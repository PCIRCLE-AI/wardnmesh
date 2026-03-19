/**
 * Unit tests for Overconfidence Detector
 *
 * Testing Strategy:
 * - Test detection of overconfident claims
 * - Test verification of completion claims vs actual status
 * - Test pattern matching for dangerous phrases
 * - Test risk level assessment
 * - Test multiple pattern matching
 * - Test edge cases (no patterns, low confidence claims)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// These imports will fail initially - that's expected in TDD!
import {
  OverconfidenceDetector,
  OverconfidentPattern,
  OverconfidenceCheck,
  OverconfidenceResult
} from '../../../src/hallucination/behavioral/overconfidence-detector';

describe('OverconfidenceDetector', () => {
  let detector: OverconfidenceDetector;

  beforeEach(() => {
    detector = new OverconfidenceDetector();
  });

  describe('Detect Overconfident Claims', () => {
    it('should detect "I have completed" claims', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have completed the entire feature implementation',
        actualStatus: false // Not actually completed
      };

      const result = detector.detectOverconfidence(check);

      expect(result.isOverconfident).toBe(true);
      expect(result.riskLevel).not.toBe('none');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect "definitely" claims', () => {
      const check: OverconfidenceCheck = {
        statement: 'This will definitely work without any issues'
      };

      const result = detector.detectOverconfidence(check);

      expect(result.isOverconfident).toBe(true);
      expect(result.matchedPatterns.length).toBeGreaterThan(0);
      expect(result.matchedPatterns[0].category).toBe('certainty');
    });

    it('should detect "100%" claims', () => {
      const check: OverconfidenceCheck = {
        statement: 'I am 100% certain this is correct'
      };

      const result = detector.detectOverconfidence(check);

      expect(result.isOverconfident).toBe(true);
      expect(result.matchedPatterns.some(p => p.category === 'certainty')).toBe(true);
    });

    it('should detect multiple overconfident patterns', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have definitely completed everything and it is 100% working perfectly'
      };

      const result = detector.detectOverconfidence(check);

      expect(result.isOverconfident).toBe(true);
      expect(result.matchedPatterns.length).toBeGreaterThan(1);
      expect(result.riskLevel).toBe('high');
    });

    it('should not flag modest claims', () => {
      const check: OverconfidenceCheck = {
        statement: 'I believe this should work, but it needs testing'
      };

      const result = detector.detectOverconfidence(check);

      expect(result.isOverconfident).toBe(false);
      expect(result.riskLevel).toBe('none');
      expect(result.matchedPatterns).toHaveLength(0);
    });

    it('should not flag tentative language', () => {
      const check: OverconfidenceCheck = {
        statement: 'This might be correct, but I am not entirely sure'
      };

      const result = detector.detectOverconfidence(check);

      expect(result.isOverconfident).toBe(false);
    });
  });

  describe('Verify Completion Claims', () => {
    it('should flag false completion claims', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have completed all the tests',
        actualStatus: false // Tests not actually completed
      };

      const result = detector.detectOverconfidence(check);

      expect(result.isOverconfident).toBe(true);
      expect(result.warnings).toContain('Claimed completion but actual status is incomplete');
    });

    it('should not flag true completion claims', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have completed all the tests',
        actualStatus: true // Tests actually completed
      };

      const result = detector.detectOverconfidence(check);

      // Might still match "completed" pattern, but should have lower risk
      expect(result.riskLevel).not.toBe('high');
    });

    it('should detect "done" claims with false status', () => {
      const check: OverconfidenceCheck = {
        statement: 'All tasks are done',
        actualStatus: false
      };

      const result = detector.detectOverconfidence(check);

      expect(result.isOverconfident).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect "finished" claims with false status', () => {
      const check: OverconfidenceCheck = {
        statement: 'The implementation is finished',
        actualStatus: false
      };

      const result = detector.detectOverconfidence(check);

      expect(result.isOverconfident).toBe(true);
    });

    it('should handle claims without actual status', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have completed the feature'
        // No actualStatus provided
      };

      const result = detector.detectOverconfidence(check);

      // Should still detect overconfident language
      expect(result.matchedPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Pattern Matching for Dangerous Phrases', () => {
    it('should match completion patterns', () => {
      const patterns = detector.matchPatterns('I have completed the task');

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.category === 'completion')).toBe(true);
    });

    it('should match certainty patterns', () => {
      const patterns = detector.matchPatterns('I am absolutely certain this is correct');

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.category === 'certainty')).toBe(true);
    });

    it('should match knowledge claim patterns', () => {
      const patterns = detector.matchPatterns('I know for a fact that this will work');

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.category === 'knowledge')).toBe(true);
    });

    it('should assign severity levels correctly', () => {
      const highRiskPatterns = detector.matchPatterns('I have completed everything 100%');
      const mediumRiskPatterns = detector.matchPatterns('This is probably done');

      expect(highRiskPatterns.some(p => p.severity === 'high')).toBe(true);
      expect(mediumRiskPatterns.every(p => p.severity !== 'high')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const uppercase = detector.matchPatterns('I HAVE DEFINITELY COMPLETED THIS');
      const lowercase = detector.matchPatterns('i have definitely completed this');

      expect(uppercase.length).toBeGreaterThan(0);
      expect(lowercase.length).toBeGreaterThan(0);
      expect(uppercase.length).toBe(lowercase.length);
    });

    it('should match common overconfidence phrases', () => {
      const phrases = [
        'absolutely',
        'certainly',
        'guaranteed',
        'no doubt',
        'without a doubt',
        'perfectly',
        'flawlessly',
        'completely sure'
      ];

      phrases.forEach(phrase => {
        const patterns = detector.matchPatterns(`This is ${phrase} correct`);
        expect(patterns.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Risk Level Assessment', () => {
    it('should assign high risk for multiple high-severity patterns', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have absolutely completed everything 100% perfectly',
        actualStatus: false
      };

      const result = detector.detectOverconfidence(check);

      expect(result.riskLevel).toBe('high');
    });

    it('should assign medium risk for single high-severity pattern', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have completed the task'
      };

      const result = detector.detectOverconfidence(check);

      expect(result.riskLevel).toBe('medium');
    });

    it('should assign low risk for only low-severity patterns', () => {
      const check: OverconfidenceCheck = {
        statement: 'This seems to be working'
      };

      const result = detector.detectOverconfidence(check);

      // Might not even match any patterns
      if (result.matchedPatterns.length > 0) {
        expect(result.riskLevel).toBe('low');
      }
    });

    it('should assign none risk for no patterns', () => {
      const check: OverconfidenceCheck = {
        statement: 'I tried to implement this feature'
      };

      const result = detector.detectOverconfidence(check);

      expect(result.riskLevel).toBe('none');
      expect(result.isOverconfident).toBe(false);
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate confidence score based on patterns', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have definitely completed this 100%'
      };

      const result = detector.detectOverconfidence(check);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should have higher confidence for more patterns', () => {
      const lowCheck: OverconfidenceCheck = {
        statement: 'This is complete'
      };

      const highCheck: OverconfidenceCheck = {
        statement: 'This is absolutely definitely 100% complete'
      };

      const lowResult = detector.detectOverconfidence(lowCheck);
      const highResult = detector.detectOverconfidence(highCheck);

      expect(highResult.confidence).toBeGreaterThan(lowResult.confidence);
    });

    it('should have maximum confidence for contradictory evidence', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have completed all tests',
        actualStatus: false
      };

      const result = detector.detectOverconfidence(check);

      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty statements', () => {
      const check: OverconfidenceCheck = {
        statement: ''
      };

      const result = detector.detectOverconfidence(check);

      expect(result.isOverconfident).toBe(false);
      expect(result.matchedPatterns).toHaveLength(0);
    });

    it('should handle very long statements', () => {
      const longStatement = 'I have completed ' + 'the task '.repeat(100);
      const check: OverconfidenceCheck = {
        statement: longStatement
      };

      const result = detector.detectOverconfidence(check);

      expect(result).toBeDefined();
      expect(result.isOverconfident).toBe(true);
    });

    it('should handle statements with special characters', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have *definitely* completed this (100%)!'
      };

      const result = detector.detectOverconfidence(check);

      expect(result.isOverconfident).toBe(true);
    });

    it('should handle statements with numbers', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have completed 99.9% of the tasks'
      };

      const result = detector.detectOverconfidence(check);

      expect(result).toBeDefined();
    });
  });

  describe('Warning Messages', () => {
    it('should provide specific warnings for matched patterns', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have definitely completed everything'
      };

      const result = detector.detectOverconfidence(check);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('overconfident'))).toBe(true);
    });

    it('should include pattern categories in warnings', () => {
      const check: OverconfidenceCheck = {
        statement: 'I am 100% certain this is done'
      };

      const result = detector.detectOverconfidence(check);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should provide actionable warnings', () => {
      const check: OverconfidenceCheck = {
        statement: 'I have completed all the tests',
        actualStatus: false
      };

      const result = detector.detectOverconfidence(check);

      expect(result.warnings.some(w =>
        w.includes('verify') || w.includes('check') || w.includes('actual')
      )).toBe(true);
    });
  });
});
