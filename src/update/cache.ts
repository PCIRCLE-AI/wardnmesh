/**
 * Version Cache System
 *
 * Manages local caching of version check results to reduce API calls.
 * Cache TTL: 24 hours for version checks.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { CacheData, UpdatePriority } from './types';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NOTIFICATION_INTERVALS = {
  CRITICAL: 0, // Every run
  IMPORTANT: 0, // Every run
  MINOR: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class VersionCache {
  private cacheDir: string;
  private cacheFile: string;

  constructor(customCacheDir?: string) {
    const baseDir = customCacheDir || os.homedir();
    this.cacheDir = path.join(baseDir, '.wardnmesh', 'cache');
    this.cacheFile = path.join(this.cacheDir, 'version-check.json');
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Check if cache is expired
   */
  isExpired(): boolean {
    try {
      const data = this.read();
      if (!data) return true;

      const lastChecked = new Date(data.lastChecked).getTime();
      const now = Date.now();
      return now - lastChecked > CACHE_TTL_MS;
    } catch {
      return true;
    }
  }

  /**
   * Check if we should notify user based on priority and last notification time
   */
  shouldNotify(priority: UpdatePriority): boolean {
    try {
      const data = this.read();
      if (!data) return true;

      const interval = NOTIFICATION_INTERVALS[priority];
      if (interval === 0) return true; // Always notify for CRITICAL/IMPORTANT

      const lastNotified = new Date(data.lastNotified).getTime();
      const now = Date.now();
      return now - lastNotified > interval;
    } catch {
      return true;
    }
  }

  /**
   * Read cache data
   */
  read(): CacheData | null {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        return null;
      }

      const content = fs.readFileSync(this.cacheFile, 'utf-8');
      const data = JSON.parse(content) as CacheData;

      // Validate structure
      if (!data.lastChecked || !data.latestVersion) {
        return null;
      }

      return data;
    } catch (error) {
      // Corrupted cache file, treat as expired
      return null;
    }
  }

  /**
   * Write cache data
   */
  write(data: Partial<CacheData>): void {
    try {
      const existing = this.read();
      const newData: CacheData = {
        ...existing,
        ...data,
        lastChecked: new Date().toISOString(),
      } as CacheData;

      fs.writeFileSync(this.cacheFile, JSON.stringify(newData, null, 2), 'utf-8');
    } catch (error) {
      // Fail silently - cache is not critical
      console.error('Failed to write version cache:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Update last notified timestamp
   */
  updateLastNotified(): void {
    try {
      const data = this.read();
      if (data) {
        data.lastNotified = new Date().toISOString();
        fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch (error) {
      // Fail silently
    }
  }

  /**
   * Clear cache (for testing)
   */
  clear(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
    } catch {
      // Fail silently
    }
  }

  /**
   * Get cache file path (for debugging)
   */
  getCacheFilePath(): string {
    return this.cacheFile;
  }
}
