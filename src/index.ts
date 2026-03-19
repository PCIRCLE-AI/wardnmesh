/**
 * WardnMesh - AI Agent Security Scanner
 */

export * from './agent-guard';
export * from './rules/schema';
export * from './state/config';

// Read version from package.json at runtime
import { readFileSync } from 'fs';
import { join } from 'path';
function loadVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return '1.0.0';
  }
}
export const version = loadVersion();
