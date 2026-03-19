/**
 * Overconfidence Detector
 *
 * Detects AI claims that express excessive confidence or false completion.
 * Helps prevent hallucinations by identifying suspicious language patterns.
 *
 * Features:
 * - Pattern matching for overconfident phrases
 * - Completion claim verification
 * - Risk level assessment
 * - Confidence scoring
 * - Actionable warnings
 */

/**
 * Overconfident pattern definition
 */
export interface OverconfidentPattern {
  /** Pattern to match (regex or string) */
  pattern: RegExp | string;

  /** Severity level */
  severity: 'high' | 'medium' | 'low';

  /** Pattern category */
  category: 'completion' | 'certainty' | 'knowledge';

  /** Pattern description */
  description?: string;
}

/**
 * Overconfidence check input
 */
export interface OverconfidenceCheck {
  /** The AI's statement to check */
  statement: string;

  /** Actual completion status (if known) */
  actualStatus?: boolean;

  /** Supporting evidence */
  evidence?: string;
}

/**
 * Overconfidence detection result
 */
export interface OverconfidenceResult {
  /** Whether the statement is overconfident */
  isOverconfident: boolean;

  /** Confidence score (0-1) */
  confidence: number;

  /** Matched patterns */
  matchedPatterns: OverconfidentPattern[];

  /** Overall risk level */
  riskLevel: 'high' | 'medium' | 'low' | 'none';

  /** Warning messages */
  warnings: string[];
}

/**
 * Overconfidence Detector
 *
 * Identifies overconfident AI claims and false completions
 */
export class OverconfidenceDetector {
  // Predefined overconfidence patterns
  private static readonly PATTERNS: OverconfidentPattern[] = [
    // Completion patterns (high severity)
    // Exclude tentative modifiers (probably, might, maybe, seems)
    {
      pattern: /(?<!(probably|might|maybe|seems|appears)\s+)(completed|finished|done)\b/i,
      severity: 'high',
      category: 'completion',
      description: 'Completion claim'
    },
    {
      pattern: /\ball (tests?|tasks?|features?|work) (is|are|has been) (completed|finished|done)\b/i,
      severity: 'high',
      category: 'completion',
      description: 'Total completion claim'
    },
    {
      pattern: /\beverything (is|has been) (completed|finished|done)\b/i,
      severity: 'high',
      category: 'completion',
      description: 'Universal completion claim'
    },

    // Certainty patterns (high severity)
    {
      pattern: /100\s*%/,
      severity: 'high',
      category: 'certainty',
      description: 'Absolute certainty claim'
    },
    {
      pattern: /\b(definitely|certainly|absolutely)\b/i,
      severity: 'high',
      category: 'certainty',
      description: 'Strong certainty modifier'
    },
    {
      pattern: /\bguaranteed?\b/i,
      severity: 'high',
      category: 'certainty',
      description: 'Guarantee claim'
    },
    {
      pattern: /\b(no doubt|without a doubt)\b/i,
      severity: 'high',
      category: 'certainty',
      description: 'Doubtless claim'
    },

    // Knowledge patterns (medium severity)
    {
      pattern: /\bi know for (a )?fact\b/i,
      severity: 'medium',
      category: 'knowledge',
      description: 'Factual knowledge claim'
    },
    {
      pattern: /\b(perfectly|flawlessly)\b/i,
      severity: 'medium',
      category: 'certainty',
      description: 'Perfection claim'
    },
    {
      pattern: /\bcompletely sure\b/i,
      severity: 'medium',
      category: 'certainty',
      description: 'Complete certainty'
    },

    // Percentage patterns (medium severity)
    {
      pattern: /\b9\d(\.\d+)?%\b/,
      severity: 'medium',
      category: 'certainty',
      description: 'High percentage claim (90%+)'
    }
  ];

  /**
   * Detect overconfidence in a statement
   *
   * @param check - Check input
   * @returns Detection result
   */
  detectOverconfidence(check: OverconfidenceCheck): OverconfidenceResult {
    const { statement, actualStatus } = check;

    // Handle empty statements
    if (!statement || statement.trim().length === 0) {
      return {
        isOverconfident: false,
        confidence: 0,
        matchedPatterns: [],
        riskLevel: 'none',
        warnings: []
      };
    }

    // Match patterns
    const matchedPatterns = this.matchPatterns(statement);

    // Calculate confidence and risk
    const confidence = this.calculateConfidence(matchedPatterns, actualStatus);
    const riskLevel = this.assessRiskLevel(matchedPatterns, actualStatus);

    // Generate warnings
    const warnings = this.generateWarnings(matchedPatterns, actualStatus);

    // Determine if overconfident
    const isOverconfident = matchedPatterns.length > 0 ||
                           (actualStatus === false && this.isCompletionClaim(statement));

    return {
      isOverconfident,
      confidence,
      matchedPatterns,
      riskLevel,
      warnings
    };
  }

  /**
   * Match overconfidence patterns in statement
   *
   * @param statement - Statement to check
   * @returns Matched patterns
   */
  matchPatterns(statement: string): OverconfidentPattern[] {
    const matched: OverconfidentPattern[] = [];

    for (const pattern of OverconfidenceDetector.PATTERNS) {
      const regex = typeof pattern.pattern === 'string'
        ? new RegExp(pattern.pattern, 'i')
        : pattern.pattern;

      if (regex.test(statement)) {
        matched.push(pattern);
      }
    }

    return matched;
  }

  /**
   * Check if statement is a completion claim
   *
   * @param statement - Statement to check
   * @returns True if completion claim
   */
  private isCompletionClaim(statement: string): boolean {
    const completionPatterns = OverconfidenceDetector.PATTERNS.filter(
      p => p.category === 'completion'
    );

    return completionPatterns.some(p => {
      const regex = typeof p.pattern === 'string'
        ? new RegExp(p.pattern, 'i')
        : p.pattern;
      return regex.test(statement);
    });
  }

  /**
   * Calculate confidence score
   *
   * @param patterns - Matched patterns
   * @param actualStatus - Actual completion status
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(
    patterns: OverconfidentPattern[],
    actualStatus?: boolean
  ): number {
    if (patterns.length === 0 && actualStatus !== false) {
      return 0;
    }

    // Base confidence from pattern count
    let confidence = Math.min(patterns.length * 0.3, 0.9);

    // Boost for high-severity patterns
    const highSeverityCount = patterns.filter(p => p.severity === 'high').length;
    confidence += highSeverityCount * 0.1;

    // Maximum confidence if claim contradicts actual status
    if (actualStatus === false && this.hasCompletionPattern(patterns)) {
      confidence = Math.max(confidence, 0.85);
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Check if patterns include completion pattern
   *
   * @param patterns - Patterns to check
   * @returns True if has completion pattern
   */
  private hasCompletionPattern(patterns: OverconfidentPattern[]): boolean {
    return patterns.some(p => p.category === 'completion');
  }

  /**
   * Assess overall risk level
   *
   * @param patterns - Matched patterns
   * @param actualStatus - Actual completion status
   * @returns Risk level
   */
  private assessRiskLevel(
    patterns: OverconfidentPattern[],
    actualStatus?: boolean
  ): 'high' | 'medium' | 'low' | 'none' {
    if (patterns.length === 0 && actualStatus !== false) {
      return 'none';
    }

    // High risk: contradictory evidence or multiple high-severity patterns
    const highSeverityCount = patterns.filter(p => p.severity === 'high').length;

    if (actualStatus === false && this.hasCompletionPattern(patterns)) {
      return 'high';
    }

    if (highSeverityCount >= 2) {
      return 'high';
    }

    // Medium risk: single high-severity pattern
    if (highSeverityCount === 1) {
      return 'medium';
    }

    // Low risk: only medium/low severity patterns
    if (patterns.length > 0) {
      return patterns.some(p => p.severity === 'medium') ? 'low' : 'low';
    }

    return 'none';
  }

  /**
   * Generate warning messages
   *
   * @param patterns - Matched patterns
   * @param actualStatus - Actual completion status
   * @returns Warning messages
   */
  private generateWarnings(
    patterns: OverconfidentPattern[],
    actualStatus?: boolean
  ): string[] {
    const warnings: string[] = [];

    // Warning for contradictory evidence
    if (actualStatus === false && this.hasCompletionPattern(patterns)) {
      warnings.push('Claimed completion but actual status is incomplete');
    }

    // Warning for overconfident language
    if (patterns.length > 0) {
      const categories = new Set(patterns.map(p => p.category));

      if (categories.has('certainty')) {
        warnings.push('Statement uses overconfident certainty language');
      }

      if (categories.has('completion') && actualStatus === undefined) {
        warnings.push('Completion claim should be verified against actual status');
      }

      if (categories.has('knowledge')) {
        warnings.push('Statement claims absolute knowledge - verify accuracy');
      }
    }

    // Warning for high-severity patterns
    const highSeverityPatterns = patterns.filter(p => p.severity === 'high');
    if (highSeverityPatterns.length > 1) {
      warnings.push(`Multiple high-risk overconfidence indicators detected (${highSeverityPatterns.length} patterns)`);
    }

    return warnings;
  }
}
