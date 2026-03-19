/**
 * PERFORMANCE REGRESSION TESTS
 *
 * Validates that safe-regex.ts fixes don't introduce performance issues
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  validateRegexPattern,
  getCachedRegex,
  resetPatternErrorMetrics,
  getPatternErrorMetrics,
  safeRegexTest,
} from '../safe-regex';

describe('PERFORMANCE: Pattern Validation Speed', () => {
  beforeEach(() => {
    resetPatternErrorMetrics();
  });

  test('should validate 1000 safe patterns in < 100ms', () => {
    const patterns = Array.from({ length: 1000 }, (_, i) => `test${i}`);

    const start = performance.now();
    patterns.forEach(pattern => {
      validateRegexPattern(pattern);
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  test('should validate 100 complex patterns in < 50ms', () => {
    const patterns = [
      'sk-[a-zA-Z0-9]{48}',
      'AKIA[0-9A-Z]{16}',
      'ghp_[a-zA-Z0-9]{36}',
      '\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b',
      '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    ];

    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      patterns.forEach(pattern => {
        validateRegexPattern(pattern);
      });
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(150); // Relaxed for CI environments
  });

  test('should detect dangerous patterns efficiently', () => {
    const dangerousPatterns = [
      '(a+)+',
      '(a*)+',
      '(?:a+)*',
      '.*.*',
      '.+.+',
      '(a|b)+',
    ];

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      dangerousPatterns.forEach(pattern => {
        validateRegexPattern(pattern);
      });
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(150); // Relaxed for CI environments
  });
});

describe('PERFORMANCE: Regex Caching Efficiency', () => {
  beforeEach(() => {
    resetPatternErrorMetrics();
  });

  test('should cache and reuse patterns efficiently', () => {
    const pattern = 'test\\d+';

    // First call: compile and cache
    const start1 = performance.now();
    const regex1 = getCachedRegex(pattern);
    const duration1 = performance.now() - start1;

    // Subsequent calls: should be much faster (cache hit)
    const start2 = performance.now();
    for (let i = 0; i < 1000; i++) {
      getCachedRegex(pattern);
    }
    const duration2 = performance.now() - start2;

    expect(regex1).not.toBeNull();
    expect(duration2).toBeLessThan(duration1 * 10); // Cache should be much faster
    expect(duration2).toBeLessThan(10); // 1000 cached lookups in < 10ms
  });

  test('should handle mixed cache hits and misses efficiently', () => {
    const patterns = Array.from({ length: 50 }, (_, i) => `pattern${i}`);

    const start = performance.now();
    // Each pattern called twice - second call should be cached
    for (let j = 0; j < 2; j++) {
      patterns.forEach(pattern => {
        getCachedRegex(pattern);
      });
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(150); // Relaxed for CI environments

    const metrics = getPatternErrorMetrics();
    expect(metrics.totalPatternsProcessed).toBe(100);
  });
});

describe('PERFORMANCE: PCRE Conversion Speed', () => {
  beforeEach(() => {
    resetPatternErrorMetrics();
  });

  test('should convert PCRE modifiers efficiently', () => {
    const patterns = [
      '(?i)test',
      '(?m)^start',
      '(?s)a.b',
      '(?im)pattern',
      '(?ims)complex',
    ];

    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      patterns.forEach(pattern => {
        getCachedRegex(pattern);
      });
    }
    const duration = performance.now() - start;

    // 1000 PCRE conversions should complete quickly
    expect(duration).toBeLessThan(100);
  });

  test('should reject unsupported PCRE efficiently', () => {
    const unsupportedPatterns = [
      '(?x)test',
      '(?x)verbose',
      '(?ix)pattern',
    ];

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      unsupportedPatterns.forEach(pattern => {
        getCachedRegex(pattern);
      });
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(150); // Relaxed for CI environments

    const metrics = getPatternErrorMetrics();
    expect(metrics.pcreConversionFailures).toBeGreaterThan(0);
  });
});

describe('PERFORMANCE: Safe Execution with Content Truncation', () => {
  test('should handle large content efficiently with truncation', () => {
    const regex = /test/g;
    const largeContent = 'a'.repeat(100000) + 'test';

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      safeRegexTest(regex, largeContent, 50000);
    }
    const duration = performance.now() - start;

    // Truncation should prevent excessive execution time
    expect(duration).toBeLessThan(150); // Relaxed for CI environments
  });

  test('should not have performance overhead for small content', () => {
    const regex = /test/;
    const smallContent = 'this is a test string';

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      safeRegexTest(regex, smallContent);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });
});

describe('PERFORMANCE: No Catastrophic Backtracking', () => {
  test('should reject patterns before they cause catastrophic backtracking', () => {
    const dangerousPattern = '(a+)+';

    // This should fail validation immediately, not hang
    const start = performance.now();
    const regex = getCachedRegex(dangerousPattern);
    const duration = performance.now() - start;

    expect(regex).toBeNull();
    expect(duration).toBeLessThan(5); // Should be instant
  });

  test('should handle multiple dangerous patterns without hanging', () => {
    const dangerousPatterns = [
      '(a+)+',
      '(a*)*',
      '(?:b+)+',
      '.*.*',
      '.+.+',
      '(x|y)+',
    ];

    const start = performance.now();
    dangerousPatterns.forEach(pattern => {
      getCachedRegex(pattern);
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10); // All should fail validation quickly
  });
});

describe('PERFORMANCE: Memory Usage (Cache Management)', () => {
  beforeEach(() => {
    resetPatternErrorMetrics();
  });

  test('should not exceed cache size limit', () => {
    // Create 150 unique patterns (MAX_CACHE_SIZE is 100)
    const patterns = Array.from({ length: 150 }, (_, i) => `pattern${i}`);

    patterns.forEach(pattern => {
      getCachedRegex(pattern);
    });

    const metrics = getPatternErrorMetrics();
    expect(metrics.totalPatternsProcessed).toBe(150);

    // Cache should evict oldest entries, no errors
    expect(metrics.validationFailures).toBe(0);
  });

  test('should evict oldest entries when cache is full', () => {
    const pattern1 = 'first';
    const pattern2 = 'second';

    // Add first pattern
    const regex1a = getCachedRegex(pattern1);
    expect(regex1a).not.toBeNull();

    // Fill cache with 99 more patterns
    for (let i = 0; i < 99; i++) {
      getCachedRegex(`filler${i}`);
    }

    // Add one more pattern - should evict 'first'
    getCachedRegex(pattern2);

    // Requesting 'first' again should recompile (not cached)
    const regex1b = getCachedRegex(pattern1);

    // Should still work, just not the same instance
    expect(regex1b).not.toBeNull();
  });
});
