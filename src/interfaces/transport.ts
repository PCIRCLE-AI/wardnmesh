/**
 * IPC Transport Interfaces
 */

import type { ConfirmationRequest, ConfirmationResult } from './confirmation';

export interface ScanEvent {
  ruleId: string;
  ruleName: string;
  severity: string;
  action: 'allow' | 'block';
  source: string;
  timestamp: string;
}

export interface IConfirmationTransport {
  readonly name: string;
  readonly connected: boolean;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  requestConfirmation(req: ConfirmationRequest, timeoutMs: number): Promise<ConfirmationResult>;
  sendEvent(event: ScanEvent): void; // fire-and-forget
}
