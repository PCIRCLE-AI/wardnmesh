/**
 * Example of valid code: using real Node.js APIs
 */

import * as fs from 'fs';
import * as path from 'path';

export function readFileContent(filePath: string): string {
  // Real API: fs.readFileSync
  const content = fs.readFileSync(filePath, 'utf-8');

  // Real API: String.prototype.split and Array.prototype.map
  const lines = content.split('\n').map(line => line.trim());

  return lines.join('\n');
}

export function formatDates(dates: Date[]): string[] {
  // Real API: Date.prototype.toISOString
  return dates.map(d => d.toISOString());
}

export function getBasename(filePath: string): string {
  // Real API: path.basename
  return path.basename(filePath);
}
