/**
 * Enhanced Sequence Detector
 *
 * Detects violations based on tool call sequences with advanced features:
 * - Time window validation (patterns expire after maxTimeSinceMatch)
 * - State storage (storeAs/mustMatch for cross-pattern matching)
 * - Success requirement validation
 * - Multiple edits threshold (require re-read after N edits)
 */

import { BaseDetector } from './base';
import {
  ToolData,
  Violation,
  Rule,
  SequenceDetectorConfig,
  SequencePattern,
  SessionStateProvider
} from '../rules/schema';
import { getCachedRegex } from '../utils/safe-regex';

/** State storage type alias for cleaner code */
type StateStorage = Record<string, StoredMatch | undefined>;

/** Stored pattern match for time window validation */
interface StoredMatch {
  toolData: ToolData;
  timestamp: number;
  value: unknown;
}

/**
 * Enhanced Sequence Detector
 *
 * Detects tool call sequence violations with advanced pattern matching.
 */
export class SequenceDetector extends BaseDetector {
  private static readonly STATE_KEY = 'sequence_detector_state';

  getType(): string {
    return 'sequence';
  }

  /** Extract value from tool data using dot-notation path */
  private getToolValue(toolData: ToolData, path: string): unknown {
    return this.extractValue(toolData as unknown as Record<string, unknown>, path || '');
  }

  detect(
    toolData: ToolData,
    rule: Rule,
    sessionState: SessionStateProvider
  ): Violation | null {
    const config = rule.detector.config as SequenceDetectorConfig;

    // Get recent tools for sequence analysis
    const recentTools = sessionState.getRecentTools(config.lookback);

    // Add current tool to analysis
    const toolsToAnalyze = [...recentTools, toolData];

    // Try to match the sequence pattern
    const matchResult = this.matchPattern(
      toolsToAnalyze,
      config.pattern,
      sessionState
    );

    if (!matchResult.matched) {
      // Pattern not matched - check if this violates the rule
      // For sequence rules, violation occurs when:
      // 1. We have the final step of the pattern (e.g., Edit)
      // 2. But the preceding required steps are missing (e.g., Read)

      const violation = this.checkViolation(
        toolData,
        recentTools,
        config,
        rule,
        matchResult
      );

      return violation;
    }

    // Pattern matched - but still need to check advanced thresholds
    // Check multiple edits threshold even when pattern matched
    if (config.advancedChecks?.multipleEditsThreshold && toolData.toolName === 'Edit') {
      const lastStep = config.pattern[config.pattern.length - 1];
      const filePath = String(this.getToolValue(toolData, lastStep.extractPath || ''));
      const editCount = this.countRecentEdits(recentTools, filePath);

      if (editCount >= config.advancedChecks.multipleEditsThreshold) {
        return this.createViolation(rule, toolData, {
          reason: `Multiple edits (${editCount}) without re-reading file`,
          filePath,
          editCount,
          threshold: config.advancedChecks.multipleEditsThreshold
        });
      }
    }

    // Pattern matched and no threshold violations - no violation
    return null;
  }

  /**
   * Match sequence pattern against tools
   *
   * @param tools - Tools to analyze
   * @param pattern - Sequence pattern to match
   * @param sessionState - Session state for storing matches
   * @returns Match result
   */
  private matchPattern(
    tools: ToolData[],
    pattern: SequencePattern[],
    sessionState: SessionStateProvider
  ): { matched: boolean; reason?: string } {
    const state = (sessionState.getCustomState(SequenceDetector.STATE_KEY) || {}) as StateStorage;

    for (let i = 0; i < pattern.length; i++) {
      const step = pattern[i];
      const isLastStep = i === pattern.length - 1;

      if (isLastStep) {
        return this.matchLastStep(tools, step, state, sessionState);
      }

      // For non-last steps, search backwards through history
      const match = this.findMatchInHistory(tools, step, state);
      if (!match) {
        return { matched: false, reason: `Step ${i + 1} not found: tool '${step.tool}'` };
      }

      // Store match if requested
      if (step.storeAs) {
        state[step.storeAs] = match;
        sessionState.setCustomState(SequenceDetector.STATE_KEY, state);
      }
    }

    return { matched: true };
  }

  /** Match the final step of a pattern */
  private matchLastStep(
    tools: ToolData[],
    step: SequencePattern,
    state: StateStorage,
    sessionState: SessionStateProvider
  ): { matched: boolean; reason?: string } {
    const currentTool = tools[tools.length - 1];

    // Not the triggering tool - pattern not applicable yet
    if (currentTool.toolName !== step.tool) {
      return { matched: true };
    }

    // Check if must match a previous stored value
    if (step.mustMatch) {
      const storedMatch = state[step.mustMatch];
      if (!storedMatch) {
        return { matched: false, reason: `No previous match found for '${step.mustMatch}'` };
      }

      // Check time window expiration
      if (step.maxTimeSinceMatch) {
        const elapsed = Date.now() - storedMatch.timestamp;
        if (elapsed > step.maxTimeSinceMatch) {
          delete state[step.mustMatch];
          sessionState.setCustomState(SequenceDetector.STATE_KEY, state);
          return { matched: false, reason: `Previous match expired (${elapsed}ms > ${step.maxTimeSinceMatch}ms)` };
        }
      }

      // Check value match
      const currentValue = this.getToolValue(currentTool, step.extractPath || '');
      if (currentValue !== storedMatch.value) {
        return { matched: false, reason: `Value mismatch: current='${currentValue}', expected='${storedMatch.value}'` };
      }
    }

    // Check regex pattern
    if (step.matchesPattern) {
      const currentValue = this.getToolValue(currentTool, step.extractPath || '');
      // SECURITY FIX Round 15: Use getCachedRegex for ReDoS protection
      const regex = getCachedRegex(step.matchesPattern);
      if (!regex) {
        return { matched: false, reason: `Invalid or unsafe regex pattern: '${step.matchesPattern}'` };
      }
      if (!regex.test(String(currentValue))) {
        return { matched: false, reason: `Value '${currentValue}' does not match pattern '${step.matchesPattern}'` };
      }
    }

    return { matched: true };
  }

  /** Find matching tool in history */
  private findMatchInHistory(
    tools: ToolData[],
    step: SequencePattern,
    state: StateStorage
  ): StoredMatch | null {
    for (let i = tools.length - 1; i >= 0; i--) {
      const tool = tools[i];

      if (tool.toolName !== step.tool) continue;
      if (step.requireSuccess && !tool.result.success) continue;

      const value = this.getToolValue(tool, step.extractPath || '');

      // Check if must match previous stored value
      if (step.mustMatch) {
        const storedMatch = state[step.mustMatch];
        if (!storedMatch || storedMatch.value !== value) continue;
      }

      // Check regex pattern
      if (step.matchesPattern) {
        // SECURITY FIX Round 15: Use getCachedRegex for ReDoS protection
        const regex = getCachedRegex(step.matchesPattern);
        if (!regex || !regex.test(String(value))) {
          continue;  // Skip if pattern invalid or doesn't match
        }
      }

      return { toolData: tool, timestamp: new Date(tool.timestamp).getTime(), value };
    }

    return null;
  }

  /** Check if current tool violates the rule */
  private checkViolation(
    toolData: ToolData,
    tools: ToolData[],
    config: SequenceDetectorConfig,
    rule: Rule,
    matchResult: { matched: boolean; reason?: string }
  ): Violation | null {
    const lastStep = config.pattern[config.pattern.length - 1];

    // Not the triggering tool
    if (toolData.toolName !== lastStep.tool) {
      return null;
    }

    // Check if current tool matches validation pattern
    if (lastStep.matchesPattern) {
      const val = this.getToolValue(toolData, lastStep.extractPath || '');
      // SECURITY FIX Round 15: Use getCachedRegex for ReDoS protection
      const regex = getCachedRegex(lastStep.matchesPattern);
      if (!regex || !regex.test(String(val))) {
        return null; // Pattern invalid or value doesn't match trigger pattern
      }
    }

    // Check multiple edits threshold
    if (config.advancedChecks?.multipleEditsThreshold && toolData.toolName === 'Edit') {
      const filePath = String(this.getToolValue(toolData, lastStep.extractPath || ''));
      const editCount = this.countRecentEdits(tools, filePath);

      if (editCount >= config.advancedChecks.multipleEditsThreshold) {
        return this.createViolation(rule, toolData, {
          reason: `Multiple edits (${editCount}) without re-reading file`,
          filePath,
          editCount,
          threshold: config.advancedChecks.multipleEditsThreshold
        });
      }
    }

    return this.createViolation(rule, toolData, {
      reason: matchResult.reason || 'Sequence pattern not matched',
      pattern: config.pattern.map(p => p.tool).join(' → '),
      missingSteps: this.getMissingSteps(tools, config.pattern)
    });
  }

  /**
   * Count recent edits on a file
   *
   * @param tools - Tool history
   * @param filePath - File path to count edits for
   * @returns Edit count
   */
  private countRecentEdits(tools: ToolData[], filePath: string): number {
    let count = 0;
    let lastReadIndex = -1;

    // Find last Read of this file
    for (let i = tools.length - 1; i >= 0; i--) {
      const tool = tools[i];
      if (tool.toolName === 'Read' && tool.parameters.file_path === filePath) {
        lastReadIndex = i;
        break;
      }
    }

    // Count edits after last read
    const startIndex = lastReadIndex === -1 ? 0 : lastReadIndex + 1;
    for (let i = startIndex; i < tools.length; i++) {
      const tool = tools[i];
      if (tool.toolName === 'Edit' && tool.parameters.file_path === filePath) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get missing steps in pattern
   *
   * @param tools - Tool history
   * @param pattern - Sequence pattern
   * @returns Array of missing step names
   */
  private getMissingSteps(
    tools: ToolData[],
    pattern: SequencePattern[]
  ): string[] {
    const missing: string[] = [];

    for (let i = 0; i < pattern.length - 1; i++) {
      const step = pattern[i];
      const found = tools.some(tool => {
        if (tool.toolName !== step.tool) return false;
        if (step.requireSuccess && !tool.result.success) return false;
        return true;
      });

      if (!found) {
        missing.push(step.tool);
      }
    }

    return missing;
  }
}
