import { PassThrough } from 'stream';
import { ScanPipeline } from '../../src/scan/pipeline';
import { SecurityTransform } from '../../src/scan/security-transform';
import type { Scanner, ScanResult, ScanContext, ViolationInfo } from '../../src/interfaces/scan';

function makeViolatingScanner(ruleId: string): Scanner {
  return {
    name: 'test-scanner',
    phase: 'stdout',
    scan: (_content: string, _ctx: ScanContext): ScanResult => ({
      violation: {
        ruleId,
        ruleName: `Test Rule ${ruleId}`,
        category: 'safety',
        severity: 'critical',
        matchedPattern: 'test',
        contentPreview: 'test content',
      },
      scanDurationMs: 0,
      scannerType: 'content',
    }),
  };
}

function makeSafeScanner(): Scanner {
  return {
    name: 'safe-scanner',
    phase: 'stdout',
    scan: (_content: string, _ctx: ScanContext): ScanResult => ({
      violation: null,
      scanDurationMs: 0,
      scannerType: 'content',
    }),
  };
}

describe('SecurityTransform', () => {
  const context: ScanContext = {
    projectDir: '/test',
    sessionId: 'test-session',
  };

  it('passes safe data through unchanged', (done) => {
    const pipeline = new ScanPipeline();
    pipeline.register(makeSafeScanner());

    const transform = new SecurityTransform(pipeline, context);
    const chunks: Buffer[] = [];

    transform.on('data', (chunk: Buffer) => chunks.push(chunk));
    transform.on('end', () => {
      const output = Buffer.concat(chunks).toString();
      expect(output).toBe('safe content here');
      done();
    });

    transform.write('safe content here');
    transform.end();
  });

  it('drops data when violation detected (no confirmation flow)', (done) => {
    const pipeline = new ScanPipeline();
    pipeline.register(makeViolatingScanner('wm-test-001'));

    const transform = new SecurityTransform(pipeline, context);
    const chunks: Buffer[] = [];

    // Capture stderr to suppress output during test
    const origStderrWrite = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;

    transform.on('data', (chunk: Buffer) => chunks.push(chunk));
    transform.on('end', () => {
      process.stderr.write = origStderrWrite;
      const output = Buffer.concat(chunks).toString();
      expect(output).toBe(''); // data dropped
      done();
    });

    transform.write('dangerous content');
    transform.end();
  });

  it('preserves data integrity for large safe payloads', (done) => {
    const pipeline = new ScanPipeline();
    pipeline.register(makeSafeScanner());

    const transform = new SecurityTransform(pipeline, context);
    const chunks: Buffer[] = [];
    const inputChunks: string[] = [];

    transform.on('data', (chunk: Buffer) => chunks.push(chunk));
    transform.on('end', () => {
      const output = Buffer.concat(chunks).toString();
      const expected = inputChunks.join('');
      expect(output).toBe(expected);
      expect(output.length).toBeGreaterThan(10000); // verify we actually sent data
      done();
    });

    // Send 100 chunks of 1KB each = 100KB total
    for (let i = 0; i < 100; i++) {
      const chunk = `chunk-${i}-${'x'.repeat(1000)}\n`;
      inputChunks.push(chunk);
      transform.write(chunk);
    }
    transform.end();
  });

  it('allows data when confirmation flow returns allow', (done) => {
    const pipeline = new ScanPipeline();
    pipeline.register(makeViolatingScanner('wm-test-001'));

    const mockConfirmation = {
      handle: async (_v: ViolationInfo) => ({
        action: 'allow' as const,
        source: 'terminal',
        responseTimeMs: 50,
      }),
    };

    const transform = new SecurityTransform(pipeline, context, undefined, mockConfirmation);
    const chunks: Buffer[] = [];

    transform.on('data', (chunk: Buffer) => chunks.push(chunk));
    transform.on('end', () => {
      const output = Buffer.concat(chunks).toString();
      expect(output).toBe('content to allow');
      done();
    });

    transform.write('content to allow');
    transform.end();
  });

  it('blocks data when confirmation flow returns block', (done) => {
    const pipeline = new ScanPipeline();
    pipeline.register(makeViolatingScanner('wm-test-001'));

    const mockConfirmation = {
      handle: async (_v: ViolationInfo) => ({
        action: 'block' as const,
        source: 'desktop',
        responseTimeMs: 100,
      }),
    };

    const origStderrWrite = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;

    const transform = new SecurityTransform(pipeline, context, undefined, mockConfirmation);
    const chunks: Buffer[] = [];

    transform.on('data', (chunk: Buffer) => chunks.push(chunk));
    transform.on('end', () => {
      process.stderr.write = origStderrWrite;
      const output = Buffer.concat(chunks).toString();
      expect(output).toBe(''); // blocked
      done();
    });

    transform.write('content to block');
    transform.end();
  });
});
