import { DatabaseManager } from '../../src/storage/database';
import { DecisionRepository } from '../../src/storage/decision-repository';
import { AuditRepository } from '../../src/storage/audit-repository';
import { RuleRepository } from '../../src/storage/rule-repository';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('DecisionRepository', () => {
  let tmpDir: string;
  let repo: DecisionRepository;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wardn-test-'));
    const dm = DatabaseManager.getInstance(path.join(tmpDir, 'test.db'));
    repo = new DecisionRepository(dm.getDb());
  });

  afterEach(() => {
    DatabaseManager.resetInstance();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when no decision exists', () => {
    const result = repo.find('wm-code-001', '/project', 'session-1');
    expect(result).toBeNull();
  });

  it('saves and finds always-scoped decision', () => {
    repo.save({
      ruleId: 'wm-code-001',
      scope: 'always',
      approved: true,
      createdAt: new Date().toISOString(),
    });

    const result = repo.find('wm-code-001', '/any-project', 'any-session');
    expect(result).not.toBeNull();
    expect(result!.approved).toBe(true);
    expect(result!.scope).toBe('always');
  });

  it('saves and finds project-scoped decision', () => {
    repo.save({
      ruleId: 'wm-code-001',
      scope: 'project',
      approved: false,
      projectDir: '/my-project',
      createdAt: new Date().toISOString(),
    });

    // Same project - found
    const found = repo.find('wm-code-001', '/my-project', 'session-1');
    expect(found).not.toBeNull();
    expect(found!.approved).toBe(false);

    // Different project - not found
    const notFound = repo.find('wm-code-001', '/other-project', 'session-1');
    expect(notFound).toBeNull();
  });

  it('session-scoped decisions are in-memory only', () => {
    repo.save({
      ruleId: 'wm-code-001',
      scope: 'session',
      approved: true,
      sessionId: 'sess-123',
      createdAt: new Date().toISOString(),
    });

    // Found in same session
    const found = repo.find('wm-code-001', '/project', 'sess-123');
    expect(found).not.toBeNull();

    // Not found in different session
    const notFound = repo.find('wm-code-001', '/project', 'sess-other');
    expect(notFound).toBeNull();
  });

  it('revokes a decision by ID', () => {
    repo.save({
      ruleId: 'wm-code-001',
      scope: 'always',
      approved: true,
      createdAt: new Date().toISOString(),
    });

    const decisions = repo.list();
    expect(decisions.length).toBe(1);

    const revoked = repo.revoke(decisions[0].id!);
    expect(revoked).toBe(true);

    const afterRevoke = repo.list();
    expect(afterRevoke.length).toBe(0);
  });

  it('clearByScope clears only the specified scope', () => {
    repo.save({ ruleId: 'r1', scope: 'always', approved: true, createdAt: new Date().toISOString() });
    repo.save({ ruleId: 'r2', scope: 'always', approved: false, createdAt: new Date().toISOString() });
    repo.save({ ruleId: 'r3', scope: 'project', approved: true, projectDir: '/p', createdAt: new Date().toISOString() });

    const cleared = repo.clearByScope('always');
    expect(cleared).toBe(2);

    const remaining = repo.list();
    expect(remaining.length).toBe(1);
    expect(remaining[0].scope).toBe('project');
  });

  it('list with filters works', () => {
    repo.save({ ruleId: 'r1', scope: 'always', approved: true, createdAt: new Date().toISOString() });
    repo.save({ ruleId: 'r2', scope: 'project', approved: false, projectDir: '/p', createdAt: new Date().toISOString() });

    const always = repo.list({ scope: 'always' });
    expect(always.length).toBe(1);
    expect(always[0].ruleId).toBe('r1');

    const byRule = repo.list({ ruleId: 'r2' });
    expect(byRule.length).toBe(1);
    expect(byRule[0].scope).toBe('project');
  });
});

describe('AuditRepository', () => {
  let tmpDir: string;
  let repo: AuditRepository;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wardn-test-'));
    const dm = DatabaseManager.getInstance(path.join(tmpDir, 'test.db'));
    repo = new AuditRepository(dm.getDb());
  });

  afterEach(() => {
    DatabaseManager.resetInstance();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('logs an audit entry', () => {
    repo.log({
      ruleId: 'wm-code-001',
      ruleName: 'dangerous function detection',
      severity: 'critical',
      action: 'block',
      source: 'terminal',
      contentPreview: 'dangerous(userInput)',
      projectDir: '/project',
      sessionId: 'sess-1',
      responseTimeMs: 150,
    });

    const result = repo.query({}, { page: 1, limit: 10 });
    expect(result.total).toBe(1);
    expect(result.items[0].ruleId).toBe('wm-code-001');
    expect(result.items[0].action).toBe('block');
  });

  it('truncates content preview to 200 chars', () => {
    const longContent = 'x'.repeat(500);
    repo.log({
      ruleId: 'r1',
      ruleName: 'test',
      severity: 'minor',
      action: 'allow',
      source: 'cache',
      contentPreview: longContent,
    });

    const result = repo.query({}, { page: 1, limit: 10 });
    expect(result.items[0].contentPreview!.length).toBe(200);
  });

  it('queries with severity filter', () => {
    repo.log({ ruleId: 'r1', ruleName: 'a', severity: 'critical', action: 'block', source: 'terminal' });
    repo.log({ ruleId: 'r2', ruleName: 'b', severity: 'minor', action: 'allow', source: 'cache' });
    repo.log({ ruleId: 'r3', ruleName: 'c', severity: 'critical', action: 'block', source: 'desktop' });

    const result = repo.query({ severity: 'critical' }, { page: 1, limit: 10 });
    expect(result.total).toBe(2);
    expect(result.items.every(i => i.severity === 'critical')).toBe(true);
  });

  it('paginates correctly', () => {
    for (let i = 0; i < 15; i++) {
      repo.log({ ruleId: `r${i}`, ruleName: `rule-${i}`, severity: 'minor', action: 'allow', source: 'cache' });
    }

    const page1 = repo.query({}, { page: 1, limit: 5 });
    expect(page1.items.length).toBe(5);
    expect(page1.total).toBe(15);
    expect(page1.totalPages).toBe(3);

    const page3 = repo.query({}, { page: 3, limit: 5 });
    expect(page3.items.length).toBe(5);
  });

  it('prunes old entries', () => {
    // Insert an entry with old timestamp directly
    const dm = DatabaseManager.getInstance();
    const db = dm.getDb();
    db.prepare(`
      INSERT INTO audit_log (timestamp, rule_id, rule_name, severity, action, source)
      VALUES (datetime('now', '-100 days'), 'old-rule', 'Old', 'minor', 'allow', 'cache')
    `).run();

    repo.log({ ruleId: 'new-rule', ruleName: 'New', severity: 'major', action: 'block', source: 'terminal' });

    const pruned = repo.prune(90);
    expect(pruned).toBe(1);

    const result = repo.query({}, { page: 1, limit: 10 });
    expect(result.total).toBe(1);
    expect(result.items[0].ruleId).toBe('new-rule');
  });
});

describe('RuleRepository', () => {
  let tmpDir: string;
  let repo: RuleRepository;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wardn-test-'));
    const dm = DatabaseManager.getInstance(path.join(tmpDir, 'test.db'));
    repo = new RuleRepository(dm.getDb());
  });

  afterEach(() => {
    DatabaseManager.resetInstance();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for unknown rule', () => {
    const result = repo.getOverride('unknown-rule');
    expect(result).toBeNull();
  });

  it('sets and gets override', () => {
    repo.setOverride('wm-code-001', false);
    const result = repo.getOverride('wm-code-001');
    expect(result).toEqual({ enabled: false });
  });

  it('updates existing override', () => {
    repo.setOverride('wm-code-001', false);
    repo.setOverride('wm-code-001', true);
    const result = repo.getOverride('wm-code-001');
    expect(result).toEqual({ enabled: true });
  });

  it('clears override', () => {
    repo.setOverride('wm-code-001', false);
    repo.clearOverride('wm-code-001');
    const result = repo.getOverride('wm-code-001');
    expect(result).toBeNull();
  });

  it('lists all overrides', () => {
    repo.setOverride('r1', true);
    repo.setOverride('r2', false);
    const list = repo.listOverrides();
    expect(list.length).toBe(2);
    expect(list.find(r => r.ruleId === 'r2')?.enabled).toBe(false);
  });
});
