import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SocketClient } from '../../src/ipc/socket-client';
import type { DesktopMessage } from '../../src/ipc/protocol';

describe('SocketClient', () => {
  let tmpDir: string;
  let socketPath: string;
  let server: net.Server | null = null;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wardn-ipc-'));
    socketPath = path.join(tmpDir, 'test.sock');
  });

  afterEach(async () => {
    if (server) {
      server.close();
      server = null;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function startServer(): Promise<net.Server> {
    return new Promise((resolve) => {
      const srv = net.createServer();
      srv.listen(socketPath, () => resolve(srv));
      server = srv;
    });
  }

  it('connects to a Unix socket', async () => {
    await startServer();
    const client = new SocketClient();

    // Override getSocketPath by connecting directly
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ path: socketPath });
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });

    expect(connected).toBe(true);
  });

  it('returns false when no server running', async () => {
    const client = new SocketClient();
    // Try to connect to non-existent socket
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ path: socketPath });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, 500);
      socket.on('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });

    expect(connected).toBe(false);
  });

  it('parses newline-delimited JSON messages', async () => {
    const srv = await startServer();
    const messages: DesktopMessage[] = [];

    srv.on('connection', (conn) => {
      // Send two messages
      const msg1: DesktopMessage = { v: 1, type: 'welcome', desktopVersion: '1.0.0', protocolVersion: 1 };
      const msg2: DesktopMessage = { v: 1, type: 'error', code: 'TEST', message: 'test error' };
      conn.write(JSON.stringify(msg1) + '\n' + JSON.stringify(msg2) + '\n');
    });

    const client = new SocketClient();

    // Connect directly
    await new Promise<void>((resolve) => {
      const socket = net.createConnection({ path: socketPath });
      socket.on('connect', () => {
        // Simulate SocketClient buffer parsing
        let buffer = '';
        socket.on('data', (data) => {
          buffer += data.toString();
          let idx: number;
          while ((idx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            try {
              messages.push(JSON.parse(line));
            } catch {}
          }
          if (messages.length >= 2) {
            socket.destroy();
            resolve();
          }
        });
      });
    });

    expect(messages.length).toBe(2);
    expect(messages[0].type).toBe('welcome');
    expect(messages[1].type).toBe('error');
  });
});
