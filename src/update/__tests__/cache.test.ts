/**
 * Unit tests for VersionCache
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { VersionCache } from '../cache';
import type { CacheData, UpdatePriority } from '../types';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock fs module
jest.mock('fs');

describe('VersionCache', () => {
  let cache: VersionCache;
  let mockCacheDir: string;
  let mockCacheFile: string;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock paths
    mockCacheDir = path.join(os.homedir(), '.wardnmesh', 'cache');
    mockCacheFile = path.join(mockCacheDir, 'version-check.json');

    cache = new VersionCache();
  });

  describe('Cache Expiration', () => {
    it('should detect expired cache when lastChecked is > 24 hours ago', () => {
      const expiredData: CacheData = {
        lastChecked: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        latestVersion: '1.1.0',
        currentVersion: '1.0.0',
        priority: 'IMPORTANT',
        lastNotified: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        releaseNotes: 'Test notes',
        releaseUrl: 'https://example.com',
      };

      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(expiredData));

      expect(cache.isExpired()).toBe(true);
    });

    it('should detect fresh cache when lastChecked is < 24 hours ago', () => {
      const freshData: CacheData = {
        lastChecked: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(), // 23 hours ago
        latestVersion: '1.1.0',
        currentVersion: '1.0.0',
        priority: 'IMPORTANT',
        lastNotified: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
        releaseNotes: 'Test notes',
        releaseUrl: 'https://example.com',
      };

      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(freshData));

      expect(cache.isExpired()).toBe(false);
    });

    it('should consider cache expired when file does not exist', () => {
      jest.mocked(fs.existsSync).mockReturnValue(false);

      expect(cache.isExpired()).toBe(true);
    });

    it('should consider cache expired when file is corrupted', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.readFileSync).mockReturnValue('invalid json{');

      expect(cache.isExpired()).toBe(true);
    });
  });

  describe('Notification Frequency', () => {
    it('should notify for CRITICAL priority every time', () => {
      const criticalData: CacheData = {
        lastChecked: new Date().toISOString(),
        latestVersion: '2.0.0',
        currentVersion: '1.0.0',
        priority: 'CRITICAL',
        lastNotified: new Date(Date.now() - 1000).toISOString(), // 1 second ago
        releaseNotes: 'Critical update',
        releaseUrl: 'https://example.com',
      };

      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(criticalData));

      expect(cache.shouldNotify('CRITICAL')).toBe(true);
    });

    it('should notify for IMPORTANT priority every time', () => {
      const importantData: CacheData = {
        lastChecked: new Date().toISOString(),
        latestVersion: '1.1.0',
        currentVersion: '1.0.0',
        priority: 'IMPORTANT',
        lastNotified: new Date(Date.now() - 1000).toISOString(), // 1 second ago
        releaseNotes: 'Important update',
        releaseUrl: 'https://example.com',
      };

      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(importantData));

      expect(cache.shouldNotify('IMPORTANT')).toBe(true);
    });

    it('should not notify for MINOR priority within 7 days', () => {
      const minorData: CacheData = {
        lastChecked: new Date().toISOString(),
        latestVersion: '1.0.1',
        currentVersion: '1.0.0',
        priority: 'MINOR',
        lastNotified: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
        releaseNotes: 'Minor update',
        releaseUrl: 'https://example.com',
      };

      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(minorData));

      expect(cache.shouldNotify('MINOR')).toBe(false);
    });

    it('should notify for MINOR priority after 7 days', () => {
      const minorData: CacheData = {
        lastChecked: new Date().toISOString(),
        latestVersion: '1.0.1',
        currentVersion: '1.0.0',
        priority: 'MINOR',
        lastNotified: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
        releaseNotes: 'Minor update',
        releaseUrl: 'https://example.com',
      };

      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(minorData));

      expect(cache.shouldNotify('MINOR')).toBe(true);
    });

    it('should notify when never notified before', () => {
      jest.mocked(fs.existsSync).mockReturnValue(false);

      expect(cache.shouldNotify('MINOR')).toBe(true);
    });
  });

  describe('Read and Write Operations', () => {
    it('should read cache data successfully', () => {
      const testData: CacheData = {
        lastChecked: '2026-01-16T10:00:00Z',
        latestVersion: '1.1.0',
        currentVersion: '1.0.0',
        priority: 'IMPORTANT',
        lastNotified: '2026-01-16T10:00:00Z',
        releaseNotes: 'Test notes',
        releaseUrl: 'https://example.com',
      };

      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(testData));

      const result = cache.read();

      expect(result).toEqual(testData);
    });

    it('should return null when cache file does not exist', () => {
      jest.mocked(fs.existsSync).mockReturnValue(false);

      const result = cache.read();

      expect(result).toBeNull();
    });

    it('should return null when cache file is corrupted', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.readFileSync).mockReturnValue('invalid json{');

      const result = cache.read();

      expect(result).toBeNull();
    });

    it('should write cache data successfully', () => {
      const testData: Partial<CacheData> = {
        latestVersion: '1.2.0',
        currentVersion: '1.0.0',
        priority: 'IMPORTANT',
        lastNotified: '2026-01-16T10:00:00Z',
        releaseNotes: 'New release',
        releaseUrl: 'https://example.com',
      };

      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.readFileSync).mockReturnValue('null'); // No existing cache
      jest.mocked(fs.writeFileSync).mockImplementation(() => {});

      cache.write(testData);

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      const writeCall = jest.mocked(fs.writeFileSync).mock.calls[0];
      expect(writeCall[0]).toBe(mockCacheFile);
      expect(writeCall[2]).toBe('utf-8');

      // Parse the written data to verify structure (lastChecked is dynamic)
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData).toMatchObject(testData);
      expect(writtenData.lastChecked).toBeDefined();
      expect(new Date(writtenData.lastChecked).getTime()).toBeGreaterThan(0);
    });

    it('should create cache directory if it does not exist', () => {
      jest.mocked(fs.existsSync).mockReturnValue(false);
      jest.mocked(fs.mkdirSync).mockImplementation(() => '');

      // Constructor should create directory
      const newCache = new VersionCache();

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        mockCacheDir,
        { recursive: true }
      );
    });
  });

  describe('Mark Notified', () => {
    it('should update lastNotified timestamp', () => {
      const testData: CacheData = {
        lastChecked: '2026-01-16T10:00:00Z',
        latestVersion: '1.1.0',
        currentVersion: '1.0.0',
        priority: 'IMPORTANT',
        lastNotified: '2026-01-15T10:00:00Z',
        releaseNotes: 'Test notes',
        releaseUrl: 'https://example.com',
      };

      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(testData));
      jest.mocked(fs.writeFileSync).mockImplementation(() => {});

      cache.updateLastNotified();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenData = JSON.parse(
        jest.mocked(fs.writeFileSync).mock.calls[0][1] as string
      );
      expect(writtenData.lastNotified).not.toBe('2026-01-15T10:00:00Z');
    });

    it('should handle missing cache file gracefully', () => {
      jest.mocked(fs.existsSync).mockReturnValue(false);

      // Should not throw error
      expect(() => cache.updateLastNotified()).not.toThrow();
    });
  });

  describe('Clear Cache', () => {
    it('should delete cache file', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.unlinkSync).mockImplementation(() => {});

      cache.clear();

      expect(fs.unlinkSync).toHaveBeenCalledWith(mockCacheFile);
    });

    it('should handle missing cache file gracefully', () => {
      jest.mocked(fs.existsSync).mockReturnValue(false);

      // Should not throw error
      expect(() => cache.clear()).not.toThrow();
    });

    it('should handle deletion errors gracefully', () => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
      jest.mocked(fs.unlinkSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw error
      expect(() => cache.clear()).not.toThrow();
    });
  });
});
