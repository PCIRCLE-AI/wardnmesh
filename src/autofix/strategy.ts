import { Rule, Violation } from '../rules/schema';

/**
 * Represents a planned fix action
 */
export interface FixPlan {
  /** Description of what the fix will do */
  description: string;

  /** The tool to execute */
  tool: string;

  /** Arguments for the tool */
  args: Record<string, unknown>;

  /** Type of fix: local (simple tool) or agent (delegated) */
  type: 'local' | 'agent';
}

export class AutoFixStrategyMapper {
  /**
   * Determine the best fix for a given violation
   */
  getFix(violation: Violation, rule: Rule): FixPlan | null {
    if (!rule.autofix?.enabled) {
      return null;
    }

    const strategy = rule.autofix.strategy;

    switch (strategy) {
      case 'read_before_edit': {
        const filePath = violation.context.filePath;
        
        if (!filePath) {
            return null;
        }

        return {
          description: `Read file ${filePath} before editing.`,
          tool: 'view_file',
          args: { AbsolutePath: filePath }, // Using AbsolutePath to match view_file tool signature
          type: 'local'
        };
      }

      case 'remove_secrets': {
        const filePath = violation.context.filePath;
        if (!filePath) {
            return null;
        }
        
        return {
          description: `Delegate to Security Agent: Remove hardcoded secrets from ${filePath}.`,
          tool: 'delegate_task',
          args: { 
            agent: rule.autofix.agent || 'security-butler',
            task: `Remove hardcoded secrets from ${filePath}. Create a .env file if necessary and use process.env.`
          },
          type: 'agent'
        };
      }

      case 'run_tests':
        return {
          description: 'Run project tests to verify changes.',
          tool: 'run_command',
          args: { command: 'npm test' },
          type: 'local'
        };
      


      default:
        console.warn(`Unknown autofix strategy: ${strategy}`);
        return null;
    }
  }
}
