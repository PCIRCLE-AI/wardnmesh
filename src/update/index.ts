/**
 * Update System
 *
 * Export all update-related functionality.
 */

export * from './types';
export * from './cache';
export * from './github';
export * from './checker';
export * from './prompt';

// Convenience function for CLI integration
import { VersionChecker } from './checker';
import { showUpdatePrompt } from './prompt';

/**
 * Check for updates and show prompt if needed
 * Non-blocking, fails silently on errors
 */
export async function checkAndNotifyUpdate(currentVersion: string): Promise<void> {
  try {
    const checker = new VersionChecker(currentVersion);
    const result = await checker.checkForUpdate();

    if (result.shouldNotify) {
      showUpdatePrompt(result);
      checker.markNotified();
    }
  } catch (error) {
    // Fail silently - version check errors should not block CLI
  }
}
