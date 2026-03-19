/**
 * Logger Utility - Centralized logging for WardnMesh SDK
 *
 * Provides consistent logging with configurable log levels.
 * Can be easily extended to integrate with external logging services.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/**
 * Structured log context for better debugging
 */
export interface LogContext {
  file?: string;
  function?: string;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(prefix: string = "[Wardn]", level?: LogLevel) {
    this.prefix = prefix;
    // Default to 'info' in production, 'debug' in development
    this.level =
      level ||
      (process.env.WARDN_LOG_LEVEL as LogLevel) ||
      (process.env.NODE_ENV === "development" ? "debug" : "info");
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(message: string, context?: LogContext): string {
    const parts = [this.prefix, message];

    if (context) {
      const contextStr = Object.entries(context)
        .map(([key, value]) => {
          if (typeof value === 'object') {
            try {
              return `${key}=${JSON.stringify(value)}`;
            } catch {
              return `${key}=[object]`;
            }
          }
          return `${key}=${value}`;
        })
        .join(' ');

      if (contextStr) {
        parts.push(`[${contextStr}]`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Debug level - detailed information for debugging
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage(message, context));
    }
  }

  /**
   * Info level - general operational information
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage(message, context));
    }
  }

  /**
   * Warn level - potentially harmful situations
   */
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage(message, context));
    }
  }

  /**
   * Error level - error events
   */
  error(message: string, context?: LogContext): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage(message, context));
    }
  }
}

// Singleton instance for the SDK
export const logger = new Logger("[Wardn]");

// Export class for custom instances
export { Logger };
