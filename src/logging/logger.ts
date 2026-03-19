/**
 * Structured JSON Logger
 *
 * Writes to ~/.wardnmesh/logs/wardn.log
 * Rotation: max 10MB per file, keep 5 files
 */

import fs from 'fs';
import path from 'path';
import { getLogDir } from '../config/loader';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: Record<string, unknown>;
  error?: { code: string; stack?: string };
}

const LOG_FILE_NAME = 'wardn.log';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

class Logger {
  private logDir: string | null = null;
  private minLevel: LogLevel = 'info';

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private getLogDir(): string {
    if (!this.logDir) {
      this.logDir = getLogDir();
    }
    return this.logDir;
  }

  private getLogPath(): string {
    return path.join(this.getLogDir(), LOG_FILE_NAME);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[this.minLevel];
  }

  private rotate(): void {
    try {
      const logPath = this.getLogPath();
      if (!fs.existsSync(logPath)) return;

      const stat = fs.statSync(logPath);
      if (stat.size < MAX_FILE_SIZE) return;

      // Rotate: wardn.4.log → delete, wardn.3.log → wardn.4.log, ...
      const dir = this.getLogDir();
      for (let i = MAX_FILES - 1; i >= 1; i--) {
        const src = path.join(dir, `wardn.${i}.log`);
        const dst = path.join(dir, `wardn.${i + 1}.log`);
        if (fs.existsSync(src)) {
          if (i === MAX_FILES - 1) {
            fs.unlinkSync(src);
          } else {
            fs.renameSync(src, dst);
          }
        }
      }

      fs.renameSync(logPath, path.join(dir, 'wardn.1.log'));
    } catch {
      // Rotation failure is non-fatal
    }
  }

  private write(entry: LogEntry): void {
    try {
      this.rotate();
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.getLogPath(), line);
    } catch {
      // Log write failure is non-fatal
    }
  }

  private log(level: LogLevel, module: string, message: string, context?: Record<string, unknown>, error?: Error & { code?: string }): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        code: error.code || error.name,
        stack: error.stack,
      };
    }

    this.write(entry);
  }

  error(module: string, message: string, context?: Record<string, unknown>, error?: Error & { code?: string }): void {
    this.log('error', module, message, context, error);
  }

  warn(module: string, message: string, context?: Record<string, unknown>): void {
    this.log('warn', module, message, context);
  }

  info(module: string, message: string, context?: Record<string, unknown>): void {
    this.log('info', module, message, context);
  }

  debug(module: string, message: string, context?: Record<string, unknown>): void {
    this.log('debug', module, message, context);
  }
}

export const logger = new Logger();
