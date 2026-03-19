/**
 * Import Statement Analyzer
 *
 * Detects AI hallucinations in import statements:
 * - Non-existent files (local imports)
 * - Non-existent packages (npm imports)
 * - Missing exports from real modules
 *
 * Uses TypeScript AST parsing for accurate extraction
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Mutex } from 'async-mutex';
import { parse } from '@typescript-eslint/typescript-estree';
import type { TSESTree } from '@typescript-eslint/typescript-estree';
import { HallucinationIssue } from '../types';
import { validateNonEmptyString, validateObject, validateRequiredFields } from '../utils/validation';
import { logger } from '../../utils/logger';
import {
  SIMILARITY_THRESHOLD,
  AST_CACHE_MAX_SIZE,
  CACHE_TTL_MS,
  FILE_EXTENSIONS as SUPPORTED_FILE_EXTENSIONS,
  MAX_SIMILAR_FILE_SUGGESTIONS,
  NPM_REQUEST_TIMEOUT_MS,
} from '../constants';

/**
 * Import Type
 */
export type ImportType =
  | 'named'        // import { foo } from 'module'
  | 'default'      // import foo from 'module'
  | 'namespace'    // import * as foo from 'module'
  | 'side-effect'  // import 'module'
  | 'dynamic'      // await import('module')
  | 'mixed';       // import foo, { bar } from 'module'

/**
 * Import Information
 */
export interface ImportInfo {
  type: ImportType;
  source: string;
  names?: string[];
  name?: string;
  defaultName?: string;
  aliases?: Record<string, string>;
  isRelative?: boolean;
  isScoped?: boolean;
  isTypeOnly?: boolean;
}

/**
 * Import Validation Result
 */
export interface ImportValidationResult {
  valid: boolean;
  issue?: HallucinationIssue;
  resolvedPath?: string;
}

// Use constants from centralized configuration
const FILE_EXTENSIONS = SUPPORTED_FILE_EXTENSIONS;

// =============================================================================
// AST Cache (Performance Optimization)
// =============================================================================

/**
 * Cache entry for parsed AST
 */
interface ASTCacheEntry {
  ast: TSESTree.Program;
  timestamp: number;
}

/**
 * AST cache with LRU eviction
 * Configuration imported from constants.ts:
 * - AST_CACHE_MAX_SIZE: Max entries to prevent memory bloat
 * - CACHE_TTL_MS: Time-to-live to prevent stale parses
 */
const AST_CACHE = new Map<string, ASTCacheEntry>();

/**
 * Mutex to protect cache operations from race conditions
 */
const AST_CACHE_MUTEX = new Mutex();

/**
 * Generate cache key from code using SHA-256
 * Uses crypto hash to prevent collisions
 */
function getCacheKey(code: string): string {
  return crypto.createHash('sha256').update(code, 'utf8').digest('hex');
}

/**
 * Get cached AST if available and not expired
 */
async function getCachedAST(code: string): Promise<TSESTree.Program | null> {
  return await AST_CACHE_MUTEX.runExclusive(() => {
    const key = getCacheKey(code);
    const entry = AST_CACHE.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) {
      AST_CACHE.delete(key);
      logger.debug('AST cache entry expired', { key, age });
      return null;
    }

    return entry.ast;
  });
}

/**
 * Cache parsed AST with LRU eviction
 *
 * LRU (Least Recently Used) Eviction Algorithm:
 * - When cache is full, find the entry with oldest timestamp
 * - Remove oldest entry before inserting new one
 * - Time complexity: O(n) where n = cache size
 * - Why this approach: Simple, predictable, no external dependencies
 * - Edge cases handled: Empty cache, single entry, tie-breaking by insertion order
 */
async function cacheAST(code: string, ast: TSESTree.Program): Promise<void> {
  await AST_CACHE_MUTEX.runExclusive(() => {
    const key = getCacheKey(code);

    // LRU eviction: remove oldest entry if cache is full
    if (AST_CACHE.size >= AST_CACHE_MAX_SIZE) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      // Find oldest entry by comparing timestamps
      for (const [k, entry] of AST_CACHE.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        AST_CACHE.delete(oldestKey);
        logger.debug('Evicted oldest AST cache entry', {
          evictedKey: oldestKey,
          cacheSize: AST_CACHE.size
        });
      }
    }

    AST_CACHE.set(key, {
      ast,
      timestamp: Date.now(),
    });
  });
}

/**
 * Clear AST cache (useful for testing)
 */
export function clearASTCache(): void {
  AST_CACHE.clear();
  logger.info('AST cache cleared');
}

/**
 * Extract all import statements from TypeScript code
 *
 * @param code - TypeScript source code
 * @returns Array of import information
 */
export async function extractImports(code: string): Promise<ImportInfo[]> {
  // Validate input
  try {
    validateNonEmptyString(code, 'code');
  } catch (error) {
    logger.error('Invalid input to extractImports', {
      function: 'extractImports',
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }

  const imports: ImportInfo[] = [];

  try {
    // Try to get cached AST first (performance optimization)
    let ast = await getCachedAST(code);

    if (!ast) {
      // Parse fresh and cache
      ast = parse(code, {
        jsx: true,
        loc: true,
        range: true,
        comment: true
      });
      await cacheAST(code, ast);
      logger.debug('Parsed and cached new AST');
    } else {
      logger.debug('Using cached AST');
    }

    // Traverse AST to find import declarations
    traverse(ast, (node) => {
      if (node.type === 'ImportDeclaration') {
        const importInfo = extractImportDeclaration(node);
        if (importInfo) {
          imports.push(importInfo);
        }
      }

      // Handle dynamic imports: import('module')
      if (
        node.type === 'ImportExpression' &&
        node.source.type === 'Literal' &&
        typeof node.source.value === 'string'
      ) {
        imports.push({
          type: 'dynamic',
          source: node.source.value,
          isRelative: node.source.value.startsWith('./') || node.source.value.startsWith('../'),
          isScoped: node.source.value.startsWith('@')
        });
      }
    });

    logger.debug('Extracted imports successfully', {
      function: 'extractImports',
      importCount: imports.length
    });
  } catch (error) {
    // If parsing fails, log error and return empty array (malformed code)
    logger.warn('Failed to parse code for imports', {
      function: 'extractImports',
      error: error instanceof Error ? error.message : String(error),
      codeLength: code.length
    });
    return [];
  }

  return imports;
}

/**
 * Extract information from an ImportDeclaration node
 */
function extractImportDeclaration(node: TSESTree.ImportDeclaration): ImportInfo | null {
  const source = node.source.value as string;
  const isRelative = source.startsWith('./') || source.startsWith('../');
  const isScoped = source.startsWith('@');

  // Side-effect import: import './module'
  if (node.specifiers.length === 0) {
    return {
      type: 'side-effect',
      source,
      isRelative,
      isScoped
    };
  }

  const names: string[] = [];
  const aliases: Record<string, string> = {};
  let defaultName: string | undefined;
  let namespaceName: string | undefined;
  let hasNamed = false;
  let isTypeOnly = node.importKind === 'type';

  for (const specifier of node.specifiers) {
    if (specifier.type === 'ImportDefaultSpecifier') {
      defaultName = specifier.local.name;
    } else if (specifier.type === 'ImportNamespaceSpecifier') {
      namespaceName = specifier.local.name;
    } else if (specifier.type === 'ImportSpecifier') {
      hasNamed = true;
      // Handle both Identifier and StringLiteral (for named imports with quotes)
      const importedName = specifier.imported.type === 'Identifier'
        ? specifier.imported.name
        : String(specifier.imported.value);
      const localName = specifier.local.name;

      names.push(importedName);

      if (importedName !== localName) {
        aliases[importedName] = localName;
      }

      // Check if this specific import is type-only
      if (specifier.importKind === 'type') {
        isTypeOnly = true;
      }
    }
  }

  // Determine import type
  let type: ImportType;
  if (namespaceName) {
    type = 'namespace';
  } else if (defaultName && hasNamed) {
    type = 'mixed';
  } else if (defaultName) {
    type = 'default';
  } else {
    type = 'named';
  }

  const importInfo: ImportInfo = {
    type,
    source,
    isRelative,
    isScoped,
    isTypeOnly
  };

  if (names.length > 0) {
    importInfo.names = names;
  }

  if (Object.keys(aliases).length > 0) {
    importInfo.aliases = aliases;
  }

  if (defaultName) {
    importInfo.defaultName = defaultName;
  }

  if (namespaceName) {
    importInfo.name = namespaceName;
  }

  if (type === 'default' && defaultName) {
    importInfo.name = defaultName;
  }

  return importInfo;
}

/**
 * Iterative AST traversal (prevents stack overflow on deeply nested ASTs)
 *
 * Stack-based iteration algorithm:
 * - Uses explicit stack instead of recursive calls
 * - Prevents stack overflow on deeply nested code
 * - Depth-first traversal (children processed in reverse order)
 * - Time complexity: O(n) where n = number of AST nodes
 * - Space complexity: O(h) where h = max tree height
 * - Why this approach: Handles pathological cases (e.g., 1000+ nested blocks)
 * - Edge cases: Empty AST, single node, circular references (prevented by visitor pattern)
 */
function traverse(node: any, visitor: (node: any) => void): void {
  // Use stack-based iteration instead of recursion
  const stack: any[] = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      continue;
    }

    // Visit current node
    visitor(current);

    // Add children to stack (in reverse order for depth-first traversal)
    const keys = Object.keys(current);
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i];

      // Skip metadata properties
      if (key === 'parent' || key === 'loc' || key === 'range') {
        continue;
      }

      const child = current[key];
      if (child && typeof child === 'object') {
        if (Array.isArray(child)) {
          // Add array items in reverse order
          for (let j = child.length - 1; j >= 0; j--) {
            if (child[j] && typeof child[j] === 'object') {
              stack.push(child[j]);
            }
          }
        } else {
          stack.push(child);
        }
      }
    }
  }
}

/**
 * Validate an import statement
 *
 * @param importInfo - Import information to validate
 * @param currentFile - Path to the file containing the import
 * @param projectRoot - Project root directory
 * @returns Validation result with issue if invalid
 */
export async function validateImport(
  importInfo: ImportInfo,
  currentFile: string,
  projectRoot: string
): Promise<ImportValidationResult> {
  // Validate inputs
  try {
    validateObject(importInfo, 'importInfo');
    validateRequiredFields(importInfo, ['type', 'source'], 'importInfo');
    validateNonEmptyString(currentFile, 'currentFile');
    validateNonEmptyString(projectRoot, 'projectRoot');
  } catch (error) {
    logger.error('Invalid input to validateImport', {
      function: 'validateImport',
      error: error instanceof Error ? error.message : String(error),
      importSource: importInfo?.source
    });
    throw error;
  }

  // Local file import validation
  if (importInfo.isRelative) {
    return validateLocalFileImport(importInfo, currentFile, projectRoot);
  }

  // Package import validation
  return validatePackageImport(importInfo, projectRoot);
}

/**
 * Validate local file import
 */
async function validateLocalFileImport(
  importInfo: ImportInfo,
  currentFile: string,
  projectRoot: string
): Promise<ImportValidationResult> {

  const currentDir = path.dirname(currentFile);
  const importPath = importInfo.source;

  // Resolve the import path relative to current file
  let resolvedPath = path.resolve(currentDir, importPath);

  // Normalize paths to prevent path traversal attacks
  const normalizedResolvedPath = path.normalize(resolvedPath);
  const normalizedProjectRoot = path.normalize(projectRoot);

  // Security check: ensure resolved path is within project root
  if (!normalizedResolvedPath.startsWith(normalizedProjectRoot + path.sep) &&
      normalizedResolvedPath !== normalizedProjectRoot) {

    logger.warn('Import path resolves outside project root', {
      function: 'validateLocalFileImport',
      file: currentFile,
      importPath,
      resolvedPath: normalizedResolvedPath,
      projectRoot: normalizedProjectRoot
    });

    const issue: HallucinationIssue = {
      type: 'file-hallucination',
      severity: 'critical',
      message: `Import path "${importPath}" resolves outside project root`,
      location: {
        file: currentFile
      },
      suggestion: 'Imports must reference files within the project directory',
      confidence: 1.0
    };

    return {
      valid: false,
      issue
    };
  }

  // Try to find the file with different extensions
  const foundPath = tryResolveFile(normalizedResolvedPath);

  if (foundPath) {
    logger.debug('Successfully resolved local import', {
      function: 'validateLocalFileImport',
      file: currentFile,
      importPath,
      resolvedPath: foundPath
    });
    return {
      valid: true,
      resolvedPath: foundPath
    };
  }

  // File not found - generate issue with suggestions
  const similarFiles = findSimilarFiles(resolvedPath, currentDir, projectRoot);

  logger.warn('Local import file not found', {
    function: 'validateLocalFileImport',
    file: currentFile,
    importPath,
    resolvedPath: normalizedResolvedPath,
    similarFilesCount: similarFiles.length
  });

  const issue: HallucinationIssue = {
    type: 'file-hallucination',
    severity: 'critical',
    message: `File does not exist: ${importPath}`,
    location: {
      file: currentFile
    },
    suggestion: similarFiles.length > 0
      ? `Did you mean one of these?\n${similarFiles.map(f => `  - ${f}`).join('\n')}`
      : undefined,
    confidence: 1.0
  };

  return {
    valid: false,
    issue
  };
}

/**
 * Try to resolve a file with different extensions
 */
function tryResolveFile(basePath: string): string | null {
  // Try exact path first
  try {
    if (fs.existsSync(basePath)) {
      const stat = fs.statSync(basePath);
      if (stat.isFile()) {
        return basePath;
      }
      // If it's a directory, try index files
      if (stat.isDirectory()) {
        for (const ext of FILE_EXTENSIONS) {
          const indexPath = path.join(basePath, `index${ext}`);
          if (fs.existsSync(indexPath)) {
            return indexPath;
          }
        }
      }
    }

    // Try with different extensions
    for (const ext of FILE_EXTENSIONS) {
      const pathWithExt = basePath + ext;
      if (fs.existsSync(pathWithExt)) {
        return pathWithExt;
      }
    }
  } catch (error) {
    logger.error('Error while resolving file', {
      function: 'tryResolveFile',
      basePath,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return null;
}

/**
 * Find similar files using fuzzy matching
 *
 * Similarity matching algorithm:
 * - Uses Levenshtein distance (see calculateSimilarity)
 * - Threshold: SIMILARITY_THRESHOLD (from constants.ts)
 * - Returns top MAX_SIMILAR_FILE_SUGGESTIONS matches
 * - Time complexity: O(n * m * k) where n=files, m=avg filename length, k=target length
 * - Why this approach: Good balance between accuracy and performance
 * - Edge cases: Empty directory, no similar files, permission errors
 */
function findSimilarFiles(
  targetPath: string,
  currentDir: string,
  projectRoot: string
): string[] {
  const targetBase = path.basename(targetPath);
  const targetDirName = path.dirname(targetPath);
  const searchDir = path.resolve(currentDir, targetDirName);

  if (!fs.existsSync(searchDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(searchDir);
    const similar: Array<{ file: string; score: number }> = [];

    for (const file of files) {
      const score = calculateSimilarity(targetBase, file);
      if (score > SIMILARITY_THRESHOLD) {
        const relativePath = path.join(
          targetDirName,
          file.replace(/\.(ts|tsx|js|jsx|mjs|cjs|json|d\.ts)$/, '')
        );
        similar.push({ file: relativePath, score });
      }
    }

    // Sort by similarity score (highest first)
    similar.sort((a, b) => b.score - a.score);

    return similar.slice(0, MAX_SIMILAR_FILE_SUGGESTIONS).map(s => s.file);
  } catch (error) {
    logger.error('Error finding similar files', {
      function: 'findSimilarFiles',
      searchDir,
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 *
 * Levenshtein Distance Algorithm (Dynamic Programming):
 * - Measures minimum edit operations (insert, delete, substitute) to transform str1 to str2
 * - Builds 2D matrix where matrix[i][j] = distance between first i chars of str2 and first j chars of str1
 * - Base cases: empty string distance = length of other string
 * - Recurrence: matrix[i][j] = min(substitute, insert, delete)
 * - Time complexity: O(m * n) where m, n = string lengths
 * - Space complexity: O(m * n) for matrix (can be optimized to O(min(m,n)))
 * - Why this approach: Standard algorithm, handles all edit types, proven accuracy
 * - Edge cases: Empty strings (return 0), identical strings (return 1.0)
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity score from 0.0 (no match) to 1.0 (identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Fast paths for edge cases
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  // Initialize distance matrix
  const matrix: number[][] = [];

  // First row: distance from empty string to s1[0..j]
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  // First column: distance from empty string to s2[0..i]
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix using dynamic programming
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        // Characters match - no operation needed
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Take minimum of three operations
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  // Convert distance to similarity score (0.0 to 1.0)
  const distance = matrix[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - distance / maxLen;
}

/**
 * Validate package import
 */
async function validatePackageImport(
  importInfo: ImportInfo,
  projectRoot: string
): Promise<ImportValidationResult> {

  const packageName = extractPackageName(importInfo.source);

  // Check if package is installed
  const isInstalled = isPackageInstalled(packageName, projectRoot);

  if (isInstalled) {
    logger.debug('Package is installed', {
      function: 'validatePackageImport',
      package: packageName
    });
    return {
      valid: true
    };
  }

  // Package not installed - check if it exists on npm
  const existsOnNpm = await checkNpmPackageExists(packageName);

  if (existsOnNpm) {
    // Package exists but not installed
    logger.warn('Package exists on npm but not installed', {
      function: 'validatePackageImport',
      package: packageName,
      projectRoot
    });

    const issue: HallucinationIssue = {
      type: 'import-hallucination',
      severity: 'critical',
      message: `Package "${packageName}" not installed`,
      suggestion: `Run: npm install ${packageName}`,
      autoFix: {
        type: 'install-package',
        data: { package: packageName }
      },
      confidence: 1.0
    };

    return {
      valid: false,
      issue
    };
  }

  // Package doesn't exist on npm - hallucination
  logger.warn('Package does not exist on npm', {
    function: 'validatePackageImport',
    package: packageName
  });

  const suggestion = suggestCorrectPackageName(packageName);

  const issue: HallucinationIssue = {
    type: 'package-hallucination',
    severity: 'critical',
    message: `Package "${packageName}" does not exist on npm`,
    suggestion,
    confidence: 1.0
  };

  return {
    valid: false,
    issue
  };
}

/**
 * Extract package name from import source
 * e.g., '@scope/package/subpath' => '@scope/package'
 */
function extractPackageName(source: string): string {
  if (source.startsWith('@')) {
    // Scoped package
    const parts = source.split('/');
    return parts.slice(0, 2).join('/');
  }

  // Regular package
  return source.split('/')[0];
}

/**
 * Check if package is installed
 */
function isPackageInstalled(packageName: string, projectRoot: string): boolean {
  const packageJsonPath = path.join(projectRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    logger.debug('package.json not found', {
      function: 'isPackageInstalled',
      projectRoot
    });
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies
    };

    return packageName in allDeps;
  } catch (error) {
    logger.error('Error reading package.json', {
      function: 'isPackageInstalled',
      file: packageJsonPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Check if package exists on npm registry
 */
async function checkNpmPackageExists(packageName: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
      {
        method: 'HEAD',
        signal: AbortSignal.timeout(NPM_REQUEST_TIMEOUT_MS)
      }
    );

    const exists = response.ok;
    logger.debug('Checked npm registry', {
      function: 'checkNpmPackageExists',
      package: packageName,
      exists,
      status: response.status
    });

    return exists;
  } catch (error) {
    // On error, conservatively assume package exists
    // (network issues shouldn't block development)
    logger.warn('Error checking npm registry, assuming package exists', {
      function: 'checkNpmPackageExists',
      package: packageName,
      error: error instanceof Error ? error.message : String(error)
    });
    return true;
  }
}

/**
 * Suggest correct package name for common typos
 */
function suggestCorrectPackageName(packageName: string): string | undefined {
  const commonCorrections: Record<string, string> = {
    'openai-sdk': 'openai',
    'anthropic-sdk': '@anthropic-ai/sdk',
    'stripe-js': '@stripe/stripe-js',
    'react-router': 'react-router-dom',
    'node-fetch': 'Built-in in Node.js 18+, or install: node-fetch'
  };

  if (packageName in commonCorrections) {
    return `Did you mean "${commonCorrections[packageName]}"?`;
  }

  return undefined;
}
