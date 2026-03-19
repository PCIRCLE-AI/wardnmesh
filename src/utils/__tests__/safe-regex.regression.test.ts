/**
 * REGRESSION TEST SUITE - Round 5 Fixes
 *
 * Validates that Round 4-5 security fixes don't introduce regressions:
 * 1. Regex validation (ReDoS prevention)
 * 2. PCRE modifier conversion
 * 3. Pattern caching
 * 4. Error handling
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  validateRegexPattern,
  validateRegexPatterns,
  createSafeRegex,
  convertPCREModifiers,
  getCachedRegex,
  getPatternErrorMetrics,
  resetPatternErrorMetrics,
  safeRegexTest,
  safeRegexExec,
} from '../safe-regex';

describe('REGRESSION: Regex Validation', () => {
  beforeEach(() => {
    resetPatternErrorMetrics();
  });

  describe('Edge Cases - Pattern Length', () => {
    test('should accept empty string', () => {
      const result = validateRegexPattern('');
      expect(result.valid).toBe(true);
    });

    test('should accept pattern at exactly max length (1000 chars)', () => {
      const pattern = 'a'.repeat(1000);
      const result = validateRegexPattern(pattern);
      expect(result.valid).toBe(true);
    });

    test('should reject pattern over max length (1001 chars)', () => {
      const pattern = 'a'.repeat(1001);
      const result = validateRegexPattern(pattern);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });
  });

  describe('Edge Cases - Valid Patterns', () => {
    const validPatterns = [
      // Simple patterns
      'test',
      '^start',
      'end$',
      '[a-z]+',
      '\\d{1,10}',

      // Common threat detection patterns
      'sk-[a-zA-Z0-9]{48}',
      'AKIA[0-9A-Z]{16}',
      'ghp_[a-zA-Z0-9]{36}',

      // Non-capturing groups (should be allowed)
      '(?:test)',
      '(?:foo|bar)',
      '(?:abc)+',

      // Lookahead/lookbehind
      '(?=test)',
      '(?!test)',
      '(?<=test)',
      '(?<!test)',
    ];

    test.each(validPatterns)('should accept valid pattern: %s', (pattern) => {
      const result = validateRegexPattern(pattern);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('Edge Cases - Dangerous Patterns', () => {
    const dangerousPatterns = [
      // Catastrophic backtracking
      { pattern: '(a+)+b', reason: 'nested quantifiers' },
      { pattern: '(a*)+b', reason: 'nested quantifiers' },
      { pattern: '(a+)*b', reason: 'nested quantifiers' },
      { pattern: '(a*)*b', reason: 'nested quantifiers' },

      // Multiple greedy wildcards
      { pattern: '.*.*', reason: 'multiple wildcards' },
      { pattern: '.+.+', reason: 'multiple wildcards' },

      // Large quantifiers
      { pattern: 'a{101,}', reason: 'exceeds maximum' },
      { pattern: 'a{999}', reason: 'exceeds maximum' },
    ];

    test.each(dangerousPatterns)('should reject dangerous pattern: $pattern ($reason)', ({ pattern }) => {
      const result = validateRegexPattern(pattern);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Edge Cases - Invalid Syntax', () => {
    const invalidPatterns = [
      '[z-a]',      // Invalid range
      '(?P<name>)', // Python named groups
      '(abc',       // Unclosed group
      'abc)',       // Unmatched closing
    ];

    test.each(invalidPatterns)('should reject invalid syntax: %s', (pattern) => {
      const result = validateRegexPattern(pattern);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid regex syntax');
    });
  });

  describe('Batch Validation', () => {
    test('should validate all patterns when all valid', () => {
      const patterns = ['test', '^start', 'end$'];
      const result = validateRegexPatterns(patterns);
      expect(result.valid).toBe(true);
    });

    test('should fail on first invalid pattern', () => {
      const patterns = ['test', '(a+)+', 'valid'];
      const result = validateRegexPatterns(patterns);
      expect(result.valid).toBe(false);
    });

    test('should handle empty array', () => {
      const result = validateRegexPatterns([]);
      expect(result.valid).toBe(true);
    });
  });
});

describe('REGRESSION: PCRE Modifier Conversion', () => {
  test('should handle no modifiers (pass through)', () => {
    const result = convertPCREModifiers('test');
    expect(result.pattern).toBe('test');
    expect(result.flags).toBe('');
    expect(result.converted).toBe(false);
  });

  test('should convert (?i) to i flag', () => {
    const result = convertPCREModifiers('(?i)test');
    expect(result.pattern).toBe('test');
    expect(result.flags).toBe('i');
    expect(result.converted).toBe(true);
  });

  test('should convert (?m) to m flag', () => {
    const result = convertPCREModifiers('(?m)^start');
    expect(result.pattern).toBe('^start');
    expect(result.flags).toBe('m');
    expect(result.converted).toBe(true);
  });

  test('should convert (?s) to s flag', () => {
    const result = convertPCREModifiers('(?s)a.b');
    expect(result.pattern).toBe('a.b');
    expect(result.flags).toBe('s');
    expect(result.converted).toBe(true);
  });

  test('should convert (?im) to im flags', () => {
    const result = convertPCREModifiers('(?im)test');
    expect(result.pattern).toBe('test');
    expect(result.flags).toContain('i');
    expect(result.flags).toContain('m');
    expect(result.converted).toBe(true);
  });

  test('should reject unsupported (?x) modifier', () => {
    const result = convertPCREModifiers('(?x)test');
    expect(result.converted).toBe(false);
    expect(result.error).toContain('Unsupported PCRE modifiers');
    expect(result.error).toContain('x (extended/verbose)');
  });

  test('should preserve non-capturing groups (?:...)', () => {
    const result = convertPCREModifiers('(?:foo|bar)');
    expect(result.pattern).toBe('(?:foo|bar)');
    expect(result.flags).toBe('');
    expect(result.converted).toBe(false);
  });

  test('should handle multiple PCRE modifiers', () => {
    const result = convertPCREModifiers('(?i)test(?m)pattern');
    expect(result.converted).toBe(true);
    expect(result.flags).toContain('i');
    expect(result.flags).toContain('m');
  });
});

describe('REGRESSION: Regex Caching', () => {
  beforeEach(() => {
    resetPatternErrorMetrics();
  });

  test('should cache valid regex', () => {
    const regex1 = getCachedRegex('test', 'i');
    const regex2 = getCachedRegex('test', 'i');

    expect(regex1).toBe(regex2); // Same instance
    expect(regex1).not.toBeNull();
  });

  test('should return null for dangerous pattern', () => {
    const regex = getCachedRegex('(a+)+');
    expect(regex).toBeNull();

    const metrics = getPatternErrorMetrics();
    expect(metrics.validationFailures).toBe(1);
  });

  test('should convert PCRE and cache', () => {
    const regex = getCachedRegex('(?i)test');
    expect(regex).not.toBeNull();
    expect(regex?.flags).toContain('i');
  });

  test('should reject unsupported PCRE modifiers', () => {
    const regex = getCachedRegex('(?x)test');
    expect(regex).toBeNull();

    const metrics = getPatternErrorMetrics();
    expect(metrics.pcreConversionFailures).toBe(1);
  });

  test('should track error metrics correctly', () => {
    getCachedRegex('valid'); // Success
    getCachedRegex('(a+)+'); // Validation failure
    getCachedRegex('(?x)test'); // PCRE conversion failure

    const metrics = getPatternErrorMetrics();
    expect(metrics.totalPatternsProcessed).toBe(3);
    expect(metrics.validationFailures).toBe(1);
    expect(metrics.pcreConversionFailures).toBe(1);
  });
});

describe('REGRESSION: Safe Execution', () => {
  test('should truncate long content in test()', () => {
    const regex = /test/;
    const longContent = 'a'.repeat(100000) + 'test';

    // Should not throw, should truncate
    const result = safeRegexTest(regex, longContent, 50000);
    expect(result).toBe(false); // 'test' is beyond truncation point
  });

  test('should truncate long content in exec()', () => {
    const regex = /test/;
    const longContent = 'a'.repeat(100000) + 'test';

    const result = safeRegexExec(regex, longContent, 50000);
    expect(result).toBeNull(); // 'test' is beyond truncation point
  });

  test('should handle normal content without truncation', () => {
    const regex = /test/;
    const content = 'this is a test string';

    const testResult = safeRegexTest(regex, content);
    expect(testResult).toBe(true);

    const execResult = safeRegexExec(regex, content);
    expect(execResult).not.toBeNull();
    expect(execResult?.[0]).toBe('test');
  });
});

describe('REGRESSION: createSafeRegex', () => {
  test('should create regex for valid pattern', () => {
    const regex = createSafeRegex('test', 'i');
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex.flags).toBe('i');
  });

  test('should throw for dangerous pattern', () => {
    expect(() => {
      createSafeRegex('(a+)+');
    }).toThrow('dangerous');
  });

  test('should throw for invalid syntax', () => {
    expect(() => {
      createSafeRegex('[z-a]');
    }).toThrow('Invalid regex');
  });

  test('should throw for oversized pattern', () => {
    const pattern = 'a'.repeat(1001);
    expect(() => {
      createSafeRegex(pattern);
    }).toThrow('exceeds maximum length');
  });
});

describe('REGRESSION: Real-world Threat Patterns', () => {
  // These are actual patterns from threat_rules database
  const threatPatterns = [
    { name: 'OpenAI API Key', pattern: 'sk-[a-zA-Z0-9]{48}', test: 'sk-AbC123xyz789AbC123xyz789AbC123xyz789AbC123xyzABC' },
    { name: 'AWS Access Key', pattern: 'AKIA[0-9A-Z]{16}', test: 'AKIAIOSFODNN7EXAMPLE' },
    { name: 'GitHub PAT', pattern: 'ghp_[a-zA-Z0-9]{36}', test: 'ghp_AbCdEfGhIjKlMnOpQrStUvWxYz012345abcd' },
    { name: 'IPv4', pattern: '\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b', test: '192.168.1.1' },
    { name: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', test: 'test@example.com' },
  ];

  test.each(threatPatterns)('should validate $name pattern', ({ pattern }) => {
    const result = validateRegexPattern(pattern);
    expect(result.valid).toBe(true);
  });

  test.each(threatPatterns)('should compile $name pattern', ({ pattern, test: testValue }) => {
    const regex = createSafeRegex(pattern);
    expect(regex.test(testValue)).toBe(true);
  });
});
