import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfirmationRequester } from '../../src/confirmation/requester';
import { DatabaseManager } from '../../src/storage/database';
import { DecisionRepository } from '../../src/storage/decision-repository';
import { DecisionManager } from '../../src/decisions/manager';
import type { IConfirmationTransport, ScanEvent } from '../../src/interfaces/transport';
import type { ConfirmationRequest, ConfirmationResult, ConfirmationSource } from '../../src/interfaces/confirmation';
import type { ViolationInfo } from '../../src/interfaces/scan';

function makeViolation(): ViolationInfo {
  return {
    ruleId: 'wm-test-001',
    ruleName: 'Test Violation',
    category: 'safety',
    severity: 'critical',
    matchedPattern: 'test',
    contentPreview: 'dangerous content',
  };
}

describe('Integration: Fallback and timeout behavior', () => {
  let tmpDir: string;
  let decisionManager: DecisionManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wardn-fb-'));
    const dm = DatabaseManager.getInstance(path.join(tmpDir, 'test.db'));
    const decisionRepo = new DecisionRepository(dm.getDb());
    decisionManager = new DecisionManager(decisionRepo, 'fb-session');
  });

  afterEach(() => {
    DatabaseManager.resetInstance();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('timeout results in block (fail-closed)', async () => {
    // Transport that simulates a timeout response
    const slowTransport: IConfirmationTransport = {
      name: 'slow',
      connected: true,
      connect: async () => true,
      disconnect: async () => {},
      requestConfirmation: async (_req: ConfirmationRequest, timeoutMs: number): Promise<ConfirmationResult> => {
        // Simulate transport timeout by returning block after a short delay
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              action: 'block',
              scope: 'once',
              source: 'timeout' as ConfirmationSource,
              responseTimeMs: timeoutMs,
            });
          }, 50);
        });
      },
      sendEvent: (_event: ScanEvent) => {},
    };

    const requester = new ConfirmationRequester(slowTransport, decisionManager, '/project', 'fb-session');
    const result = await requester.handle(makeViolation());

    expect(result.action).toBe('block');
  });

  it('transport error results in block (fail-closed)', async () => {
    const brokenTransport: IConfirmationTransport = {
      name: 'broken',
      connected: true,
      connect: async () => true,
      disconnect: async () => {},
      requestConfirmation: async (): Promise<ConfirmationResult> => {
        throw new Error('Socket disconnected');
      },
      sendEvent: () => {},
    };

    const requester = new ConfirmationRequester(brokenTransport, decisionManager, '/project', 'fb-session');
    const result = await requester.handle(makeViolation());

    expect(result.action).toBe('block');
    expect(result.source).toBe('timeout');
  });

  it('multiple violations use independent decisions', async () => {
    let callCount = 0;
    const transport: IConfirmationTransport = {
      name: 'alternating',
      connected: true,
      connect: async () => true,
      disconnect: async () => {},
      requestConfirmation: async (): Promise<ConfirmationResult> => {
        callCount++;
        return {
          action: callCount % 2 === 1 ? 'allow' : 'block',
          scope: 'once',
          source: 'terminal',
          responseTimeMs: 10,
        };
      },
      sendEvent: () => {},
    };

    const requester = new ConfirmationRequester(transport, decisionManager, '/project', 'fb-session');

    const v1: ViolationInfo = { ...makeViolation(), ruleId: 'rule-1' };
    const v2: ViolationInfo = { ...makeViolation(), ruleId: 'rule-2' };
    const v3: ViolationInfo = { ...makeViolation(), ruleId: 'rule-3' };

    const r1 = await requester.handle(v1);
    const r2 = await requester.handle(v2);
    const r3 = await requester.handle(v3);

    expect(r1.action).toBe('allow');
    expect(r2.action).toBe('block');
    expect(r3.action).toBe('allow');
  });

  it('always-scoped decision persists across requester instances', async () => {
    const transport: IConfirmationTransport = {
      name: 'test',
      connected: true,
      connect: async () => true,
      disconnect: async () => {},
      requestConfirmation: async (): Promise<ConfirmationResult> => ({
        action: 'block' as const,
        scope: 'always' as const,
        source: 'terminal' as ConfirmationSource,
        responseTimeMs: 10,
      }),
      sendEvent: () => {},
    };

    // First requester creates the always decision
    const requester1 = new ConfirmationRequester(transport, decisionManager, '/project', 'fb-session');
    await requester1.handle(makeViolation());

    // Second requester (new session) should find it cached via SQLite
    const dm = DatabaseManager.getInstance();
    const decisionRepo2 = new DecisionRepository(dm.getDb());
    const decisionManager2 = new DecisionManager(decisionRepo2, 'new-session');

    let transportCalled = false;
    const transport2: IConfirmationTransport = {
      name: 'test2',
      connected: true,
      connect: async () => true,
      disconnect: async () => {},
      requestConfirmation: async (): Promise<ConfirmationResult> => {
        transportCalled = true;
        return { action: 'allow' as const, scope: 'once' as const, source: 'terminal' as ConfirmationSource, responseTimeMs: 10 };
      },
      sendEvent: () => {},
    };

    const requester2 = new ConfirmationRequester(transport2, decisionManager2, '/project', 'new-session');
    const result = await requester2.handle(makeViolation());

    expect(result.source).toBe('cache');
    expect(result.action).toBe('block');
    expect(transportCalled).toBe(false);
  });
});
