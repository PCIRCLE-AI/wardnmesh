import fs from 'fs';
import path from 'path';
import { ScanPipeline } from '../../src/scan/pipeline';
import { PatternScanner } from '../../src/scan/pattern-scanner';
import { adaptAllRules } from '../../src/rules/threat-rule-adapter';
import type { Scanner, ScanResult, ScanContext } from '../../src/interfaces/scan';

const RULES_PATH = path.join(__dirname, '../../data/default-threat-rules.json');

function loadBundledRules() {
  const raw = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));
  return adaptAllRules(raw).valid;
}

describe('ScanPipeline', () => {
  it('returns null violation when no match', () => {
    const pipeline = new ScanPipeline();
    const rules = loadBundledRules();
    pipeline.register(new PatternScanner(rules));

    const result = pipeline.scan('normal safe content here', {
      projectDir: '/test',
      sessionId: 'test-session',
    });

    expect(result.violation).toBeNull();
  });

  it('detects dangerous function call pattern', () => {
    const pipeline = new ScanPipeline();
    const rules = loadBundledRules();
    pipeline.register(new PatternScanner(rules));

    // wm-code-003 matches rm -rf pattern
    const result = pipeline.scan('rm -rf / --no-preserve-root', {
      projectDir: '/test',
      sessionId: 'test-session',
    });

    expect(result.violation).not.toBeNull();
    expect(result.violation!.severity).toBeDefined();
  });

  it('short-circuits on first violation', () => {
    let scanner1Called = false;
    let scanner2Called = false;

    const mockScanner1: Scanner = {
      name: 'scanner1',
      phase: 'stdout',
      scan: (_content: string, _context: ScanContext): ScanResult => {
        scanner1Called = true;
        return {
          violation: {
            ruleId: 'test',
            ruleName: 'Test',
            category: 'safety',
            severity: 'critical',
            matchedPattern: 'test',
            contentPreview: 'test',
          },
          scanDurationMs: 0,
          scannerType: 'content',
        };
      },
    };

    const mockScanner2: Scanner = {
      name: 'scanner2',
      phase: 'stdout',
      scan: (_content: string, _context: ScanContext): ScanResult => {
        scanner2Called = true;
        return { violation: null, scanDurationMs: 0, scannerType: 'content' };
      },
    };

    const pipeline = new ScanPipeline();
    pipeline.register(mockScanner1);
    pipeline.register(mockScanner2);

    pipeline.scan('test', { projectDir: '/test', sessionId: 's1' });

    expect(scanner1Called).toBe(true);
    expect(scanner2Called).toBe(false);
  });

  it('scan performance: 243 rules in under 5ms for safe content', () => {
    const pipeline = new ScanPipeline();
    const rules = loadBundledRules();
    pipeline.register(new PatternScanner(rules));

    const context: ScanContext = { projectDir: '/test', sessionId: 'perf-test' };
    const safeContent = 'const x = 42; console.log("hello world");';

    // Warm up regex cache
    pipeline.scan(safeContent, context);

    // Measure
    const iterations = 100;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      pipeline.scan(safeContent, context);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    expect(avgMs).toBeLessThan(5); // < 5ms per scan
  });
});

describe('PatternScanner', () => {
  it('returns violation info with content preview', () => {
    const rules = loadBundledRules();
    const scanner = new PatternScanner(rules);

    // wm-code-005 matches {{...}} template injection
    const result = scanner.scan('render({{user.password}})', {
      projectDir: '/test',
      sessionId: 's1',
    });

    expect(result.violation).not.toBeNull();
    expect(result.violation!.contentPreview.length).toBeLessThanOrEqual(200);
    expect(result.violation!.matchedPattern).toBeTruthy();
  });

  it('reports scanner count', () => {
    const rules = loadBundledRules();
    const scanner = new PatternScanner(rules);
    expect(scanner.getRuleCount()).toBeGreaterThan(200);
  });
});
