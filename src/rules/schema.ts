/**
 * Rule Schema - Core type definitions for WardnMesh rules
 *
 * This file defines the structure of compliance rules that detect
 * violations in Claude Code tool execution.
 */

/**
 * Rule categories for organization and filtering
 */
export type RuleCategory = 'workflow' | 'quality' | 'safety' | 'network_boundary';

/**
 * Severity levels for violations
 */
export type Severity = 'critical' | 'major' | 'minor';

/**
 * Detector types for violation detection
 */
export type DetectorType = 'sequence' | 'state' | 'pattern' | 'content_analysis';

/**
 * Escalation levels for violations
 */
export type EscalationLevel = 'none' | 'warning' | 'critical' | 'block';

/**
 * Detector configuration for sequence-based detection
 */
export interface SequenceDetectorConfig {
  /** Number of recent tool calls to examine */
  lookback: number;

  /** Sequence patterns to detect */
  pattern: SequencePattern[];

  /** Advanced checks (optional) */
  advancedChecks?: {
    /** Threshold for multiple edits before re-read required */
    multipleEditsThreshold?: number;

    /** Require successful tool execution */
    requireSuccessfulRead?: boolean;
  };
}

/**
 * Sequence pattern for matching tool calls
 */
export interface SequencePattern {
  /** Tool name to match */
  tool: string;

  /** JSON path to extract value from tool data */
  extractPath: string;

  /** Store extracted value with this key (for later matching) */
  storeAs?: string;

  /** Must match a previously stored value */
  mustMatch?: string;

  /** Maximum time since matched pattern (milliseconds) */
  maxTimeSinceMatch?: number;

  /** Require successful tool execution */
  requireSuccess?: boolean;

  /** Regex pattern to match value against (optional) */
  matchesPattern?: string;
}

/**
 * Detector configuration for state-based detection
 */
export interface StateDetectorConfig {
  requiredState: string;
  targetStateValue: unknown;
  trigger: {
    tool: string;
    parameterMatch?: {
      key: string;
      valuePattern: string;
    };
  };
  stateDerivation?: {
    fromTool: string;
    setState: string;
    setValue: unknown;
    validityDurationMs?: number;
  };
}

/**
 * State condition for state-based detection (Legacy/Alternative?)
 */
export interface StateCondition {
  type: 'exists' | 'not_exists' | 'equals' | 'custom';
  value?: unknown;
  predicate?: (state: Record<string, unknown>) => boolean;
}

/**
 * Detector configuration for pattern-based detection
 */
export interface PatternDetectorConfig {
  targetTool: string;
  targetParameter: string;
  patterns: {
    name: string;
    regex: string;
    description: string;
  }[];
  
  /** Patterns that, if matched, override the detection (whitelist/allowlist) */
  exceptions?: string[];
  
  // Legacy fields (optional) for compatibility if needed
  patternType?: 'excessive_usage' | 'slow_execution' | 'high_failure_rate';
  threshold?: number;
  timeWindow?: number;
}

/**
 * Detector configuration for content analysis
 */
export interface ContentAnalysisDetectorConfig {
  /** Suspicious patterns (indicate potential violation) */
  suspiciousPatterns?: RegExp[];

  /** Valid patterns (indicate no violation) */
  validPatterns?: RegExp[];

  /** Detection logic */
  logic: 'suspicious_without_valid' | 'contains_suspicious' | 'missing_valid';

  /** Minimum match count for violation */
  minMatches?: number;
}

/**
 * Generic detector configuration
 */
export type DetectorConfig =
  | SequenceDetectorConfig
  | StateDetectorConfig
  | PatternDetectorConfig
  | ContentAnalysisDetectorConfig;

/**
 * Escalation configuration
 */
export type EscalationConfig = Record<number, EscalationLevel>;

/**
 * Auto-fix configuration (Phase 2)
 */
export interface AutofixConfig {
  /** Enable auto-fix for this rule */
  enabled: boolean;

  /** CCB agent to use for auto-fix */
  agent: string;

  /** Fix strategy identifier */
  strategy: string;

  /** Strategy parameters */
  params?: Record<string, unknown>;
}

/**
 * Complete rule definition
 */
export interface Rule {
  /** Unique rule identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Rule category */
  category: RuleCategory;

  /** Violation severity */
  severity: Severity;

  /** Rule description */
  description: string;

  /** Detector configuration */
  detector: {
    type: DetectorType;
    config: DetectorConfig; 
  };

  /** Escalation configuration */
  escalation: EscalationConfig;

  /** Auto-fix configuration (optional, Phase 2) */
  autofix?: AutofixConfig;
}

/**
 * Tool execution data from Claude Code
 */
export interface ToolData {
  /** Tool name (Read, Edit, Bash, etc.) */
  toolName: string;

  /** Tool parameters */
  parameters: Record<string, unknown>;

  /** Tool execution result */
  result: ToolResult;

  /** Execution duration in milliseconds */
  duration: number;

  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Execution success */
  success: boolean;

  /** Output text (optional) */
  output?: string;

  /** Error message (optional) */
  error?: string;

  /** Additional result data */
  [key: string]: unknown;
}

/**
 * Detected violation
 */
export interface Violation {
  /** Unique violation ID */
  id: string;

  /** Rule that was violated */
  ruleId: string;

  /** Rule name */
  ruleName: string;

  /** Violation severity */
  severity: Severity;

  /** Violation description */
  description: string;

  /** Violation context */
  context: ViolationContext;

  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Violation context
 */
export interface ViolationContext {
  /** Tool name that caused violation */
  toolName: string;

  /** Full tool data */
  toolData: ToolData;

  /** Extracted file path (optional) */
  filePath?: string;

  /** Additional context information */
  additionalInfo?: Record<string, unknown>;
}

/**
 * Violation record with tracking information
 */
export interface ViolationRecord {
  /** Rule ID */
  ruleId: string;

  /** Violation count */
  count: number;

  /** First violation timestamp */
  firstViolation: string;

  /** Last violation timestamp */
  lastViolation: string;

  /** Violation history */
  history: ViolationEvent[];

  /** Current escalation level */
  escalationLevel: EscalationLevel;
}

/**
 * Violation event in history
 */
export interface ViolationEvent {
  /** The violation */
  violation: Violation;

  /** Event timestamp */
  timestamp: string;

  /** Action taken */
  action: 'detected' | 'warned' | 'critical' | 'blocked';
}

/**
 * Session state
 */
export interface SessionState {
  /** Session start time */
  startTime: string;

  /** All tool calls in this session */
  toolCalls: ToolData[];

  /** Recent tools (sliding window for sequence detection) */
  recentTools: ToolData[];

  /** Detected violations in this session */
  detectedViolations: Violation[];

  /** Current file being worked on (optional) */
  currentFile?: string;

  /** Custom state storage */
  customState: Record<string, unknown>;
}

/**
 * Session State Provider Interface
 *
 * Minimal interface for session state access needed by detectors.
 * SessionStateManager implements this interface.
 */
export interface SessionStateProvider {
  /** Get recent tool calls (sliding window) */
  getRecentTools(count: number): ToolData[];

  /** Get custom state value by key */
  getCustomState(key: string): unknown;

  /** Set custom state value */
  setCustomState(key: string, value: unknown): void;
}

/**
 * Detector Interface
 */
export interface Detector {
  detect(toolData: ToolData, rule: Rule, sessionState: SessionStateProvider): Violation | null;
  getType(): string;
}
