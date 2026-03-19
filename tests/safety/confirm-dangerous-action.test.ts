import { describe, it, expect } from '@jest/globals';
import { SequenceDetector } from '../../src/detectors/sequence';
import { CONFIRM_DANGEROUS_ACTION } from '../../src/rules/definitions/safety/confirm-dangerous-action';
import {
  createMockSessionState,
  createBashTool,
  createNotifyUserTool,
  createTimestamp,
} from '../test-utils';

describe('Safety Rule: CONFIRM_DANGEROUS_ACTION', () => {
  const detector = new SequenceDetector();

  it('should detect dangerous command (rm -rf) without confirmation', () => {
    const mockState = createMockSessionState();
    const currentTool = createBashTool('rm -rf /tmp/test');

    const violation = detector.detect(currentTool, CONFIRM_DANGEROUS_ACTION, mockState);

    expect(violation).toBeDefined();
    expect(violation?.ruleId).toBe(CONFIRM_DANGEROUS_ACTION.id);
  });

  it('should NOT detect safe command (ls -la)', () => {
    const mockState = createMockSessionState();
    const currentTool = createBashTool('ls -la');

    const violation = detector.detect(currentTool, CONFIRM_DANGEROUS_ACTION, mockState);

    expect(violation).toBeNull();
  });

  it('should NOT detect if valid confirmation preceded dangerous command', () => {
    const confirmation = createNotifyUserTool('Please confirm deletion of files.', {
      timestamp: createTimestamp(-1000),
    });
    const mockState = createMockSessionState([confirmation]);
    const currentTool = createBashTool('rm -rf /tmp/test');

    const violation = detector.detect(currentTool, CONFIRM_DANGEROUS_ACTION, mockState);

    expect(violation).toBeNull();
  });

  it('should detect if confirmation message exists but missing keyword', () => {
    const weakNotification = createNotifyUserTool('I am deleting files.', {
      timestamp: createTimestamp(-1000),
    });
    const mockState = createMockSessionState([weakNotification]);
    const currentTool = createBashTool('rm -rf /tmp/test');

    const violation = detector.detect(currentTool, CONFIRM_DANGEROUS_ACTION, mockState);

    expect(violation).toBeDefined();
    expect(violation?.ruleId).toBe(CONFIRM_DANGEROUS_ACTION.id);
  });
});
