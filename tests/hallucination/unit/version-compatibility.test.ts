/**
 * Unit tests for Package Version Compatibility Checker
 *
 * Testing Strategy:
 * - Test version parsing and comparison (semver)
 * - Test API availability detection across versions
 * - Test upgrade suggestion logic (minimal upgrade path)
 * - Test version range compatibility (^, ~, >=, etc.)
 * - Test edge cases (pre-release, build metadata)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NpmRegistryClient } from '../../../src/hallucination/npm/registry-client';

// These imports will fail initially - that's expected in TDD!
import {
  VersionCompatibilityChecker,
  VersionInfo,
  ApiAvailability,
  UpgradeSuggestion
} from '../../../src/hallucination/npm/version-compatibility';

describe('VersionCompatibilityChecker', () => {
  let checker: VersionCompatibilityChecker;
  let mockNpmClient: jest.Mocked<NpmRegistryClient>;

  beforeEach(() => {
    // Create mock npm client
    mockNpmClient = {
      getPackageInfo: jest.fn(),
      getPackageVersions: jest.fn(),
      getLatestVersion: jest.fn()
    } as any;

    checker = new VersionCompatibilityChecker(mockNpmClient);
  });

  describe('Version Parsing', () => {
    it('should parse simple version numbers', () => {
      const version = checker.parseVersion('1.2.3');

      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: undefined,
        build: undefined
      });
    });

    it('should parse version with prerelease tag', () => {
      const version = checker.parseVersion('1.2.3-alpha.1');

      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
        build: undefined
      });
    });

    it('should parse version with build metadata', () => {
      const version = checker.parseVersion('1.2.3+20130313144700');

      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: undefined,
        build: '20130313144700'
      });
    });

    it('should parse version with both prerelease and build', () => {
      const version = checker.parseVersion('1.2.3-beta.2+exp.sha.5114f85');

      expect(version).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'beta.2',
        build: 'exp.sha.5114f85'
      });
    });
  });

  describe('Version Comparison', () => {
    it('should compare major versions', () => {
      expect(checker.compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
      expect(checker.compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    });

    it('should compare minor versions', () => {
      expect(checker.compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0);
      expect(checker.compareVersions('1.1.0', '1.2.0')).toBeLessThan(0);
    });

    it('should compare patch versions', () => {
      expect(checker.compareVersions('1.2.3', '1.2.2')).toBeGreaterThan(0);
      expect(checker.compareVersions('1.2.2', '1.2.3')).toBeLessThan(0);
    });

    it('should handle equal versions', () => {
      expect(checker.compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('should compare prerelease versions', () => {
      expect(checker.compareVersions('1.2.3', '1.2.3-alpha')).toBeGreaterThan(0);
      expect(checker.compareVersions('1.2.3-alpha', '1.2.3-beta')).toBeLessThan(0);
    });

    it('should sort versions correctly', () => {
      const versions = ['1.10.0', '1.2.0', '2.0.0', '1.2.1', '1.2.0-beta'];
      const sorted = versions.sort((a, b) => checker.compareVersions(a, b));

      expect(sorted).toEqual(['1.2.0-beta', '1.2.0', '1.2.1', '1.10.0', '2.0.0']);
    });
  });

  describe('Version Range Matching', () => {
    it('should match exact version', () => {
      expect(checker.satisfiesRange('1.2.3', '1.2.3')).toBe(true);
      expect(checker.satisfiesRange('1.2.4', '1.2.3')).toBe(false);
    });

    it('should match caret range (^)', () => {
      // ^1.2.3 := >=1.2.3 <2.0.0
      expect(checker.satisfiesRange('1.2.3', '^1.2.3')).toBe(true);
      expect(checker.satisfiesRange('1.3.0', '^1.2.3')).toBe(true);
      expect(checker.satisfiesRange('2.0.0', '^1.2.3')).toBe(false);
      expect(checker.satisfiesRange('1.2.2', '^1.2.3')).toBe(false);
    });

    it('should match tilde range (~)', () => {
      // ~1.2.3 := >=1.2.3 <1.3.0
      expect(checker.satisfiesRange('1.2.3', '~1.2.3')).toBe(true);
      expect(checker.satisfiesRange('1.2.5', '~1.2.3')).toBe(true);
      expect(checker.satisfiesRange('1.3.0', '~1.2.3')).toBe(false);
    });

    it('should match >= operator', () => {
      expect(checker.satisfiesRange('1.2.3', '>=1.2.0')).toBe(true);
      expect(checker.satisfiesRange('1.1.9', '>=1.2.0')).toBe(false);
    });

    it('should match > operator', () => {
      expect(checker.satisfiesRange('1.2.1', '>1.2.0')).toBe(true);
      expect(checker.satisfiesRange('1.2.0', '>1.2.0')).toBe(false);
    });

    it('should match <= operator', () => {
      expect(checker.satisfiesRange('1.2.0', '<=1.2.3')).toBe(true);
      expect(checker.satisfiesRange('1.2.4', '<=1.2.3')).toBe(false);
    });

    it('should match < operator', () => {
      expect(checker.satisfiesRange('1.2.0', '<1.2.3')).toBe(true);
      expect(checker.satisfiesRange('1.2.3', '<1.2.3')).toBe(false);
    });

    it('should match wildcard (*)', () => {
      expect(checker.satisfiesRange('1.2.3', '*')).toBe(true);
      expect(checker.satisfiesRange('0.0.1', '*')).toBe(true);
    });
  });

  describe('API Availability Detection', () => {
    it('should detect API available in current version', async () => {
      mockNpmClient.getPackageInfo.mockResolvedValue({
        name: 'test-package',
        versions: ['1.0.0', '1.1.0', '1.2.0', '2.0.0']
      } as any);

      const result = await checker.checkApiAvailability(
        'test-package',
        '1.2.0',
        'someMethod'
      );

      expect(result.available).toBe(true);
      expect(result.currentVersion).toBe('1.2.0');
    });

    it('should detect API not available and suggest upgrade', async () => {
      mockNpmClient.getPackageInfo.mockResolvedValue({
        name: 'test-package',
        versions: ['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.1.0']
      } as any);

      // API was added in version 2.0.0
      const result = await checker.checkApiAvailability(
        'test-package',
        '1.2.0', // Current version (too old)
        'newMethod',
        '2.0.0' // First version with this API
      );

      expect(result.available).toBe(false);
      expect(result.currentVersion).toBe('1.2.0');
      expect(result.firstAvailableVersion).toBe('2.0.0');
      expect(result.requiresUpgrade).toBe(true);
    });

    it('should return null for non-existent package', async () => {
      mockNpmClient.getPackageInfo.mockResolvedValue(null);

      const result = await checker.checkApiAvailability(
        'fake-package',
        '1.0.0',
        'someMethod'
      );

      expect(result).toBeNull();
    });
  });

  describe('Upgrade Suggestions', () => {
    it('should suggest minimal upgrade for patch-level API', async () => {
      mockNpmClient.getPackageInfo.mockResolvedValue({
        name: 'test-package',
        versions: ['1.0.0', '1.0.1', '1.0.2', '1.1.0', '2.0.0'],
        latestVersion: '2.0.0'
      } as any);

      const suggestion = await checker.suggestUpgrade(
        'test-package',
        '1.0.0',  // Current
        '1.0.2'   // First version with API
      );

      expect(suggestion).toEqual({
        packageName: 'test-package',
        currentVersion: '1.0.0',
        suggestedVersion: '1.0.2',
        upgradeType: 'patch',
        isBreaking: false,
        reason: 'API first available in 1.0.2'
      });
    });

    it('should suggest minor upgrade for non-breaking change', async () => {
      mockNpmClient.getPackageInfo.mockResolvedValue({
        name: 'test-package',
        versions: ['1.0.0', '1.1.0', '1.2.0', '2.0.0'],
        latestVersion: '2.0.0'
      } as any);

      const suggestion = await checker.suggestUpgrade(
        'test-package',
        '1.0.0',
        '1.1.0'
      );

      expect(suggestion?.upgradeType).toBe('minor');
      expect(suggestion?.isBreaking).toBe(false);
    });

    it('should warn about breaking changes for major upgrade', async () => {
      mockNpmClient.getPackageInfo.mockResolvedValue({
        name: 'test-package',
        versions: ['1.0.0', '1.1.0', '2.0.0', '3.0.0'],
        latestVersion: '3.0.0'
      } as any);

      const suggestion = await checker.suggestUpgrade(
        'test-package',
        '1.1.0',
        '2.0.0'
      );

      expect(suggestion?.upgradeType).toBe('major');
      expect(suggestion?.isBreaking).toBe(true);
      expect(suggestion?.reason).toContain('breaking');
    });

    it('should suggest latest stable if API is in latest', async () => {
      mockNpmClient.getPackageInfo.mockResolvedValue({
        name: 'test-package',
        versions: ['1.0.0', '2.0.0', '3.0.0'],
        latestVersion: '3.0.0'
      } as any);

      const suggestion = await checker.suggestUpgrade(
        'test-package',
        '1.0.0',
        '3.0.0'
      );

      expect(suggestion?.suggestedVersion).toBe('3.0.0');
    });

    it('should handle prerelease versions appropriately', async () => {
      mockNpmClient.getPackageInfo.mockResolvedValue({
        name: 'test-package',
        versions: ['1.0.0', '2.0.0-beta.1', '2.0.0'],
        latestVersion: '2.0.0'
      } as any);

      const suggestion = await checker.suggestUpgrade(
        'test-package',
        '1.0.0',
        '2.0.0'
      );

      // Should suggest stable 2.0.0, not beta
      expect(suggestion?.suggestedVersion).toBe('2.0.0');
    });
  });

  describe('Version Compatibility Report', () => {
    it('should generate comprehensive compatibility report', async () => {
      mockNpmClient.getPackageInfo.mockResolvedValue({
        name: 'react',
        version: '18.2.0',
        versions: ['16.0.0', '17.0.0', '18.0.0', '18.2.0'],
        latestVersion: '18.2.0'
      } as any);

      const report = await checker.generateCompatibilityReport(
        'react',
        '17.0.0',
        ['useId', 'useDeferredValue'] // APIs added in React 18
      );

      expect(report.packageName).toBe('react');
      expect(report.currentVersion).toBe('17.0.0');
      expect(report.latestVersion).toBe('18.2.0');
      expect(report.incompatibleApis).toHaveLength(2);
      expect(report.recommendedVersion).toBe('18.0.0');
    });
  });

  describe('Edge Cases', () => {
    it('should handle version ranges in package.json', async () => {
      const isCompatible = await checker.checkVersionRange(
        'test-package',
        '^1.2.0', // package.json version range
        '1.5.0'   // required version for API
      );

      expect(isCompatible).toBe(true);
    });

    it('should handle missing version information gracefully', async () => {
      mockNpmClient.getPackageInfo.mockResolvedValue({
        name: 'test-package',
        versions: []
      } as any);

      const result = await checker.checkApiAvailability(
        'test-package',
        '1.0.0',
        'someMethod'
      );

      expect(result).toBeNull();
    });

    it('should handle invalid version strings', () => {
      expect(() => checker.parseVersion('invalid')).toThrow();
      expect(() => checker.parseVersion('1.2')).toThrow();
    });
  });
});
