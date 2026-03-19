/**
 * Base Detector
 *
 * Abstract base class providing common functionality for all detectors.
 * Detectors should extend this class and implement the Detector interface from schema.ts.
 */

import { randomUUID } from 'crypto';
import { ToolData, Violation, Rule, Detector, SessionStateProvider } from '../rules/schema';
import { DANGEROUS_KEYS } from '../utils/security-constants';

/**
 * Abstract base detector class
 *
 * Provides common functionality for all detectors.
 */
export abstract class BaseDetector implements Detector {
  abstract detect(
    toolData: ToolData,
    rule: Rule,
    sessionState: SessionStateProvider
  ): Violation | null;

  abstract getType(): string;

  /**
   * Generate unique violation ID
   *
   * SECURITY FIX: Use crypto.randomUUID() instead of Math.random()
   * - Math.random() is NOT cryptographically secure (predictable, PRNG)
   * - Attacker can predict violation IDs and potentially bypass tracking
   * - crypto.randomUUID() uses cryptographically secure random number generator
   */
  protected generateViolationId(): string {
    return `violation_${randomUUID()}`;
  }

  /**
   * Create violation object
   *
   * @param rule - Rule that was violated
   * @param toolData - Tool data that caused violation
   * @param additionalInfo - Additional context information
   * @returns Violation object
   */
  protected createViolation(
    rule: Rule,
    toolData: ToolData,
    additionalInfo?: Record<string, unknown>
  ): Violation {
    return {
      id: this.generateViolationId(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      description: rule.description,
      context: {
        toolName: toolData.toolName,
        toolData,
        filePath: (toolData.parameters.file_path || toolData.parameters.TargetFile || toolData.parameters.AbsolutePath || toolData.parameters.path) as string | undefined,
        additionalInfo
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract value from object using JSON path
   *
   * SECURITY: Includes prototype pollution protection by rejecting
   * dangerous property names like __proto__, constructor, prototype.
   *
   * @param obj - Object to extract from
   * @param path - JSON path (e.g., "parameters.file_path")
   * @returns Extracted value or undefined
   */
  protected extractValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      // SECURITY: Block prototype pollution attacks
      if (DANGEROUS_KEYS.has(part)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}
