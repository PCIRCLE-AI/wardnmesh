/**
 * MCP Hallucination Detector
 *
 * Main entry point for hallucination detection via MCP.
 * Integrates all detection layers and provides MCP tool interface.
 */

import { DetectionOrchestrator, DetectionLayer } from '../integration/detection-orchestrator';
import { HallucinationIssue } from '../types';
import { extractImports } from '../detectors/import-analyzer';
import { TypeScriptCompiler } from '../runtime/typescript-compiler';
import { NpmRegistryClient } from '../npm/registry-client';
import { VersionCompatibilityChecker } from '../npm/version-compatibility';
import { validateNonEmptyString, validateObject } from '../utils/validation';

/**
 * Detection mode
 */
export type DetectionMode = 'fast' | 'comprehensive';

/**
 * Detection options
 */
export interface DetectionOptions {
  /** Detection mode (fast < 200ms, comprehensive = all layers) */
  mode: DetectionMode;

  /** Enable auto-fix suggestions */
  enableAutoFix: boolean;

  /** Additional options */
  timeout?: number;
  includeSources?: boolean;
}

/**
 * Detection result
 */
export interface DetectionResult {
  /** Whether hallucinations were detected */
  hasHallucinations: boolean;

  /** List of detected issues */
  issues: HallucinationIssue[];

  /** Execution time in milliseconds */
  executionTime: number;

  /** Detection mode used */
  mode: DetectionMode;

  /** Layers that were run */
  layersRun: string[];
}

/**
 * MCP Tool Result
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

/**
 * Hallucination Detector
 *
 * Orchestrates detection layers and provides MCP tool interface
 */
export class HallucinationDetector {
  private orchestrator: DetectionOrchestrator;
  private npmClient: NpmRegistryClient;

  constructor() {
    this.orchestrator = new DetectionOrchestrator();
    this.npmClient = new NpmRegistryClient();

    // Register detection layers
    this.registerLayers();
  }

  /**
   * Register all detection layers
   */
  private registerLayers(): void {
    // Layer 1: Import Analysis (fast)
    const importLayer: DetectionLayer = {
      name: 'import-analysis',
      priority: 1,
      timeout: 50,
      detect: async (code: string) => {
        // Simple import extraction - just identify imports
        // Full validation happens in other layers
        const imports = await extractImports(code);
        // For now, return empty array (validation in package layer)
        return [];
      }
    };

    // Layer 2: Package Validation (fast)
    const packageLayer: DetectionLayer = {
      name: 'package-validation',
      priority: 2,
      timeout: 150,
      detect: async (code: string) => {
        const imports = await extractImports(code);
        const issues: HallucinationIssue[] = [];

        for (const imp of imports) {
          // Only check non-relative imports (external packages)
          if (imp.source && !imp.isRelative) {
            const packageName = imp.source.split('/')[0];
            const exists = await this.npmClient.checkPackageExists(packageName);
            if (!exists) {
              issues.push({
                type: 'package-hallucination',
                severity: 'critical',
                message: `Package "${packageName}" does not exist on npm`,
                location: { file: 'code.ts' },
                confidence: 1.0
              });
            }
          }
        }

        return issues;
      }
    };

    // Layer 3: TypeScript Compilation (comprehensive)
    const compilerLayer: DetectionLayer = {
      name: 'typescript-compilation',
      priority: 3,
      timeout: 500,
      detect: async (code: string) => {
        const compiler = new TypeScriptCompiler();
        const result = await compiler.compile(code);

        // Convert CompilationErrors to HallucinationIssues
        return result.errors.map(error => ({
          type: error.type === 'import_error' ? 'import-hallucination' :
                error.type === 'type_error' ? 'function-hallucination' :
                'logic-hallucination',
          severity: 'major' as const,
          message: error.message,
          location: {
            file: 'code.ts',
            line: error.line,
            column: error.column
          },
          confidence: 0.9
        })) as HallucinationIssue[];
      }
    };

    // Layer 4: Version Compatibility (comprehensive)
    const versionLayer: DetectionLayer = {
      name: 'version-compatibility',
      priority: 4,
      timeout: 300,
      detect: async (code: string) => {
        const checker = new VersionCompatibilityChecker(this.npmClient);
        const imports = await extractImports(code);
        const issues: HallucinationIssue[] = [];

        for (const imp of imports) {
          // Only check non-relative imports (external packages)
          if (imp.source && !imp.isRelative) {
            const packageName = imp.source.split('/')[0];
            try {
              // Check each imported member individually
              const members = imp.names || [];

              for (const memberName of members) {
                const result = await checker.checkApiAvailability(
                  packageName,
                  '*', // Use wildcard to represent "latest/any version"
                  memberName
                );

                // If API is not available and requires upgrade, it's a potential issue
                if (result && !result.available && result.requiresUpgrade) {
                  issues.push({
                    type: 'api-version-hallucination',
                    severity: 'major',
                    message: `API "${memberName}" requires upgrade to version ${result.firstAvailableVersion || 'unknown'}`,
                    location: { file: 'code.ts' },
                    confidence: 0.8
                  });
                }
              }
            } catch {
              // Ignore errors for packages that don't exist
              // (already caught by package-validation layer)
            }
          }
        }

        return issues;
      }
    };

    // Register all layers
    this.orchestrator.registerLayer(importLayer);
    this.orchestrator.registerLayer(packageLayer);
    this.orchestrator.registerLayer(compilerLayer);
    this.orchestrator.registerLayer(versionLayer);
  }

  /**
   * Detect hallucinations in code
   *
   * @param code - Code to analyze
   * @param options - Detection options
   * @returns Detection result
   */
  async detect(code: string, options: DetectionOptions): Promise<DetectionResult> {
    // Validate inputs
    validateNonEmptyString(code, 'code');
    validateObject(options, 'options');

    if (options.mode !== 'fast' && options.mode !== 'comprehensive') {
      throw new TypeError(`options.mode must be 'fast' or 'comprehensive', got '${options.mode}'`);
    }

    if (typeof options.enableAutoFix !== 'boolean') {
      throw new TypeError(`options.enableAutoFix must be a boolean, got ${typeof options.enableAutoFix}`);
    }

    const startTime = Date.now();

    // Run detection based on mode
    const orchestratorResult = options.mode === 'fast'
      ? await this.orchestrator.detectFast(code)
      : await this.orchestrator.detectAll(code);

    // Add auto-fix suggestions if enabled
    if (options.enableAutoFix) {
      orchestratorResult.issues.forEach(issue => {
        if (!issue.autoFix) {
          issue.autoFix = this.generateAutoFix(issue);
        }
      });
    }

    const executionTime = Date.now() - startTime;

    return {
      hasHallucinations: orchestratorResult.issues.length > 0,
      issues: orchestratorResult.issues,
      executionTime,
      mode: options.mode,
      layersRun: orchestratorResult.layersRun
    };
  }

  /**
   * Generate auto-fix suggestion for an issue
   *
   * @param issue - Issue to generate fix for
   * @returns Auto-fix suggestion
   */
  private generateAutoFix(issue: HallucinationIssue): HallucinationIssue['autoFix'] {
    if (issue.type === 'package-hallucination') {
      return {
        type: 'remove-import',
        data: {
          description: 'Remove import from non-existent package',
          code: ''
        }
      };
    }

    if (issue.type === 'function-hallucination') {
      return {
        type: 'comment-out',
        data: {
          description: 'Comment out hallucinated function call',
          code: '// ' + (issue.location?.line ? `Line ${issue.location.line}` : 'TODO: Fix hallucinated API call')
        }
      };
    }

    return undefined;
  }

  /**
   * Detect hallucinations as MCP tool
   *
   * @param params - MCP tool parameters
   * @returns MCP tool result
   */
  async detectAsMCPTool(params: {
    code: string;
    options?: Partial<DetectionOptions>;
  }): Promise<MCPToolResult> {
    // Validate inputs
    validateObject(params, 'params');
    validateNonEmptyString(params.code, 'params.code');

    if (params.options !== undefined) {
      validateObject(params.options, 'params.options');
    }

    const options: DetectionOptions = {
      mode: params.options?.mode || 'fast',
      enableAutoFix: params.options?.enableAutoFix ?? false,
      ...params.options
    };

    const result = await this.detect(params.code, options);

    const response = {
      hasHallucinations: result.hasHallucinations,
      issues: result.issues,
      executionTime: result.executionTime,
      mode: result.mode,
      layersRun: result.layersRun
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }
}
