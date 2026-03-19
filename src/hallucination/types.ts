/**
 * Hallucination Issue Type Definitions
 *
 * This module defines the core types for hallucination detection.
 * All hallucination issues detected by the system conform to these schemas.
 */

import { z } from 'zod';

/**
 * Issue Type Enum
 *
 * Categorizes different kinds of AI hallucinations:
 * - import-hallucination: Importing from non-existent modules
 * - function-hallucination: Calling non-existent functions
 * - export-hallucination: Importing non-existent exports from real modules
 * - api-version-hallucination: Using APIs not available in current version
 * - package-hallucination: Using packages that don't exist
 * - file-hallucination: Importing from non-existent files
 * - logic-hallucination: False claims about implementation (e.g., "added error handling" but didn't)
 * - overconfidence: AI overconfidently claims completion without verification
 */
export const IssueTypeEnum = z.enum([
  'import-hallucination',
  'function-hallucination',
  'export-hallucination',
  'api-version-hallucination',
  'package-hallucination',
  'file-hallucination',
  'logic-hallucination',
  'overconfidence'
]);

export type IssueType = z.infer<typeof IssueTypeEnum>;

/**
 * Issue Severity Enum
 *
 * - critical: Blocks execution, immediate action required
 * - major: Should be fixed before commit
 * - minor: Warning, can be deferred
 */
export const IssueSeverityEnum = z.enum([
  'critical',
  'major',
  'minor'
]);

export type IssueSeverity = z.infer<typeof IssueSeverityEnum>;

/**
 * Issue Location Schema
 *
 * Specifies where in the code the hallucination was detected
 */
export const IssueLocationSchema = z.object({
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional()
});

export type IssueLocation = z.infer<typeof IssueLocationSchema>;

/**
 * Auto-Fix Schema
 *
 * Describes an automated fix that can be applied to resolve the hallucination
 *
 * Common fix types:
 * - install-package: Install missing npm package
 * - upgrade-package: Upgrade package to version with required API
 * - create-file: Create missing file
 * - fix-import: Correct import path
 * - add-export: Add missing export to module
 */
export const AutoFixSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.any())
});

export type AutoFix = z.infer<typeof AutoFixSchema>;

/**
 * Hallucination Issue Schema
 *
 * The main schema for all hallucination detection results
 *
 * @example
 * ```typescript
 * const issue: HallucinationIssue = {
 *   type: 'import-hallucination',
 *   severity: 'critical',
 *   message: 'Package "fake-package" does not exist on npm',
 *   location: {
 *     file: 'src/index.ts',
 *     line: 10
 *   },
 *   suggestion: 'Did you mean "real-package"?',
 *   autoFix: {
 *     type: 'install-package',
 *     data: { package: 'real-package' }
 *   },
 *   confidence: 0.95
 * };
 * ```
 */
export const HallucinationIssueSchema = z.object({
  /**
   * Type of hallucination detected
   */
  type: IssueTypeEnum,

  /**
   * Severity level (critical/major/minor)
   */
  severity: IssueSeverityEnum,

  /**
   * Human-readable description of the issue
   */
  message: z.string(),

  /**
   * Optional location in source code
   */
  location: IssueLocationSchema.optional(),

  /**
   * Optional suggestion for how to fix
   */
  suggestion: z.string().optional(),

  /**
   * Optional automated fix
   */
  autoFix: AutoFixSchema.optional(),

  /**
   * Confidence score (0.0 - 1.0)
   * Default: 1.0 (100% confident)
   */
  confidence: z.number().min(0).max(1).default(1.0)
});

export type HallucinationIssue = z.infer<typeof HallucinationIssueSchema>;

/**
 * Detection Result Schema
 *
 * The result returned by hallucination detectors
 */
export const DetectionResultSchema = z.object({
  /**
   * Whether any hallucinations were detected
   */
  detected: z.boolean(),

  /**
   * List of detected issues
   */
  issues: z.array(HallucinationIssueSchema),

  /**
   * Execution time in milliseconds
   */
  executionTimeMs: z.number().optional()
});

export type DetectionResult = z.infer<typeof DetectionResultSchema>;

/**
 * Type guard to check if value is a valid HallucinationIssue
 */
export function isHallucinationIssue(value: unknown): value is HallucinationIssue {
  try {
    HallucinationIssueSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if value is a valid IssueType
 */
export function isIssueType(value: unknown): value is IssueType {
  try {
    IssueTypeEnum.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if value is a valid IssueSeverity
 */
export function isIssueSeverity(value: unknown): value is IssueSeverity {
  try {
    IssueSeverityEnum.parse(value);
    return true;
  } catch {
    return false;
  }
}
