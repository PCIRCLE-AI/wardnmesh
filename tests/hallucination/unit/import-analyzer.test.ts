/**
 * Unit tests for Import Statement Analyzer
 *
 * Testing Strategy:
 * - Test import extraction (named, default, namespace, dynamic)
 * - Test local file validation (relative paths, absolute paths)
 * - Test package validation (installed, npm registry, scoped packages)
 * - Test error suggestions (fuzzy matching, similar files)
 * - Test edge cases (no imports, malformed syntax, circular imports)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// These imports will fail initially - that's expected in TDD!
import {
  extractImports,
  validateImport,
  ImportInfo,
  ImportValidationResult
} from '../../../src/hallucination/detectors/import-analyzer';

describe('Import Statement Analyzer', () => {

  describe('extractImports - Named Imports', () => {
    it('should extract single named import', async () => {
      const code = `import { useState } from 'react';`;
      const imports = await extractImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        type: 'named',
        source: 'react',
        names: ['useState']
      });
    });

    it('should extract multiple named imports', async () => {
      const code = `import { useState, useEffect, useMemo } from 'react';`;
      const imports = await extractImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        type: 'named',
        source: 'react',
        names: ['useState', 'useEffect', 'useMemo']
      });
    });

    it('should extract named imports with aliases', async () => {
      const code = `import { useState as state, useEffect as effect } from 'react';`;
      const imports = await extractImports(code);

      expect(imports[0].names).toEqual(['useState', 'useEffect']);
      expect(imports[0].aliases).toEqual({ useState: 'state', useEffect: 'effect' });
    });

    it('should extract type-only named imports', async () => {
      const code = `import { type User, type Config } from './types';`;
      const imports = await extractImports(code);

      expect(imports[0]).toMatchObject({
        type: 'named',
        source: './types',
        names: ['User', 'Config'],
        isTypeOnly: true
      });
    });
  });

  describe('extractImports - Default Imports', () => {
    it('should extract default import', async () => {
      const code = `import React from 'react';`;
      const imports = await extractImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        type: 'default',
        source: 'react',
        name: 'React'
      });
    });

    it('should extract type-only default import', async () => {
      const code = `import type React from 'react';`;
      const imports = await extractImports(code);

      expect(imports[0]).toMatchObject({
        type: 'default',
        source: 'react',
        name: 'React',
        isTypeOnly: true
      });
    });
  });

  describe('extractImports - Namespace Imports', () => {
    it('should extract namespace import', async () => {
      const code = `import * as React from 'react';`;
      const imports = await extractImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        type: 'namespace',
        source: 'react',
        name: 'React'
      });
    });

    it('should extract type-only namespace import', async () => {
      const code = `import type * as Types from './types';`;
      const imports = await extractImports(code);

      expect(imports[0]).toMatchObject({
        type: 'namespace',
        source: './types',
        name: 'Types',
        isTypeOnly: true
      });
    });
  });

  describe('extractImports - Side Effect Imports', () => {
    it('should extract side effect import', async () => {
      const code = `import './styles.css';`;
      const imports = await extractImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        type: 'side-effect',
        source: './styles.css'
      });
    });
  });

  describe('extractImports - Dynamic Imports', () => {
    it('should extract dynamic import', async () => {
      const code = `const module = await import('./dynamic-module');`;
      const imports = await extractImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        type: 'dynamic',
        source: './dynamic-module'
      });
    });
  });

  describe('extractImports - Mixed Imports', () => {
    it('should extract default + named imports', async () => {
      const code = `import React, { useState, useEffect } from 'react';`;
      const imports = await extractImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        type: 'mixed',
        source: 'react',
        defaultName: 'React',
        names: ['useState', 'useEffect']
      });
    });
  });

  describe('extractImports - Multiple Statements', () => {
    it('should extract multiple import statements', async () => {
      const code = `
        import React from 'react';
        import { useState } from 'react';
        import * as utils from './utils';
        import './styles.css';
      `;
      const imports = await extractImports(code);

      expect(imports).toHaveLength(4);
      expect(imports.map(i => i.type)).toEqual([
        'default',
        'named',
        'namespace',
        'side-effect'
      ]);
    });
  });

  describe('extractImports - Relative Paths', () => {
    it('should extract relative path import', async () => {
      const code = `import { helper } from './utils/helper';`;
      const imports = await extractImports(code);

      expect(imports[0].source).toBe('./utils/helper');
      expect(imports[0].isRelative).toBe(true);
    });

    it('should extract parent directory import', async () => {
      const code = `import { config } from '../config';`;
      const imports = await extractImports(code);

      expect(imports[0].source).toBe('../config');
      expect(imports[0].isRelative).toBe(true);
    });
  });

  describe('extractImports - Scoped Packages', () => {
    it('should extract scoped package import', async () => {
      const code = `import { Client } from '@anthropic-ai/sdk';`;
      const imports = await extractImports(code);

      expect(imports[0]).toMatchObject({
        source: '@anthropic-ai/sdk',
        isScoped: true
      });
    });
  });

  describe('extractImports - Edge Cases', () => {
    it('should return empty array for no imports', async () => {
      const code = `const x = 1; console.log(x);`;
      const imports = await extractImports(code);

      expect(imports).toEqual([]);
    });

    it('should skip comments', async () => {
      const code = `
        // import { fake } from 'fake';
        /* import { fake2 } from 'fake2'; */
        import { real } from 'real';
      `;
      const imports = await extractImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0].source).toBe('real');
    });

    it('should handle import in string literals (not actual import)', async () => {
      const code = `const str = "import { fake } from 'fake'";`;
      const imports = await extractImports(code);

      expect(imports).toEqual([]);
    });
  });
});

describe('validateImport - Local File Validation', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should validate existing local file', async () => {
    // Create test file
    const testFile = path.join(tempDir, 'helper.ts');
    fs.writeFileSync(testFile, 'export const helper = () => {};');

    const importInfo: ImportInfo = {
      type: 'named',
      source: './helper',
      names: ['helper'],
      isRelative: true
    };

    const result = await validateImport(
      importInfo,
      path.join(tempDir, 'index.ts'),
      tempDir
    );

    expect(result.valid).toBe(true);
    expect(result.issue).toBeUndefined();
  });

  it('should detect non-existent local file', async () => {
    const importInfo: ImportInfo = {
      type: 'named',
      source: './non-existent',
      names: ['foo'],
      isRelative: true
    };

    const result = await validateImport(
      importInfo,
      path.join(tempDir, 'index.ts'),
      tempDir
    );

    expect(result.valid).toBe(false);
    expect(result.issue).toBeDefined();
    expect(result.issue?.type).toBe('file-hallucination');
    expect(result.issue?.severity).toBe('critical');
  });

  it('should try multiple file extensions', async () => {
    // Create .ts file
    fs.writeFileSync(path.join(tempDir, 'helper.ts'), 'export {}');

    const importInfo: ImportInfo = {
      type: 'named',
      source: './helper', // No extension
      names: ['foo'],
      isRelative: true
    };

    const result = await validateImport(
      importInfo,
      path.join(tempDir, 'index.ts'),
      tempDir
    );

    expect(result.valid).toBe(true);
  });

  it('should resolve nested paths correctly', async () => {
    // Create nested structure
    fs.mkdirSync(path.join(tempDir, 'utils'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'utils', 'helper.ts'), 'export {}');

    const importInfo: ImportInfo = {
      type: 'named',
      source: './utils/helper',
      names: ['foo'],
      isRelative: true
    };

    const result = await validateImport(
      importInfo,
      path.join(tempDir, 'index.ts'),
      tempDir
    );

    expect(result.valid).toBe(true);
  });

  it('should suggest similar files on typo', async () => {
    // Create files with similar names
    fs.writeFileSync(path.join(tempDir, 'helpers.ts'), 'export {}');
    fs.writeFileSync(path.join(tempDir, 'helper-utils.ts'), 'export {}');

    const importInfo: ImportInfo = {
      type: 'named',
      source: './helper', // Typo: should be helpers
      names: ['foo'],
      isRelative: true
    };

    const result = await validateImport(
      importInfo,
      path.join(tempDir, 'index.ts'),
      tempDir
    );

    expect(result.valid).toBe(false);
    expect(result.issue?.suggestion).toBeDefined();
    expect(result.issue?.suggestion).toContain('helpers');
  });

  it('should handle parent directory imports', async () => {
    // Create parent directory file
    fs.writeFileSync(path.join(tempDir, 'config.ts'), 'export {}');

    // Create subdirectory
    const subDir = path.join(tempDir, 'src');
    fs.mkdirSync(subDir);

    const importInfo: ImportInfo = {
      type: 'named',
      source: '../config',
      names: ['config'],
      isRelative: true
    };

    const result = await validateImport(
      importInfo,
      path.join(subDir, 'index.ts'),
      tempDir
    );

    expect(result.valid).toBe(true);
  });

  it('should reject path traversal attempts outside project root', async () => {
    // Create a file outside project root
    const outsideDir = path.join(path.dirname(tempDir), 'outside');
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, 'secret.ts'), 'export const secret = "data";');

    const importInfo: ImportInfo = {
      type: 'named',
      source: '../../outside/secret',
      names: ['secret'],
      isRelative: true
    };

    const result = await validateImport(
      importInfo,
      path.join(tempDir, 'src', 'index.ts'),
      tempDir
    );

    expect(result.valid).toBe(false);
    expect(result.issue?.type).toBe('file-hallucination');
    expect(result.issue?.message).toContain('outside project root');
    expect(result.issue?.severity).toBe('critical');

    // Cleanup
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it('should reject normalized path traversal with mixed separators', async () => {
    const importInfo: ImportInfo = {
      type: 'named',
      source: '../../../etc/passwd',
      names: ['data'],
      isRelative: true
    };

    const result = await validateImport(
      importInfo,
      path.join(tempDir, 'src', 'deep', 'index.ts'),
      tempDir
    );

    expect(result.valid).toBe(false);
    expect(result.issue?.type).toBe('file-hallucination');
    expect(result.issue?.message).toContain('outside project root');
  });
});

describe('validateImport - Package Validation', () => {
  it('should validate installed package', async () => {
    const importInfo: ImportInfo = {
      type: 'named',
      source: 'zod', // This is installed
      names: ['z'],
      isRelative: false
    };

    const result = await validateImport(
      importInfo,
      path.join(process.cwd(), 'src/index.ts'),
      process.cwd()
    );

    expect(result.valid).toBe(true);
  });

  it('should detect non-existent package', async () => {
    const importInfo: ImportInfo = {
      type: 'named',
      source: 'this-package-definitely-does-not-exist-12345',
      names: ['foo'],
      isRelative: false
    };

    const result = await validateImport(
      importInfo,
      path.join(process.cwd(), 'src/index.ts'),
      process.cwd()
    );

    expect(result.valid).toBe(false);
    expect(result.issue?.type).toBe('package-hallucination');
    expect(result.issue?.severity).toBe('critical');
  });

  it('should detect missing but existing package', async () => {
    const importInfo: ImportInfo = {
      type: 'named',
      source: 'lodash', // Exists on npm but not installed
      names: ['map'],
      isRelative: false
    };

    const result = await validateImport(
      importInfo,
      path.join(process.cwd(), 'src/index.ts'),
      process.cwd()
    );

    expect(result.valid).toBe(false);
    expect(result.issue?.type).toBe('import-hallucination');
    expect(result.issue?.autoFix).toMatchObject({
      type: 'install-package',
      data: { package: 'lodash' }
    });
  });

  it('should validate scoped packages', async () => {
    const importInfo: ImportInfo = {
      type: 'named',
      source: '@anthropic-ai/sdk', // Installed
      names: ['Anthropic'],
      isRelative: false,
      isScoped: true
    };

    const result = await validateImport(
      importInfo,
      path.join(process.cwd(), 'src/index.ts'),
      process.cwd()
    );

    expect(result.valid).toBe(true);
  });

  it('should suggest correct package name for common typos', async () => {
    const importInfo: ImportInfo = {
      type: 'named',
      source: 'openai-sdk', // Should be 'openai'
      names: ['OpenAI'],
      isRelative: false
    };

    const result = await validateImport(
      importInfo,
      path.join(process.cwd(), 'src/index.ts'),
      process.cwd()
    );

    expect(result.valid).toBe(false);
    expect(result.issue?.suggestion).toBeDefined();
  });
});

describe('validateImport - Performance', () => {
  it('should complete validation in < 100ms for local files', async () => {
    const importInfo: ImportInfo = {
      type: 'named',
      source: './types',
      names: ['foo'],
      isRelative: true
    };

    const start = Date.now();
    await validateImport(
      importInfo,
      path.join(process.cwd(), 'src/index.ts'),
      process.cwd()
    );
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });
});
