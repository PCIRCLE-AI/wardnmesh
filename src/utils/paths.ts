/**
 * Path Utilities
 *
 * Provides utilities for managing application state directories.
 * Extracted from repeated implementations in session.ts and tracker.ts.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

/** Base directory for all agent-guard state */
const STATE_BASE_DIR = '.claude';

/** Sub-directory for state files */
const STATE_SUBDIR = 'state';

/**
 * Ensure a state directory exists, creating it if necessary.
 *
 * @param subDir - Sub-directory name within the state folder
 * @returns Full path to the state directory
 *
 * @example
 * const dir = ensureStateDir('agent-guard');
 * // Returns: ~/.claude/state/agent-guard (and creates it if needed)
 */
export function ensureStateDir(subDir: string): string {
  const stateDir = path.join(os.homedir(), STATE_BASE_DIR, STATE_SUBDIR, subDir);

  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }

  return stateDir;
}

/**
 * Get the full path for a state file.
 *
 * @param subDir - Sub-directory name within the state folder
 * @param filename - Name of the state file
 * @returns Full path to the state file
 *
 * @example
 * const path = getStatePath('agent-guard', 'session-state.json');
 * // Returns: ~/.claude/state/agent-guard/session-state.json
 */
export function getStatePath(subDir: string, filename: string): string {
  const dir = ensureStateDir(subDir);
  return path.join(dir, filename);
}

/**
 * Get the home directory path.
 *
 * @returns Home directory path
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * Get the base state directory path.
 *
 * @returns Base state directory path (~/.claude/state)
 */
export function getBaseStateDir(): string {
  return path.join(os.homedir(), STATE_BASE_DIR, STATE_SUBDIR);
}

/**
 * Check if a state file exists.
 *
 * @param subDir - Sub-directory name within the state folder
 * @param filename - Name of the state file
 * @returns True if the file exists
 */
export function stateFileExists(subDir: string, filename: string): boolean {
  const filePath = path.join(os.homedir(), STATE_BASE_DIR, STATE_SUBDIR, subDir, filename);
  return fs.existsSync(filePath);
}

/**
 * Delete a state file if it exists.
 *
 * @param subDir - Sub-directory name within the state folder
 * @param filename - Name of the state file
 * @returns True if file was deleted, false if it didn't exist
 */
export function deleteStateFile(subDir: string, filename: string): boolean {
  const filePath = path.join(os.homedir(), STATE_BASE_DIR, STATE_SUBDIR, subDir, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }

  return false;
}
