import { Rule, RuleCategory, Severity, PatternDetectorConfig } from './schema';
import { getCachedRegex } from '../utils/safe-regex';
import { logger } from '../logging/logger';

interface FlatThreatRule {
  id: string;
  pattern: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  enabled: boolean;
}

const SEVERITY_MAP: Record<string, Severity> = {
  critical: 'critical',
  high: 'critical',
  medium: 'major',
  low: 'minor',
};

const CATEGORY_MAP: Record<string, RuleCategory> = {
  'code-injection': 'safety',
  'command-injection': 'safety',
  'data-exfiltration': 'safety',
  'privilege-escalation': 'safety',
  'network': 'network_boundary',
  'supply-chain': 'safety',
};

/**
 * Convert PCRE-style (?i) inline flag to JS-compatible pattern.
 * JS RegExp doesn't support inline flags — use the 'i' flag parameter instead.
 */
function normalizePattern(pattern: string): string {
  return pattern.replace(/^\(\?i\)/i, '');
}

export function adaptThreatRule(raw: FlatThreatRule): Rule | null {
  // Normalize PCRE-style (?i) inline flags to JS flags
  const normalizedPattern = normalizePattern(raw.pattern);

  // Validate regex
  const regex = getCachedRegex(normalizedPattern, 'i');
  if (!regex) {
    logger.warn('rules.adapter', `Invalid regex in rule ${raw.id}, skipping`, { pattern: raw.pattern });
    return null;
  }

  const severity = SEVERITY_MAP[raw.severity] || 'minor';
  const category = CATEGORY_MAP[raw.category] || 'safety';

  return {
    id: raw.id,
    name: raw.description,
    category,
    severity,
    description: raw.description,
    detector: {
      type: 'pattern',
      config: {
        targetTool: 'any',
        targetParameter: 'content',
        patterns: [{
          name: raw.id,
          regex: normalizedPattern,
          description: raw.description,
        }],
      } as PatternDetectorConfig,
    },
    escalation: { 1: 'warning', 2: 'critical', 3: 'block' },
  };
}

export function adaptAllRules(rules: FlatThreatRule[]): { valid: Rule[]; skipped: string[] } {
  const valid: Rule[] = [];
  const skipped: string[] = [];

  for (const raw of rules) {
    if (!raw.enabled) {
      skipped.push(`${raw.id} (disabled)`);
      continue;
    }
    const adapted = adaptThreatRule(raw);
    if (adapted) {
      valid.push(adapted);
    } else {
      skipped.push(`${raw.id} (invalid regex)`);
    }
  }

  logger.info('rules.adapter', `Adapted ${valid.length} rules, skipped ${skipped.length}`);
  return { valid, skipped };
}
