/**
 * Package Version Compatibility Checker
 *
 * Checks if specific APIs are available in package versions and suggests
 * minimal upgrade paths when APIs are missing.
 *
 * Features:
 * - Semver parsing and comparison
 * - Version range matching (^, ~, >=, etc.)
 * - API availability detection
 * - Minimal upgrade suggestions
 * - Breaking change warnings
 */

import { NpmRegistryClient } from './registry-client';

/**
 * Parsed version information
 */
export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * API availability result
 */
export interface ApiAvailability {
  available: boolean;
  currentVersion: string;
  firstAvailableVersion?: string;
  requiresUpgrade: boolean;
}

/**
 * Upgrade suggestion
 */
export interface UpgradeSuggestion {
  packageName: string;
  currentVersion: string;
  suggestedVersion: string;
  upgradeType: 'patch' | 'minor' | 'major';
  isBreaking: boolean;
  reason: string;
}

/**
 * Compatibility report for multiple APIs
 */
export interface CompatibilityReport {
  packageName: string;
  currentVersion: string;
  latestVersion: string;
  incompatibleApis: string[];
  recommendedVersion: string;
  upgradeSuggestion?: UpgradeSuggestion;
}

/**
 * Version Compatibility Checker
 *
 * Provides semver-based version comparison and API availability checking
 */
export class VersionCompatibilityChecker {
  constructor(private npmClient: NpmRegistryClient) {}

  /**
   * Parse a semantic version string
   *
   * @param version - Version string (e.g., "1.2.3", "1.2.3-alpha.1")
   * @returns Parsed version information
   */
  parseVersion(version: string): VersionInfo {
    // Semver regex: major.minor.patch[-prerelease][+build]
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+([a-zA-Z0-9.-]+))?$/;
    const match = version.match(semverRegex);

    if (!match) {
      throw new Error(`Invalid version string: ${version}`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4],
      build: match[5]
    };
  }

  /**
   * Compare two version strings
   *
   * @param a - First version
   * @param b - Second version
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
   */
  compareVersions(a: string, b: string): number {
    const versionA = this.parseVersion(a);
    const versionB = this.parseVersion(b);

    // Compare major.minor.patch
    if (versionA.major !== versionB.major) {
      return versionA.major - versionB.major;
    }
    if (versionA.minor !== versionB.minor) {
      return versionA.minor - versionB.minor;
    }
    if (versionA.patch !== versionB.patch) {
      return versionA.patch - versionB.patch;
    }

    // Handle prerelease
    // Version without prerelease > version with prerelease
    if (versionA.prerelease && !versionB.prerelease) {
      return -1;
    }
    if (!versionA.prerelease && versionB.prerelease) {
      return 1;
    }
    if (versionA.prerelease && versionB.prerelease) {
      return versionA.prerelease.localeCompare(versionB.prerelease);
    }

    // Build metadata is ignored in comparison
    return 0;
  }

  /**
   * Check if a version satisfies a version range
   *
   * @param version - Version to check
   * @param range - Version range (e.g., "^1.2.3", "~1.2.3", ">=1.0.0")
   * @returns True if version satisfies range
   */
  satisfiesRange(version: string, range: string): boolean {
    // Wildcard - matches any version
    if (range === '*') {
      return true;
    }

    // Exact version
    if (!range.match(/[~^<>=]/)) {
      return this.compareVersions(version, range) === 0;
    }

    // Caret range: ^1.2.3 := >=1.2.3 <2.0.0
    if (range.startsWith('^')) {
      const base = range.slice(1);
      const baseVersion = this.parseVersion(base);
      const testVersion = this.parseVersion(version);

      return (
        this.compareVersions(version, base) >= 0 &&
        testVersion.major === baseVersion.major
      );
    }

    // Tilde range: ~1.2.3 := >=1.2.3 <1.3.0
    if (range.startsWith('~')) {
      const base = range.slice(1);
      const baseVersion = this.parseVersion(base);
      const testVersion = this.parseVersion(version);

      return (
        this.compareVersions(version, base) >= 0 &&
        testVersion.major === baseVersion.major &&
        testVersion.minor === baseVersion.minor
      );
    }

    // >= operator
    if (range.startsWith('>=')) {
      const base = range.slice(2).trim();
      return this.compareVersions(version, base) >= 0;
    }

    // > operator
    if (range.startsWith('>') && !range.startsWith('>=')) {
      const base = range.slice(1).trim();
      return this.compareVersions(version, base) > 0;
    }

    // <= operator
    if (range.startsWith('<=')) {
      const base = range.slice(2).trim();
      return this.compareVersions(version, base) <= 0;
    }

    // < operator
    if (range.startsWith('<') && !range.startsWith('<=')) {
      const base = range.slice(1).trim();
      return this.compareVersions(version, base) < 0;
    }

    // Unknown range format - conservative: assume not satisfied
    return false;
  }

  /**
   * Check if an API is available in a specific package version
   *
   * @param packageName - Package name
   * @param currentVersion - Current installed version
   * @param apiName - API name (for documentation)
   * @param firstAvailableVersion - Optional: first version where API is available
   * @returns API availability information
   */
  async checkApiAvailability(
    packageName: string,
    currentVersion: string,
    apiName: string,
    firstAvailableVersion?: string
  ): Promise<ApiAvailability | null> {
    const packageInfo = await this.npmClient.getPackageInfo(packageName);

    if (!packageInfo) {
      return null;
    }

    // Check if package has any versions
    if (!packageInfo.versions || packageInfo.versions.length === 0) {
      return null;
    }

    // If firstAvailableVersion is provided, check if current version has it
    if (firstAvailableVersion) {
      const hasApi = this.compareVersions(currentVersion, firstAvailableVersion) >= 0;

      return {
        available: hasApi,
        currentVersion,
        firstAvailableVersion,
        requiresUpgrade: !hasApi
      };
    }

    // If no firstAvailableVersion, assume API is available
    return {
      available: true,
      currentVersion,
      requiresUpgrade: false
    };
  }

  /**
   * Suggest an upgrade path for a package
   *
   * @param packageName - Package name
   * @param currentVersion - Current version
   * @param targetVersion - Target version with required API
   * @returns Upgrade suggestion
   */
  async suggestUpgrade(
    packageName: string,
    currentVersion: string,
    targetVersion: string
  ): Promise<UpgradeSuggestion | null> {
    const packageInfo = await this.npmClient.getPackageInfo(packageName);

    if (!packageInfo) {
      return null;
    }

    const current = this.parseVersion(currentVersion);
    const target = this.parseVersion(targetVersion);

    // Determine upgrade type
    let upgradeType: 'patch' | 'minor' | 'major';
    let isBreaking: boolean;
    let reason: string;

    if (target.major > current.major) {
      upgradeType = 'major';
      isBreaking = true;
      reason = `API first available in ${targetVersion} (breaking change - major version upgrade)`;
    } else if (target.minor > current.minor) {
      upgradeType = 'minor';
      isBreaking = false;
      reason = `API first available in ${targetVersion}`;
    } else {
      upgradeType = 'patch';
      isBreaking = false;
      reason = `API first available in ${targetVersion}`;
    }

    return {
      packageName,
      currentVersion,
      suggestedVersion: targetVersion,
      upgradeType,
      isBreaking,
      reason
    };
  }

  /**
   * Generate a compatibility report for multiple APIs
   *
   * @param packageName - Package name
   * @param currentVersion - Current version
   * @param requiredApis - List of required API names
   * @returns Compatibility report
   */
  async generateCompatibilityReport(
    packageName: string,
    currentVersion: string,
    requiredApis: string[]
  ): Promise<CompatibilityReport> {
    const packageInfo = await this.npmClient.getPackageInfo(packageName);

    if (!packageInfo) {
      throw new Error(`Package ${packageName} not found`);
    }

    const latestVersion = packageInfo.latestVersion || packageInfo.version || 'unknown';

    // For now, assume all APIs require latest version
    // In a real implementation, this would check actual API documentation
    const incompatibleApis = requiredApis.filter(() => {
      return this.compareVersions(currentVersion, latestVersion) < 0;
    });

    // Find the minimum version that includes all required APIs
    // For simplicity, recommend the first stable version that's not a prerelease
    const stableVersions = (packageInfo.versions || [])
      .filter(v => {
        try {
          const parsed = this.parseVersion(v);
          return !parsed.prerelease;
        } catch {
          return false;
        }
      })
      .sort((a, b) => this.compareVersions(a, b));

    // Find first stable version that's > current version
    // This represents the minimum upgrade needed
    const recommendedVersion = stableVersions.find(v =>
      this.compareVersions(v, currentVersion) > 0
    ) || latestVersion;

    const upgradeSuggestion = await this.suggestUpgrade(
      packageName,
      currentVersion,
      recommendedVersion
    );

    return {
      packageName,
      currentVersion,
      latestVersion,
      incompatibleApis,
      recommendedVersion,
      upgradeSuggestion: upgradeSuggestion || undefined
    };
  }

  /**
   * Check if a version range can satisfy a required version
   *
   * @param packageName - Package name (for context)
   * @param versionRange - Version range from package.json
   * @param requiredVersion - Required version for API
   * @returns True if range can satisfy requirement
   */
  async checkVersionRange(
    packageName: string,
    versionRange: string,
    requiredVersion: string
  ): Promise<boolean> {
    // Check if the required version satisfies the range
    return this.satisfiesRange(requiredVersion, versionRange);
  }
}
