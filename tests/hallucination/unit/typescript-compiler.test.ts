/**
 * Unit tests for TypeScript Compiler Integration
 *
 * Testing Strategy:
 * - Test compilation of valid TypeScript code
 * - Test detection of import errors (TS2307: Cannot find module)
 * - Test detection of type errors (TS2304: Cannot find name)
 * - Test temp file cleanup after compilation
 * - Test error message parsing and transformation
 * - Test handling of multiple errors in single file
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// These imports will fail initially - that's expected in TDD!
import {
  TypeScriptCompiler,
  CompilationResult,
  CompilationError,
  CompilerOptions
} from '../../../src/hallucination/runtime/typescript-compiler';

describe('TypeScriptCompiler', () => {
  let compiler: TypeScriptCompiler;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ts-compiler-test-'));
    compiler = new TypeScriptCompiler();
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Valid Code Compilation', () => {
    it('should compile valid TypeScript code successfully', async () => {
      const code = `
        function add(a: number, b: number): number {
          return a + b;
        }

        const result = add(1, 2);
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should compile code with valid imports', async () => {
      const code = `
        import * as fs from 'fs';
        import { readFile } from 'fs/promises';

        async function test() {
          const data = await readFile('test.txt');
          return data;
        }
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should compile code with type annotations', async () => {
      const code = `
        interface User {
          name: string;
          age: number;
        }

        const user: User = {
          name: 'John',
          age: 30
        };
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(true);
    });
  });

  describe('Import Error Detection (TS2307)', () => {
    it('should detect non-existent module imports', async () => {
      const code = `
        import { something } from 'fake-package-xyz';
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('TS2307');
      expect(result.errors[0].type).toBe('import_error');
      expect(result.errors[0].message).toContain('Cannot find module');
    });

    it('should detect non-existent file imports', async () => {
      const code = `
        import { helper } from './non-existent-file';
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('TS2307');
      expect(result.errors[0].importPath).toBe('./non-existent-file');
    });

    it('should detect scoped package import errors', async () => {
      const code = `
        import { Component } from '@fake-scope/fake-package';
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('TS2307');
      expect(result.errors[0].importPath).toBe('@fake-scope/fake-package');
    });
  });

  describe('Type Error Detection (TS2304)', () => {
    it('should detect undefined variables', async () => {
      const code = `
        const result = nonExistentVariable + 1;
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('TS2304');
      expect(result.errors[0].type).toBe('type_error');
      expect(result.errors[0].message).toContain('Cannot find name');
    });

    it('should detect undefined types in annotations', async () => {
      const code = `
        const user: NonExistentType = {};
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('TS2304');
      expect(result.errors[0].identifier).toBe('NonExistentType');
    });

    it('should detect undefined function calls', async () => {
      const code = `
        const result = nonExistentFunction();
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('TS2304');
    });
  });

  describe('Multiple Errors', () => {
    it('should detect multiple errors in single file', async () => {
      const code = `
        import { fake } from 'fake-package';

        const x: NonExistentType = 1;
        const y = undefinedVariable;
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should provide line numbers for each error', async () => {
      const code = `
        const a = undefinedA;
        const b = undefinedB;
        const c = undefinedC;
      `;

      const result = await compiler.compile(code);

      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].line).toBeDefined();
      expect(result.errors[1].line).toBeDefined();
      expect(result.errors[2].line).toBeDefined();
    });
  });

  describe('Error Message Parsing', () => {
    it('should extract import path from TS2307 error', async () => {
      const code = `import { x } from 'missing-package';`;

      const result = await compiler.compile(code);

      expect(result.errors[0].importPath).toBe('missing-package');
    });

    it('should extract identifier from TS2304 error', async () => {
      const code = `const x = MissingIdentifier;`;

      const result = await compiler.compile(code);

      expect(result.errors[0].identifier).toBe('MissingIdentifier');
    });

    it('should extract line and column numbers', async () => {
      const code = `
        const a = 1;
        const b = undefinedVar;
      `;

      const result = await compiler.compile(code);

      expect(result.errors[0].line).toBeGreaterThan(1);
      expect(result.errors[0].column).toBeGreaterThan(0);
    });
  });

  describe('Temp File Management', () => {
    it('should clean up temp files after successful compilation', async () => {
      const code = `const x = 1;`;

      await compiler.compile(code);

      // Check that compiler doesn't leave temp files in system temp
      const tempFiles = await fs.readdir(os.tmpdir());
      const tsFiles = tempFiles.filter(f => f.startsWith('hallucination-check-') && f.endsWith('.ts'));

      expect(tsFiles).toHaveLength(0);
    });

    it('should clean up temp files after failed compilation', async () => {
      const code = `import { x } from 'fake';`;

      await compiler.compile(code);

      const tempFiles = await fs.readdir(os.tmpdir());
      const tsFiles = tempFiles.filter(f => f.startsWith('hallucination-check-') && f.endsWith('.ts'));

      expect(tsFiles).toHaveLength(0);
    });

    it('should handle multiple concurrent compilations safely', async () => {
      const code1 = `const a = 1;`;
      const code2 = `const b = 2;`;
      const code3 = `const c = undefinedVar;`;

      const results = await Promise.all([
        compiler.compile(code1),
        compiler.compile(code2),
        compiler.compile(code3)
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(false);

      // All temp files should be cleaned up
      const tempFiles = await fs.readdir(os.tmpdir());
      const tsFiles = tempFiles.filter(f => f.startsWith('hallucination-check-'));

      expect(tsFiles).toHaveLength(0);
    });
  });

  describe('Compiler Options', () => {
    it('should use strict mode by default', async () => {
      const code = `
        function test(x) {
          return x;
        }
      `;

      const result = await compiler.compile(code);

      // Strict mode should flag implicit any
      expect(result.success).toBe(false);
    });

    it('should allow custom compiler options', async () => {
      const customCompiler = new TypeScriptCompiler({
        strict: false,
        noImplicitAny: false
      });

      const code = `
        function myFunction(x) {
          return x;
        }
      `;

      const result = await customCompiler.compile(code);

      // With loose mode, implicit any is allowed
      expect(result.success).toBe(true);
    });

    it('should support ES module resolution', async () => {
      const code = `
        import { readFile } from 'fs/promises';
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty code', async () => {
      const result = await compiler.compile('');

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle syntax errors', async () => {
      const code = `const x = {`;

      const result = await compiler.compile(code);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle very long code', async () => {
      const code = Array(1000)
        .fill(0)
        .map((_, i) => `const var${i} = ${i};`)
        .join('\n');

      const result = await compiler.compile(code);

      expect(result.success).toBe(true);
    });

    it('should handle code with unicode characters', async () => {
      const code = `
        const message = '你好世界';
        const emoji = '🎉';
      `;

      const result = await compiler.compile(code);

      expect(result.success).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should compile small code in < 350ms', async () => {
      const code = `const x = 1;`;

      const start = Date.now();
      await compiler.compile(code);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(350);
    });

    it('should handle compilation errors without timeout', async () => {
      const code = `
        import { a } from 'fake1';
        import { b } from 'fake2';
        const x: Fake1 = 1;
        const y: Fake2 = 2;
      `;

      const start = Date.now();
      await compiler.compile(code);
      const duration = Date.now() - start;

      // Should complete even with errors
      expect(duration).toBeLessThan(1000);
    });
  });
});
