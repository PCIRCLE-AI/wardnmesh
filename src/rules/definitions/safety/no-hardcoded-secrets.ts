import { Rule } from '../../schema';

export const NO_HARDCODED_SECRETS: Rule = {
  id: 'NO_HARDCODED_SECRETS',
  name: 'No Hardcoded Secrets',
  category: 'safety',
  severity: 'critical',
  description: '禁止在程式碼中硬編碼敏感密鑰 (API Keys, Secrets)',

  detector: {
    type: 'pattern',
    config: {
      targetTool: 'write_to_file', // Or 'Edit' depending on tool definitions
      targetParameter: 'CodeContent', // For write_to_file. For Edit it might be 'ReplacementContent'
                                      // Note: We might need a multi-tool check or generic param check later.
                                      // For now targeting write_to_file as it's the most common for new files.
                                      // For 'Edit', we'd need a separate rule entry or array support in detector config.
                                      // Let's stick to 'write_to_file' for this MVP example.
      patterns: [
        {
          name: 'AWS Access Key',
          regex: '(AKIA|ASIA)[0-9A-Z]{16}',
          description: 'AWS Access Key ID found'
        },
        {
          name: 'Generic API Key',
          regex: 'api_key\\s*[:=]\\s*["\'][a-zA-Z0-9]{20,}["\']',
          description: 'Potential Generic API Key assignment'
        },
        {
            name: 'Anthropic Key',
            regex: 'sk-ant-api03-[a-zA-Z0-9_\\-]{20,}',
            description: 'Anthropic API Key found'
        },
        {
            name: 'OpenAI Key',
            regex: 'sk-[a-zA-Z0-9]{20,}',
            description: 'OpenAI API Key found'
        }
      ]
    }
  },

  escalation: {
    1: 'critical', // Immediate critical warning
    3: 'block',    // Block quickly
    5: 'block'
  },

  autofix: {
    enabled: true,
    agent: 'security-butler',
    strategy: 'remove_secrets'
  }
};
