/**
 * Unit tests for VersionChecker
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { VersionChecker } from '../checker';
import { VersionCache } from '../cache';
import { GitHubClient } from '../github';
import type { UpdatePriority } from '../types';

// Mock dependencies
let mockCacheInstance: any;
let mockGitHubInstance: any;

jest.mock('../cache', () => ({
  VersionCache: class {
    read = jest.fn(() => mockCacheInstance?.read());
    write = jest.fn((...args: any[]) => mockCacheInstance?.write(...args));
    isExpired = jest.fn(() => mockCacheInstance?.isExpired());
    updateLastNotified = jest.fn(() => mockCacheInstance?.updateLastNotified());
    shouldNotify = jest.fn(() => mockCacheInstance?.shouldNotify());
    clear = jest.fn(() => mockCacheInstance?.clear());
    getCacheFilePath = jest.fn(() => mockCacheInstance?.getCacheFilePath());
  }
}));

jest.mock('../github', () => ({
  GitHubClient: class {
    fetchLatestRelease = jest.fn(() => mockGitHubInstance?.fetchLatestRelease());
  }
}));

describe('VersionChecker', () => {
  let checker: VersionChecker;
  let mockCache: any;
  let mockGitHub: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockCache = {
      read: jest.fn(),
      write: jest.fn(),
      isExpired: jest.fn(),
      updateLastNotified: jest.fn(),
      shouldNotify: jest.fn(),
      clear: jest.fn(),
      getCacheFilePath: jest.fn().mockReturnValue('/mock/cache/path'),
    };

    mockGitHub = {
      fetchLatestRelease: jest.fn(),
    };

    // Set mock instances for the class mocks to use
    mockCacheInstance = mockCache;
    mockGitHubInstance = mockGitHub;

    // Create checker instance
    checker = new VersionChecker('1.0.0');
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.WARDN_NO_UPDATE_CHECK;
  });

  describe('Priority Detection', () => {
    it('should detect major version update as CRITICAL', async () => {
      mockCache.isExpired.mockReturnValue(true);
      mockGitHub.fetchLatestRelease.mockResolvedValue({
        version: '2.0.0',
        releaseDate: '2026-01-16',
        releaseNotes: 'Breaking changes',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v2.0.0',
      });
      mockCache.shouldNotify.mockReturnValue(true);

      const result = await checker.checkForUpdate();

      expect(result.hasUpdate).toBe(true);
      expect(result.priority).toBe('CRITICAL');
      expect(result.currentVersion).toBe('1.0.0');
      expect(result.latestVersion).toBe('2.0.0');
    });

    it('should detect minor version update as IMPORTANT', async () => {
      mockCache.isExpired.mockReturnValue(true);
      mockGitHub.fetchLatestRelease.mockResolvedValue({
        version: '1.1.0',
        releaseDate: '2026-01-16',
        releaseNotes: 'New features',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.1.0',
      });
      mockCache.shouldNotify.mockReturnValue(true);

      const result = await checker.checkForUpdate();

      expect(result.hasUpdate).toBe(true);
      expect(result.priority).toBe('IMPORTANT');
      expect(result.latestVersion).toBe('1.1.0');
    });

    it('should detect patch version update as MINOR', async () => {
      mockCache.isExpired.mockReturnValue(true);
      mockGitHub.fetchLatestRelease.mockResolvedValue({
        version: '1.0.1',
        releaseDate: '2026-01-16',
        releaseNotes: 'Bug fixes',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.0.1',
      });
      mockCache.shouldNotify.mockReturnValue(true);

      const result = await checker.checkForUpdate();

      expect(result.hasUpdate).toBe(true);
      expect(result.priority).toBe('MINOR');
      expect(result.latestVersion).toBe('1.0.1');
    });

    it('should return no update when versions are equal', async () => {
      mockCache.isExpired.mockReturnValue(true);
      mockGitHub.fetchLatestRelease.mockResolvedValue({
        version: '1.0.0',
        releaseDate: '2026-01-16',
        releaseNotes: 'Current version',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.0.0',
      });

      const result = await checker.checkForUpdate();

      expect(result.hasUpdate).toBe(false);
      expect(result.currentVersion).toBe('1.0.0');
      expect(result.latestVersion).toBe('1.0.0');
    });

    it('should return no update when current is newer (edge case)', async () => {
      const newerChecker = new VersionChecker('2.0.0');
      mockCache.isExpired.mockReturnValue(true);
      mockGitHub.fetchLatestRelease.mockResolvedValue({
        version: '1.5.0',
        releaseDate: '2026-01-16',
        releaseNotes: 'Older version',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.5.0',
      });

      const result = await newerChecker.checkForUpdate();

      expect(result.hasUpdate).toBe(false);
    });
  });

  describe('Cache Integration', () => {
    it('should use cached data when cache is not expired', async () => {
      mockCache.isExpired.mockReturnValue(false);
      mockCache.read.mockReturnValue({
        lastChecked: '2026-01-16T10:00:00Z',
        latestVersion: '1.1.0',
        currentVersion: '1.0.0',
        priority: 'IMPORTANT' as UpdatePriority,
        lastNotified: '2026-01-16T10:00:00Z',
        releaseNotes: 'Cached notes',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.1.0',
      });
      mockCache.shouldNotify.mockReturnValue(true);

      const result = await checker.checkForUpdate();

      expect(result.hasUpdate).toBe(true);
      expect(result.latestVersion).toBe('1.1.0');
      expect(mockGitHub.fetchLatestRelease).not.toHaveBeenCalled();
    });

    it('should fetch from GitHub when cache is expired', async () => {
      mockCache.isExpired.mockReturnValue(true);
      mockGitHub.fetchLatestRelease.mockResolvedValue({
        version: '1.2.0',
        releaseDate: '2026-01-16',
        releaseNotes: 'Fresh data',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.2.0',
      });
      mockCache.shouldNotify.mockReturnValue(true);

      const result = await checker.checkForUpdate();

      expect(result.hasUpdate).toBe(true);
      expect(result.latestVersion).toBe('1.2.0');
      expect(mockGitHub.fetchLatestRelease).toHaveBeenCalledTimes(1);
      expect(mockCache.write).toHaveBeenCalled();
    });

    it('should respect notification frequency from cache', async () => {
      mockCache.isExpired.mockReturnValue(false);
      mockCache.read.mockReturnValue({
        lastChecked: '2026-01-16T10:00:00Z',
        latestVersion: '1.0.1',
        currentVersion: '1.0.0',
        priority: 'MINOR' as UpdatePriority,
        lastNotified: '2026-01-16T09:00:00Z',
        releaseNotes: 'Recent notification',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.0.1',
      });
      mockCache.shouldNotify.mockReturnValue(false); // Too soon for MINOR

      const result = await checker.checkForUpdate();

      expect(result.hasUpdate).toBe(true);
      expect(result.shouldNotify).toBe(false); // Should not show notification yet
    });
  });

  describe('Environment Variable Handling', () => {
    it('should skip check when WARDN_NO_UPDATE_CHECK=1', async () => {
      process.env.WARDN_NO_UPDATE_CHECK = '1';

      const result = await checker.checkForUpdate();

      expect(result.hasUpdate).toBe(false);
      expect(result.shouldNotify).toBe(false);
      expect(mockCache.isExpired).not.toHaveBeenCalled();
      expect(mockGitHub.fetchLatestRelease).not.toHaveBeenCalled();
    });

    it('should check normally when WARDN_NO_UPDATE_CHECK is not set', async () => {
      mockCache.isExpired.mockReturnValue(true);
      mockGitHub.fetchLatestRelease.mockResolvedValue({
        version: '1.1.0',
        releaseDate: '2026-01-16',
        releaseNotes: 'Update',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.1.0',
      });
      mockCache.shouldNotify.mockReturnValue(true);

      const result = await checker.checkForUpdate();

      expect(result.hasUpdate).toBe(true);
      expect(mockGitHub.fetchLatestRelease).toHaveBeenCalled();
    });

    it('should check normally when WARDN_NO_UPDATE_CHECK=0', async () => {
      process.env.WARDN_NO_UPDATE_CHECK = '0';
      mockCache.isExpired.mockReturnValue(true);
      mockGitHub.fetchLatestRelease.mockResolvedValue({
        version: '1.1.0',
        releaseDate: '2026-01-16',
        releaseNotes: 'Update',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.1.0',
      });
      mockCache.shouldNotify.mockReturnValue(true);

      const result = await checker.checkForUpdate();

      expect(result.hasUpdate).toBe(true);
      expect(mockGitHub.fetchLatestRelease).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle GitHub API failure gracefully', async () => {
      mockCache.isExpired.mockReturnValue(true);
      mockGitHub.fetchLatestRelease.mockResolvedValue(null); // API failure

      const result = await checker.checkForUpdate();

      expect(result.hasUpdate).toBe(false);
      expect(result.shouldNotify).toBe(false);
    });

    it('should handle invalid version format', async () => {
      mockCache.isExpired.mockReturnValue(true);
      mockGitHub.fetchLatestRelease.mockResolvedValue({
        version: 'invalid-version',
        releaseDate: '2026-01-16',
        releaseNotes: 'Invalid',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/invalid',
      });

      const result = await checker.checkForUpdate();

      // Should handle gracefully (implementation detail)
      expect(result).toBeDefined();
    });
  });

  describe('Cache Operations', () => {
    it('should mark as notified after successful check', () => {
      checker.markNotified();
      expect(mockCache.updateLastNotified).toHaveBeenCalledTimes(1);
    });

    it('should clear cache when requested', () => {
      checker.clearCache();
      expect(mockCache.clear).toHaveBeenCalledTimes(1);
    });
  });
});
