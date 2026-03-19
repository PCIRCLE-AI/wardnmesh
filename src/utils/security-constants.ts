/**
 * Security Constants
 *
 * Shared security-related constants used across the agent-guard core.
 * Centralizing these prevents inconsistencies and ensures
 * uniform security protections throughout the codebase.
 */

/**
 * Dangerous property names that could lead to prototype pollution.
 * These keys must never be used to access object properties dynamically.
 *
 * Used in:
 * - State management operations
 * - Object path extraction
 * - Session state sanitization
 *
 * @see https://owasp.org/www-community/vulnerabilities/Prototype_Pollution
 */
export const DANGEROUS_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

/**
 * Check if a key is dangerous (could lead to prototype pollution)
 *
 * @param key - The key to check
 * @returns True if the key is dangerous and should be blocked
 */
export function isDangerousKey(key: string): boolean {
  return DANGEROUS_KEYS.has(key);
}

/**
 * Maximum depth for recursive sanitization to prevent stack overflow
 */
export const MAX_SANITIZE_DEPTH = 20;
