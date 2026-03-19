/**
 * Sequence Detector Tests
 *
 * Comprehensive test suite for SequenceDetector with:
 * - Basic sequence matching (Read -> Edit)
 * - Time window validation
 * - State storage and mustMatch
 * - Multiple edits threshold
 * - Pattern matching (matchesPattern)
 * - Success requirement (requireSuccess)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SequenceDetector } from '../../src/detectors/sequence';
import { SessionStateManager } from '../../src/state/session';
import type { SequenceDetectorConfig } from '../../src/rules/schema';
import {
  createSequenceRule,
  createTimestamp,
  createReadTool,
  createEditTool,
  createBashTool,
  READ_EDIT_PATTERN,
} from '../test-utils';

describe('SequenceDetector', () => {
  let detector: SequenceDetector;
  let sessionState: SessionStateManager;

  beforeEach(() => {
    detector = new SequenceDetector();
    sessionState = SessionStateManager.getInstance();
    sessionState.reset();
  });

  describe('Basic Sequence Matching', () => {
    it('should detect violation when Read is missing before Edit', () => {
      const rule = createSequenceRule({ pattern: READ_EDIT_PATTERN });
      const editTool = createEditTool('/test.ts');

      const violation = detector.detect(editTool, rule, sessionState);

      expect(violation).not.toBeNull();
      expect(violation?.ruleId).toBe('test-rule');
      expect(violation?.context.additionalInfo?.missingSteps).toContain('Read');
    });

    it('should not detect violation when Read exists before Edit', () => {
      const rule = createSequenceRule({ pattern: READ_EDIT_PATTERN });

      const readTool = createReadTool('/test.ts');
      sessionState.addToolCall(readTool);
      detector.detect(readTool, rule, sessionState);

      const editTool = createEditTool('/test.ts');
      const violation = detector.detect(editTool, rule, sessionState);

      expect(violation).toBeNull();
    });

    it('should detect violation when editing different file than read', () => {
      const rule = createSequenceRule({ pattern: READ_EDIT_PATTERN });

      const readTool = createReadTool('/file1.ts');
      sessionState.addToolCall(readTool);
      detector.detect(readTool, rule, sessionState);

      const editTool = createEditTool('/file2.ts');
      const violation = detector.detect(editTool, rule, sessionState);

      expect(violation).not.toBeNull();
      expect(violation?.context.additionalInfo?.reason).toContain('mismatch');
    });
  });

  describe('Time Window Validation', () => {
    it('should detect violation when Read is too old (expired)', () => {
      const pattern: SequenceDetectorConfig['pattern'] = [
        { tool: 'Read', extractPath: 'parameters.file_path', storeAs: 'filePath' },
        {
          tool: 'Edit',
          extractPath: 'parameters.file_path',
          mustMatch: 'filePath',
          maxTimeSinceMatch: 5000,
        },
      ];
      const rule = createSequenceRule({ pattern });

      const readTool = createReadTool('/test.ts', { timestamp: createTimestamp(-10000) });
      sessionState.addToolCall(readTool);
      detector.detect(readTool, rule, sessionState);

      const editTool = createEditTool('/test.ts');
      const violation = detector.detect(editTool, rule, sessionState);

      expect(violation).not.toBeNull();
      expect(violation?.context.additionalInfo?.reason).toContain('expired');
    });

    it('should not detect violation when Read is recent enough', () => {
      const pattern: SequenceDetectorConfig['pattern'] = [
        { tool: 'Read', extractPath: 'parameters.file_path', storeAs: 'filePath' },
        {
          tool: 'Edit',
          extractPath: 'parameters.file_path',
          mustMatch: 'filePath',
          maxTimeSinceMatch: 10000,
        },
      ];
      const rule = createSequenceRule({ pattern });

      const readTool = createReadTool('/test.ts', { timestamp: createTimestamp(-3000) });
      sessionState.addToolCall(readTool);
      detector.detect(readTool, rule, sessionState);

      const editTool = createEditTool('/test.ts');
      const violation = detector.detect(editTool, rule, sessionState);

      expect(violation).toBeNull();
    });
  });

  describe('Multiple Edits Threshold', () => {
    it('should detect violation when editing file 3+ times without re-reading', () => {
      const rule = createSequenceRule({
        pattern: READ_EDIT_PATTERN,
        advancedChecks: { multipleEditsThreshold: 3 },
      });
      const filePath = '/test.ts';

      const readTool = createReadTool(filePath);
      sessionState.addToolCall(readTool);
      detector.detect(readTool, rule, sessionState);

      for (let i = 0; i < 3; i++) {
        const editTool = createEditTool(filePath);
        sessionState.addToolCall(editTool);
        const violation = detector.detect(editTool, rule, sessionState);

        if (i < 2) {
          expect(violation).toBeNull();
        } else {
          expect(violation).not.toBeNull();
          expect(violation?.context.additionalInfo?.editCount).toBe(3);
          expect(violation?.context.additionalInfo?.threshold).toBe(3);
        }
      }
    });

    it('should reset edit count after re-reading file', () => {
      const rule = createSequenceRule({
        pattern: READ_EDIT_PATTERN,
        advancedChecks: { multipleEditsThreshold: 3 },
      });
      const filePath = '/test.ts';

      const readTool1 = createReadTool(filePath);
      sessionState.addToolCall(readTool1);
      detector.detect(readTool1, rule, sessionState);

      for (let i = 0; i < 2; i++) {
        const editTool = createEditTool(filePath);
        sessionState.addToolCall(editTool);
        expect(detector.detect(editTool, rule, sessionState)).toBeNull();
      }

      const readTool2 = createReadTool(filePath);
      sessionState.addToolCall(readTool2);
      detector.detect(readTool2, rule, sessionState);

      for (let i = 0; i < 3; i++) {
        const editTool = createEditTool(filePath);
        sessionState.addToolCall(editTool);
        const violation = detector.detect(editTool, rule, sessionState);

        if (i < 2) {
          expect(violation).toBeNull();
        } else {
          expect(violation).not.toBeNull();
        }
      }
    });
  });

  describe('Pattern Matching (matchesPattern)', () => {
    it('should only trigger on files matching pattern', () => {
      const pattern: SequenceDetectorConfig['pattern'] = [
        { tool: 'Read', extractPath: 'parameters.file_path', storeAs: 'filePath' },
        {
          tool: 'Edit',
          extractPath: 'parameters.file_path',
          mustMatch: 'filePath',
          matchesPattern: '\\.ts$',
        },
      ];
      const rule = createSequenceRule({ pattern });

      const editTxtTool = createEditTool('/readme.txt');
      expect(detector.detect(editTxtTool, rule, sessionState)).toBeNull();

      const editTsTool = createEditTool('/app.ts');
      expect(detector.detect(editTsTool, rule, sessionState)).not.toBeNull();
    });
  });

  describe('Success Requirement (requireSuccess)', () => {
    it('should not count failed Read in sequence', () => {
      const pattern: SequenceDetectorConfig['pattern'] = [
        {
          tool: 'Read',
          extractPath: 'parameters.file_path',
          storeAs: 'filePath',
          requireSuccess: true,
        },
        { tool: 'Edit', extractPath: 'parameters.file_path', mustMatch: 'filePath' },
      ];
      const rule = createSequenceRule({ pattern });

      const failedReadTool = createReadTool('/test.ts', { success: false });
      sessionState.addToolCall(failedReadTool);
      detector.detect(failedReadTool, rule, sessionState);

      const editTool = createEditTool('/test.ts');
      const violation = detector.detect(editTool, rule, sessionState);

      expect(violation).not.toBeNull();
      expect(violation?.context.additionalInfo?.missingSteps).toContain('Read');
    });

    it('should count successful Read even with requireSuccess', () => {
      const pattern: SequenceDetectorConfig['pattern'] = [
        {
          tool: 'Read',
          extractPath: 'parameters.file_path',
          storeAs: 'filePath',
          requireSuccess: true,
        },
        { tool: 'Edit', extractPath: 'parameters.file_path', mustMatch: 'filePath' },
      ];
      const rule = createSequenceRule({ pattern });

      const readTool = createReadTool('/test.ts', { success: true });
      sessionState.addToolCall(readTool);
      detector.detect(readTool, rule, sessionState);

      const editTool = createEditTool('/test.ts');
      const violation = detector.detect(editTool, rule, sessionState);

      expect(violation).toBeNull();
    });
  });

  describe('Lookback Window', () => {
    it('should only look back N tools as configured', () => {
      const rule = createSequenceRule({
        lookback: 3,
        pattern: READ_EDIT_PATTERN,
      });

      const readTool = createReadTool('/test.ts');
      sessionState.addToolCall(readTool);
      detector.detect(readTool, rule, sessionState);

      for (let i = 0; i < 4; i++) {
        const otherTool = createBashTool(`echo ${i}`);
        sessionState.addToolCall(otherTool);
        detector.detect(otherTool, rule, sessionState);
      }

      const editTool = createEditTool('/test.ts');
      const violation = detector.detect(editTool, rule, sessionState);

      expect(violation).not.toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tool history', () => {
      const rule = createSequenceRule({ pattern: READ_EDIT_PATTERN });
      const editTool = createEditTool('/test.ts');

      const violation = detector.detect(editTool, rule, sessionState);

      expect(violation).not.toBeNull();
    });

    it('should handle non-matching tool in current position', () => {
      const rule = createSequenceRule({ pattern: READ_EDIT_PATTERN });
      const bashTool = createBashTool('ls');

      const violation = detector.detect(bashTool, rule, sessionState);

      expect(violation).toBeNull();
    });

    it('should return correct detector type', () => {
      expect(detector.getType()).toBe('sequence');
    });
  });
});
