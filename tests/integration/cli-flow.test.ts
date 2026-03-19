import fs from 'fs';
import path from 'path';
import os from 'os';
import { ScanPipeline } from '../../src/scan/pipeline';
import { PatternScanner } from '../../src/scan/pattern-scanner';
import { SecurityTransform } from '../../src/scan/security-transform';
import { ConfirmationRequester } from '../../src/confirmation/requester';
import { DatabaseManager } from '../../src/storage/database';
import { AuditRepository } from '../../src/storage/audit-repository';
import { DecisionRepository } from '../../src/storage/decision-repository';
import { DecisionManager } from '../../src/decisions/manager';
import { adaptAllRules } from '../../src/rules/threat-rule-adapter';
import type { IConfirmationTransport, ScanEvent } from '../../src/interfaces/transport';
import type { ConfirmationRequest, ConfirmationResult } from '../../src/interfaces/confirmation';

const RULES_PATH = path.join(__dirname, '../../data/default-threat-rules.json');

function loadRules() {
  const raw = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));
  return adaptAllRules(raw).valid;
}

function makeTestTransport(action: 'allow' | 'block', scope: 'once' | 'session' | 'project' | 'always' = 'once'): IConfirmationTransport {
  return {
    name: 'test',
    connected: true,
    connect: async () => true,
    disconnect: async () => {},
    requestConfirmation: async (_req: ConfirmationRequest, _timeout: number): Promise<ConfirmationResult> => ({
      action,
      scope,
      source: 'terminal',
      responseTimeMs: 10,
    }),
    sendEvent: (_event: ScanEvent) => {},
  };
}

// Content that triggers wm-cmd-003: ;\s*rm\s+-rf
const DANGEROUS_CONTENT = '; rm -rf / --no-preserve-root';

describe('Integration: CLI scan -> confirm -> audit flow', () => {
  let tmpDir: string;
  let auditRepo: AuditRepository;
  let decisionManager: DecisionManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wardn-integ-'));
    const dm = DatabaseManager.getInstance(path.join(tmpDir, 'test.db'));
    const db = dm.getDb();
    auditRepo = new AuditRepository(db);
    const decisionRepo = new DecisionRepository(db);
    decisionManager = new DecisionManager(decisionRepo, 'integ-session');
  });

  afterEach(() => {
    DatabaseManager.resetInstance();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('full flow: detect violation -> block -> audit entry written', async () => {
    const rules = loadRules();
    const pipeline = new ScanPipeline();
    pipeline.register(new PatternScanner(rules));

    const transport = makeTestTransport('block');
    const requester = new ConfirmationRequester(transport, decisionManager, '/test-project', 'integ-session');

    const context = { projectDir: '/test-project', sessionId: 'integ-session' };

    // Scan for a known violation (command injection: ; rm -rf)
    const result = pipeline.scan(DANGEROUS_CONTENT, context);
    expect(result.violation).not.toBeNull();

    // Pass through confirmation
    const decision = await requester.handle(result.violation!);
    expect(decision.action).toBe('block');

    // Log to audit
    auditRepo.log({
      ruleId: result.violation!.ruleId,
      ruleName: result.violation!.ruleName,
      severity: result.violation!.severity,
      action: decision.action,
      source: decision.source as any,
      contentPreview: result.violation!.contentPreview,
      projectDir: context.projectDir,
      sessionId: context.sessionId,
      responseTimeMs: decision.responseTimeMs,
    });

    // Verify audit entry
    const audit = auditRepo.query({}, { page: 1, limit: 10 });
    expect(audit.total).toBe(1);
    expect(audit.items[0].action).toBe('block');
    expect(audit.items[0].projectDir).toBe('/test-project');
  });

  it('full flow: detect violation -> allow -> cached for session', async () => {
    const rules = loadRules();
    const pipeline = new ScanPipeline();
    pipeline.register(new PatternScanner(rules));

    const transport = makeTestTransport('allow', 'session');
    const requester = new ConfirmationRequester(transport, decisionManager, '/test-project', 'integ-session');

    const context = { projectDir: '/test-project', sessionId: 'integ-session' };

    // First scan -- hits transport
    const result1 = pipeline.scan(DANGEROUS_CONTENT, context);
    const decision1 = await requester.handle(result1.violation!);
    expect(decision1.action).toBe('allow');
    expect(decision1.source).toBe('terminal');

    // Second scan for same rule -- should hit cache
    const result2 = pipeline.scan(DANGEROUS_CONTENT, context);
    const decision2 = await requester.handle(result2.violation!);
    expect(decision2.action).toBe('allow');
    expect(decision2.source).toBe('cache');
  });

  it('SecurityTransform blocks data and stream continues', (done) => {
    const rules = loadRules();
    const pipeline = new ScanPipeline();
    pipeline.register(new PatternScanner(rules));

    const context = { projectDir: '/test', sessionId: 'integ-session' };

    // Suppress stderr output from chalk during test
    const origStderrWrite = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;

    const transform = new SecurityTransform(pipeline, context, auditRepo);
    const chunks: Buffer[] = [];

    transform.on('data', (chunk: Buffer) => chunks.push(chunk));
    transform.on('end', () => {
      process.stderr.write = origStderrWrite;
      const output = Buffer.concat(chunks).toString();

      // Safe chunk should pass, dangerous chunk should be dropped
      expect(output).toContain('safe output here');
      expect(output).not.toContain('rm -rf');

      // Audit should have one blocked entry
      const audit = auditRepo.query({}, { page: 1, limit: 10 });
      expect(audit.total).toBe(1);
      expect(audit.items[0].action).toBe('block');

      done();
    });

    transform.write('safe output here\n');
    transform.write(DANGEROUS_CONTENT + '\n');
    transform.write('another safe line\n');
    transform.end();
  });

  it('safe content passes through without any audit entries', (done) => {
    const rules = loadRules();
    const pipeline = new ScanPipeline();
    pipeline.register(new PatternScanner(rules));

    const context = { projectDir: '/test', sessionId: 'integ-session' };
    const transform = new SecurityTransform(pipeline, context, auditRepo);
    const chunks: Buffer[] = [];

    transform.on('data', (chunk: Buffer) => chunks.push(chunk));
    transform.on('end', () => {
      const output = Buffer.concat(chunks).toString();
      expect(output).toBe('hello world\nfoo bar\n');

      const audit = auditRepo.query({}, { page: 1, limit: 10 });
      expect(audit.total).toBe(0);
      done();
    });

    transform.write('hello world\n');
    transform.write('foo bar\n');
    transform.end();
  });
});
