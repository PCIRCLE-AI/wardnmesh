import fs from 'fs';
import path from 'path';
import { adaptThreatRule, adaptAllRules } from '../../src/rules/threat-rule-adapter';

const RULES_PATH = path.join(__dirname, '../../data/default-threat-rules.json');

describe('ThreatRuleAdapter', () => {
  describe('adaptThreatRule', () => {
    it('converts a valid critical rule', () => {
      const rule = adaptThreatRule({
        id: 'wm-code-001',
        pattern: '(?i)dangerous_func\\s*\\(',
        description: 'Code Injection - dangerous function',
        severity: 'critical',
        category: 'code-injection',
        enabled: true,
      });

      expect(rule).not.toBeNull();
      expect(rule!.id).toBe('wm-code-001');
      expect(rule!.severity).toBe('critical');
      expect(rule!.category).toBe('safety');
      expect(rule!.detector.type).toBe('pattern');
    });

    it('maps high severity to critical', () => {
      const rule = adaptThreatRule({
        id: 'test-high',
        pattern: 'test',
        description: 'Test',
        severity: 'high',
        category: 'code-injection',
        enabled: true,
      });

      expect(rule!.severity).toBe('critical');
    });

    it('maps medium severity to major', () => {
      const rule = adaptThreatRule({
        id: 'test-med',
        pattern: 'test',
        description: 'Test',
        severity: 'medium',
        category: 'command-injection',
        enabled: true,
      });

      expect(rule!.severity).toBe('major');
    });

    it('maps low severity to minor', () => {
      const rule = adaptThreatRule({
        id: 'test-low',
        pattern: 'test',
        description: 'Test',
        severity: 'low',
        category: 'data-exfiltration',
        enabled: true,
      });

      expect(rule!.severity).toBe('minor');
    });

    it('maps network category to network_boundary', () => {
      const rule = adaptThreatRule({
        id: 'test-net',
        pattern: 'test',
        description: 'Test',
        severity: 'medium',
        category: 'network',
        enabled: true,
      });

      expect(rule!.category).toBe('network_boundary');
    });

    it('maps unknown category to safety', () => {
      const rule = adaptThreatRule({
        id: 'test-unk',
        pattern: 'test',
        description: 'Test',
        severity: 'medium',
        category: 'unknown-category',
        enabled: true,
      });

      expect(rule!.category).toBe('safety');
    });

    it('returns null for invalid regex', () => {
      const rule = adaptThreatRule({
        id: 'test-bad',
        pattern: '(?P<invalid',
        description: 'Bad regex',
        severity: 'critical',
        category: 'safety',
        enabled: true,
      });

      expect(rule).toBeNull();
    });
  });

  describe('adaptAllRules', () => {
    it('loads all 243 bundled rules from JSON', () => {
      const raw = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));
      expect(raw.length).toBe(243);

      const { valid, skipped } = adaptAllRules(raw);

      // Most rules should be valid
      expect(valid.length).toBeGreaterThan(200);
      // Total should equal 243
      expect(valid.length + skipped.length).toBe(243);
    });

    it('skips disabled rules', () => {
      const { valid, skipped } = adaptAllRules([
        { id: 'r1', pattern: 'test', description: 'T', severity: 'low', category: 'safety', enabled: true },
        { id: 'r2', pattern: 'test', description: 'T', severity: 'low', category: 'safety', enabled: false },
      ]);

      expect(valid.length).toBe(1);
      expect(skipped).toContain('r2 (disabled)');
    });

    it('every valid rule has correct structure', () => {
      const raw = JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8'));
      const { valid } = adaptAllRules(raw);

      for (const rule of valid) {
        expect(rule.id).toBeTruthy();
        expect(rule.name).toBeTruthy();
        expect(['critical', 'major', 'minor']).toContain(rule.severity);
        expect(['safety', 'network_boundary', 'workflow', 'quality']).toContain(rule.category);
        expect(rule.detector.type).toBe('pattern');
      }
    });
  });
});
