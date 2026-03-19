/**
 * Version Checker
 *
 * Core logic for checking if updates are available and determining priority.
 */

import { VersionCache } from './cache';
import { GitHubClient } from './github';
import type { UpdateCheckResult, UpdatePriority } from './types';

export class VersionChecker {
  private cache: VersionCache;
  private github: GitHubClient;
  private currentVersion: string;

  constructor(currentVersion: string, customCacheDir?: string) {
    this.cache = new VersionCache(customCacheDir);
    this.github = new GitHubClient();
    this.currentVersion = currentVersion;
  }

  /**
   * Check if update is available
   */
  async checkForUpdate(): Promise<UpdateCheckResult> {
    // Respect NO_UPDATE_CHECK environment variable (for CI/CD)
    if (process.env.WARDN_NO_UPDATE_CHECK === '1') {
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        shouldNotify: false,
      };
    }

    // Check cache first
    if (!this.cache.isExpired()) {
      const cached = this.cache.read();
      if (cached) {
        const hasUpdate = this.compareVersions(this.currentVersion, cached.latestVersion) < 0;
        return {
          hasUpdate,
          currentVersion: this.currentVersion,
          latestVersion: cached.latestVersion,
          priority: cached.priority,
          releaseNotes: cached.releaseNotes,
          releaseUrl: cached.releaseUrl,
          shouldNotify: hasUpdate && this.cache.shouldNotify(cached.priority),
        };
      }
    }

    // Fetch from GitHub
    const latestRelease = await this.github.fetchLatestRelease();
    if (!latestRelease) {
      // Failed to fetch (offline or API error), use cached if available
      const cached = this.cache.read();
      if (cached) {
        const hasUpdate = this.compareVersions(this.currentVersion, cached.latestVersion) < 0;
        return {
          hasUpdate,
          currentVersion: this.currentVersion,
          latestVersion: cached.latestVersion,
          priority: cached.priority,
          releaseNotes: cached.releaseNotes,
          releaseUrl: cached.releaseUrl,
          shouldNotify: false, // Don't notify if offline
        };
      }

      // No cache, return no update
      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        shouldNotify: false,
      };
    }

    // Compare versions
    const comparison = this.compareVersions(this.currentVersion, latestRelease.version);
    const hasUpdate = comparison < 0;

    if (!hasUpdate) {
      // Already on latest, update cache
      this.cache.write({
        latestVersion: this.currentVersion,
        currentVersion: this.currentVersion,
        priority: 'MINOR',
        lastNotified: new Date().toISOString(),
        releaseNotes: latestRelease.releaseNotes || '',
        releaseUrl: latestRelease.releaseUrl || '',
      });

      return {
        hasUpdate: false,
        currentVersion: this.currentVersion,
        latestVersion: this.currentVersion,
        shouldNotify: false,
      };
    }

    // Determine priority
    const priority = this.determinePriority(this.currentVersion, latestRelease.version);

    // Update cache
    this.cache.write({
      latestVersion: latestRelease.version,
      currentVersion: this.currentVersion,
      priority,
      lastNotified: new Date().toISOString(),
      releaseNotes: latestRelease.releaseNotes,
      releaseUrl: latestRelease.releaseUrl,
    });

    return {
      hasUpdate: true,
      currentVersion: this.currentVersion,
      latestVersion: latestRelease.version,
      priority,
      releaseNotes: latestRelease.releaseNotes,
      releaseUrl: latestRelease.releaseUrl,
      shouldNotify: this.cache.shouldNotify(priority),
    };
  }

  /**
   * Mark notification as shown (update lastNotified timestamp)
   */
  markNotified(): void {
    this.cache.updateLastNotified();
  }

  /**
   * Compare two semantic versions
   * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map((n) => parseInt(n, 10));
    const parts2 = v2.split('.').map((n) => parseInt(n, 10));

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 < num2) return -1;
      if (num1 > num2) return 1;
    }

    return 0;
  }

  /**
   * Determine update priority based on semantic versioning
   * major bump = CRITICAL
   * minor bump = IMPORTANT
   * patch bump = MINOR
   */
  private determinePriority(current: string, latest: string): UpdatePriority {
    const currentParts = current.split('.').map((n) => parseInt(n, 10));
    const latestParts = latest.split('.').map((n) => parseInt(n, 10));

    const [currentMajor, currentMinor] = currentParts;
    const [latestMajor, latestMinor] = latestParts;

    if (latestMajor > currentMajor) {
      return 'CRITICAL'; // Major version bump
    }

    if (latestMinor > currentMinor) {
      return 'IMPORTANT'; // Minor version bump
    }

    return 'MINOR'; // Patch version bump
  }

  /**
   * Get cache file path (for debugging)
   */
  getCacheFilePath(): string {
    return this.cache.getCacheFilePath();
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
