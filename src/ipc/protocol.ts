/**
 * IPC Protocol — message types and constants
 *
 * Newline-delimited JSON over Unix domain socket.
 * Every message carries a protocol version field `v`.
 */

export const IPC_PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_SIZE = 64 * 1024; // 64KB

// ── CLI → Desktop messages ──────────────────────────────────────────

export interface HelloMessage {
  v: 1;
  type: 'hello';
  sessionId: string;
  command: string;
  pid: number;
  cliVersion: string;
}

export interface ConfirmationRequestMessage {
  v: 1;
  type: 'confirmation_request';
  id: string;
  ruleId: string;
  ruleName: string;
  severity: string;
  contentPreview: string;
  projectDir: string;
  category: string;
}

export interface ScanEventMessage {
  v: 1;
  type: 'scan_event';
  ruleId: string;
  ruleName: string;
  severity: string;
  action: 'allow' | 'block';
  source: string;
  timestamp: string;
}

export interface GoodbyeMessage {
  v: 1;
  type: 'goodbye';
  sessionId: string;
}

// ── Desktop → CLI messages ──────────────────────────────────────────

export interface WelcomeMessage {
  v: 1;
  type: 'welcome';
  desktopVersion: string;
  protocolVersion: 1;
}

export interface ConfirmationResponseMessage {
  v: 1;
  type: 'confirmation_response';
  id: string;
  action: 'allow' | 'block';
  scope: 'once' | 'session' | 'project' | 'always';
}

export interface ErrorMessage {
  v: 1;
  type: 'error';
  code: string;
  message: string;
}

export type CLIMessage = HelloMessage | ConfirmationRequestMessage | ScanEventMessage | GoodbyeMessage;
export type DesktopMessage = WelcomeMessage | ConfirmationResponseMessage | ErrorMessage;
