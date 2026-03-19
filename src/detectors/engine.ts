/**
 * DetectorEngine - Orchestrates all detectors for real-time content analysis
 *
 * This engine manages multiple detector instances and coordinates their execution
 * for comprehensive threat detection in agent communications.
 */

import { ToolData, Violation, Rule } from '../rules/schema';
import { getRuleRegistry } from '../rules/registry';
import { getSessionStateManager, SessionStateManager } from '../state/session';
import { BaseDetector } from './base';
import { StateDetector } from './state';
import { SequenceDetector } from './sequence';
import { ContentAnalysisDetector } from './content-analysis';

export class DetectorEngine {
  private static instance: DetectorEngine | null = null;
  private detectors: Map<string, BaseDetector>;
  private stateDetector: StateDetector;
  private sequenceDetector: SequenceDetector;
  private contentAnalysisDetector: ContentAnalysisDetector;
  private sessionState: SessionStateManager;

  private constructor() {
    this.detectors = new Map();
    this.stateDetector = new StateDetector();
    this.sequenceDetector = new SequenceDetector();
    this.contentAnalysisDetector = new ContentAnalysisDetector();
    this.sessionState = getSessionStateManager();

    // Register detectors by type
    this.detectors.set('state', this.stateDetector as unknown as BaseDetector);
    this.detectors.set('sequence', this.sequenceDetector as unknown as BaseDetector);
    this.detectors.set('content_analysis', this.contentAnalysisDetector as unknown as BaseDetector);
  }

  static getInstance(): DetectorEngine {
    if (!DetectorEngine.instance) {
      DetectorEngine.instance = new DetectorEngine();
    }
    return DetectorEngine.instance;
  }

  /**
   * Analyze tool data against all enabled rules
   * Returns the first violation found (fail-fast for critical security)
   */
  analyze(toolData: ToolData): Violation | null {
    const registry = getRuleRegistry();
    const enabledRules = registry.getEnabledRules();

    for (const rule of enabledRules) {
      const violation = this.detectWithRule(toolData, rule);
      if (violation) {
        // For critical/block severity, return immediately
        if (violation.severity === 'critical') {
          return violation;
        }
      }
    }

    return null;
  }

  /**
   * Analyze tool data with a specific rule
   */
  detectWithRule(toolData: ToolData, rule: Rule): Violation | null {
    const detectorType = rule.detector.type;

    switch (detectorType) {
      case 'state':
        return this.stateDetector.detect(toolData, rule);
      case 'sequence':
        return this.sequenceDetector.detect(toolData, rule, this.sessionState);
      case 'content_analysis':
        return this.contentAnalysisDetector.detect(toolData, rule, this.sessionState);
      default:
        // Pattern detection is handled separately in ActiveDefense.scanCommand
        return null;
    }
  }

  /**
   * Reset all stateful detectors (useful for session boundaries)
   */
  reset(): void {
    // SequenceDetector tracks sequences across tool calls
    // Reset for new session if needed
  }

  /**
   * Get detector statistics for telemetry
   */
  getStats(): Record<string, number> {
    return {
      registeredDetectors: this.detectors.size,
      activeRules: getRuleRegistry().getEnabledRules().length,
    };
  }
}
