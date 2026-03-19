import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getDbPath } from '../config/loader';
import { WardnError, ErrorCode } from '../errors';
import { logger } from '../logging/logger';
import { MIGRATIONS, type Migration } from './migrations';

export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private db: Database.Database;

  private constructor(dbPath?: string) {
    const resolvedPath = dbPath || getDbPath();

    // Ensure directory exists
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = this.openWithRecovery(resolvedPath);

    // Enable WAL mode for concurrent access
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');

    this.runMigrations();
  }

  static getInstance(dbPath?: string): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(dbPath);
    }
    return DatabaseManager.instance;
  }

  // For testing: reset the singleton
  static resetInstance(): void {
    if (DatabaseManager.instance) {
      DatabaseManager.instance.close();
      DatabaseManager.instance = null;
    }
  }

  getDb(): Database.Database {
    return this.db;
  }

  private runMigrations(): void {
    // Check current version
    let currentVersion = 0;
    try {
      // schema_version table might not exist yet
      const row = this.db.prepare('SELECT MAX(version) as v FROM schema_version').get() as
        | { v: number }
        | undefined;
      if (row?.v) currentVersion = row.v;
    } catch {
      // Table doesn't exist yet, version = 0
    }

    const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
    if (pending.length === 0) return;

    for (const migration of pending) {
      logger.info('storage.db', `Applying migration v${migration.version}: ${migration.description}`);

      const runMigration = this.db.transaction(() => {
        // Execute migration SQL statements
        this.db.exec(migration.up);

        // Record migration
        this.db
          .prepare('INSERT INTO schema_version (version, description) VALUES (?, ?)')
          .run(migration.version, migration.description);
      });

      try {
        runMigration();
      } catch (err) {
        logger.error('storage.db', `Migration v${migration.version} failed`, {}, err as Error);
        throw new WardnError(
          `Migration v${migration.version} failed: ${(err as Error).message}`,
          ErrorCode.DB_MIGRATION_FAILED,
          false,
          { version: migration.version },
        );
      }
    }

    logger.info('storage.db', `Database at schema version ${pending[pending.length - 1].version}`);
  }

  private openWithRecovery(dbPath: string): Database.Database {
    try {
      const db = new Database(dbPath);
      // Test the DB is valid by running a simple query
      db.pragma('journal_mode');
      return db;
    } catch {
      // Corruption recovery: rename and create fresh
      const corruptPath = `${dbPath}.corrupt.${Date.now()}`;
      if (fs.existsSync(dbPath)) {
        fs.renameSync(dbPath, corruptPath);
        logger.warn('storage.db', 'Corrupt DB renamed, creating fresh', { corruptPath });
      }
      return new Database(dbPath);
    }
  }

  close(): void {
    this.db.close();
  }
}
