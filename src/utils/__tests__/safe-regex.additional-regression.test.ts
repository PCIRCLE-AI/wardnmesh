/**
 * ADDITIONAL REGRESSION TESTS
 *
 * Validates edge cases and potential false positives from Round 4-5 fixes:
 * 1. Fix #1: Dangerous pattern detection (lines 10-17)
 * 2. Fix #2: PCRE error detection (lines 210-220)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  validateRegexPattern,
  convertPCREModifiers,
  getCachedRegex,
  resetPatternErrorMetrics,
  getPatternErrorMetrics,
} from '../safe-regex';

describe('FIX #1 REGRESSION: Dangerous Pattern Detection', () => {
  beforeEach(() => {
    resetPatternErrorMetrics();
  });

  describe('Should REJECT: Dangerous Patterns (Both Capturing and Non-Capturing)', () => {
    const dangerousPatterns = [
      // Capturing groups with nested quantifiers
      { pattern: '(a+)+', description: 'capturing group with nested +' },
      { pattern: '(a*)+', description: 'capturing group with nested *' },
      { pattern: '(a+)*', description: 'capturing group with nested quantifiers' },
      { pattern: '(a*)*', description: 'capturing group with double *' },

      // Non-capturing groups with nested quantifiers
      { pattern: '(?:a+)+', description: 'non-capturing group with nested +' },
      { pattern: '(?:a*)+', description: 'non-capturing group with nested *' },
      { pattern: '(?:a+)*', description: 'non-capturing group with nested quantifiers' },
      { pattern: '(?:a*)*', description: 'non-capturing group with double *' },

      // Real-world dangerous patterns
      { pattern: '(.*)*test', description: 'nested wildcards in capturing group' },
      { pattern: '(?:.*)*test', description: 'nested wildcards in non-capturing group' },
      { pattern: '(a|b)+test', description: 'alternation with quantifier in capturing group' },
      { pattern: '(?:a|b)*test', description: 'alternation with quantifier in non-capturing group' },
    ];

    test.each(dangerousPatterns)(
      'should REJECT $description: $pattern',
      ({ pattern }) => {
        const result = validateRegexPattern(pattern);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('dangerous');
      }
    );
  });

  describe('Should ACCEPT: Safe Patterns (No False Positives)', () => {
    const safePatterns = [
      // Single quantifiers (no nesting)
      { pattern: 'a+', description: 'simple quantifier without groups' },
      { pattern: 'test*', description: 'simple * without groups' },
      { pattern: '[a-z]+', description: 'character class with quantifier' },

      // Groups without nested quantifiers
      { pattern: '(test)', description: 'capturing group without quantifier' },
      { pattern: '(?:test)', description: 'non-capturing group without quantifier' },
      { pattern: '(abc)+', description: 'group with single quantifier (safe)' },
      { pattern: '(?:abc)*', description: 'non-capturing group with single quantifier' },

      // Lookahead/lookbehind (should not be flagged)
      { pattern: '(?=test)', description: 'positive lookahead' },
      { pattern: '(?!test)', description: 'negative lookahead' },
      { pattern: '(?<=test)', description: 'positive lookbehind' },
      { pattern: '(?<!test)', description: 'negative lookbehind' },

      // Real-world safe patterns from threat detection
      { pattern: 'sk-[a-zA-Z0-9]{48}', description: 'OpenAI API key pattern' },
      { pattern: 'AKIA[0-9A-Z]{16}', description: 'AWS access key pattern' },
      { pattern: '\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b', description: 'IPv4 pattern' },

      // Complex but safe patterns
      { pattern: '(?:foo|bar)', description: 'alternation without quantifier' },
      { pattern: '(abc){2,5}', description: 'bounded quantifier (safe limit)' },
      { pattern: '(?:test){1,10}', description: 'bounded repetition in non-capturing group' },
    ];

    test.each(safePatterns)(
      'should ACCEPT $description: $pattern',
      ({ pattern }) => {
        const result = validateRegexPattern(pattern);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    );
  });

  describe('Performance: Should Handle Edge Cases', () => {
    test('should reject deeply nested quantifiers', () => {
      const pattern = '((a+)+)+';
      const result = validateRegexPattern(pattern);
      expect(result.valid).toBe(false);
    });

    test('should accept bounded quantifiers (no ReDoS risk)', () => {
      const pattern = '(abc){1,10}';
      const result = validateRegexPattern(pattern);
      expect(result.valid).toBe(true);
    });

    test('should reject unbounded group repetition', () => {
      const pattern = '(test){10,}';
      const result = validateRegexPattern(pattern);
      expect(result.valid).toBe(false);
      // Note: Caught by generic dangerous pattern check, not specific message
      expect(result.error).toContain('dangerous');
    });
  });
});

describe('FIX #2 REGRESSION: PCRE Error Detection Logic', () => {
  beforeEach(() => {
    resetPatternErrorMetrics();
  });

  describe('Should REJECT: Unsupported PCRE Modifiers', () => {
    test('should reject (?x) extended/verbose modifier', () => {
      const result = convertPCREModifiers('(?x)test');

      expect(result.converted).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unsupported PCRE modifiers');
      expect(result.error).toContain('x (extended/verbose)');
    });

    test('should not convert unknown PCRE-like patterns', () => {
      // (?z) doesn't match PCRE modifier regex /\(\?([imsx]+)\)/
      // So it's just passed through as-is (not an error at conversion stage)
      const result = convertPCREModifiers('(?z)test');

      expect(result.converted).toBe(false);
      expect(result.pattern).toBe('(?z)test'); // Unchanged
      expect(result.flags).toBe('');
      // No error at conversion stage - will be caught by regex validation if invalid
      expect(result.error).toBeUndefined();
    });

    test('getCachedRegex should return null for unsupported PCRE', () => {
      const regex = getCachedRegex('(?x)test');

      expect(regex).toBeNull();

      const metrics = getPatternErrorMetrics();
      expect(metrics.pcreConversionFailures).toBe(1);
      expect(metrics.totalPatternsProcessed).toBe(1);
    });
  });

  describe('Should ACCEPT: Supported PCRE Modifiers', () => {
    test('should convert (?i) case-insensitive modifier', () => {
      const result = convertPCREModifiers('(?i)test');

      expect(result.converted).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.flags).toBe('i');
      expect(result.pattern).toBe('test');
    });

    test('should convert (?m) multiline modifier', () => {
      const result = convertPCREModifiers('(?m)^start');

      expect(result.converted).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.flags).toBe('m');
    });

    test('should convert (?s) dotall modifier', () => {
      const result = convertPCREModifiers('(?s)a.b');

      expect(result.converted).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.flags).toBe('s');
    });

    test('should convert combined modifiers (?ims)', () => {
      const result = convertPCREModifiers('(?ims)test');

      expect(result.converted).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.flags).toContain('i');
      expect(result.flags).toContain('m');
      expect(result.flags).toContain('s');
    });

    test('getCachedRegex should cache converted PCRE patterns', () => {
      const regex1 = getCachedRegex('(?i)test');
      const regex2 = getCachedRegex('(?i)test');

      expect(regex1).not.toBeNull();
      expect(regex1).toBe(regex2); // Same cached instance
      expect(regex1?.flags).toContain('i');
    });
  });

  describe('Error Metrics Tracking', () => {
    test('should track PCRE conversion failures correctly', () => {
      getCachedRegex('(?x)test'); // Unsupported PCRE - conversion failure
      getCachedRegex('(?z)pattern'); // Not a PCRE modifier, passes through to validation - validation failure

      const metrics = getPatternErrorMetrics();
      expect(metrics.pcreConversionFailures).toBe(1); // Only (?x) is PCRE conversion failure
      expect(metrics.validationFailures).toBe(1); // (?z) fails at validation stage
      expect(metrics.totalPatternsProcessed).toBe(2);
    });

    test('should track validation failures separately from PCRE failures', () => {
      getCachedRegex('(a+)+'); // Dangerous pattern (validation failure)
      getCachedRegex('(?x)test'); // Unsupported PCRE (conversion failure)

      const metrics = getPatternErrorMetrics();
      expect(metrics.validationFailures).toBe(1);
      expect(metrics.pcreConversionFailures).toBe(1);
      expect(metrics.totalPatternsProcessed).toBe(2);
    });

    test('should not increment errors for valid patterns', () => {
      getCachedRegex('valid');
      getCachedRegex('(?i)test');

      const metrics = getPatternErrorMetrics();
      expect(metrics.validationFailures).toBe(0);
      expect(metrics.pcreConversionFailures).toBe(0);
      expect(metrics.totalPatternsProcessed).toBe(2);
    });
  });
});

describe('EDGE CASE: PCRE vs Non-Capturing Groups', () => {
  test('should preserve non-capturing groups (?:...)', () => {
    const result = convertPCREModifiers('(?:foo|bar)');

    expect(result.pattern).toBe('(?:foo|bar)');
    expect(result.flags).toBe('');
    expect(result.converted).toBe(false); // Not a PCRE modifier
    expect(result.error).toBeUndefined();
  });

  test('should convert PCRE modifier but preserve non-capturing groups', () => {
    const result = convertPCREModifiers('(?i)(?:foo|bar)');

    expect(result.pattern).toBe('(?:foo|bar)');
    expect(result.flags).toBe('i');
    expect(result.converted).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('should handle lookahead assertions (not PCRE modifiers)', () => {
    const patterns = [
      '(?=test)',  // Positive lookahead
      '(?!test)',  // Negative lookahead
      '(?<=test)', // Positive lookbehind
      '(?<!test)', // Negative lookbehind
    ];

    patterns.forEach(pattern => {
      const result = convertPCREModifiers(pattern);
      expect(result.pattern).toBe(pattern);
      expect(result.converted).toBe(false);
      expect(result.error).toBeUndefined();
    });
  });
});

describe('PERFORMANCE: Large-scale Pattern Processing', () => {
  beforeEach(() => {
    resetPatternErrorMetrics();
  });

  test('should handle 100 valid patterns efficiently', () => {
    const start = Date.now();

    for (let i = 0; i < 100; i++) {
      const regex = getCachedRegex(`test${i}`);
      expect(regex).not.toBeNull();
    }

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200); // Should complete in < 200ms (relaxed for CI stability)

    const metrics = getPatternErrorMetrics();
    expect(metrics.totalPatternsProcessed).toBe(100);
    expect(metrics.validationFailures).toBe(0);
  });

  test('should cache and reuse patterns', () => {
    const pattern = 'test';
    const iterations = 1000;

    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      getCachedRegex(pattern);
    }
    const duration = Date.now() - start;

    // Caching should make this very fast
    expect(duration).toBeLessThan(50); // Should complete in < 50ms

    const metrics = getPatternErrorMetrics();
    expect(metrics.totalPatternsProcessed).toBe(iterations);
  });
});
