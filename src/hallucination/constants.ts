/**
 * Hallucination Detection Constants
 *
 * Centralized configuration values used across the hallucination detection system.
 * Extract magic numbers as named constants for better maintainability.
 */

// =============================================================================
// Similarity & Matching Thresholds
// =============================================================================

/**
 * Minimum similarity score (0.0-1.0) to consider two strings as similar.
 * Used in fuzzy file matching to suggest alternatives when imports fail.
 *
 * Higher values = stricter matching (fewer false positives)
 * Lower values = looser matching (more suggestions)
 */
export const SIMILARITY_THRESHOLD = 0.5;

// =============================================================================
// Performance & Timeout Settings
// =============================================================================

/**
 * Timeout for fast mode detection layers (in milliseconds).
 * Layers with timeout < FAST_MODE_TIMEOUT_MS will be included in fast detection.
 *
 * Rationale: 200ms provides good balance between speed and accuracy.
 * Quick checks (syntax, imports) complete in < 100ms, while semantic analysis
 * may take 500ms+. Fast mode skips expensive operations.
 */
export const FAST_MODE_TIMEOUT_MS = 200;

/**
 * Network request timeout for npm registry API calls (in milliseconds).
 *
 * Rationale: 2 seconds allows for typical network latency while preventing
 * indefinite hangs. Registry API typically responds in < 500ms.
 */
export const NPM_REQUEST_TIMEOUT_MS = 2000;

// =============================================================================
// Cache Configuration
// =============================================================================

/**
 * Maximum number of entries in the AST cache (LRU eviction).
 *
 * Rationale: Each AST entry ~50KB. 100 entries = ~5MB memory footprint.
 * Prevents unbounded memory growth while maintaining good hit rate for
 * typical projects (most files are re-analyzed < 100 times per session).
 */
export const AST_CACHE_MAX_SIZE = 100;

/**
 * Maximum number of entries in the package cache (LRU eviction).
 *
 * Rationale: Each package entry ~2KB. 500 entries = ~1MB memory footprint.
 * Typical projects have 50-200 dependencies. 500 provides ample headroom
 * for monorepos and complex projects.
 */
export const MAX_PACKAGE_CACHE_SIZE = 500;

/**
 * Time-to-live for cached entries (in milliseconds).
 *
 * Rationale: 5 minutes balances freshness vs performance.
 * - Code changes: Developers typically iterate on same file for 5-30 min
 * - Package updates: npm install invalidates cache anyway
 * - Memory: Prevents stale entries from accumulating indefinitely
 */
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// File System & Path Resolution
// =============================================================================

/**
 * Supported file extensions for import resolution.
 * Ordered by likelihood (most common first for performance).
 */
export const FILE_EXTENSIONS = [
  '.ts',    // TypeScript
  '.tsx',   // TypeScript + JSX
  '.js',    // JavaScript
  '.jsx',   // JavaScript + JSX
  '.mjs',   // ES Module
  '.cjs',   // CommonJS
  '.json',  // JSON
  '.d.ts'   // TypeScript Declaration
] as const;

/**
 * Maximum number of similar files to suggest when import fails.
 *
 * Rationale: 3 suggestions provide enough options without overwhelming
 * the user. More than 3 typically includes irrelevant matches.
 */
export const MAX_SIMILAR_FILE_SUGGESTIONS = 3;

// =============================================================================
// Version Sorting & Comparison
// =============================================================================

/**
 * Default value for missing version parts during semantic version comparison.
 *
 * Example: When comparing "1.2" vs "1.2.3", missing patch version defaults to 0.
 */
export const VERSION_PART_DEFAULT = 0;
