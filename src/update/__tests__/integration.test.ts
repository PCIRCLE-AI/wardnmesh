/**
 * Integration tests for Update System
 *
 * Tests the end-to-end workflow of version checking, caching, and notification.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { VersionChecker } from '../checker';
import { VersionCache } from '../cache';
import { GitHubClient } from '../github';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mock GitHub client
// vitest v4: Create a mock class that can be instantiated
let mockGitHubInstance: any;

jest.mock('../github', () => ({
  GitHubClient: class {
    fetchLatestRelease = jest.fn(() => mockGitHubInstance?.fetchLatestRelease());
  }
}));

describe('Update System Integration', () => {
  let testCacheDir: string;
  let testCacheFile: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Create temporary cache directory
    testCacheDir = path.join(os.tmpdir(), '.wardnmesh-test', `test-${Date.now()}`);
    testCacheFile = path.join(testCacheDir, '.wardnmesh', 'cache', 'version-check.json');

    // Save original environment
    originalEnv = process.env;

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;

    // Clean up test cache
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('Full Update Check Workflow', () => {
    it('should perform complete update check on first run', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue({
          version: '2.0.0',
          releaseDate: '2026-01-16T10:00:00Z',
          releaseNotes: 'Major update',
          releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v2.0.0',
        }),
      };

      const checker = new VersionChecker('1.0.0', testCacheDir);
      const result = await checker.checkForUpdate();

      // Verify GitHub was called
      expect(mockGitHubInstance.fetchLatestRelease).toHaveBeenCalledTimes(1);

      // Verify result
      expect(result.hasUpdate).toBe(true);
      expect(result.priority).toBe('CRITICAL');
      expect(result.latestVersion).toBe('2.0.0');
      expect(result.shouldNotify).toBe(true);

      // Verify cache was created
      expect(fs.existsSync(testCacheFile)).toBe(true);

      // Verify cache content
      const cacheContent = JSON.parse(fs.readFileSync(testCacheFile, 'utf-8'));
      expect(cacheContent.latestVersion).toBe('2.0.0');
      expect(cacheContent.currentVersion).toBe('1.0.0');
      expect(cacheContent.priority).toBe('CRITICAL');
    });

    it('should use cached data on second run within 24 hours', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue({
          version: '1.1.0',
          releaseDate: '2026-01-16T10:00:00Z',
          releaseNotes: 'Update',
          releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.1.0',
        }),
      };


      const checker = new VersionChecker('1.0.0', testCacheDir);

      // First check
      await checker.checkForUpdate();
      expect(mockGitHubInstance.fetchLatestRelease).toHaveBeenCalledTimes(1);

      // Second check (should use cache)
      const result = await checker.checkForUpdate();
      expect(mockGitHubInstance.fetchLatestRelease).toHaveBeenCalledTimes(1); // Still 1 (not called again)
      expect(result.hasUpdate).toBe(true);
      expect(result.latestVersion).toBe('1.1.0');
    });

    it('should refresh cache after 24 hours', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue({
          version: '1.2.0',
          releaseDate: '2026-01-16T10:00:00Z',
          releaseNotes: 'Update',
          releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.2.0',
        }),
      };


      // Create expired cache
      const cache = new VersionCache(testCacheDir);
      cache.write({
        latestVersion: '1.1.0',
        currentVersion: '1.0.0',
        priority: 'IMPORTANT',
        lastNotified: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        releaseNotes: 'Old update',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.1.0',
      });

      // Manually set lastChecked to 25 hours ago
      const cacheContent = JSON.parse(fs.readFileSync(testCacheFile, 'utf-8'));
      cacheContent.lastChecked = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(testCacheFile, JSON.stringify(cacheContent), 'utf-8');

      // Check for update
      const checker = new VersionChecker('1.0.0', testCacheDir);
      const result = await checker.checkForUpdate();

      // Verify GitHub was called (cache expired)
      expect(mockGitHubInstance.fetchLatestRelease).toHaveBeenCalledTimes(1);
      expect(result.latestVersion).toBe('1.2.0'); // New version from GitHub
    });
  });

  describe('Priority Detection Integration', () => {
    it('should correctly classify major version update', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue({
          version: '2.0.0',
          releaseDate: '2026-01-16T10:00:00Z',
          releaseNotes: 'Breaking changes',
          releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v2.0.0',
        }),
      };


      const checker = new VersionChecker('1.5.0', testCacheDir);
      const result = await checker.checkForUpdate();

      expect(result.priority).toBe('CRITICAL');
      expect(result.shouldNotify).toBe(true); // CRITICAL always notifies
    });

    it('should correctly classify minor version update', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue({
          version: '1.2.0',
          releaseDate: '2026-01-16T10:00:00Z',
          releaseNotes: 'New features',
          releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.2.0',
        }),
      };


      const checker = new VersionChecker('1.1.0', testCacheDir);
      const result = await checker.checkForUpdate();

      expect(result.priority).toBe('IMPORTANT');
      expect(result.shouldNotify).toBe(true); // IMPORTANT always notifies
    });

    it('should correctly classify patch version update', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue({
          version: '1.1.1',
          releaseDate: '2026-01-16T10:00:00Z',
          releaseNotes: 'Bug fixes',
          releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.1.1',
        }),
      };


      const checker = new VersionChecker('1.1.0', testCacheDir);
      const result = await checker.checkForUpdate();

      expect(result.priority).toBe('MINOR');
    });
  });

  describe('Notification Frequency Integration', () => {
    it('should notify for CRITICAL priority every time', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue({
          version: '2.0.0',
          releaseDate: '2026-01-16T10:00:00Z',
          releaseNotes: 'Critical update',
          releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v2.0.0',
        }),
      };


      // Create cache with recent notification
      const cache = new VersionCache(testCacheDir);
      cache.write({
        latestVersion: '2.0.0',
        currentVersion: '1.0.0',
        priority: 'CRITICAL',
        lastNotified: new Date(Date.now() - 1000).toISOString(), // 1 second ago
        releaseNotes: 'Critical update',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v2.0.0',
      });

      const checker = new VersionChecker('1.0.0', testCacheDir);
      const result = await checker.checkForUpdate();

      // Should still notify even though we just notified
      expect(result.shouldNotify).toBe(true);
    });

    it('should respect 7-day interval for MINOR updates', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue({
          version: '1.0.1',
          releaseDate: '2026-01-16T10:00:00Z',
          releaseNotes: 'Bug fixes',
          releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.0.1',
        }),
      };


      // Create cache with recent notification (6 days ago)
      const cache = new VersionCache(testCacheDir);
      cache.write({
        latestVersion: '1.0.1',
        currentVersion: '1.0.0',
        priority: 'MINOR',
        lastNotified: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
        releaseNotes: 'Bug fixes',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.0.1',
      });

      const checker = new VersionChecker('1.0.0', testCacheDir);
      const result = await checker.checkForUpdate();

      // Should not notify yet (not 7 days)
      expect(result.shouldNotify).toBe(false);

      // Update cache to 8 days ago
      const cacheContent = JSON.parse(fs.readFileSync(testCacheFile, 'utf-8'));
      cacheContent.lastNotified = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(testCacheFile, JSON.stringify(cacheContent), 'utf-8');

      // Check again
      const result2 = await checker.checkForUpdate();

      // Should notify now (8 days passed)
      expect(result2.shouldNotify).toBe(true);
    });
  });

  describe('Environment Variable Integration', () => {
    it('should skip update check when WARDN_NO_UPDATE_CHECK=1', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue({
          version: '2.0.0',
          releaseDate: '2026-01-16T10:00:00Z',
          releaseNotes: 'Update',
          releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v2.0.0',
        }),
      };


      process.env.WARDN_NO_UPDATE_CHECK = '1';

      const checker = new VersionChecker('1.0.0', testCacheDir);
      const result = await checker.checkForUpdate();

      // Should not call GitHub
      expect(mockGitHubInstance.fetchLatestRelease).not.toHaveBeenCalled();

      // Should return no update
      expect(result.hasUpdate).toBe(false);
      expect(result.shouldNotify).toBe(false);
    });

    it('should check normally when WARDN_NO_UPDATE_CHECK is not set', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue({
          version: '2.0.0',
          releaseDate: '2026-01-16T10:00:00Z',
          releaseNotes: 'Update',
          releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v2.0.0',
        }),
      };


      delete process.env.WARDN_NO_UPDATE_CHECK;

      const checker = new VersionChecker('1.0.0', testCacheDir);
      const result = await checker.checkForUpdate();

      // Should call GitHub
      expect(mockGitHubInstance.fetchLatestRelease).toHaveBeenCalledTimes(1);
      expect(result.hasUpdate).toBe(true);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should handle GitHub API failure gracefully', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue(null), // API failure
      };


      const checker = new VersionChecker('1.0.0', testCacheDir);
      const result = await checker.checkForUpdate();

      // Should not throw error
      expect(result.hasUpdate).toBe(false);
      expect(result.shouldNotify).toBe(false);
    });

    it('should handle corrupted cache gracefully', async () => {
      mockGitHubInstance = {
        fetchLatestRelease: jest.fn().mockResolvedValue({
          version: '1.1.0',
          releaseDate: '2026-01-16T10:00:00Z',
          releaseNotes: 'Update',
          releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.1.0',
        }),
      };


      // Create corrupted cache
      const cacheDir = path.join(testCacheDir, '.wardnmesh', 'cache');
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(testCacheFile, 'invalid json{', 'utf-8');

      const checker = new VersionChecker('1.0.0', testCacheDir);
      const result = await checker.checkForUpdate();

      // Should fetch from GitHub and recover
      expect(mockGitHubInstance.fetchLatestRelease).toHaveBeenCalledTimes(1);
      expect(result.hasUpdate).toBe(true);

      // Should create new valid cache
      const newCache = JSON.parse(fs.readFileSync(testCacheFile, 'utf-8'));
      expect(newCache.latestVersion).toBe('1.1.0');
    });
  });
});
