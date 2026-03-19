import type { Scanner, ScanResult, ScanContext } from '../interfaces/scan';

export class ScanPipeline {
  private scanners: Scanner[] = [];

  register(scanner: Scanner): void {
    this.scanners.push(scanner);
  }

  scan(content: string, context: ScanContext): ScanResult {
    const start = performance.now();

    for (const scanner of this.scanners) {
      const result = scanner.scan(content, context);
      if (result.violation) {
        return result;
      }
    }

    return {
      violation: null,
      scanDurationMs: performance.now() - start,
      scannerType: 'content',
    };
  }

  getScannerCount(): number {
    return this.scanners.length;
  }
}
