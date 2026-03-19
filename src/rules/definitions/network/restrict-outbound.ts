
import { Rule, Severity } from '../../schema';

export const RESTRICT_OUTBOUND_TOOL: Rule = {
  id: 'restrict-outbound-tool',
  name: 'Restrict Raw Network Tools',
  description: 'Prevents the use of curl and wget to effectively limit arbitrary outbound connections.',
  category: 'network_boundary',
  severity: 'critical',
  detector: {
    type: 'pattern',
    config: {
      targetTool: 'shell',
      targetParameter: 'command',
      patterns: [
        {
          name: 'curl_wget',
          regex: '(^|[\\s|;&])(curl|wget)\\s+',
          description: 'Detects usage of curl or wget'
        }
      ],
      exceptions: [
          'google\\.com', // Whitelist Google
          'localhost',    // Whitelist Localhost
          '127\\.0\\.0\\.1'
      ]
    }
  },
  autofix: {
      enabled: true,
      strategy: 'suggestion',
      agent: 'agent-guard-core',
      params: {
          message: 'Raw network tools (curl/wget) are restricted. Please use the authorized API client or request a whitelist exemption.'
      }
  },
  escalation: {
      1: 'warning',
      2: 'block'
  }
};
