/**
 * Shared Test Utilities for Agent Guard
 *
 * Common factories, mocks, and helpers used across integration tests.
 * Consolidates duplicated patterns for consistency and maintainability.
 */

import { performance } from 'perf_hooks';
import type { SessionStateManager } from '../src/state/session';
import type { Rule, ToolData, SequenceDetectorConfig, Severity } from '../src/rules/schema';

/**
 * Creates a mock SessionStateManager with configurable recent tools.
 */
export function createMockSessionState(
  recentTools: ToolData[] = [],
  customState: Record<string, unknown> = {}
): SessionStateManager {
  return {
    getRecentTools: jest.fn().mockReturnValue(recentTools),
    getCustomState: jest.fn().mockReturnValue(customState),
    setCustomState: jest.fn(),
    addViolation: jest.fn(),
  } as unknown as SessionStateManager;
}

/**
 * Creates ToolData for testing.
 */
export function createToolData(
  toolName: string,
  parameters: Record<string, unknown> = {},
  options: {
    success?: boolean;
    timestamp?: string;
    duration?: number;
    output?: string;
  } = {}
): ToolData {
  const { success = true, timestamp, duration = 100, output = '' } = options;

  return {
    toolName,
    parameters,
    result: { success, output },
    duration,
    timestamp: timestamp || new Date().toISOString(),
  };
}

/**
 * Creates a sequence detection rule for testing.
 */
export function createSequenceRule(
  config: Partial<SequenceDetectorConfig>,
  options: {
    id?: string;
    name?: string;
    severity?: Severity;
    description?: string;
  } = {}
): Rule {
  const {
    id = 'test-rule',
    name = 'Test Sequence Rule',
    severity = 'minor',
    description = 'Test rule for sequence detection',
  } = options;

  return {
    id,
    name,
    description,
    severity,
    category: 'workflow',
    detector: {
      type: 'sequence',
      config: {
        lookback: 10,
        pattern: [],
        ...config,
      } as SequenceDetectorConfig,
    },
    escalation: {},
  };
}

/**
 * Measures execution time of a function.
 * Returns both the result and duration in milliseconds.
 */
export function measureTime<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Creates a timestamp offset from now by the given milliseconds.
 * Negative values create timestamps in the past.
 */
export function createTimestamp(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

/**
 * Standard Read -> Edit sequence pattern configuration.
 * Common pattern used in multiple tests.
 */
export const READ_EDIT_PATTERN: SequenceDetectorConfig['pattern'] = [
  { tool: 'Read', extractPath: 'parameters.file_path', storeAs: 'filePath' },
  { tool: 'Edit', extractPath: 'parameters.file_path', mustMatch: 'filePath' },
];

/**
 * Creates a Bash tool data with a command.
 */
export function createBashTool(
  command: string,
  options: { success?: boolean; timestamp?: string } = {}
): ToolData {
  return createToolData('Bash', { command }, options);
}

/**
 * Creates a Read tool data with a file path.
 */
export function createReadTool(
  filePath: string,
  options: { success?: boolean; timestamp?: string } = {}
): ToolData {
  return createToolData('Read', { file_path: filePath }, options);
}

/**
 * Creates an Edit tool data with a file path.
 */
export function createEditTool(
  filePath: string,
  options: { success?: boolean; timestamp?: string } = {}
): ToolData {
  return createToolData('Edit', { file_path: filePath }, options);
}

/**
 * Creates a NotifyUser tool data with a message.
 */
export function createNotifyUserTool(
  message: string,
  options: { success?: boolean; timestamp?: string } = {}
): ToolData {
  return createToolData('NotifyUser', { message }, options);
}

/**
 * Creates a mock RuleRegistry for testing.
 */
export function createMockRuleRegistry(enabledRules: Rule[] = []) {
  return {
    getEnabledRules: jest.fn().mockReturnValue(enabledRules),
    getAllRules: jest.fn().mockReturnValue(enabledRules),
    isRuleEnabled: jest.fn().mockReturnValue(true),
    loadRules: jest.fn(),
  };
}

/**
 * Creates a generic pattern rule for testing.
 */
export function createPatternRule(
  pattern: string | RegExp,
  options: {
    id?: string;
    name?: string;
    severity?: Severity;
    description?: string;
    targetTool?: string;
    targetField?: string;
  } = {}
): Rule {
  const {
    id = 'test-pattern-rule',
    name = 'Test Pattern Rule',
    severity = 'minor',
    description = 'Test rule for pattern detection',
    targetTool = '*',
    targetField = 'parameters',
  } = options;

  return {
    id,
    name,
    description,
    severity,
    category: 'safety',
    detector: {
      type: 'pattern',
      config: {
        targetTool,
        targetParameter: targetField,
        patterns: [{
          name: 'test-pattern',
          regex: pattern instanceof RegExp ? pattern.source : pattern,
          description: 'Test pattern',
        }],
      },
    },
    escalation: {},
  };
}

/**
 * Creates a Write tool data with file path and content.
 */
export function createWriteTool(
  filePath: string,
  content: string = '',
  options: { success?: boolean; timestamp?: string } = {}
): ToolData {
  return createToolData('Write', { file_path: filePath, content }, options);
}
