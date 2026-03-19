/**
 * Object Path Utilities
 *
 * Provides safe access to nested object properties using dot-notation paths.
 * Extracted from repeated implementations in pattern.ts, state.ts, and base.ts.
 */

/**
 * Get a value from a nested object using a dot-notation path.
 *
 * @param obj - The object to extract from
 * @param path - Dot-notation path (e.g., "parameters.file_path")
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * const obj = { a: { b: { c: 42 } } };
 * getValueByPath(obj, 'a.b.c'); // 42
 * getValueByPath(obj, 'a.b.d'); // undefined
 * getValueByPath(obj, 'a.x.y'); // undefined (safe traversal)
 */
export function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a value in a nested object using a dot-notation path.
 * Creates intermediate objects as needed.
 *
 * @param obj - The object to modify
 * @param path - Dot-notation path (e.g., "a.b.c")
 * @param value - The value to set
 *
 * @example
 * const obj = {};
 * setValueByPath(obj, 'a.b.c', 42);
 * // obj is now { a: { b: { c: 42 } } }
 */
export function setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  if (!path) return;

  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Check if a path exists in a nested object.
 *
 * @param obj - The object to check
 * @param path - Dot-notation path
 * @returns True if the path exists (value is not undefined)
 */
export function hasPath(obj: Record<string, unknown>, path: string): boolean {
  return getValueByPath(obj, path) !== undefined;
}
