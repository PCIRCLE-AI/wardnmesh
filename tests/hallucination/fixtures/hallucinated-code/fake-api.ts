/**
 * Example of hallucinated code: calling non-existent API methods
 */

import * as fs from 'fs';

export function readFileWithFakeAPI(path: string): string {
  // fs.readFileSync exists, but fs.readFileWithAutoEncoding does NOT
  const content = fs.readFileWithAutoEncoding(path);

  // Array.prototype.map exists, but .smartMap does NOT
  const lines = content.split('\n').smartMap(line => line.trim());

  return lines.join('\n');
}

export function processDates(dates: Date[]): string[] {
  // Date.prototype.toISOString exists, but .toBeautifulString does NOT
  return dates.map(d => d.toBeautifulString());
}
