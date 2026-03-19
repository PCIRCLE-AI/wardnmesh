/**
 * Detection Orchestrator
 *
 * Coordinates multiple detection layers, aggregates results,
 * and provides fast/comprehensive detection modes.
 *
 * Features:
 * - Parallel execution of detection layers
 * - Issue aggregation and deduplication
 * - Severity-based sorting
 * - Error handling (layer failures don't stop execution)
 * - Fast mode (only runs quick layers < 200ms)
 * - Execution time tracking
 * - Thread-safe layer registration
 * - Configurable layer execution timeout
 */

import { Mutex } from 'async-mutex';
import { HallucinationIssue } from '../types';

/**
 * Detection Layer Interface
 *
 * A detection layer is a modular component that performs
 * a specific type of hallucination detection.
 */
export interface DetectionLayer {
  /** Unique layer name */
  name: string;

  /** Priority (lower = higher priority, runs first) */
  priority: number;

  /** Timeout in milliseconds (optional, for fast mode filtering) */
  timeout?: number;

  /** Detection function */
  detect: (code: string) => Promise<HallucinationIssue[]>;
}

/**
 * Layer Error
 *
 * Represents an error that occurred in a detection layer
 */
export interface LayerError {
  /** Layer name that failed */
  layerName: string;

  /** Error message */
  error: string;
}

/**
 * Detection Result
 *
 * Combined result from all detection layers
 */
export interface DetectionResult {
  /** All detected issues (aggregated, deduplicated, sorted) */
  issues: HallucinationIssue[];

  /** Execution time in milliseconds */
  executionTime: number;

  /** Names of layers that were run */
  layersRun: string[];

  /** Errors from failed layers (optional) */
  errors?: LayerError[];
}

/**
 * Detection Orchestrator
 *
 * Manages and coordinates multiple detection layers
 */
export class DetectionOrchestrator {
  private layers: DetectionLayer[] = [];
  private readonly registrationMutex = new Mutex();
  private readonly defaultTimeout = 300000; // 5 minutes default timeout (protects against truly hung layers)

  /**
   * Register a detection layer
   *
   * Thread-safe registration using mutex to prevent race conditions
   * during concurrent layer registration.
   *
   * @param layer - Detection layer to register
   */
  async registerLayer(layer: DetectionLayer): Promise<void> {
    await this.registrationMutex.runExclusive(() => {
      this.layers.push(layer);
      // Sort layers by priority (lower priority number = higher priority)
      this.layers.sort((a, b) => a.priority - b.priority);
    });
  }

  /**
   * Get all registered layers
   *
   * @returns Array of registered layers (sorted by priority)
   */
  getRegisteredLayers(): DetectionLayer[] {
    return [...this.layers];
  }

  /**
   * Run all detection layers
   *
   * @param code - Code to analyze
   * @param timeout - Optional timeout in milliseconds for each layer (default: 30000ms)
   * @returns Detection result with all issues
   */
  async detectAll(code: string, timeout?: number): Promise<DetectionResult> {
    return this.runLayers(this.layers, code, timeout);
  }

  /**
   * Run only fast detection layers (timeout < 200ms)
   *
   * @param code - Code to analyze
   * @param timeout - Optional timeout in milliseconds for each layer (default: 30000ms)
   * @returns Detection result with issues from fast layers only
   */
  async detectFast(code: string, timeout?: number): Promise<DetectionResult> {
    const fastLayers = this.layers.filter(
      layer => layer.timeout !== undefined && layer.timeout < 200
    );
    return this.runLayers(fastLayers, code, timeout);
  }

  /**
   * Run specified detection layers
   *
   * @param layers - Layers to run
   * @param code - Code to analyze
   * @param timeout - Optional timeout in milliseconds for each layer
   * @returns Detection result
   */
  private async runLayers(
    layers: DetectionLayer[],
    code: string,
    timeout?: number
  ): Promise<DetectionResult> {
    const startTime = Date.now();
    const layersRun: string[] = [];
    const errors: LayerError[] = [];
    const allIssues: HallucinationIssue[] = [];
    const effectiveTimeout = timeout ?? this.defaultTimeout;

    // Run all layers in parallel with timeout protection
    const results = await Promise.all(
      layers.map(async layer => {
        try {
          // Wrap layer execution with timeout
          const issues = await this.executeWithTimeout(
            layer.detect(code),
            effectiveTimeout,
            layer.name
          );
          layersRun.push(layer.name);
          return issues;
        } catch (error) {
          // Layer failed - record error and continue
          errors.push({
            layerName: layer.name,
            error: error instanceof Error ? error.message : String(error)
          });
          return [];
        }
      })
    );

    // Aggregate all issues
    results.forEach(issues => {
      allIssues.push(...issues);
    });

    // Deduplicate issues
    const deduplicated = this.deduplicateIssues(allIssues);

    // Sort by severity (critical > major > minor)
    const sorted = this.sortBySeverity(deduplicated);

    const executionTime = Date.now() - startTime;

    return {
      issues: sorted,
      executionTime,
      layersRun,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Execute a promise with timeout protection
   *
   * @param promise - Promise to execute
   * @param timeoutMs - Timeout in milliseconds
   * @param layerName - Layer name for error reporting
   * @returns Promise result
   * @throws Error if timeout is exceeded
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    layerName: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Layer "${layerName}" exceeded timeout of ${timeoutMs}ms`)),
          timeoutMs
        )
      )
    ]);
  }

  /**
   * Deduplicate identical issues
   *
   * Two issues are considered identical if they have:
   * - Same type
   * - Same message
   * - Same location (file and line)
   *
   * Uses safe key generation to avoid circular reference issues.
   *
   * @param issues - Issues to deduplicate
   * @returns Deduplicated issues
   */
  private deduplicateIssues(issues: HallucinationIssue[]): HallucinationIssue[] {
    const seen = new Set<string>();
    const deduplicated: HallucinationIssue[] = [];

    for (const issue of issues) {
      // Create safe unique key using only primitive fields
      const key = this.createSafeKey(issue);

      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(issue);
      }
    }

    return deduplicated;
  }

  /**
   * Create a safe unique key for deduplication
   *
   * Uses only primitive fields to avoid circular reference issues
   * with JSON.stringify().
   *
   * @param issue - Issue to create key for
   * @returns Safe unique key string
   */
  private createSafeKey(issue: HallucinationIssue): string {
    const type = issue.type ?? '';
    const message = issue.message ?? '';
    const file = issue.location?.file ?? '';
    const line = issue.location?.line ?? 0;

    return `${type}|${message}|${file}|${line}`;
  }

  /**
   * Sort issues by severity
   *
   * Order: critical > major > minor
   * Within same severity, maintains original order
   *
   * @param issues - Issues to sort
   * @returns Sorted issues
   */
  private sortBySeverity(issues: HallucinationIssue[]): HallucinationIssue[] {
    const severityOrder = {
      critical: 0,
      major: 1,
      minor: 2
    };

    return [...issues].sort((a, b) => {
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
}
