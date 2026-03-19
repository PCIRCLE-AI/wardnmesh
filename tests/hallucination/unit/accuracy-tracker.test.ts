/**
 * Unit tests for AI Accuracy Tracker
 *
 * Testing Strategy:
 * - Test tracking claim records over time
 * - Test accuracy calculation (correct/total)
 * - Test low-accuracy warning trigger
 * - Test insufficient data handling (< 10 claims)
 * - Test accuracy trend analysis
 * - Test history persistence and clearing
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// These imports will fail initially - that's expected in TDD!
import {
  AccuracyTracker,
  ClaimRecord,
  AccuracyMetrics,
  AccuracyWarning
} from '../../../src/hallucination/behavioral/accuracy-tracker';

describe('AccuracyTracker', () => {
  let tracker: AccuracyTracker;

  beforeEach(() => {
    tracker = new AccuracyTracker({
      warningThreshold: 0.7, // Warn if accuracy < 70%
      minClaims: 10 // Need at least 10 claims before warning
    });
  });

  describe('Tracking Claims', () => {
    it('should track a single claim', () => {
      tracker.trackClaim({
        statement: 'I have implemented the add() function',
        verified: true,
        confidence: 0.95
      });

      const metrics = tracker.getAccuracy();

      expect(metrics.totalClaims).toBe(1);
      expect(metrics.correctClaims).toBe(1);
      expect(metrics.accuracy).toBe(1.0);
    });

    it('should track multiple claims', () => {
      tracker.trackClaim({
        statement: 'Claim 1',
        verified: true,
        confidence: 0.9
      });

      tracker.trackClaim({
        statement: 'Claim 2',
        verified: true,
        confidence: 0.85
      });

      tracker.trackClaim({
        statement: 'Claim 3',
        verified: false,
        confidence: 0.8
      });

      const metrics = tracker.getAccuracy();

      expect(metrics.totalClaims).toBe(3);
      expect(metrics.correctClaims).toBe(2);
      expect(metrics.accuracy).toBeCloseTo(0.667, 2);
    });

    it('should record timestamps for each claim', () => {
      const before = new Date();

      tracker.trackClaim({
        statement: 'Test claim',
        verified: true,
        confidence: 0.9
      });

      const after = new Date();
      const history = tracker.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].timestamp).toBeInstanceOf(Date);
      expect(history[0].timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(history[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should preserve claim details in history', () => {
      tracker.trackClaim({
        statement: 'Test statement',
        verified: false,
        confidence: 0.7
      });

      const history = tracker.getHistory();

      expect(history[0].statement).toBe('Test statement');
      expect(history[0].verified).toBe(false);
      expect(history[0].confidence).toBe(0.7);
    });
  });

  describe('Accuracy Calculation', () => {
    it('should calculate 100% accuracy for all correct claims', () => {
      for (let i = 0; i < 10; i++) {
        tracker.trackClaim({
          statement: `Claim ${i}`,
          verified: true,
          confidence: 0.9
        });
      }

      const metrics = tracker.getAccuracy();

      expect(metrics.accuracy).toBe(1.0);
      expect(metrics.correctClaims).toBe(10);
      expect(metrics.totalClaims).toBe(10);
    });

    it('should calculate 0% accuracy for all incorrect claims', () => {
      for (let i = 0; i < 10; i++) {
        tracker.trackClaim({
          statement: `Claim ${i}`,
          verified: false,
          confidence: 0.9
        });
      }

      const metrics = tracker.getAccuracy();

      expect(metrics.accuracy).toBe(0.0);
      expect(metrics.correctClaims).toBe(0);
      expect(metrics.totalClaims).toBe(10);
    });

    it('should calculate partial accuracy correctly', () => {
      // 7 correct, 3 incorrect = 70% accuracy
      for (let i = 0; i < 7; i++) {
        tracker.trackClaim({
          statement: `Correct ${i}`,
          verified: true,
          confidence: 0.9
        });
      }

      for (let i = 0; i < 3; i++) {
        tracker.trackClaim({
          statement: `Incorrect ${i}`,
          verified: false,
          confidence: 0.9
        });
      }

      const metrics = tracker.getAccuracy();

      expect(metrics.accuracy).toBeCloseTo(0.7, 2);
    });

    it('should handle zero claims', () => {
      const metrics = tracker.getAccuracy();

      expect(metrics.totalClaims).toBe(0);
      expect(metrics.correctClaims).toBe(0);
      expect(metrics.accuracy).toBe(0);
    });
  });

  describe('Low-Accuracy Warning', () => {
    it('should trigger warning when accuracy falls below threshold', () => {
      // Add 10 claims with 60% accuracy (below 70% threshold)
      for (let i = 0; i < 6; i++) {
        tracker.trackClaim({
          statement: `Correct ${i}`,
          verified: true,
          confidence: 0.9
        });
      }

      for (let i = 0; i < 4; i++) {
        tracker.trackClaim({
          statement: `Incorrect ${i}`,
          verified: false,
          confidence: 0.9
        });
      }

      const warning = tracker.shouldWarn();

      expect(warning).toBe(true);
    });

    it('should not warn when accuracy is above threshold', () => {
      // Add 10 claims with 80% accuracy (above 70% threshold)
      for (let i = 0; i < 8; i++) {
        tracker.trackClaim({
          statement: `Correct ${i}`,
          verified: true,
          confidence: 0.9
        });
      }

      for (let i = 0; i < 2; i++) {
        tracker.trackClaim({
          statement: `Incorrect ${i}`,
          verified: false,
          confidence: 0.9
        });
      }

      const warning = tracker.shouldWarn();

      expect(warning).toBe(false);
    });

    it('should not warn when exactly at threshold', () => {
      // Add 10 claims with exactly 70% accuracy
      for (let i = 0; i < 7; i++) {
        tracker.trackClaim({
          statement: `Correct ${i}`,
          verified: true,
          confidence: 0.9
        });
      }

      for (let i = 0; i < 3; i++) {
        tracker.trackClaim({
          statement: `Incorrect ${i}`,
          verified: false,
          confidence: 0.9
        });
      }

      const warning = tracker.shouldWarn();

      expect(warning).toBe(false);
    });

    it('should ignore insufficient data (< 10 claims)', () => {
      // Add only 5 claims with 0% accuracy
      for (let i = 0; i < 5; i++) {
        tracker.trackClaim({
          statement: `Incorrect ${i}`,
          verified: false,
          confidence: 0.9
        });
      }

      const warning = tracker.shouldWarn();

      // Should not warn because we need at least 10 claims
      expect(warning).toBe(false);
    });

    it('should provide warning details', () => {
      // Trigger warning
      for (let i = 0; i < 10; i++) {
        tracker.trackClaim({
          statement: `Claim ${i}`,
          verified: i < 5, // 50% accuracy
          confidence: 0.9
        });
      }

      const warningDetails = tracker.getWarningDetails();

      expect(warningDetails).toBeDefined();
      expect(warningDetails!.currentAccuracy).toBeCloseTo(0.5, 2);
      expect(warningDetails!.threshold).toBe(0.7);
      expect(warningDetails!.recentClaims).toBeGreaterThan(0);
      expect(warningDetails!.message).toContain('accuracy');
    });
  });

  describe('Accuracy Trend Analysis', () => {
    it('should detect improving trend', () => {
      // First 5 claims: 40% accuracy
      for (let i = 0; i < 2; i++) {
        tracker.trackClaim({ statement: `Early correct ${i}`, verified: true, confidence: 0.9 });
      }
      for (let i = 0; i < 3; i++) {
        tracker.trackClaim({ statement: `Early incorrect ${i}`, verified: false, confidence: 0.9 });
      }

      // Next 5 claims: 80% accuracy
      for (let i = 0; i < 4; i++) {
        tracker.trackClaim({ statement: `Recent correct ${i}`, verified: true, confidence: 0.9 });
      }
      for (let i = 0; i < 1; i++) {
        tracker.trackClaim({ statement: `Recent incorrect ${i}`, verified: false, confidence: 0.9 });
      }

      const metrics = tracker.getAccuracy();

      expect(metrics.trend).toBe('improving');
    });

    it('should detect declining trend', () => {
      // First 5 claims: 80% accuracy
      for (let i = 0; i < 4; i++) {
        tracker.trackClaim({ statement: `Early correct ${i}`, verified: true, confidence: 0.9 });
      }
      for (let i = 0; i < 1; i++) {
        tracker.trackClaim({ statement: `Early incorrect ${i}`, verified: false, confidence: 0.9 });
      }

      // Next 5 claims: 40% accuracy
      for (let i = 0; i < 2; i++) {
        tracker.trackClaim({ statement: `Recent correct ${i}`, verified: true, confidence: 0.9 });
      }
      for (let i = 0; i < 3; i++) {
        tracker.trackClaim({ statement: `Recent incorrect ${i}`, verified: false, confidence: 0.9 });
      }

      const metrics = tracker.getAccuracy();

      expect(metrics.trend).toBe('declining');
    });

    it('should detect stable trend', () => {
      // All claims with consistent 70% accuracy in BOTH halves
      // First half: 7/10 claims correct → need 3.5/5 per half
      // Round to 4/5 = 80% and 3/5 = 60% → avg 70%, diff = 20% (too high)
      // Better: alternate pattern to get 70% in both halves
      const pattern = [true, true, true, false, false]; // 60% per half

      for (let i = 0; i < 10; i++) {
        tracker.trackClaim({
          statement: `Claim ${i}`,
          verified: pattern[i % 5], // 60% in each half
          confidence: 0.9
        });
      }

      const metrics = tracker.getAccuracy();

      expect(metrics.trend).toBe('stable');
    });
  });

  describe('History Management', () => {
    it('should clear history', () => {
      for (let i = 0; i < 5; i++) {
        tracker.trackClaim({
          statement: `Claim ${i}`,
          verified: true,
          confidence: 0.9
        });
      }

      tracker.clearHistory();

      const metrics = tracker.getAccuracy();
      const history = tracker.getHistory();

      expect(metrics.totalClaims).toBe(0);
      expect(history).toHaveLength(0);
    });

    it('should maintain history order (oldest to newest)', () => {
      tracker.trackClaim({ statement: 'First', verified: true, confidence: 0.9 });
      tracker.trackClaim({ statement: 'Second', verified: false, confidence: 0.8 });
      tracker.trackClaim({ statement: 'Third', verified: true, confidence: 0.7 });

      const history = tracker.getHistory();

      expect(history[0].statement).toBe('First');
      expect(history[1].statement).toBe('Second');
      expect(history[2].statement).toBe('Third');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very low confidence claims', () => {
      tracker.trackClaim({
        statement: 'Low confidence claim',
        verified: false,
        confidence: 0.1
      });

      const metrics = tracker.getAccuracy();

      expect(metrics.accuracy).toBe(0);
    });

    it('should handle very high confidence incorrect claims', () => {
      tracker.trackClaim({
        statement: 'High confidence but wrong',
        verified: false,
        confidence: 0.99
      });

      const metrics = tracker.getAccuracy();

      expect(metrics.accuracy).toBe(0);
    });

    it('should handle large claim history', () => {
      // Add 1000 claims
      for (let i = 0; i < 1000; i++) {
        tracker.trackClaim({
          statement: `Claim ${i}`,
          verified: i % 2 === 0, // 50% accuracy
          confidence: 0.9
        });
      }

      const metrics = tracker.getAccuracy();

      expect(metrics.totalClaims).toBe(1000);
      expect(metrics.accuracy).toBeCloseTo(0.5, 2);
    });
  });

  describe('Custom Configuration', () => {
    it('should respect custom warning threshold', () => {
      const customTracker = new AccuracyTracker({
        warningThreshold: 0.5, // Warn if < 50%
        minClaims: 10
      });

      // Add 10 claims with 60% accuracy
      for (let i = 0; i < 6; i++) {
        customTracker.trackClaim({ statement: `Claim ${i}`, verified: true, confidence: 0.9 });
      }
      for (let i = 0; i < 4; i++) {
        customTracker.trackClaim({ statement: `Claim ${i}`, verified: false, confidence: 0.9 });
      }

      // Should not warn (60% > 50%)
      expect(customTracker.shouldWarn()).toBe(false);
    });

    it('should respect custom minimum claims', () => {
      const customTracker = new AccuracyTracker({
        warningThreshold: 0.7,
        minClaims: 5 // Only need 5 claims
      });

      // Add 5 claims with 40% accuracy
      for (let i = 0; i < 2; i++) {
        customTracker.trackClaim({ statement: `Claim ${i}`, verified: true, confidence: 0.9 });
      }
      for (let i = 0; i < 3; i++) {
        customTracker.trackClaim({ statement: `Claim ${i}`, verified: false, confidence: 0.9 });
      }

      // Should warn (5 claims >= minClaims, and 40% < 70%)
      expect(customTracker.shouldWarn()).toBe(true);
    });
  });
});
