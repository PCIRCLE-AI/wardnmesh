/**
 * Safe Regex Utilities - ReDoS Prevention
 *
 * Provides regex validation and safe execution with timeout protection.
 */

import { logger } from "./logger";

// Patterns that are known to cause catastrophic backtracking
// SECURITY FIX: Detect dangerous patterns in BOTH non-capturing (?...) AND capturing (...) groups
// VULNERABILITY (v1): Required `\?` which only matched (?...) groups, missing dangerous (...) groups
// FIX (v2): Remove `\?` requirement to catch all dangerous nested quantifiers
const DANGEROUS_PATTERNS = [
  /\([^)]*\+[^)]*\)\+/, // Nested quantifiers: (...+...)+  or (?...+...)+
  /\([^)]*\*[^)]*\)\+/, // Nested quantifiers: (...*...)+  or (?...*...)+
  /\([^)]*\+[^)]*\)\*/, // Nested quantifiers: (...+...)* or (?...+...)*
  /\([^)]*\*[^)]*\)\*/, // Nested quantifiers: (...*...)* or (?...*...)*
  /\([^)]+\)\{[0-9]+,\}/, // Unbounded repetition of groups: (...){10,}
  /\.\*\.\*/, // Multiple greedy wildcards: .*.*
  /\.\+\.\+/, // Multiple greedy wildcards: .+.+
  /\([^)]*\|[^)]*\)\+/, // Alternation with quantifier: (a|b)+
  /\([^)]*\|[^)]*\)\*/, // Alternation with quantifier: (a|b)*
];

// Maximum allowed regex pattern length
const MAX_PATTERN_LENGTH = 1000;

// Maximum allowed quantifier value
const MAX_QUANTIFIER = 100;

export interface RegexValidationResult {
  valid: boolean;
  error?: string;
}

export interface PCREConversionResult {
  pattern: string;
  flags: string;
  converted: boolean;
  error?: string;
}

/**
 * Convert PCRE inline modifiers to JavaScript flags
 * Handles: (?i), (?m), (?s), (?x), and combinations like (?im)
 */
export function convertPCREModifiers(pattern: string): PCREConversionResult {
  let convertedPattern = pattern;
  let flags = "";
  let converted = false;

  // Match PCRE inline modifiers: (?i), (?m), (?s), (?im), etc.
  const pcreModifierRegex = /\(\?([imsx]+)\)/g;
  const matches = [...pattern.matchAll(pcreModifierRegex)];

  if (matches.length === 0) {
    return { pattern, flags: "", converted: false };
  }

  const unsupportedModifiers: string[] = [];
  const flagSet = new Set<string>();

  for (const match of matches) {
    const modifiers = match[1];

    for (const modifier of modifiers) {
      switch (modifier) {
        case "i": // Case insensitive - supported
          flagSet.add("i");
          break;
        case "m": // Multiline - supported
          flagSet.add("m");
          break;
        case "s": // Dotall - supported in ES2018+
          flagSet.add("s");
          break;
        case "x": // Extended/verbose - NOT supported in JavaScript
          unsupportedModifiers.push("x (extended/verbose)");
          break;
        default:
          unsupportedModifiers.push(modifier);
      }
    }

    // Remove the PCRE modifier from pattern
    convertedPattern = convertedPattern.replace(match[0], "");
    converted = true;
  }

  if (unsupportedModifiers.length > 0) {
    return {
      pattern: convertedPattern,
      flags: "",
      converted: false,
      error: `Unsupported PCRE modifiers: ${unsupportedModifiers.join(", ")}`,
    };
  }

  flags = Array.from(flagSet).join("");

  return {
    pattern: convertedPattern,
    flags,
    converted: true,
  };
}

/**
 * Validate a regex pattern for potential ReDoS vulnerabilities
 */
export function validateRegexPattern(pattern: string): RegexValidationResult {
  // Check pattern length
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      valid: false,
      error: `Pattern exceeds maximum length of ${MAX_PATTERN_LENGTH} characters`,
    };
  }

  // Check for dangerous patterns
  for (const dangerous of DANGEROUS_PATTERNS) {
    if (dangerous.test(pattern)) {
      return {
        valid: false,
        error: "Pattern contains potentially dangerous nested quantifiers",
      };
    }
  }

  // Check for large quantifiers like {1000,}
  const quantifierMatch = pattern.match(/\{(\d+)(,(\d*))?\}/g);
  if (quantifierMatch) {
    for (const q of quantifierMatch) {
      const nums = q.match(/\d+/g);
      if (nums) {
        for (const num of nums) {
          if (parseInt(num, 10) > MAX_QUANTIFIER) {
            return {
              valid: false,
              error: `Quantifier value ${num} exceeds maximum of ${MAX_QUANTIFIER}`,
            };
          }
        }
      }
    }
  }

  // Try to compile the regex to catch syntax errors
  try {
    new RegExp(pattern);
  } catch (e) {
    return {
      valid: false,
      error: `Invalid regex syntax: ${e instanceof Error ? e.message : "Unknown error"}`,
    };
  }

  return { valid: true };
}

/**
 * Cached regex instances to avoid recompilation
 */
const regexCache = new Map<string, RegExp>();
const MAX_CACHE_SIZE = 100;

/**
 * Pattern error metrics for monitoring
 */
export interface PatternErrorMetrics {
  pcreConversionFailures: number;
  validationFailures: number;
  regexCompilationFailures: number;
  totalPatternsProcessed: number;
}

const errorMetrics: PatternErrorMetrics = {
  pcreConversionFailures: 0,
  validationFailures: 0,
  regexCompilationFailures: 0,
  totalPatternsProcessed: 0,
};

/**
 * Get current pattern error metrics
 */
export function getPatternErrorMetrics(): Readonly<PatternErrorMetrics> {
  return { ...errorMetrics };
}

/**
 * Reset pattern error metrics (useful for testing)
 */
export function resetPatternErrorMetrics(): void {
  errorMetrics.pcreConversionFailures = 0;
  errorMetrics.validationFailures = 0;
  errorMetrics.regexCompilationFailures = 0;
  errorMetrics.totalPatternsProcessed = 0;
}

/**
 * Get a cached regex instance or create a new one
 */
export function getCachedRegex(pattern: string, flags: string = ""): RegExp | null {
  errorMetrics.totalPatternsProcessed++;

  // Convert PCRE modifiers first
  const pcreResult = convertPCREModifiers(pattern);

  // SECURITY FIX: Check for PCRE conversion errors
  // VULNERABILITY (v1): Condition `converted && error` was always false when error exists
  //   - When unsupported modifiers found: converted=false, error=truthy
  //   - Condition: false && truthy = false (check skipped!)
  // FIX (v2): Check error first, regardless of converted status
  if (pcreResult.error) {
    // Unsupported PCRE modifiers - skip this pattern
    errorMetrics.pcreConversionFailures++;
    logger.warn(`Skipping pattern with unsupported PCRE modifiers: ${pcreResult.error}`);
    return null;
  }

  // Use converted pattern and merge flags
  const finalPattern = pcreResult.pattern;
  const finalFlags = pcreResult.converted
    ? pcreResult.flags + flags // PCRE flags + explicit flags
    : flags;

  const cacheKey = `${finalPattern}:${finalFlags}`;

  if (regexCache.has(cacheKey)) {
    return regexCache.get(cacheKey)!;
  }

  const validation = validateRegexPattern(finalPattern);
  if (!validation.valid) {
    errorMetrics.validationFailures++;
    logger.warn(`Unsafe regex pattern rejected: ${validation.error}`);
    return null;
  }

  try {
    const regex = new RegExp(finalPattern, finalFlags);

    // Evict oldest entries if cache is full
    if (regexCache.size >= MAX_CACHE_SIZE) {
      const firstKey = regexCache.keys().next().value;
      if (firstKey) regexCache.delete(firstKey);
    }

    regexCache.set(cacheKey, regex);
    return regex;
  } catch {
    errorMetrics.regexCompilationFailures++;
    return null;
  }
}

/**
 * Execute regex with content length limit
 */
export function safeRegexExec(
  regex: RegExp,
  content: string,
  maxLength: number = 50000
): RegExpExecArray | null {
  // Truncate content if too long
  const safeContent = content.length > maxLength ? content.substring(0, maxLength) : content;
  return regex.exec(safeContent);
}

/**
 * Safe regex test with content length limit
 */
export function safeRegexTest(
  regex: RegExp,
  content: string,
  maxLength: number = 50000
): boolean {
  const safeContent = content.length > maxLength ? content.substring(0, maxLength) : content;
  return regex.test(safeContent);
}

/**
 * Create a safe regex with validation
 * Throws error if pattern is unsafe
 */
export function createSafeRegex(pattern: string, flags: string = ""): RegExp {
  const validation = validateRegexPattern(pattern);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid regex pattern");
  }
  return new RegExp(pattern, flags);
}

/**
 * Validate multiple regex patterns
 */
export function validateRegexPatterns(patterns: string[]): RegexValidationResult {
  for (const pattern of patterns) {
    const result = validateRegexPattern(pattern);
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}
