
import { Rule, RuleCategory, Severity } from '../../schema';

export const NO_INCOMPLETE_WORK: Rule = {
  id: 'NO_INCOMPLETE_WORK',
  name: 'No Incomplete Work',
  description: 'Detects incomplete work markers (TODO, FIXME) in code being written.',
  category: 'quality' as RuleCategory,
  severity: 'minor' as Severity,
  detector: {
    type: 'content_analysis',
    config: {
      logic: 'contains_suspicious',
      suspiciousPatterns: [
        /TODO:/i,
        /FIXME:/i,
        /implement this/i
      ],
      minMatches: 1
    }
  },
  escalation: {
    1: 'warning',
    3: 'critical'
  }
};
