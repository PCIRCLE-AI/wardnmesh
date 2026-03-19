import { DatabaseManager } from '../../src/storage/database';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('DatabaseManager', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wardn-test-'));
    dbPath = path.join(tmpDir, 'test.db');
    DatabaseManager.resetInstance();
  });

  afterEach(() => {
    DatabaseManager.resetInstance();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates database on first run with WAL mode', () => {
    const dm = DatabaseManager.getInstance(dbPath);
    const db = dm.getDb();

    // Check WAL mode
    const mode = db.pragma('journal_mode', { simple: true });
    expect(mode).toBe('wal');

    // Check tables exist
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('schema_version');
    expect(tableNames).toContain('decisions');
    expect(tableNames).toContain('audit_log');
    expect(tableNames).toContain('rules_config');
  });

  it('records schema version 1', () => {
    const dm = DatabaseManager.getInstance(dbPath);
    const db = dm.getDb();

    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
    expect(row.v).toBe(1);
  });

  it('is idempotent — re-opening does not re-run migrations', () => {
    // First open
    const dm1 = DatabaseManager.getInstance(dbPath);
    dm1.getDb().prepare("INSERT INTO audit_log (rule_id, rule_name, severity, action, source) VALUES ('r1', 'Test', 'critical', 'block', 'terminal')").run();

    // Close and re-open
    DatabaseManager.resetInstance();
    const dm2 = DatabaseManager.getInstance(dbPath);
    const db = dm2.getDb();

    // Data should still exist
    const count = db.prepare('SELECT COUNT(*) as cnt FROM audit_log').get() as { cnt: number };
    expect(count.cnt).toBe(1);

    // Schema version should still be 1
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
    expect(row.v).toBe(1);
  });

  it('recovers from corrupted database', () => {
    // Write garbage to DB path
    fs.writeFileSync(dbPath, 'CORRUPT DATA NOT A SQLITE FILE');

    // Should not throw — creates a fresh DB
    const dm = DatabaseManager.getInstance(dbPath);
    const db = dm.getDb();

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all() as { name: string }[];
    expect(tables.length).toBeGreaterThan(0);

    // Corrupt file should be renamed
    const files = fs.readdirSync(tmpDir);
    const corruptFiles = files.filter(f => f.includes('.corrupt.'));
    expect(corruptFiles.length).toBe(1);
  });

  it('singleton returns same instance', () => {
    const dm1 = DatabaseManager.getInstance(dbPath);
    const dm2 = DatabaseManager.getInstance(dbPath);
    expect(dm1).toBe(dm2);
  });

  it('has busy_timeout set', () => {
    const dm = DatabaseManager.getInstance(dbPath);
    const db = dm.getDb();
    const timeout = db.pragma('busy_timeout', { simple: true });
    expect(timeout).toBe(5000);
  });
});
