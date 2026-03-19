/**
 * Terminal Transport — readline fallback
 *
 * When the desktop app is unavailable, prompts the user
 * directly in the terminal via stdin/stderr.
 */

import readline from 'readline';
import type { IConfirmationTransport, ScanEvent } from '../interfaces/transport';
import type { ConfirmationRequest, ConfirmationResult, ConfirmationScope } from '../interfaces/confirmation';
import chalk from 'chalk';

const SEVERITY_COLORS: Record<string, (s: string) => string> = {
  critical: chalk.red,
  major: chalk.yellow,
  minor: chalk.blue,
};

const INPUT_MAP: Record<string, { action: 'allow' | 'block'; scope: ConfirmationScope }> = {
  y: { action: 'allow', scope: 'once' },
  n: { action: 'block', scope: 'once' },
  s: { action: 'allow', scope: 'session' },
  p: { action: 'allow', scope: 'project' },
  a: { action: 'allow', scope: 'always' },
};

export class TerminalTransport implements IConfirmationTransport {
  readonly name = 'terminal';
  private _connected = true;

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<boolean> {
    this._connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  async requestConfirmation(req: ConfirmationRequest, timeoutMs: number): Promise<ConfirmationResult> {
    const start = Date.now();
    const colorFn = SEVERITY_COLORS[req.violation.severity] || chalk.white;

    // Show threat info on stderr (not stdout, which is the intercepted stream)
    process.stderr.write('\n');
    process.stderr.write(colorFn(`[${req.violation.severity}] ${req.violation.ruleName}\n`));
    process.stderr.write(`  Content: ${req.violation.contentPreview.slice(0, 100)}...\n`);
    process.stderr.write(`  Allow? [N/y/s=session/p=project/a=always]: `);

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stderr,
        terminal: false,
      });

      const timer = setTimeout(() => {
        rl.close();
        process.stderr.write('\n  Timeout - auto-blocked\n');
        resolve({
          action: 'block',
          scope: 'once',
          source: 'timeout',
          responseTimeMs: Date.now() - start,
        });
      }, timeoutMs);

      rl.once('line', (answer) => {
        clearTimeout(timer);
        rl.close();

        const input = answer.trim().toLowerCase();
        const mapped = INPUT_MAP[input];

        if (mapped) {
          resolve({
            action: mapped.action,
            scope: mapped.scope,
            source: 'terminal',
            responseTimeMs: Date.now() - start,
          });
        } else {
          // Default: block
          resolve({
            action: 'block',
            scope: 'once',
            source: 'terminal',
            responseTimeMs: Date.now() - start,
          });
        }
      });
    });
  }

  sendEvent(_event: ScanEvent): void {
    // Terminal transport doesn't send events
  }
}
