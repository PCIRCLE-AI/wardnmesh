import { Rule } from '../../schema';

export const RUN_TESTS_BEFORE_CLAIM: Rule = {
  id: 'RUN_TESTS_BEFORE_CLAIM',
  name: 'Run Tests Before Claim',
  category: 'workflow',
  severity: 'major',
  description: '在宣告任務完成前，必須先執行並通過測試 (Run Tests)',

  detector: {
    type: 'state',
    config: {
      requiredState: 'tests_passed',
      targetStateValue: true,
      
      trigger: {
        tool: 'notify_user',
        parameterMatch: {
          key: 'Message',
          // Matches phrasing like "Task Completed", "Finished", "Done"
          valuePattern: '(task|mission)\\s*(complete|finished|done)|completed\\s*task'
        }
      },

      stateDerivation: {
        fromTool: 'run_command',
        // StateDetector.updateStateFromTool() checks for 'test' or 'vitest' in CommandLine
        // See: src/detectors/state.ts L105-120
        setState: 'tests_passed',
        setValue: true,
        validityDurationMs: 900000 // 15 mins validity
      }
    }
  },

  escalation: {
    1: 'warning',
    3: 'critical',
    5: 'block'
  },

  autofix: {
    enabled: true,
    agent: 'test-automator',
    strategy: 'run_tests'
  }
};
