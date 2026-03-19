/**
 * Pre-Hook Interceptor
 *
 * Intercepts operations (e.g., tool use) and blocks execution
 * if hallucinations are detected in the code.
 */

import { HallucinationDetector, DetectionMode } from './detector';
import { HallucinationIssue } from '../types';

/**
 * Intercept request
 */
export interface InterceptRequest {
  /** Operation being performed */
  operation: 'tool_use' | 'code_execution' | 'file_write';

  /** Code to check */
  code: string;

  /** Tool name (if operation is tool_use) */
  toolName?: string;

  /** Bypass minor issues */
  bypassMinor?: boolean;

  /** Detection mode */
  mode?: DetectionMode;
}

/**
 * Intercept result
 */
export interface InterceptResult {
  /** Whether the operation is allowed */
  allowed: boolean;

  /** Reason for blocking (if not allowed) */
  reason?: string;

  /** Detected issues */
  issues: HallucinationIssue[];

  /** Execution time */
  executionTime?: number;
}

/**
 * Pre-Hook Interceptor Configuration
 */
export interface PreHookConfig {
  /** Detector instance */
  detector: HallucinationDetector;

  /** Default detection mode */
  defaultMode?: DetectionMode;

  /** Bypass minor issues by default */
  defaultBypassMinor?: boolean;
}

/**
 * Pre-Hook Interceptor
 *
 * Checks code for hallucinations before allowing execution
 */
export class PreHookInterceptor {
  private detector: HallucinationDetector;
  private defaultMode: DetectionMode;
  private defaultBypassMinor: boolean;

  constructor(config: PreHookConfig) {
    this.detector = config.detector;
    this.defaultMode = config.defaultMode || 'fast';
    this.defaultBypassMinor = config.defaultBypassMinor || false;
  }

  /**
   * Intercept an operation and check for hallucinations
   *
   * @param request - Intercept request
   * @returns Intercept result
   */
  async intercept(request: InterceptRequest): Promise<InterceptResult> {
    const mode = request.mode || this.defaultMode;
    const bypassMinor = request.bypassMinor ?? this.defaultBypassMinor;

    // Detect hallucinations
    const result = await this.detector.detect(request.code, {
      mode,
      enableAutoFix: false
    });

    // No issues = allow
    if (!result.hasHallucinations) {
      return {
        allowed: true,
        issues: [],
        executionTime: result.executionTime
      };
    }

    // Check if we should bypass (only minor issues and bypass enabled)
    if (bypassMinor) {
      const hasCriticalOrMajor = result.issues.some(
        i => i.severity === 'critical' || i.severity === 'major'
      );

      if (!hasCriticalOrMajor) {
        return {
          allowed: true,
          issues: result.issues,
          executionTime: result.executionTime
        };
      }
    }

    // Block execution and provide reason
    const reason = this.generateBlockingReason(request, result.issues);

    return {
      allowed: false,
      reason,
      issues: result.issues,
      executionTime: result.executionTime
    };
  }

  /**
   * Generate human-readable blocking reason
   *
   * @param request - Intercept request
   * @param issues - Detected issues
   * @returns Blocking reason message
   */
  private generateBlockingReason(
    request: InterceptRequest,
    issues: HallucinationIssue[]
  ): string {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const majorCount = issues.filter(i => i.severity === 'major').length;
    const minorCount = issues.filter(i => i.severity === 'minor').length;

    const parts: string[] = [];

    // Operation context
    const operation = request.operation === 'tool_use' && request.toolName
      ? `tool "${request.toolName}"`
      : request.operation.replace('_', ' ');

    parts.push(`Blocked ${operation} due to code hallucinations detected:`);

    // Severity breakdown
    if (criticalCount > 0) {
      parts.push(`${criticalCount} critical issue(s)`);
    }
    if (majorCount > 0) {
      parts.push(`${majorCount} major issue(s)`);
    }
    if (minorCount > 0) {
      parts.push(`${minorCount} minor issue(s)`);
    }

    // Issue types
    const types = new Set(issues.map(i => i.type));
    const typeDescriptions: string[] = [];

    if (types.has('package-hallucination')) {
      typeDescriptions.push('non-existent packages');
    }
    if (types.has('function-hallucination')) {
      typeDescriptions.push('non-existent functions/APIs');
    }
    if (types.has('import-hallucination')) {
      typeDescriptions.push('invalid imports');
    }
    if (types.has('api-version-hallucination')) {
      typeDescriptions.push('incompatible API versions');
    }

    if (typeDescriptions.length > 0) {
      parts.push(`\nDetected: ${typeDescriptions.join(', ')}`);
    }

    // Top issues (max 3)
    const topIssues = issues
      .sort((a, b) => {
        const severityOrder = { critical: 0, major: 1, minor: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 3);

    if (topIssues.length > 0) {
      parts.push('\nTop issues:');
      topIssues.forEach((issue, idx) => {
        parts.push(`${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Check if code is safe to execute (convenience method)
   *
   * @param code - Code to check
   * @param mode - Detection mode
   * @returns True if safe, false if hallucinations detected
   */
  async isSafe(code: string, mode?: DetectionMode): Promise<boolean> {
    const result = await this.intercept({
      operation: 'code_execution',
      code,
      mode
    });

    return result.allowed;
  }
}
