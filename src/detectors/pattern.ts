import { BaseDetector } from './base';
import { ToolData, Violation, Rule, SessionStateProvider } from '../rules/schema';
import { createSafeRegex } from '../utils/safe-regex';
import { getValueByPath } from '../utils/object-path';

interface PatternConfig {
  targetTool: string;
  targetParameter: string;
  patterns: {
    name: string;
    regex: string; // Regex string
    description: string;
  }[];
  exceptions?: string[]; // Allowed patterns (whitelist)
}

export class PatternDetector extends BaseDetector {
  getType(): string {
    return 'pattern';
  }

  detect(toolData: ToolData, rule: Rule, _sessionState: SessionStateProvider): Violation | null {
    const config = rule.detector.config as PatternConfig;

    // 1. Check if this is the target tool (e.g., "Edit" or "write_to_file")
    if (toolData.toolName !== config.targetTool) {
      return null;
    }

    // 2. Extract content to scan
    const content = getValueByPath(toolData.parameters as Record<string, unknown>, config.targetParameter);
    if (!content || typeof content !== 'string') {
      return null;
    }

    // 3. Scan for patterns
    for (const pattern of config.patterns) {
      // SECURITY FIX (MAJOR-3): Use safe regex creation to prevent ReDoS
      // Pattern validation occurs in rule validator, but we use createSafeRegex as defense-in-depth
      let regex: RegExp;
      try {
        regex = createSafeRegex(pattern.regex, 'g'); // Global search
      } catch (error) {
        console.error(`Skipping unsafe pattern "${pattern.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }

      const match = regex.exec(content);

      if (match) {
        // Check exceptions (also using safe regex creation)
        if (config.exceptions) {
             const isWhitelisted = config.exceptions.some(ex => {
               try {
                 return createSafeRegex(ex, 'i').test(content);
               } catch {
                 console.error(`Skipping unsafe exception pattern: ${ex}`);
                 return false;
               }
             });
             if (isWhitelisted) continue;
        }

        // Found a violation (e.g. a secret)
        // We redact the actual secret in the violation context for safety
        const redactedMatch = match[0].substring(0, 4) + '***...';

        return this.createViolation(rule, toolData, {
            message: `Detected sensitive pattern: ${pattern.name} (${pattern.description}). Found: ${redactedMatch}`,
            redactedParams: { ...toolData.parameters, [config.targetParameter]: '<REDACTED_CONTENT>' }
        });
      }
    }

    return null;
  }
}
