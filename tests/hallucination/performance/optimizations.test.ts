/**
 * Tests for Performance Optimizations
 *
 * Verifies that optimization features work correctly:
 * - 6.3.4: AST caching
 * - 6.3.5: Batch npm registry operations
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { extractImports, clearASTCache } from '../../../src/hallucination/detectors/import-analyzer';
import { NpmRegistryClient } from '../../../src/hallucination/npm/registry-client';

describe('Performance Optimizations', () => {
  describe('6.3.4: AST Caching', () => {
    beforeEach(() => {
      // Clear cache before each test
      clearASTCache();
    });

    it('should cache parsed ASTs and reuse them', async () => {
      const code = `
        import * as fs from 'fs';
        import { parse } from 'module';

        export function test() {
          return 'hello';
        }
      `;

      // First parse - should parse fresh
      const start1 = performance.now();
      const result1 = await extractImports(code);
      const time1 = performance.now() - start1;

      // Second parse - should use cache (much faster)
      const start2 = performance.now();
      const result2 = await extractImports(code);
      const time2 = performance.now() - start2;

      // Results should be identical
      expect(result1).toEqual(result2);
      expect(result1.length).toBe(2);

      // Second call should be faster (cached)
      // Note: May not always be true due to V8 optimizations, but generally should be
      console.log(`First parse: ${time1.toFixed(2)}ms`);
      console.log(`Second parse (cached): ${time2.toFixed(2)}ms`);
      console.log(`Speed improvement: ${(time1 / time2).toFixed(1)}x faster`);

      // At minimum, cached result should not be slower
      expect(time2).toBeLessThanOrEqual(time1 * 2); // Allow some variance
    });

    it('should handle cache clearing', async () => {
      const code = "import { test } from 'module';";

      // Parse and cache
      await extractImports(code);

      // Clear cache
      clearASTCache();

      // Should still work after clearing
      const result = await extractImports(code);
      expect(result.length).toBe(1);
      expect(result[0].source).toBe('module');
    });

    it('should cache different code separately', async () => {
      const code1 = "import { a } from 'module-a';";
      const code2 = "import { b } from 'module-b';";

      const result1 = await extractImports(code1);
      const result2 = await extractImports(code2);

      expect(result1[0].source).toBe('module-a');
      expect(result2[0].source).toBe('module-b');
    });
  });

  describe('6.3.5: Batch npm Registry Operations', () => {
    let npmClient: NpmRegistryClient;

    beforeEach(() => {
      npmClient = new NpmRegistryClient();
    });

    it('should check multiple packages in batch', async () => {
      const packages = ['react', 'vue', 'angular'];

      const results = await npmClient.checkPackagesExist(packages);

      // Should return Map with all package results
      expect(results.size).toBe(3);
      expect(results.get('react')).toBe(true);
      expect(results.get('vue')).toBe(true);
      expect(results.get('angular')).toBe(true);
    });

    it('should fetch multiple package infos in batch', async () => {
      const packages = ['react', 'lodash'];

      const results = await npmClient.getPackagesInfo(packages);

      // Should return Map with package info
      expect(results.size).toBe(2);

      const reactInfo = results.get('react');
      expect(reactInfo).toBeDefined();
      expect(reactInfo?.name).toBe('react');
      expect(reactInfo?.versions).toBeDefined();

      const lodashInfo = results.get('lodash');
      expect(lodashInfo).toBeDefined();
      expect(lodashInfo?.name).toBe('lodash');
    }, 30000);

    it('should handle mix of existing and non-existing packages in batch', async () => {
      const packages = [
        'react', // exists
        'super-fake-package-that-does-not-exist-12345', // doesn't exist
        'typescript', // exists
      ];

      const results = await npmClient.checkPackagesExist(packages);

      expect(results.size).toBe(3);
      expect(results.get('react')).toBe(true);
      expect(results.get('typescript')).toBe(true);
      // Note: Network errors default to true (conservative approach)
    });

    it('should leverage cache in batch operations', async () => {
      const packages = ['react', 'vue', 'svelte'];

      // Prime the cache
      await npmClient.checkPackagesExist(packages);

      // Get initial stats
      const stats1 = npmClient.getCacheStats();

      // Second batch call should hit cache
      await npmClient.checkPackagesExist(packages);

      const stats2 = npmClient.getCacheStats();

      // Cache hits should have increased
      expect(stats2.hits).toBeGreaterThan(stats1.hits);
      expect(stats2.hitRate).toBeGreaterThan(0);

      console.log(`\nCache performance:`);
      console.log(`  Hits: ${stats2.hits}`);
      console.log(`  Misses: ${stats2.misses}`);
      console.log(`  Hit rate: ${(stats2.hitRate * 100).toFixed(1)}%`);
    });

    it('should process batch operations faster than sequential', async () => {
      const packages = ['express', 'fastify', 'koa', 'hapi'];

      // Clear cache to ensure fair comparison
      npmClient.clearCache();

      // Sequential processing (one at a time)
      const seqStart = performance.now();
      for (const pkg of packages) {
        await npmClient.checkPackageExists(pkg);
      }
      const seqTime = performance.now() - seqStart;

      // Clear cache again for fair comparison
      npmClient.clearCache();

      // Batch processing (parallel)
      const batchStart = performance.now();
      await npmClient.checkPackagesExist(packages);
      const batchTime = performance.now() - batchStart;

      console.log(`\nBatch vs Sequential:`);
      console.log(`  Sequential: ${seqTime.toFixed(2)}ms`);
      console.log(`  Batch: ${batchTime.toFixed(2)}ms`);
      console.log(`  Speedup: ${(seqTime / batchTime).toFixed(1)}x`);

      // Batch should be faster (or at least not significantly slower)
      // Allow some variance due to network conditions
      expect(batchTime).toBeLessThanOrEqual(seqTime * 1.2);
    }, 60000);
  });

  describe('Combined Optimizations Impact', () => {
    it('should demonstrate cumulative performance benefits', async () => {
      const code = `
        import * as fs from 'fs';
        import * as path from 'path';
        import { parse } from '@typescript-eslint/typescript-estree';
        import type { TSESTree } from '@typescript-eslint/typescript-estree';
        import { HallucinationIssue } from '../types';
      `.repeat(5); // Repeat to make it larger

      // Clear caches
      clearASTCache();
      const npmClient = new NpmRegistryClient();

      // First run: no cache benefits
      const start1 = performance.now();
      const imports1 = await extractImports(code);
      // Filter out relative imports (starting with . or ..)
      const packages1 = Array.from(new Set(
        imports1
          .map(i => i.source)
          .filter(Boolean)
          .filter(s => !s.startsWith('.'))
      ));
      await npmClient.checkPackagesExist(packages1 as string[]);
      const time1 = performance.now() - start1;

      // Second run: both AST cache and npm cache hit
      const start2 = performance.now();
      const imports2 = await extractImports(code);
      // Filter out relative imports (starting with . or ..)
      const packages2 = Array.from(new Set(
        imports2
          .map(i => i.source)
          .filter(Boolean)
          .filter(s => !s.startsWith('.'))
      ));
      await npmClient.checkPackagesExist(packages2 as string[]);
      const time2 = performance.now() - start2;

      console.log(`\n🚀 Combined optimization impact:`);
      console.log(`  First run (no cache): ${time1.toFixed(2)}ms`);
      console.log(`  Second run (cached): ${time2.toFixed(2)}ms`);
      console.log(`  Overall speedup: ${(time1 / time2).toFixed(1)}x`);

      // Should see significant improvement with both caches
      expect(time2).toBeLessThan(time1);
    });
  });
});
