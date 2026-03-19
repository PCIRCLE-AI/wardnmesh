/**
 * npm Registry Client
 *
 * Checks package existence and versions on npm registry.
 * Implements caching to minimize network requests.
 *
 * Features:
 * - Package existence checking
 * - Version information fetching
 * - Intelligent caching (positive/negative results)
 * - Timeout handling
 * - Custom registry URL support
 * - Performance metrics tracking
 */

import { logger } from '../../utils/logger';
import {
  NPM_REQUEST_TIMEOUT_MS,
  MAX_PACKAGE_CACHE_SIZE,
  CACHE_TTL_MS,
} from '../constants';
import { validatePackageName, validateNonEmptyString, validateArray } from '../utils/validation';
import { Mutex } from 'async-mutex';
import * as semver from 'semver';
import pLimit from 'p-limit';

/**
 * Package Information
 */
export interface PackageInfo {
  name: string;
  version?: string;
  description?: string;
  versions?: string[];
  latestVersion?: string;
  distTags?: Record<string, string>;
}

/**
 * Cache Statistics
 */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * npm Registry Client Options
 */
export interface NpmClientOptions {
  /**
   * Registry URL (default: https://registry.npmjs.org)
   */
  registryUrl?: string;

  /**
   * Request timeout in milliseconds (default: from constants)
   */
  timeout?: number;

  /**
   * Maximum concurrent requests for batch operations (default: 10)
   */
  maxConcurrency?: number;
}

/**
 * Cache Entry
 */
interface CacheEntry {
  exists: boolean;
  info?: PackageInfo;
  timestamp: number;
}

/**
 * npm Registry Response (for runtime validation)
 */
interface NpmRegistryResponse {
  name?: string;
  version?: string;
  description?: string;
  versions?: Record<string, unknown>;
  'dist-tags'?: Record<string, string>;
}

/**
 * npm Registry Client
 *
 * Provides methods to check package existence and fetch version information
 * from npm registry with built-in caching.
 */
export class NpmRegistryClient {
  private registryUrl: string;
  private timeout: number;
  private cache: Map<string, CacheEntry>;
  private cacheHits: number;
  private cacheMisses: number;
  private statsMutex: Mutex;
  private rateLimiter: ReturnType<typeof pLimit>;

  constructor(options: NpmClientOptions = {}) {
    this.registryUrl = options.registryUrl || 'https://registry.npmjs.org';
    this.timeout = options.timeout || NPM_REQUEST_TIMEOUT_MS;
    this.cache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.statsMutex = new Mutex();
    this.rateLimiter = pLimit(options.maxConcurrency || 10);

    logger.debug('NpmRegistryClient initialized', {
      registryUrl: this.registryUrl,
      timeout: this.timeout,
      maxConcurrency: options.maxConcurrency || 10
    });
  }

  /**
   * Check if cache entry is expired (TTL check)
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > CACHE_TTL_MS;
  }

  /**
   * Increment cache hits (thread-safe)
   */
  private async incrementHits(): Promise<void> {
    await this.statsMutex.runExclusive(() => {
      this.cacheHits++;
    });
  }

  /**
   * Increment cache misses (thread-safe)
   */
  private async incrementMisses(): Promise<void> {
    await this.statsMutex.runExclusive(() => {
      this.cacheMisses++;
    });
  }

  /**
   * Validate npm registry response
   */
  private validateRegistryResponse(data: unknown): NpmRegistryResponse {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid registry response: not an object');
    }

    const response = data as Record<string, unknown>;

    // Validate name (should be string if present)
    if (response.name !== undefined && typeof response.name !== 'string') {
      throw new Error('Invalid registry response: name is not a string');
    }

    // Validate version (should be string if present)
    if (response.version !== undefined && typeof response.version !== 'string') {
      throw new Error('Invalid registry response: version is not a string');
    }

    // Validate description (should be string if present)
    if (response.description !== undefined && typeof response.description !== 'string') {
      throw new Error('Invalid registry response: description is not a string');
    }

    // Validate versions (should be object if present)
    if (response.versions !== undefined && (typeof response.versions !== 'object' || response.versions === null)) {
      throw new Error('Invalid registry response: versions is not an object');
    }

    // Validate dist-tags (should be object with string values if present)
    if (response['dist-tags'] !== undefined) {
      if (typeof response['dist-tags'] !== 'object' || response['dist-tags'] === null) {
        throw new Error('Invalid registry response: dist-tags is not an object');
      }
      const distTags = response['dist-tags'] as Record<string, unknown>;
      for (const [key, value] of Object.entries(distTags)) {
        if (typeof value !== 'string') {
          throw new Error(`Invalid registry response: dist-tags.${key} is not a string`);
        }
      }
    }

    return response as NpmRegistryResponse;
  }

  /**
   * Check if a package exists on npm registry
   *
   * @param packageName - Package name (e.g., 'react' or '@types/node')
   * @returns True if package exists, false otherwise
   */
  async checkPackageExists(packageName: string): Promise<boolean> {
    // Validate input
    validatePackageName(packageName, 'packageName');

    // Check cache first
    const cached = this.cache.get(packageName);
    if (cached && !this.isExpired(cached)) {
      await this.incrementHits();
      logger.debug('Cache hit for package existence check', {
        function: 'checkPackageExists',
        package: packageName
      });
      return cached.exists;
    }

    // Remove expired entry
    if (cached && this.isExpired(cached)) {
      this.cache.delete(packageName);
    }

    await this.incrementMisses();

    try {
      const url = `${this.registryUrl}/${encodeURIComponent(packageName)}`;
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(this.timeout)
      });

      const exists = response.ok;

      // Cache the result (both positive and negative)
      this.evictOldestIfFull();
      this.cache.set(packageName, {
        exists,
        timestamp: Date.now()
      });

      logger.debug('Checked package existence', {
        function: 'checkPackageExists',
        package: packageName,
        exists,
        status: response.status
      });

      return exists;
    } catch (error) {
      // Network errors, timeouts - conservatively assume package exists
      // (don't block development due to network issues)
      // DON'T cache errors - allow retry on next call
      logger.warn('Error checking package existence, assuming exists', {
        function: 'checkPackageExists',
        package: packageName,
        error: error instanceof Error ? error.message : String(error)
      });
      return true;
    }
  }

  /**
   * Get full package information
   *
   * @param packageName - Package name
   * @returns Package info or null if not found
   */
  async getPackageInfo(packageName: string): Promise<PackageInfo | null> {
    // Validate input
    validatePackageName(packageName, 'packageName');

    // Check cache first
    const cached = this.cache.get(packageName);
    if (cached && cached.info && !this.isExpired(cached)) {
      await this.incrementHits();
      logger.debug('Cache hit for package info', {
        function: 'getPackageInfo',
        package: packageName
      });
      return cached.info;
    }

    // Remove expired entry
    if (cached && this.isExpired(cached)) {
      this.cache.delete(packageName);
    }

    await this.incrementMisses();

    try {
      const url = `${this.registryUrl}/${encodeURIComponent(packageName)}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        // Cache negative result
        this.evictOldestIfFull();
        this.cache.set(packageName, {
          exists: false,
          timestamp: Date.now()
        });

        logger.debug('Package not found on registry', {
          function: 'getPackageInfo',
          package: packageName,
          status: response.status
        });

        return null;
      }

      const rawData = await response.json();
      const data = this.validateRegistryResponse(rawData);

      // Extract version information
      const versions = data.versions ? Object.keys(data.versions) : [];
      const distTags = data['dist-tags'] || {};
      const latestVersion = distTags.latest || data.version;

      const info: PackageInfo = {
        name: data.name || packageName,
        version: data.version,
        description: data.description,
        versions: this.sortVersions(versions),
        latestVersion,
        distTags
      };

      // Cache the result
      this.evictOldestIfFull();
      this.cache.set(packageName, {
        exists: true,
        info,
        timestamp: Date.now()
      });

      logger.debug('Retrieved package info', {
        function: 'getPackageInfo',
        package: packageName,
        versionsCount: versions.length
      });

      return info;
    } catch (error) {
      // Don't cache errors
      logger.error('Error fetching package info', {
        function: 'getPackageInfo',
        package: packageName,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get all available versions of a package
   *
   * @param packageName - Package name
   * @returns Array of version strings (sorted)
   */
  async getPackageVersions(packageName: string): Promise<string[]> {
    // Validate input
    validatePackageName(packageName, 'packageName');

    const info = await this.getPackageInfo(packageName);
    return info?.versions || [];
  }

  /**
   * Get latest version of a package
   *
   * @param packageName - Package name
   * @param tag - Optional dist-tag (default: 'latest')
   * @returns Version string or null if not found
   */
  async getLatestVersion(
    packageName: string,
    tag: string = 'latest'
  ): Promise<string | null> {
    // Validate inputs
    validatePackageName(packageName, 'packageName');
    validateNonEmptyString(tag, 'tag');

    const info = await this.getPackageInfo(packageName);
    if (!info) {
      return null;
    }

    // Try to get version from dist-tags
    if (info.distTags && info.distTags[tag]) {
      return info.distTags[tag];
    }

    // Fallback to latest version
    return info.latestVersion || null;
  }

  /**
   * Clear all cached results
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats including hit rate
   */
  getCacheStats(): CacheStats {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? this.cacheHits / total : 0;

    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate
    };
  }

  // =============================================================================
  // Batch Operations (Performance Optimization)
  // =============================================================================

  /**
   * Check multiple packages in parallel (batch operation with rate limiting)
   *
   * Performance optimization: Process packages concurrently with Promise.all
   * Cache hits are instant, uncached packages are fetched in parallel with
   * controlled concurrency to avoid overwhelming the registry.
   *
   * @param packageNames - Array of package names to check
   * @returns Map of package name to existence status
   *
   * @example
   * const client = new NpmRegistryClient();
   * const results = await client.checkPackagesExist(['react', 'vue', 'angular']);
   * console.log(results.get('react')); // true
   */
  async checkPackagesExist(
    packageNames: string[]
  ): Promise<Map<string, boolean>> {
    // Validate input
    validateArray(packageNames, 'packageNames');

    // Validate each package name
    packageNames.forEach((name, index) => {
      try {
        validatePackageName(name, `packageNames[${index}]`);
      } catch (error) {
        throw new TypeError(
          `packageNames[${index}] is invalid: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    logger.debug('Checking multiple packages', {
      function: 'checkPackagesExist',
      count: packageNames.length
    });

    // Process all packages in parallel with rate limiting
    const results = await Promise.all(
      packageNames.map((name) =>
        this.rateLimiter(async () => ({
          name,
          exists: await this.checkPackageExists(name),
        }))
      )
    );

    // Convert to Map for easy lookup
    return new Map(results.map((r) => [r.name, r.exists]));
  }

  /**
   * Get information for multiple packages in parallel (batch operation with rate limiting)
   *
   * Performance optimization: Fetch multiple package infos concurrently with
   * controlled concurrency.
   *
   * @param packageNames - Array of package names
   * @returns Map of package name to package info (or null if not found)
   *
   * @example
   * const client = new NpmRegistryClient();
   * const infos = await client.getPackagesInfo(['react', 'vue']);
   * const reactInfo = infos.get('react');
   * console.log(reactInfo?.latestVersion);
   */
  async getPackagesInfo(
    packageNames: string[]
  ): Promise<Map<string, PackageInfo | null>> {
    // Validate input
    validateArray(packageNames, 'packageNames');

    // Validate each package name
    packageNames.forEach((name, index) => {
      try {
        validatePackageName(name, `packageNames[${index}]`);
      } catch (error) {
        throw new TypeError(
          `packageNames[${index}] is invalid: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    logger.debug('Getting info for multiple packages', {
      function: 'getPackagesInfo',
      count: packageNames.length
    });

    // Process all packages in parallel with rate limiting
    const results = await Promise.all(
      packageNames.map((name) =>
        this.rateLimiter(async () => ({
          name,
          info: await this.getPackageInfo(name),
        }))
      )
    );

    // Convert to Map for easy lookup
    return new Map(results.map((r) => [r.name, r.info]));
  }

  /**
   * Evict oldest cache entry if cache is full
   *
   * LRU (Least Recently Used) eviction:
   * - Prevents unbounded memory growth
   * - Removes entry with oldest timestamp
   * - Called before adding new entries
   */
  private evictOldestIfFull(): void {
    if (this.cache.size >= MAX_PACKAGE_CACHE_SIZE) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.debug('Evicted oldest cache entry', {
          function: 'evictOldestIfFull',
          evictedKey: oldestKey,
          cacheSize: this.cache.size
        });
      }
    }
  }

  /**
   * Sort versions semantically using semver library
   *
   * Handles complex version strings including:
   * - Prerelease versions (1.0.0-beta.1)
   * - Build metadata (1.0.0+20130313144700)
   * - Version prefixes (v1.0.0)
   *
   * Time complexity: O(n * log n) where n = number of versions
   *
   * @param versions - Array of version strings
   * @returns Sorted array of version strings
   */
  private sortVersions(versions: string[]): string[] {
    return versions.sort((a, b) => {
      // Try semver comparison
      const validA = semver.valid(a);
      const validB = semver.valid(b);

      if (validA && validB) {
        return semver.compare(validA, validB);
      }

      // Fallback to string comparison for invalid semver
      return a.localeCompare(b);
    });
  }
}
