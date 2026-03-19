import { Rule, EscalationConfig } from '../rules/schema';
import { ViolationRecord } from './tracker';
import { EscalationLevel } from './notifier';

export class Escalator {
  /**
   * Determine the escalation level for a violation
   */
  escalate(rule: Rule, record: ViolationRecord): EscalationLevel {
    const count = record.violationCount;
    const config = rule.escalation;
    
    // Check for Block (highest priority)
    // Typically 5 violations
    const blockThreshold = this.findThreshold(config, 'block');
    if (blockThreshold && count >= blockThreshold) {
      return EscalationLevel.BLOCK;
    }
    
    // Check for Critical
    // Typically 3 violations
    const criticalThreshold = this.findThreshold(config, 'critical');
    if (criticalThreshold && count >= criticalThreshold) {
      return EscalationLevel.CRITICAL;
    }
    
    // Default to Warning (or whatever is set for 1)
    // Typically 1 violation
    return EscalationLevel.WARNING;
  }
  
  private findThreshold(config: EscalationConfig, level: string): number | null {
    const thresholds = Object.entries(config)
      .filter(([_, value]) => value === level)
      .map(([key, _]) => parseInt(key, 10))
      .sort((a, b) => a - b);
      
    return thresholds.length > 0 ? thresholds[0] : null;
  }
}
