/**
 * TypeScript Compiler Integration
 *
 * Provides runtime compilation and type-checking of TypeScript code
 * to detect import errors, type errors, and other compilation issues.
 *
 * Features:
 * - TypeScript compilation with error detection
 * - Temp file management (safe cleanup)
 * - Import error detection (TS2307)
 * - Type error detection (TS2304)
 * - Detailed error parsing with line/column numbers
 * - Concurrent compilation support
 */

import * as ts from 'typescript';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomBytes } from 'crypto';

/**
 * Compilation error details
 */
export interface CompilationError {
  code: string;
  type: 'import_error' | 'type_error' | 'syntax_error' | 'other';
  message: string;
  line?: number;
  column?: number;
  importPath?: string;
  identifier?: string;
}

/**
 * Compilation result
 */
export interface CompilationResult {
  success: boolean;
  errors: CompilationError[];
}

/**
 * Compiler options (subset of TypeScript CompilerOptions)
 */
export interface CompilerOptions {
  strict?: boolean;
  noImplicitAny?: boolean;
  target?: ts.ScriptTarget;
  module?: ts.ModuleKind;
  moduleResolution?: ts.ModuleResolutionKind;
  esModuleInterop?: boolean;
}

/**
 * TypeScript Compiler
 *
 * Compiles TypeScript code and detects errors without requiring a full project setup
 */
export class TypeScriptCompiler {
  private compilerOptions: ts.CompilerOptions;

  constructor(options: CompilerOptions = {}) {
    // Default compiler options (strict mode unless explicitly disabled)
    const strict = options.strict !== undefined ? options.strict : true;
    const noImplicitAny = options.noImplicitAny !== undefined ? options.noImplicitAny : true;

    this.compilerOptions = {
      strict,
      noImplicitAny,
      target: options.target || ts.ScriptTarget.ES2020,
      module: options.module || ts.ModuleKind.CommonJS,
      moduleResolution: options.moduleResolution || ts.ModuleResolutionKind.Node10,
      esModuleInterop: options.esModuleInterop !== false,
      skipLibCheck: true,
      skipDefaultLibCheck: true,
      noEmit: true,
      isolatedModules: false,
      lib: ['lib.es2020.d.ts']
    };
  }

  /**
   * Compile TypeScript code and detect errors
   *
   * @param code - TypeScript source code
   * @param filename - Optional filename for context (default: temp file)
   * @returns Compilation result with errors
   */
  async compile(code: string, filename?: string): Promise<CompilationResult> {
    let tempFilePath: string | null = null;

    try {
      // Empty code is valid
      if (!code.trim()) {
        return { success: true, errors: [] };
      }

      // Create temp file for compilation
      const tempFileName = filename || this.generateTempFileName();
      tempFilePath = path.join(os.tmpdir(), tempFileName);

      // Write code to temp file
      await fs.writeFile(tempFilePath, code, 'utf-8');

      // Compile using TypeScript API
      const program = ts.createProgram([tempFilePath], this.compilerOptions);
      const diagnostics = ts.getPreEmitDiagnostics(program);

      // Parse diagnostics into errors
      const errors = this.parseDiagnostics(diagnostics);

      return {
        success: errors.length === 0,
        errors
      };
    } catch (error) {
      // Internal error - return as compilation failure
      return {
        success: false,
        errors: [
          {
            code: 'INTERNAL',
            type: 'other',
            message: error instanceof Error ? error.message : String(error)
          }
        ]
      };
    } finally {
      // Always clean up temp file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Parse TypeScript diagnostics into compilation errors
   *
   * @param diagnostics - TypeScript diagnostics
   * @returns Array of compilation errors
   */
  private parseDiagnostics(diagnostics: readonly ts.Diagnostic[]): CompilationError[] {
    return diagnostics.map(diagnostic => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      const code = `TS${diagnostic.code}`;

      // Extract line and column numbers
      let line: number | undefined;
      let column: number | undefined;
      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line: lineNum, character } = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start
        );
        line = lineNum + 1; // Convert from 0-indexed to 1-indexed
        column = character + 1;
      }

      // Determine error type and extract metadata
      let type: CompilationError['type'] = 'other';
      let importPath: string | undefined;
      let identifier: string | undefined;

      if (diagnostic.code === 2307) {
        // TS2307: Cannot find module 'X'
        type = 'import_error';
        importPath = this.extractImportPath(message);
      } else if (diagnostic.code === 2304) {
        // TS2304: Cannot find name 'X'
        type = 'type_error';
        identifier = this.extractIdentifier(message);
      } else if (diagnostic.code === 2339 || diagnostic.code === 2551) {
        // TS2339: Property 'X' does not exist on type 'Y'
        // TS2551: Property 'X' does not exist on type 'Y'. Did you mean 'Z'?
        type = 'type_error';
        identifier = this.extractPropertyName(message);
      } else if (diagnostic.code >= 1000 && diagnostic.code < 2000) {
        // TS1xxx: Syntax errors
        type = 'syntax_error';
      }

      return {
        code,
        type,
        message,
        line,
        column,
        importPath,
        identifier
      };
    });
  }

  /**
   * Extract import path from TS2307 error message
   *
   * @param message - Error message
   * @returns Import path or undefined
   */
  private extractImportPath(message: string): string | undefined {
    // "Cannot find module 'xxx'" or "Cannot find module 'xxx' or its corresponding type declarations"
    const match = message.match(/Cannot find module ['"](.+?)['"]/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract identifier from TS2304 error message
   *
   * @param message - Error message
   * @returns Identifier or undefined
   */
  private extractIdentifier(message: string): string | undefined {
    // "Cannot find name 'xxx'"
    const match = message.match(/Cannot find name ['"](.+?)['"]/);
    return match ? match[1] : undefined;
  }

  /**
   * Extract property name from TS2339/TS2551 error message
   *
   * @param message - Error message
   * @returns Property name or undefined
   */
  private extractPropertyName(message: string): string | undefined {
    // "Property 'xxx' does not exist on type 'yyy'"
    // "Property 'xxx' does not exist on type 'yyy'. Did you mean 'zzz'?"
    const match = message.match(/Property ['"](.+?)['"] does not exist/);
    return match ? match[1] : undefined;
  }

  /**
   * Generate unique temp file name
   *
   * @returns Temp file name
   */
  private generateTempFileName(): string {
    const randomId = randomBytes(8).toString('hex');
    return `hallucination-check-${randomId}.ts`;
  }
}
