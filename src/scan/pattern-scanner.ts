import type { Scanner, ScanResult, ScanContext, ViolationInfo } from '../interfaces/scan';
import type { Rule } from '../rules/schema';
import { getCachedRegex } from '../utils/safe-regex';
import { logger } from '../logging/logger';

export class PatternScanner implements Scanner {
  readonly name = 'PatternScanner';
  readonly phase: 'pre-exec' | 'stdin' | 'stdout';

  private rules: Rule[];

  constructor(rules: Rule[], phase: 'pre-exec' | 'stdin' | 'stdout' = 'stdout') {
    this.rules = rules;
    this.phase = phase;
  }

  scan(content: string, _context: ScanContext): ScanResult {
    const start = performance.now();

    for (const rule of this.rules) {
      if (rule.detector.type !== 'pattern') continue;

      const config = rule.detector.config as { patterns: Array<{ regex: string; description: string }> };
      if (!config.patterns) continue;

      for (const pattern of config.patterns) {
        const regex = getCachedRegex(pattern.regex, 'i');
        if (!regex) continue;

        if (regex.test(content)) {
          const violation: ViolationInfo = {
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            matchedPattern: pattern.regex,
            contentPreview: content.slice(0, 200),
          };

          return {
            violation,
            scanDurationMs: performance.now() - start,
            scannerType: 'content',
          };
        }
      }
    }

    return {
      violation: null,
      scanDurationMs: performance.now() - start,
      scannerType: 'content',
    };
  }

  getRuleCount(): number {
    return this.rules.length;
  }
}
