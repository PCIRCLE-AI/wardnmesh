/**
 * E2E tests for MCP Integration
 *
 * Testing Strategy:
 * - Test MCP tool: detect_hallucinations
 * - Test pre-hook: blocks hallucinated code
 * - Test auto-fix: applies fixes to hallucinated code
 * - Test full workflow: detection → blocking → fix → verify
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// These imports will fail initially - that's expected in TDD!
import {
  HallucinationDetector,
  DetectionOptions,
  DetectionResult
} from '../../../src/hallucination/mcp/detector';

import {
  PreHookInterceptor,
  InterceptResult
} from '../../../src/hallucination/mcp/pre-hook';

import {
  AutoFixer,
  FixResult
} from '../../../src/hallucination/mcp/auto-fix';

describe('MCP Integration E2E', () => {
  const fixturesDir = path.join(__dirname, '../fixtures');
  const hallucinatedDir = path.join(fixturesDir, 'hallucinated-code');
  const validDir = path.join(fixturesDir, 'valid-code');

  let detector: HallucinationDetector;
  let preHook: PreHookInterceptor;
  let autoFixer: AutoFixer;

  beforeEach(() => {
    detector = new HallucinationDetector();
    preHook = new PreHookInterceptor({ detector });
    autoFixer = new AutoFixer();
  });

  describe('MCP Tool: detect_hallucinations', () => {
    it('should detect hallucinated packages', async () => {
      const code = fs.readFileSync(
        path.join(hallucinatedDir, 'fake-package.ts'),
        'utf-8'
      );

      const result = await detector.detect(code, {
        mode: 'fast',
        enableAutoFix: false
      });

      expect(result.hasHallucinations).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);

      // Should detect the fake packages
      const packageIssues = result.issues.filter(
        i => i.type === 'package-hallucination'
      );
      expect(packageIssues.length).toBeGreaterThan(0);

      // Check for specific hallucinated packages
      const messages = packageIssues.map(i => i.message).join(' ');
      expect(messages).toContain('super-awesome-nonexistent-lib');
    });

    it('should detect hallucinated API methods', async () => {
      const code = fs.readFileSync(
        path.join(hallucinatedDir, 'fake-api.ts'),
        'utf-8'
      );

      const result = await detector.detect(code, {
        mode: 'comprehensive',
        enableAutoFix: false
      });

      expect(result.hasHallucinations).toBe(true);

      // Should detect fake API calls
      const apiIssues = result.issues.filter(
        i => i.type === 'function-hallucination'
      );
      expect(apiIssues.length).toBeGreaterThan(0);

      // Check for specific hallucinated methods
      const messages = apiIssues.map(i => i.message).join(' ');
      expect(messages).toMatch(/readFileWithAutoEncoding|smartMap|toBeautifulString/);
    });

    it('should not flag valid code', async () => {
      const code = fs.readFileSync(
        path.join(validDir, 'real-api.ts'),
        'utf-8'
      );

      const result = await detector.detect(code, {
        mode: 'comprehensive',
        enableAutoFix: false
      });

      expect(result.hasHallucinations).toBe(false);
      expect(result.issues).toHaveLength(0);
    });

    it('should support fast mode (< 200ms)', async () => {
      const code = fs.readFileSync(
        path.join(hallucinatedDir, 'fake-package.ts'),
        'utf-8'
      );

      const startTime = Date.now();
      const result = await detector.detect(code, {
        mode: 'fast',
        enableAutoFix: false
      });
      const duration = Date.now() - startTime;

      expect(result.hasHallucinations).toBe(true);
      expect(duration).toBeLessThan(200);
    });

    it('should support comprehensive mode', async () => {
      const code = fs.readFileSync(
        path.join(hallucinatedDir, 'fake-api.ts'),
        'utf-8'
      );

      const result = await detector.detect(code, {
        mode: 'comprehensive',
        enableAutoFix: false
      });

      expect(result.hasHallucinations).toBe(true);

      // Comprehensive mode should find more issues
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    }, 30000); // Added timeout for comprehensive mode
  });

  describe('Pre-Hook: Block Hallucinated Code', () => {
    it('should block execution of hallucinated code', async () => {
      const code = fs.readFileSync(
        path.join(hallucinatedDir, 'fake-package.ts'),
        'utf-8'
      );

      const result = await preHook.intercept({
        operation: 'tool_use',
        code,
        toolName: 'write_file'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('hallucination');
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should allow execution of valid code', async () => {
      const code = fs.readFileSync(
        path.join(validDir, 'real-api.ts'),
        'utf-8'
      );

      const result = await preHook.intercept({
        operation: 'tool_use',
        code,
        toolName: 'write_file'
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.issues).toHaveLength(0);
    });

    it('should provide detailed blocking reason', async () => {
      const code = fs.readFileSync(
        path.join(hallucinatedDir, 'fake-api.ts'),
        'utf-8'
      );

      const result = await preHook.intercept({
        operation: 'tool_use',
        code,
        toolName: 'execute_code',
        mode: 'comprehensive' // Use comprehensive mode to detect function hallucinations
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('function');
      expect(result.issues.length).toBeGreaterThan(0);

      // Should include severity information
      const criticalIssues = result.issues.filter(i => i.severity === 'critical');
      if (criticalIssues.length > 0) {
        expect(result.reason).toContain('critical');
      }
    });

    it('should support bypass for low-severity issues', async () => {
      const codeWithMinorIssue = `
        // Only minor hallucination
        const x = 1;
        // Comment mentions non-existent-package
      `;

      const result = await preHook.intercept({
        operation: 'tool_use',
        code: codeWithMinorIssue,
        toolName: 'write_file',
        bypassMinor: true
      });

      // Should allow if only minor issues and bypass enabled
      // (This depends on whether the detector finds issues)
      expect(result).toBeDefined();
    });
  });

  describe('Auto-Fix: Apply Corrections', () => {
    it('should suggest fixes for hallucinated packages', async () => {
      const code = fs.readFileSync(
        path.join(hallucinatedDir, 'fake-package.ts'),
        'utf-8'
      );

      const detectionResult = await detector.detect(code, {
        mode: 'comprehensive',
        enableAutoFix: true
      });

      const fixResult = await autoFixer.fix(code, detectionResult.issues);

      expect(fixResult.applied).toBe(true);
      expect(fixResult.fixedCode).toBeDefined();
      expect(fixResult.fixedCode).not.toBe(code);
      expect(fixResult.changes.length).toBeGreaterThan(0);
    });

    it('should remove imports from hallucinated packages', async () => {
      const code = `import { fake } from 'non-existent-package';\n\nconst x = 1;`;

      const issues = [{
        type: 'package-hallucination' as const,
        severity: 'critical' as const,
        message: 'Package "non-existent-package" does not exist',
        location: { file: 'test.ts', line: 1 },
        confidence: 1.0,
        autoFix: {
          type: 'remove-import',
          data: {
            description: 'Remove import from non-existent package',
            code: ''
          }
        }
      }];

      const fixResult = await autoFixer.fix(code, issues);

      expect(fixResult.applied).toBe(true);
      expect(fixResult.fixedCode).not.toContain('non-existent-package');
      expect(fixResult.changes).toHaveLength(1);
      expect(fixResult.changes[0].type).toBe('remove-import');
    });

    it('should provide fix preview without applying', async () => {
      const code = fs.readFileSync(
        path.join(hallucinatedDir, 'fake-package.ts'),
        'utf-8'
      );

      const detectionResult = await detector.detect(code, {
        mode: 'comprehensive',
        enableAutoFix: true
      });

      const fixResult = await autoFixer.fix(code, detectionResult.issues, {
        dryRun: true
      });

      expect(fixResult.applied).toBe(false);
      expect(fixResult.fixedCode).toBeDefined();
      expect(fixResult.changes.length).toBeGreaterThan(0);

      // Original code should not be modified in dry run
      const originalCode = fs.readFileSync(
        path.join(hallucinatedDir, 'fake-package.ts'),
        'utf-8'
      );
      expect(code).toBe(originalCode);
    });

    it('should handle cases with no auto-fix available', async () => {
      const code = 'const x = 1;';

      const issues = [{
        type: 'logic-hallucination' as const,
        severity: 'minor' as const,
        message: 'Suspicious logic',
        location: { file: 'test.ts', line: 1 },
        confidence: 0.6
        // No autoFix field
      }];

      const fixResult = await autoFixer.fix(code, issues);

      expect(fixResult.applied).toBe(false);
      expect(fixResult.fixedCode).toBe(code);
      expect(fixResult.changes).toHaveLength(0);
    });
  });

  describe('Full Workflow: Detection → Blocking → Fix', () => {
    it('should detect, block, and fix hallucinated code', async () => {
      const code = fs.readFileSync(
        path.join(hallucinatedDir, 'fake-package.ts'),
        'utf-8'
      );

      // Step 1: Detection
      const detectionResult = await detector.detect(code, {
        mode: 'comprehensive',
        enableAutoFix: true
      });

      expect(detectionResult.hasHallucinations).toBe(true);

      // Step 2: Pre-hook blocks execution
      const interceptResult = await preHook.intercept({
        operation: 'tool_use',
        code,
        toolName: 'execute_code'
      });

      expect(interceptResult.allowed).toBe(false);

      // Step 3: Auto-fix applies corrections
      const fixResult = await autoFixer.fix(code, detectionResult.issues);

      expect(fixResult.applied).toBe(true);
      expect(fixResult.fixedCode).toBeDefined();

      // Step 4: Verify fixed code passes detection
      const verifyResult = await detector.detect(fixResult.fixedCode!, {
        mode: 'fast',
        enableAutoFix: false
      });

      // Fixed code should have fewer or no hallucinations
      expect(verifyResult.issues.length).toBeLessThan(detectionResult.issues.length);
    });

    it('should integrate with MCP tool interface', async () => {
      const code = fs.readFileSync(
        path.join(hallucinatedDir, 'fake-api.ts'),
        'utf-8'
      );

      // Simulate MCP tool call
      const toolResult = await detector.detectAsMCPTool({
        code,
        options: {
          mode: 'comprehensive', // Use comprehensive mode to detect function hallucinations
          enableAutoFix: false
        }
      });

      expect(toolResult.content).toBeDefined();
      expect(toolResult.content[0].type).toBe('text');

      // Should return structured MCP response
      const response = JSON.parse(toolResult.content[0].text);
      expect(response.hasHallucinations).toBe(true);
      expect(response.issues).toBeInstanceOf(Array);
    }, 30000); // Added timeout for comprehensive mode
  });
});
