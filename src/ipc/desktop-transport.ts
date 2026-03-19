/**
 * Desktop Transport — IConfirmationTransport via IPC
 *
 * Sends confirmation requests to the desktop app over a Unix socket
 * and waits for the user's response.
 */

import type { IConfirmationTransport, ScanEvent } from '../interfaces/transport';
import type { ConfirmationRequest, ConfirmationResult } from '../interfaces/confirmation';
import type { ConfirmationResponseMessage } from './protocol';
import { SocketClient } from './socket-client';
import { version } from '../index';
import { logger } from '../logging/logger';

export class DesktopTransport implements IConfirmationTransport {
  readonly name = 'desktop';
  private client: SocketClient;
  private sessionId: string;
  private command: string;

  constructor(sessionId: string, command: string) {
    this.client = new SocketClient();
    this.sessionId = sessionId;
    this.command = command;
  }

  get connected(): boolean {
    return this.client.connected;
  }

  async connect(): Promise<boolean> {
    const connected = await this.client.connect();
    if (!connected) return false;

    // Send hello
    this.client.send({
      v: 1,
      type: 'hello',
      sessionId: this.sessionId,
      command: this.command,
      pid: process.pid,
      cliVersion: version || '0.1.0',
    });

    // Wait for welcome
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(false);
      }, 1000);

      this.client.once('message', (msg: { type: string }) => {
        clearTimeout(timer);
        resolve(msg.type === 'welcome');
      });
    });
  }

  async disconnect(): Promise<void> {
    this.client.send({
      v: 1,
      type: 'goodbye',
      sessionId: this.sessionId,
    });
    await this.client.disconnect();
  }

  async requestConfirmation(req: ConfirmationRequest, timeoutMs: number): Promise<ConfirmationResult> {
    const start = Date.now();

    this.client.send({
      v: 1,
      type: 'confirmation_request',
      id: req.id,
      ruleId: req.violation.ruleId,
      ruleName: req.violation.ruleName,
      severity: req.violation.severity,
      contentPreview: req.violation.contentPreview,
      projectDir: req.projectDir,
      category: req.violation.category,
    });

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve({
          action: 'block',
          scope: 'once',
          source: 'timeout',
          responseTimeMs: Date.now() - start,
        });
      }, timeoutMs);

      const onMessage = (msg: ConfirmationResponseMessage) => {
        if (msg.type === 'confirmation_response' && msg.id === req.id) {
          cleanup();
          resolve({
            action: msg.action,
            scope: msg.scope,
            source: 'desktop',
            responseTimeMs: Date.now() - start,
          });
        }
      };

      const onDisconnect = () => {
        cleanup();
        resolve({
          action: 'block',
          scope: 'once',
          source: 'timeout',
          responseTimeMs: Date.now() - start,
        });
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.client.removeListener('message', onMessage);
        this.client.removeListener('disconnect', onDisconnect);
      };

      this.client.on('message', onMessage);
      this.client.on('disconnect', onDisconnect);
    });
  }

  sendEvent(event: ScanEvent): void {
    this.client.send({
      v: 1,
      type: 'scan_event',
      ...event,
    });
  }
}
