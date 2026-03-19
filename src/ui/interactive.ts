import inquirer from 'inquirer';
import { FixPlan } from '../autofix/strategy';
import chalk from 'chalk';

export class InteractiveUI {
  async askToFix(plan: FixPlan): Promise<boolean> {
    // Check if we are in an interactive session
    if (!process.stdin.isTTY) {
      console.log(chalk.yellow('⚠️  Non-interactive mode detected. Auto-fix suggestion skipped.'));
      console.log(`Suggestion: ${plan.description} (Run '${plan.tool}')`);
      return false;
    }

    console.log('\n');
    console.log(chalk.blue('🔧 Auto-Fix Available:'));
    console.log(chalk.bold(plan.description));
    console.log(chalk.dim(`Action: ${plan.tool} ${JSON.stringify(plan.args)}`));
    console.log('\n');

    try {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'applyFix',
          message: 'Would you like to apply this fix now?',
          default: true
        }
      ]);

      return answers.applyFix;
    } catch (error) {
      console.error('Failed to prompt user:', error);
      return false;
    }
  }

  async askForVerification(ruleName: string, severity: string, info: string): Promise<{ authorized: boolean; feedback?: 'true_positive' | 'false_positive' }> {
    if (!process.stdin.isTTY) {
      return { authorized: false }; // Secure default
    }

    console.log('\n');
    console.log(chalk.red('⚠️  Security Alert Triggered'));
    console.log(`${chalk.bold('Rule:')} ${ruleName}`);
    console.log(`${chalk.bold('Severity:')} ${severity.toUpperCase()}`);
    console.log(`${chalk.gray(info)}`);
    console.log('\n');

    try {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'How do you want to proceed?',
          choices: [
            { name: '🚫 Block Action (Confirm Threat)', value: 'block_confirm' },
            { name: '🛑 Block Action (Unsure)', value: 'block_unsure' },
            { name: '✅ Allow & Mark as Safe (False Positive)', value: 'allow_fp' },
            { name: '⚠️  Allow Once (I know what I am doing)', value: 'allow_once' }
          ]
        }
      ]);

      switch (action) {
        case 'block_confirm':
          return { authorized: false, feedback: 'true_positive' };
        case 'block_unsure':
          return { authorized: false };
        case 'allow_fp':
          return { authorized: true, feedback: 'false_positive' };
        case 'allow_once':
          return { authorized: true, feedback: 'true_positive' }; // Technically knowing it's risky implies it's a true positive logic-wise, or just neutral. Let's say feedback is optional here.
        default:
          return { authorized: false };
      }
    } catch (error) {
      console.error('Interaction failed:', error);
      return { authorized: false };
    }
  }
}
