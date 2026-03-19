/**
 * Scan Pipeline Interfaces
 */

export interface ScanResult {
  violation: ViolationInfo | null;
  scanDurationMs: number;
  scannerType: 'command' | 'content';
}

export interface ViolationInfo {
  ruleId: string;
  ruleName: string;
  category: string;
  severity: 'critical' | 'major' | 'minor';
  matchedPattern: string;
  contentPreview: string; // truncated to 200 chars, PII scrubbed
}

export interface ScanContext {
  projectDir: string;
  sessionId: string;
  command?: string;
}

export interface Scanner {
  readonly name: string;
  readonly phase: 'pre-exec' | 'stdin' | 'stdout';
  scan(content: string, context: ScanContext): ScanResult;
}
