/**
 * Error Domain Model for WardnMesh
 *
 * Structured errors with recovery strategies for all subsystems.
 */

export enum ErrorCode {
  // Storage
  DB_INIT_FAILED = 'DB_INIT_FAILED',
  DB_MIGRATION_FAILED = 'DB_MIGRATION_FAILED',
  DB_WRITE_FAILED = 'DB_WRITE_FAILED',
  DB_LOCKED = 'DB_LOCKED',

  // IPC
  IPC_CONNECT_FAILED = 'IPC_CONNECT_FAILED',
  IPC_SEND_FAILED = 'IPC_SEND_FAILED',
  IPC_TIMEOUT = 'IPC_TIMEOUT',
  IPC_PROTOCOL_ERROR = 'IPC_PROTOCOL_ERROR',

  // Scan
  SCAN_REGEX_INVALID = 'SCAN_REGEX_INVALID',
  SCAN_RULE_LOAD_FAILED = 'SCAN_RULE_LOAD_FAILED',

  // Process
  CHILD_SPAWN_FAILED = 'CHILD_SPAWN_FAILED',
  CHILD_UNEXPECTED_EXIT = 'CHILD_UNEXPECTED_EXIT',
}

export type RecoveryStrategy = 'retry' | 'fallback' | 'abort' | 'skip';

export const RECOVERY_STRATEGIES: Record<ErrorCode, RecoveryStrategy> = {
  [ErrorCode.DB_INIT_FAILED]: 'retry',
  [ErrorCode.DB_MIGRATION_FAILED]: 'abort',
  [ErrorCode.DB_WRITE_FAILED]: 'skip',
  [ErrorCode.DB_LOCKED]: 'retry',

  [ErrorCode.IPC_CONNECT_FAILED]: 'fallback',
  [ErrorCode.IPC_SEND_FAILED]: 'fallback',
  [ErrorCode.IPC_TIMEOUT]: 'abort',
  [ErrorCode.IPC_PROTOCOL_ERROR]: 'fallback',

  [ErrorCode.SCAN_REGEX_INVALID]: 'skip',
  [ErrorCode.SCAN_RULE_LOAD_FAILED]: 'skip',

  [ErrorCode.CHILD_SPAWN_FAILED]: 'abort',
  [ErrorCode.CHILD_UNEXPECTED_EXIT]: 'abort',
};

export class WardnError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode,
    readonly recoverable: boolean,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'WardnError';
  }

  get strategy(): RecoveryStrategy {
    return RECOVERY_STRATEGIES[this.code];
  }
}
