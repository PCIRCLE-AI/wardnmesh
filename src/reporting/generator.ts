
import { SessionState, Violation } from '../rules/schema';

/**
 * Generates compliance reports from session state.
 */
export class ReportGenerator {
  /**
   * Generate a Markdown report for the session.
   */
  generateMarkdownReport(sessionState: SessionState): string {
    const startTime = new Date(sessionState.startTime);
    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMin = (durationMs / 60000).toFixed(2);
    
    const violations = sessionState.detectedViolations;
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    
    const ruleCounts = this.getRuleCounts(violations);

    let report = `# Agent Compliance Report
> Generated at: ${endTime.toISOString()}

## Session Overview
- **Start Time**: ${startTime.toISOString()}
- **Duration**: ${durationMin} minutes
- **Total Tool Calls**: ${sessionState.toolCalls.length}
- **Violations Detected**: ${violations.length}

`;

    if (violations.length === 0) {
      report += `✅ **No violations detected. Excellent work!**\n`;
    } else {
      report += `## Violation Summary\n\n`;
      report += `| Rule | Count | Severity |\n`;
      report += `|------|-------|----------|\n`;
      
      for (const [ruleName, count] of Object.entries(ruleCounts)) {
        const sample = violations.find(v => v.ruleName === ruleName);
        report += `| ${ruleName} | ${count} | ${sample?.severity || 'unknown'} |\n`;
      }
      
      report += `\n`;
    }

    if (criticalViolations.length > 0) {
      report += `## 🚨 Critical Incidents\n\n`;
      criticalViolations.forEach((v, idx) => {
        report += `### ${idx + 1}. ${v.ruleName}\n`;
        report += `- **Time**: ${v.timestamp}\n`;
        report += `- **Description**: ${v.description}\n`;
        report += `- **Tool**: ${v.context.toolName}\n`;
        if (v.context.filePath) {
          report += `- **File**: \`${v.context.filePath}\`\n`;
        }
        report += `\n`;
      });
    }

    return report;
  }

  private getRuleCounts(violations: Violation[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const v of violations) {
      counts[v.ruleName] = (counts[v.ruleName] || 0) + 1;
    }
    return counts;
  }
}
