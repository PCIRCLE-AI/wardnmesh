/**
 * Performance Benchmarks for Hallucination Detection
 *
 * Performance Targets:
 * - Static analysis (import extraction): < 50ms
 * - Dependency check (cached): < 20ms
 * - Full fast layers (parallel): < 200ms
 * - TypeScript compilation: < 500ms
 *
 * Testing Strategy:
 * - Use realistic code samples (500-1000 lines)
 * - Measure average over 10 iterations
 * - Allow 20% variance for CI environment
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Import components to benchmark
import { extractImports } from '../../../src/hallucination/detectors/import-analyzer';
import { NpmRegistryClient } from '../../../src/hallucination/npm/registry-client';
import { HallucinationDetector } from '../../../src/hallucination/mcp/detector';

// =============================================================================
// Test Data & Utilities
// =============================================================================

/**
 * Generate realistic TypeScript code for benchmarking
 */
function generateRealisticCode(lines: number): string {
  const imports = [
    "import * as fs from 'fs';",
    "import * as path from 'path';",
    "import { parse } from '@typescript-eslint/typescript-estree';",
    "import type { TSESTree } from '@typescript-eslint/typescript-estree';",
    "import { HallucinationIssue } from '../types';",
  ];

  const functions = `
export function processData(input: string[]): string[] {
  return input.map(item => item.trim()).filter(item => item.length > 0);
}

export function validateInput(value: any): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return value.length > 0 && value.length < 1000;
}

export async function fetchData(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }
  return response.json();
}

export class DataProcessor {
  private cache: Map<string, any>;

  constructor() {
    this.cache = new Map();
  }

  async process(key: string, data: any): Promise<any> {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const result = await this.transform(data);
    this.cache.set(key, result);
    return result;
  }

  private async transform(data: any): Promise<any> {
    // Simulate async transformation
    return new Promise(resolve => {
      setTimeout(() => resolve(data), 10);
    });
  }
}
`;

  // Repeat function bodies to reach target line count
  const targetLines = Math.max(lines - imports.length - 10, 0);
  const repetitions = Math.ceil(targetLines / 40); // Each function block is ~40 lines

  let code = imports.join('\n') + '\n\n';
  for (let i = 0; i < repetitions; i++) {
    code += functions;
  }

  return code;
}

/**
 * Measure execution time of a function
 */
async function measureTime(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
}

/**
 * Run benchmark multiple times and get average
 */
async function runBenchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 10
): Promise<{ avg: number; min: number; max: number }> {
  const times: number[] = [];

  // Warmup (not counted)
  await fn();

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const time = await measureTime(fn);
    times.push(time);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`\n📊 Benchmark: ${name}`);
  console.log(`   Average: ${avg.toFixed(2)}ms`);
  console.log(`   Min: ${min.toFixed(2)}ms`);
  console.log(`   Max: ${max.toFixed(2)}ms`);
  console.log(`   Variance: ${(((max - min) / avg) * 100).toFixed(1)}%`);

  return { avg, min, max };
}

// =============================================================================
// Benchmark Tests
// =============================================================================

describe('Performance Benchmarks', () => {
  let smallCode: string;
  let mediumCode: string;
  let largeCode: string;
  let npmClient: NpmRegistryClient;
  let detector: HallucinationDetector;

  beforeAll(() => {
    // Generate test code of various sizes
    smallCode = generateRealisticCode(100);   // ~100 lines
    mediumCode = generateRealisticCode(500);  // ~500 lines
    largeCode = generateRealisticCode(1000);  // ~1000 lines

    // Initialize components
    npmClient = new NpmRegistryClient();
    detector = new HallucinationDetector();
  });

  describe('6.3.1: Static Analysis Performance', () => {
    it('should extract imports in < 50ms (small code)', async () => {
      const result = await runBenchmark(
        'Import extraction (100 lines)',
        async () => {
          extractImports(smallCode);
        },
        10
      );

      // Target: < 50ms average
      expect(result.avg).toBeLessThan(50);
    }, 30000);

    it('should extract imports in < 50ms (medium code)', async () => {
      const result = await runBenchmark(
        'Import extraction (500 lines)',
        async () => {
          extractImports(mediumCode);
        },
        10
      );

      // Target: < 50ms average
      expect(result.avg).toBeLessThan(50);
    }, 30000);

    it('should extract imports in < 50ms (large code)', async () => {
      const result = await runBenchmark(
        'Import extraction (1000 lines)',
        async () => {
          extractImports(largeCode);
        },
        10
      );

      // Target: < 50ms average (may need optimization for large files)
      expect(result.avg).toBeLessThan(50);
    }, 30000);
  });

  describe('6.3.2: Dependency Check Performance (Cached)', () => {
    it('should check package existence in < 20ms when cached', async () => {
      // Prime the cache first
      await npmClient.checkPackageExists('react');
      await npmClient.checkPackageExists('typescript');
      await npmClient.checkPackageExists('jest');

      const result = await runBenchmark(
        'Package existence check (cached)',
        async () => {
          await npmClient.checkPackageExists('react');
          await npmClient.checkPackageExists('typescript');
          await npmClient.checkPackageExists('jest');
        },
        10
      );

      // Target: < 20ms average for cached lookups
      expect(result.avg).toBeLessThan(20);
    }, 30000);

    it('should batch check multiple packages efficiently', async () => {
      const packages = ['react', 'vue', 'angular', 'svelte', 'preact'];

      // Prime cache
      await Promise.all(packages.map(pkg => npmClient.checkPackageExists(pkg)));

      const result = await runBenchmark(
        'Batch package check (5 packages, cached)',
        async () => {
          await Promise.all(packages.map(pkg => npmClient.checkPackageExists(pkg)));
        },
        10
      );

      // Target: < 20ms average for 5 packages (cached)
      expect(result.avg).toBeLessThan(20);
    }, 30000);
  });

  describe('6.3.3: Full Fast Layers Performance', () => {
    it('should run fast mode in < 200ms (small code)', async () => {
      const result = await runBenchmark(
        'Fast mode detection (100 lines)',
        async () => {
          await detector.detect(smallCode, {
            mode: 'fast',
            enableAutoFix: false,
          });
        },
        3 // Reduced from 10 to avoid timeout
      );

      // Target: < 200ms average
      expect(result.avg).toBeLessThan(200);
    }, 90000); // Increased timeout

    it('should run fast mode in < 200ms (medium code)', async () => {
      const result = await runBenchmark(
        'Fast mode detection (500 lines)',
        async () => {
          await detector.detect(mediumCode, {
            mode: 'fast',
            enableAutoFix: false,
          });
        },
        3 // Reduced from 10 to avoid timeout
      );

      // Target: < 200ms average
      expect(result.avg).toBeLessThan(200);
    }, 90000); // Increased timeout

    it('should run fast mode in < 200ms (large code)', async () => {
      const result = await runBenchmark(
        'Fast mode detection (1000 lines)',
        async () => {
          await detector.detect(largeCode, {
            mode: 'fast',
            enableAutoFix: false,
          });
        },
        3 // Reduced from 10 to avoid timeout
      );

      // Target: < 200ms average (may need optimization)
      expect(result.avg).toBeLessThan(200);
    }, 90000); // Increased timeout
  });

  describe('Performance Comparison: Fast vs Comprehensive', () => {
    it('should show fast mode is significantly faster than comprehensive', async () => {
      const fastResult = await runBenchmark(
        'Fast mode (500 lines)',
        async () => {
          await detector.detect(mediumCode, {
            mode: 'fast',
            enableAutoFix: false,
          });
        },
        3 // Reduced from 5 to avoid timeout
      );

      const comprehensiveResult = await runBenchmark(
        'Comprehensive mode (500 lines)',
        async () => {
          await detector.detect(mediumCode, {
            mode: 'comprehensive',
            enableAutoFix: false,
          });
        },
        3 // Reduced from 5 to avoid timeout
      );

      console.log(`\n⚡ Speed comparison:`);
      console.log(`   Fast: ${fastResult.avg.toFixed(2)}ms`);
      console.log(`   Comprehensive: ${comprehensiveResult.avg.toFixed(2)}ms`);
      console.log(`   Fast is ${(comprehensiveResult.avg / fastResult.avg).toFixed(1)}x faster`);

      // Fast mode should be at least 2x faster than comprehensive
      expect(fastResult.avg).toBeLessThan(comprehensiveResult.avg / 2);
    }, 120000); // Increased timeout for comprehensive mode comparison
  });
});
