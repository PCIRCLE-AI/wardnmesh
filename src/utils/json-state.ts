/**
 * JSON State Persistence Utilities
 *
 * Provides safe JSON state loading and saving with error handling.
 * Extracted from repeated implementations in session.ts and tracker.ts.
 */

import fs from 'fs';

/**
 * Load JSON state from a file with error handling.
 *
 * @param filePath - Path to the JSON file
 * @param defaultValue - Default value to return if file doesn't exist or is invalid
 * @returns Parsed JSON or default value
 *
 * @example
 * interface MyState { count: number; items: string[]; }
 * const state = loadJsonState<MyState>('/path/to/state.json', { count: 0, items: [] });
 */
export function loadJsonState<T>(filePath: string, defaultValue: T): T {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    // Log error but don't expose internal details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[JsonState] Failed to load state from ${filePath}: ${errorMessage}`);
    return defaultValue;
  }
}

/**
 * Save JSON state to a file with error handling.
 *
 * @param filePath - Path to the JSON file
 * @param state - State object to save
 * @param pretty - Whether to format with indentation (default: true)
 * @returns True if save was successful, false otherwise
 *
 * @example
 * const success = saveJsonState('/path/to/state.json', { count: 42 });
 */
export function saveJsonState<T>(filePath: string, state: T, pretty: boolean = true): boolean {
  try {
    const content = pretty ? JSON.stringify(state, null, 2) : JSON.stringify(state);
    fs.writeFileSync(filePath, content);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[JsonState] Failed to save state to ${filePath}: ${errorMessage}`);
    return false;
  }
}

/**
 * Atomically save JSON state (write to temp file, then rename).
 * This prevents corruption if the process crashes during write.
 *
 * @param filePath - Path to the JSON file
 * @param state - State object to save
 * @returns True if save was successful, false otherwise
 */
export function saveJsonStateAtomic<T>(filePath: string, state: T): boolean {
  const tempPath = `${filePath}.tmp`;

  try {
    const content = JSON.stringify(state, null, 2);
    fs.writeFileSync(tempPath, content);
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[JsonState] Failed to atomically save state to ${filePath}: ${errorMessage}`);

    // Clean up temp file if it exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    return false;
  }
}
