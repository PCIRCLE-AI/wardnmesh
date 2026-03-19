/**
 * READ_BEFORE_EDIT Rule
 *
 * Enforces the Anti-Hallucination Protocol requirement:
 * "必須先 Read 檔案再 Edit（基於實際內容，非記憶或假設）"
 *
 * Detection Strategy:
 * - Use Enhanced SequenceDetector
 * - Check for Read → Edit sequence on same file
 * - Validate time window (Read expires after 5 minutes)
 * - Verify successful Read execution
 * - Detect multiple edits without re-reading
 *
 * Origin: CLAUDE.md Anti-Hallucination Protocol
 */

import { Rule } from '../../schema';

export const READ_BEFORE_EDIT: Rule = {
  id: 'READ_BEFORE_EDIT',
  name: 'Read Before Edit',
  category: 'workflow',
  severity: 'major',
  description: '必須先 Read 檔案再 Edit（基於實際內容，非記憶或假設）',

  detector: {
    type: 'sequence',
    config: {
      // Check last 10 tool calls
      lookback: 10,

      // Sequence pattern: Read → Edit (same file)
      pattern: [
        {
          // Step 1: Must have Read
          tool: 'Read',
          extractPath: 'parameters.file_path',
          storeAs: 'readFile',
          requireSuccess: true
        },
        {
          // Step 2: Then Edit same file
          tool: 'Edit',
          extractPath: 'parameters.file_path',
          mustMatch: 'readFile',
          maxTimeSinceMatch: 300000 // 5 minutes (300,000 ms)
        }
      ],

      // Advanced checks
      advancedChecks: {
        // If same file edited 3+ times, need to re-read
        multipleEditsThreshold: 3,

        // Read must succeed (not fail)
        requireSuccessfulRead: true
      }
    }
  },

  escalation: {
    1: 'warning',
    3: 'critical',
    5: 'block'
  },

  autofix: {
    enabled: true, // Phase 3: enabled
    agent: 'development-butler',
    strategy: 'read_before_edit'
  }
};
