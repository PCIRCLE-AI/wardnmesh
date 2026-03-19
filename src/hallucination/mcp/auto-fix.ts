/**
 * Auto-Fixer
 *
 * Applies automatic fixes to hallucinated code based on detected issues.
 */

import { HallucinationIssue, AutoFix } from '../types';

/**
 * Fix change record
 */
export interface FixChange {
  /** Type of change */
  type: string;

  /** Description of change */
  description: string;

  /** Original code fragment */
  original: string;

  /** Fixed code fragment */
  fixed: string;

  /** Line number (if applicable) */
  line?: number;

  /** Additional data */
  data?: Record<string, any>;
}

/**
 * Fix result
 */
export interface FixResult {
  /** Whether fixes were applied */
  applied: boolean;

  /** Fixed code (if applied) */
  fixedCode?: string;

  /** List of changes made */
  changes: FixChange[];

  /** Issues that couldn't be auto-fixed */
  unfixableIssues: HallucinationIssue[];
}

/**
 * Fix options
 */
export interface FixOptions {
  /** Dry run (don't actually apply changes) */
  dryRun?: boolean;

  /** Only fix critical issues */
  onlyCritical?: boolean;

  /** Maximum number of fixes to apply */
  maxFixes?: number;
}

/**
 * Auto-Fixer
 *
 * Automatically fixes hallucinated code
 */
export class AutoFixer {
  /**
   * Fix hallucinated code
   *
   * @param code - Original code
   * @param issues - Detected issues
   * @param options - Fix options
   * @returns Fix result
   */
  async fix(
    code: string,
    issues: HallucinationIssue[],
    options?: FixOptions
  ): Promise<FixResult> {
    const dryRun = options?.dryRun || false;
    const onlyCritical = options?.onlyCritical || false;
    const maxFixes = options?.maxFixes || Infinity;

    const changes: FixChange[] = [];
    const unfixableIssues: HallucinationIssue[] = [];

    // Filter issues based on options
    let issuesToFix = issues;
    if (onlyCritical) {
      issuesToFix = issues.filter(i => i.severity === 'critical');
    }

    // Sort by severity (critical first)
    issuesToFix = issuesToFix.sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Apply fixes
    let fixedCode = code;
    let fixCount = 0;

    for (const issue of issuesToFix) {
      if (fixCount >= maxFixes) {
        unfixableIssues.push(issue);
        continue;
      }

      // Check if issue has auto-fix available
      if (!issue.autoFix) {
        unfixableIssues.push(issue);
        continue;
      }

      // Apply fix based on type
      const change = await this.applyFix(fixedCode, issue);

      if (change) {
        changes.push(change);
        if (!dryRun) {
          fixedCode = change.fixed;
        }
        fixCount++;
      } else {
        unfixableIssues.push(issue);
      }
    }

    return {
      applied: changes.length > 0 && !dryRun,
      fixedCode: changes.length > 0 ? fixedCode : code,
      changes,
      unfixableIssues
    };
  }

  /**
   * Apply a single fix
   *
   * @param code - Current code
   * @param issue - Issue to fix
   * @returns Fix change record
   */
  private async applyFix(
    code: string,
    issue: HallucinationIssue
  ): Promise<FixChange | null> {
    if (!issue.autoFix) {
      return null;
    }

    const { type, data } = issue.autoFix;
    const description = data.description || 'Auto-fix';

    switch (type) {
      case 'remove-import':
        return this.removeImport(code, issue);

      case 'comment-out':
        return this.commentOut(code, issue);

      case 'replace':
        return this.replace(code, issue);

      case 'remove-line':
        return this.removeLine(code, issue);

      default:
        return null;
    }
  }

  /**
   * Remove import statement
   *
   * @param code - Original code
   * @param issue - Issue with import to remove
   * @returns Fix change
   */
  private removeImport(
    code: string,
    issue: HallucinationIssue
  ): FixChange | null {
    // Extract package name from message
    const packageMatch = issue.message.match(/Package "([^"]+)"/);
    if (!packageMatch) {
      return null;
    }

    const packageName = packageMatch[1];

    // Find and remove the import line
    const lines = code.split('\n');
    const importRegex = new RegExp(`import\\s+.*from\\s+['"\`]${packageName}['"\`]`);

    const fixedLines = lines.filter(line => !importRegex.test(line));
    const removedLine = lines.find(line => importRegex.test(line));

    if (!removedLine) {
      return null;
    }

    return {
      type: 'remove-import',
      description: `Remove import from "${packageName}"`,
      original: removedLine,
      fixed: fixedLines.join('\n'),
      line: issue.location?.line
    };
  }

  /**
   * Comment out problematic code
   *
   * @param code - Original code
   * @param issue - Issue to comment out
   * @returns Fix change
   */
  private commentOut(
    code: string,
    issue: HallucinationIssue
  ): FixChange | null {
    if (!issue.location?.line) {
      return null;
    }

    const lines = code.split('\n');
    const lineIndex = issue.location.line - 1;

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return null;
    }

    const original = lines[lineIndex];
    const commented = `// FIXME: Hallucinated API - ${original.trim()}`;

    lines[lineIndex] = commented;

    return {
      type: 'comment-out',
      description: `Comment out line ${issue.location.line}`,
      original,
      fixed: lines.join('\n'),
      line: issue.location.line
    };
  }

  /**
   * Replace code with fix
   *
   * @param code - Original code
   * @param issue - Issue with replacement
   * @returns Fix change
   */
  private replace(
    code: string,
    issue: HallucinationIssue
  ): FixChange | null {
    if (!issue.autoFix?.data?.code) {
      return null;
    }

    const replacement = issue.autoFix.data.code;

    // For now, just append replacement as a comment
    // In a real implementation, this would do intelligent replacement
    const fixedCode = code + '\n\n// Suggested fix:\n' + replacement;

    return {
      type: 'replace',
      description: issue.autoFix.data.description || 'Replace with suggested code',
      original: code,
      fixed: fixedCode
    };
  }

  /**
   * Remove a specific line
   *
   * @param code - Original code
   * @param issue - Issue with line to remove
   * @returns Fix change
   */
  private removeLine(
    code: string,
    issue: HallucinationIssue
  ): FixChange | null {
    if (!issue.location?.line) {
      return null;
    }

    const lines = code.split('\n');
    const lineIndex = issue.location.line - 1;

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return null;
    }

    const original = lines[lineIndex];
    lines.splice(lineIndex, 1);

    return {
      type: 'remove-line',
      description: `Remove line ${issue.location.line}`,
      original,
      fixed: lines.join('\n'),
      line: issue.location.line
    };
  }

  /**
   * Preview fixes without applying them
   *
   * @param code - Original code
   * @param issues - Detected issues
   * @returns Fix preview (dry run)
   */
  async preview(
    code: string,
    issues: HallucinationIssue[]
  ): Promise<FixResult> {
    return this.fix(code, issues, { dryRun: true });
  }
}
