/**
 * AI Accuracy Tracker
 *
 * Tracks AI claim verification history and monitors accuracy over time.
 * Triggers warnings when accuracy falls below acceptable thresholds.
 *
 * Features:
 * - Claim history tracking with timestamps
 * - Accuracy calculation (correct / total)
 * - Low-accuracy warning system
 * - Trend analysis (improving/declining/stable)
 * - Configurable thresholds
 * - Minimum data requirements
 */

/**
 * Individual claim record
 */
export interface ClaimRecord {
  /** The AI's claim statement */
  statement: string;

  /** Whether the claim was verified as correct */
  verified: boolean;

  /** Confidence level of the claim (0-1) */
  confidence: number;

  /** Timestamp when claim was made */
  timestamp: Date;
}

/**
 * Accuracy metrics
 */
export interface AccuracyMetrics {
  /** Total number of claims tracked */
  totalClaims: number;

  /** Number of correct claims */
  correctClaims: number;

  /** Accuracy rate (0-1) */
  accuracy: number;

  /** Trend direction */
  trend: 'improving' | 'declining' | 'stable';
}

/**
 * Warning details when accuracy is low
 */
export interface AccuracyWarning {
  /** Current accuracy rate */
  currentAccuracy: number;

  /** Warning threshold */
  threshold: number;

  /** Number of recent claims considered */
  recentClaims: number;

  /** Warning message */
  message: string;
}

/**
 * Accuracy Tracker configuration
 */
export interface AccuracyTrackerOptions {
  /** Minimum accuracy before warning (default: 0.7 = 70%) */
  warningThreshold?: number;

  /** Minimum number of claims before warning (default: 10) */
  minClaims?: number;

  /** Number of recent claims for trend analysis (default: 5) */
  trendWindow?: number;
}

/**
 * AI Accuracy Tracker
 *
 * Monitors AI claim accuracy and detects concerning patterns
 */
export class AccuracyTracker {
  private history: ClaimRecord[] = [];
  private warningThreshold: number;
  private minClaims: number;
  private trendWindow: number;

  constructor(options: AccuracyTrackerOptions = {}) {
    this.warningThreshold = options.warningThreshold ?? 0.7;
    this.minClaims = options.minClaims ?? 10;
    this.trendWindow = options.trendWindow ?? 5;
  }

  /**
   * Track a new claim
   *
   * @param claim - Claim details (without timestamp)
   */
  trackClaim(claim: Omit<ClaimRecord, 'timestamp'>): void {
    const record: ClaimRecord = {
      ...claim,
      timestamp: new Date()
    };

    this.history.push(record);
  }

  /**
   * Get accuracy metrics
   *
   * @returns Current accuracy metrics
   */
  getAccuracy(): AccuracyMetrics {
    const totalClaims = this.history.length;

    if (totalClaims === 0) {
      return {
        totalClaims: 0,
        correctClaims: 0,
        accuracy: 0,
        trend: 'stable'
      };
    }

    const correctClaims = this.history.filter(r => r.verified).length;
    const accuracy = correctClaims / totalClaims;
    const trend = this.calculateTrend();

    return {
      totalClaims,
      correctClaims,
      accuracy,
      trend
    };
  }

  /**
   * Check if accuracy warning should be triggered
   *
   * @returns True if warning should be shown
   */
  shouldWarn(): boolean {
    // Need minimum number of claims
    if (this.history.length < this.minClaims) {
      return false;
    }

    const metrics = this.getAccuracy();

    // Warn if accuracy is below threshold
    return metrics.accuracy < this.warningThreshold;
  }

  /**
   * Get warning details
   *
   * @returns Warning details if warning should be triggered, null otherwise
   */
  getWarningDetails(): AccuracyWarning | null {
    if (!this.shouldWarn()) {
      return null;
    }

    const metrics = this.getAccuracy();

    return {
      currentAccuracy: metrics.accuracy,
      threshold: this.warningThreshold,
      recentClaims: this.history.length,
      message: `AI accuracy has fallen to ${(metrics.accuracy * 100).toFixed(1)}% (threshold: ${(this.warningThreshold * 100).toFixed(0)}%)`
    };
  }

  /**
   * Get claim history
   *
   * @returns List of all claim records (oldest to newest)
   */
  getHistory(): ClaimRecord[] {
    return [...this.history];
  }

  /**
   * Clear claim history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Calculate accuracy trend
   *
   * @returns Trend direction
   */
  private calculateTrend(): 'improving' | 'declining' | 'stable' {
    // Need at least 2 * trendWindow claims to calculate trend
    const minClaimsForTrend = this.trendWindow * 2;
    if (this.history.length < minClaimsForTrend) {
      return 'stable';
    }

    // Split history into two halves: early and recent
    const halfPoint = Math.floor(this.history.length / 2);
    const earlyHalf = this.history.slice(0, halfPoint);
    const recentHalf = this.history.slice(halfPoint);

    // Calculate accuracy for each half
    const earlyAccuracy = earlyHalf.filter(r => r.verified).length / earlyHalf.length;
    const recentAccuracy = recentHalf.filter(r => r.verified).length / recentHalf.length;

    // Determine trend with a 5% threshold for "stable"
    const difference = recentAccuracy - earlyAccuracy;
    const stableThreshold = 0.05;

    if (Math.abs(difference) <= stableThreshold) {
      return 'stable';
    }

    return difference > 0 ? 'improving' : 'declining';
  }
}
