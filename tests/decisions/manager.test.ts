import { DatabaseManager } from '../../src/storage/database';
import { DecisionRepository } from '../../src/storage/decision-repository';
import { DecisionManager } from '../../src/decisions/manager';
import type { ViolationInfo } from '../../src/interfaces/scan';
import fs from 'fs';
import path from 'path';
import os from 'os';

const makeViolation = (ruleId: string): ViolationInfo => ({
  ruleId,
  ruleName: `Test Rule ${ruleId}`,
  category: 'safety',
  severity: 'critical',
  matchedPattern: 'test-pattern',
  contentPreview: 'test content',
});

describe('DecisionManager', () => {
  let tmpDir: string;
  let manager: DecisionManager;
  let repo: DecisionRepository;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wardn-test-'));
    const dm = DatabaseManager.getInstance(path.join(tmpDir, 'test.db'));
    repo = new DecisionRepository(dm.getDb());
    manager = new DecisionManager(repo, 'session-1');
  });

  afterEach(() => {
    DatabaseManager.resetInstance();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when no decision exists', () => {
    const result = manager.check('wm-code-001', '/project');
    expect(result).toBeNull();
  });

  it('records and retrieves always-scoped decision', () => {
    manager.record(makeViolation('wm-code-001'), 'allow', 'always', '/project');

    const result = manager.check('wm-code-001', '/project');
    expect(result).not.toBeNull();
    expect(result!.approved).toBe(true);
  });

  it('does not cache once-scoped decisions', () => {
    manager.record(makeViolation('wm-code-001'), 'allow', 'once', '/project');

    const result = manager.check('wm-code-001', '/project');
    expect(result).toBeNull();
  });

  it('session-scoped decisions are isolated per session', () => {
    manager.record(makeViolation('wm-code-001'), 'block', 'session', '/project');

    // Same session via same manager
    const found = manager.check('wm-code-001', '/project');
    expect(found).not.toBeNull();
    expect(found!.approved).toBe(false);

    // Different session via different manager
    const manager2 = new DecisionManager(repo, 'session-2');
    const notFound = manager2.check('wm-code-001', '/project');
    expect(notFound).toBeNull();
  });

  it('project-scoped decisions are isolated per project', () => {
    manager.record(makeViolation('wm-code-001'), 'allow', 'project', '/project-a');

    const found = manager.check('wm-code-001', '/project-a');
    expect(found).not.toBeNull();

    const notFound = manager.check('wm-code-001', '/project-b');
    expect(notFound).toBeNull();
  });

  it('revokes a decision', () => {
    manager.record(makeViolation('wm-code-001'), 'allow', 'always', '/project');

    const decisions = manager.list();
    expect(decisions.length).toBe(1);

    const revoked = manager.revoke(decisions[0].id!);
    expect(revoked).toBe(true);

    const result = manager.check('wm-code-001', '/project');
    expect(result).toBeNull();
  });

  it('clears decisions by scope', () => {
    manager.record(makeViolation('r1'), 'allow', 'always', '/p');
    manager.record(makeViolation('r2'), 'block', 'always', '/p');
    manager.record(makeViolation('r3'), 'allow', 'project', '/p');

    const cleared = manager.clearByScope('always');
    expect(cleared).toBe(2);

    const remaining = manager.list();
    expect(remaining.length).toBe(1);
    expect(remaining[0].scope).toBe('project');
  });

  it('list with scope filter', () => {
    manager.record(makeViolation('r1'), 'allow', 'always', '/p');
    manager.record(makeViolation('r2'), 'block', 'project', '/p');

    const always = manager.list({ scope: 'always' });
    expect(always.length).toBe(1);

    const project = manager.list({ scope: 'project' });
    expect(project.length).toBe(1);
  });
});
