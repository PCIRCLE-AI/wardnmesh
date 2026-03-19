import { Rule } from '../../schema';

// Regex for dangerous commands
const DANGEROUS_PATTERNS = [
  '\\brm\\s+-[a-zA-Z]*[rf][a-zA-Z]*\\b', // rm -rf, rm -r, rm -f
  '\\bsudo\\b',
  '\\bgit\\s+push\\s+.*--force',
  '>\\s*/dev/sd[a-z]', // overwriting devices
  '\\bdd\\s+'
].join('|');

// Regex for confirmation keywords indicating consent being asked
const CONFIRMATION_KEYWORDS = 'confirm|approve|agree|permission|consent|allow|proceed';

export const CONFIRM_DANGEROUS_ACTION: Rule = {
  id: 'CONFIRM_DANGEROUS_ACTION',
  name: 'Confirm Dangerous Action',
  category: 'safety',
  severity: 'critical',
  description: 'Dangerous commands (e.g., rm -rf, sudo, force push) must be preceded by a confirmation request (NotifyUser). You must explicitly explain the potential risks to the user and ask for consent before proceeding.',
  detector: {
    type: 'sequence',
    config: {
      lookback: 2,
      pattern: [
        {
          tool: 'NotifyUser',
          extractPath: 'parameters.message',
          matchesPattern: CONFIRMATION_KEYWORDS,
          storeAs: 'confirmation',
          requireSuccess: true
        },
        {
          tool: 'Bash',
          extractPath: 'parameters.command',
          matchesPattern: DANGEROUS_PATTERNS,
          requireSuccess: false
        }
      ]
    }
  },
  escalation: {
    1: 'critical', // Immediate critical violation
    3: 'block'
  }
};
