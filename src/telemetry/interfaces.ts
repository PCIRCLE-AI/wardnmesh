/**
 * Telemetry Event Definitions
 */

export type EventType = 
  | 'session_start'
  | 'rule_triggered'
  | 'autofix_action'
  | 'threat_detected'
  | 'user_feedback'
  | 'error';

export interface BaseTelemetryEvent {
  /** Event name (e.g., 'agent_guard_rule_triggered') */
  event: string;
  /** Properties of the event */
  properties: Record<string, unknown>;
  /** Timestamp (ISO string) */
  timestamp?: string;
}

/**
 * Triggered when WardnMesh starts
 */
export interface SessionStartEvent extends BaseTelemetryEvent {
  event: 'agent_guard_session_start';
  properties: {
    version: string;
    nodeVersion: string;
    os: string;
    enabledRulesCount: number;
  };
}

/**
 * Triggered when a rule violation is detected
 */
export interface RuleTriggeredEvent extends BaseTelemetryEvent {
  event: 'agent_guard_rule_triggered';
  properties: {
    ruleId: string;
    category: string;
    severity: string;
    toolName: string;
    /** Whether the action was blocked */
    blocked: boolean;
    /** Snapshot of the input/content that triggered the rule (redacted) */
    snapshot?: string;
  };
}

/**
 * Triggered when Auto-Fix is attempted or completed
 */
export interface AutoFixEvent extends BaseTelemetryEvent {
  event: 'agent_guard_autofix_action';
  properties: {
    ruleId: string;
    strategy: string;
    /** 'proposed', 'accepted', 'rejected', 'failed', 'succeeded' */
    status: string; 
  };
}

/**
 * Triggered when high-confidence threat signature is found (Phase 4/5)
 */
export interface ThreatDetectedEvent extends BaseTelemetryEvent {
  event: 'agent_guard_threat_detected';
  properties: {
    source: 'mcp_tool' | 'user_input' | 'file_read';
    vector: 'prompt_injection' | 'exfiltration' | 'malicious_package';
    /** Anonymized signature hash or scrubbed snippet */
    signature: string;
  };
}

/**
 * Triggered when user provides feedback on a violation
 */
export interface FeedbackEvent extends BaseTelemetryEvent {
  event: 'agent_guard_user_feedback';
  properties: {
    ruleId: string;
    /** 'true_positive' (Real Threat) | 'false_positive' (False Alarm) */
    verdict: 'true_positive' | 'false_positive';
    /** 'local' (User Config) | 'global' (Security Rule) */
    ruleSource: 'local' | 'global';
    /** Optional comment or reason */
    comment?: string;
  };
}
