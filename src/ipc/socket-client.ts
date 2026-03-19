/**
 * Unix Domain Socket Client
 *
 * Connects to the WardnMesh desktop app over a local socket.
 * Messages are newline-delimited JSON.
 */

import net from 'net';
import { EventEmitter } from 'events';
import { getSocketPath } from '../config/loader';
import { logger } from '../logging/logger';
import { IPC_PROTOCOL_VERSION, MAX_MESSAGE_SIZE } from './protocol';
import type { CLIMessage, DesktopMessage } from './protocol';

export class SocketClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer = '';
  private _connected = false;

  get connected(): boolean {
    return this._connected;
  }

  async connect(timeoutMs = 2000): Promise<boolean> {
    const socketPath = getSocketPath();

    return new Promise((resolve) => {
      const socket = net.createConnection({ path: socketPath });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeoutMs);

      socket.on('connect', () => {
        clearTimeout(timer);
        this.socket = socket;
        this._connected = true;
        this.setupListeners();
        logger.info('ipc.client', 'Connected to desktop', { socketPath });
        resolve(true);
      });

      socket.on('error', (err) => {
        clearTimeout(timer);
        logger.debug('ipc.client', 'Connection failed', { error: err.message });
        resolve(false);
      });
    });
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('data', (data) => {
      this.buffer += data.toString();
      // Process newline-delimited JSON
      let newlineIdx: number;
      while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newlineIdx);
        this.buffer = this.buffer.slice(newlineIdx + 1);

        if (line.length > MAX_MESSAGE_SIZE) {
          logger.warn('ipc.client', 'Message too large, skipping');
          continue;
        }

        try {
          const msg = JSON.parse(line) as DesktopMessage;
          if (msg.v !== IPC_PROTOCOL_VERSION) {
            logger.warn('ipc.client', 'Protocol version mismatch', { received: msg.v });
            continue;
          }
          this.emit('message', msg);
        } catch {
          logger.warn('ipc.client', 'Invalid JSON message');
        }
      }
    });

    this.socket.on('close', () => {
      this._connected = false;
      this.emit('disconnect');
      logger.info('ipc.client', 'Disconnected from desktop');
    });

    this.socket.on('error', (err) => {
      logger.error('ipc.client', 'Socket error', {}, err as Error);
    });
  }

  send(message: CLIMessage): boolean {
    if (!this.socket || !this._connected) return false;

    try {
      const json = JSON.stringify(message) + '\n';
      if (json.length > MAX_MESSAGE_SIZE) {
        logger.warn('ipc.client', 'Message too large to send');
        return false;
      }
      this.socket.write(json);
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this._connected = false;
    }
  }
}
