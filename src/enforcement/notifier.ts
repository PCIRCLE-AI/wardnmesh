import chalk from 'chalk';
import { Violation } from '../rules/schema';

export enum EscalationLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  BLOCK = 'block'
}

export class Notifier {
  /**
   * Notify the user of a violation
   */
  notify(violation: Violation, level: EscalationLevel): void {
    const message = this.formatMessage(violation, level);
    
    // We use console.error for all notifications to ensure they appear 
    // in the tool output stream properly, but formatted distinctly
    console.error(message);
  }

  /**
   * Format the notification message based on severity
   */
  private formatMessage(violation: Violation, level: EscalationLevel): string {
    const header = this.getHeader(level);
    const box = this.createBox(violation.ruleName, violation.description, header, level);
    return box;
  }

  private getHeader(level: EscalationLevel): string {
    switch (level) {
      case EscalationLevel.INFO:
        return chalk.blue('ℹ️  AGENT BUTLER INFO');
      case EscalationLevel.WARNING:
        return chalk.yellow('⚠️  COMPLIANCE WARNING');
      case EscalationLevel.CRITICAL:
        return chalk.red('🚨 CRITICAL VIOLATION');
      case EscalationLevel.BLOCK:
        return chalk.bgRed.white.bold(' ⛔ ACTION BLOCKED ');
      default:
        return chalk.blue('AGENT BUTLER');
    }
  }

  private createBox(title: string, message: string, header: string, level: EscalationLevel): string {
    const width = 60;
    const borderChar = '─';
    const border = borderChar.repeat(width);
    
    const colorMap: Record<EscalationLevel, typeof chalk.blue> = {
      [EscalationLevel.INFO]: chalk.blue,
      [EscalationLevel.WARNING]: chalk.yellow,
      [EscalationLevel.CRITICAL]: chalk.red,
      [EscalationLevel.BLOCK]: chalk.red,
    };
    const colorFn = colorMap[level] ?? chalk.blue;

    // Word wrap message simply for now
    // In a real implementation, would use a proper word-wrap library
    
    return `
${colorFn('┌' + border + '┐')}
${colorFn('│')} ${header.padEnd(width - 2)} ${colorFn('│')}
${colorFn('├' + border + '┤')}
${colorFn('│')} ${chalk.bold(title).padEnd(width - 2)} ${colorFn('│')}
${colorFn('│')} ${' '.repeat(width - 2)} ${colorFn('│')}
${colorFn('│')} ${message.padEnd(width - 2)} ${colorFn('│')}
${colorFn('└' + border + '┘')}
`;
  }
}
