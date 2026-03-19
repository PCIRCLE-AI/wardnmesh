import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfirmationRequester } from '../../src/confirmation/requester';
import { DecisionManager } from '../../src/decisions/manager';
import { DecisionRepository } from '../../src/storage/decision-repository';
import { DatabaseManager } from '../../src/storage/database';
import type { IConfirmationTransport, ScanEvent } from '../../src/interfaces/transport';
import type { ConfirmationRequest, ConfirmationResult } from '../../src/interfaces/confirmation';
import type { ViolationInfo } from '../../src/interfaces/scan';

function makeViolation(ruleId = 'wm-test-001'): ViolationInfo {
  return {
    ruleId,
    ruleName: `Test Rule ${ruleId}`,
    category: 'safety',
    severity: 'critical',
    matchedPattern: 'test',
    contentPreview: 'test content preview',
  };
}

function makeTransport(action: 'allow' | 'block', scope: 'once' | 'session' | 'project' | 'always' = 'once'): IConfirmationTransport {
  return {
    name: 'test',
    connected: true,
    connect: async () => true,
    disconnect: async () => {},
    requestConfirmation: async (_req: ConfirmationRequest, _timeout: number): Promise<ConfirmationResult> => ({
      action,
      scope,
      source: 'terminal',
      responseTimeMs: 50,
    }),
    sendEvent: (_event: ScanEvent) => {},
  };
}

function makeErrorTransport(): IConfirmationTransport {
  return {
    name: 'error-transport',
    connected: true,
    connect: async () => true,
    disconnect: async () => {},
    requestConfirmation: async () => {
      throw new Error('Transport error');
    },
    sendEvent: () => {},
  };
}

describe('ConfirmationRequester', () => {
  let tmpDir: string;
  let decisionManager: DecisionManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wardn-conf-'));
    const dm = DatabaseManager.getInstance(path.join(tmpDir, 'test.db'));
    const repo = new DecisionRepository(dm.getDb());
    decisionManager = new DecisionManager(repo, 'test-session');
  });

  afterEach(() => {
    DatabaseManager.resetInstance();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns allow from transport', async () => {
    const transport = makeTransport('allow');
    const requester = new ConfirmationRequester(transport, decisionManager, '/project', 'test-session');

    const result = await requester.handle(makeViolation());
    expect(result.action).toBe('allow');
    expect(result.source).toBe('terminal');
  });

  it('returns block from transport', async () => {
    const transport = makeTransport('block');
    const requester = new ConfirmationRequester(transport, decisionManager, '/project', 'test-session');

    const result = await requester.handle(makeViolation());
    expect(result.action).toBe('block');
  });

  it('returns cached decision on second call (session scope)', async () => {
    const transport = makeTransport('allow', 'session');
    const requester = new ConfirmationRequester(transport, decisionManager, '/project', 'test-session');

    // First call — hits transport
    const result1 = await requester.handle(makeViolation('wm-cache-test'));
    expect(result1.source).toBe('terminal');

    // Second call — should hit cache
    const result2 = await requester.handle(makeViolation('wm-cache-test'));
    expect(result2.source).toBe('cache');
    expect(result2.action).toBe('allow');
  });

  it('does not cache once-scoped decisions', async () => {
    let callCount = 0;
    const transport: IConfirmationTransport = {
      name: 'counting',
      connected: true,
      connect: async () => true,
      disconnect: async () => {},
      requestConfirmation: async (): Promise<ConfirmationResult> => {
        callCount++;
        return { action: 'allow', scope: 'once', source: 'terminal', responseTimeMs: 10 };
      },
      sendEvent: () => {},
    };

    const requester = new ConfirmationRequester(transport, decisionManager, '/project', 'test-session');

    await requester.handle(makeViolation('wm-once-test'));
    await requester.handle(makeViolation('wm-once-test'));

    // Both calls should hit transport (not cached)
    expect(callCount).toBe(2);
  });

  it('blocks on transport error (fail-closed)', async () => {
    const transport = makeErrorTransport();
    const requester = new ConfirmationRequester(transport, decisionManager, '/project', 'test-session');

    const result = await requester.handle(makeViolation());
    expect(result.action).toBe('block');
    expect(result.source).toBe('timeout');
  });

  it('caches always-scoped decisions across different rules', async () => {
    const transport = makeTransport('block', 'always');
    const requester = new ConfirmationRequester(transport, decisionManager, '/project', 'test-session');

    await requester.handle(makeViolation('wm-always-001'));

    // Same rule, different check — should be cached
    const result = await requester.handle(makeViolation('wm-always-001'));
    expect(result.source).toBe('cache');
    expect(result.action).toBe('block');
  });

  it('project-scoped cache is isolated per project', async () => {
    const transport = makeTransport('allow', 'project');
    const requester1 = new ConfirmationRequester(transport, decisionManager, '/project-a', 'test-session');
    const requester2 = new ConfirmationRequester(transport, decisionManager, '/project-b', 'test-session');

    await requester1.handle(makeViolation('wm-proj-test'));

    // Same rule, different project — should NOT be cached
    let callCount = 0;
    const countingTransport: IConfirmationTransport = {
      ...transport,
      requestConfirmation: async (): Promise<ConfirmationResult> => {
        callCount++;
        return { action: 'allow', scope: 'project', source: 'terminal', responseTimeMs: 10 };
      },
    };
    const requester3 = new ConfirmationRequester(countingTransport, decisionManager, '/project-b', 'test-session');
    await requester3.handle(makeViolation('wm-proj-test'));
    expect(callCount).toBe(1); // Had to ask transport
  });
});
