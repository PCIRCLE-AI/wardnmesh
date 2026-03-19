
/**
 * Known malicious package signatures
 * In a real system, this would be fetched from the ThreatFeed API.
 */
export const MALICIOUS_PACKAGES = new Set([
  'react-dom-malicious',
  'lodash-vulnerability-test',
  'evil-dependency',
  'crypto-miner-js'
]);
