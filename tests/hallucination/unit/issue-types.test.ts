/**
 * Unit tests for Hallucination Issue Type Definitions
 *
 * Testing Strategy:
 * - Test all valid issue type enums
 * - Test all valid severity levels
 * - Test required vs optional fields
 * - Test Zod schema validation
 * - Test auto-fix structure
 */

import { describe, it, expect } from '@jest/globals';

// This import will fail initially - that's expected in TDD!
import {
  HallucinationIssueSchema,
  HallucinationIssue,
  IssueType,
  IssueSeverity
} from '../../../src/hallucination/types';

describe('HallucinationIssue Type System', () => {

  describe('Issue Type Enum', () => {
    it('should accept all valid issue types', () => {
      const validTypes: IssueType[] = [
        'import-hallucination',
        'function-hallucination',
        'export-hallucination',
        'api-version-hallucination',
        'package-hallucination',
        'file-hallucination',
        'logic-hallucination',
        'overconfidence'
      ];

      validTypes.forEach(type => {
        const issue = {
          type,
          severity: 'critical' as IssueSeverity,
          message: 'Test message'
        };

        expect(() => HallucinationIssueSchema.parse(issue)).not.toThrow();
      });
    });

    it('should reject invalid issue type', () => {
      const issue = {
        type: 'invalid-type',
        severity: 'critical',
        message: 'Test'
      };

      expect(() => HallucinationIssueSchema.parse(issue)).toThrow();
    });
  });

  describe('Severity Levels', () => {
    it('should accept all valid severity levels', () => {
      const validSeverities: IssueSeverity[] = ['critical', 'major', 'minor'];

      validSeverities.forEach(severity => {
        const issue = {
          type: 'import-hallucination' as IssueType,
          severity,
          message: 'Test'
        };

        expect(() => HallucinationIssueSchema.parse(issue)).not.toThrow();
      });
    });

    it('should reject invalid severity', () => {
      const issue = {
        type: 'import-hallucination',
        severity: 'invalid',
        message: 'Test'
      };

      expect(() => HallucinationIssueSchema.parse(issue)).toThrow();
    });
  });

  describe('Required Fields', () => {
    it('should require type field', () => {
      const issue = {
        severity: 'critical',
        message: 'Test'
        // Missing 'type'
      };

      expect(() => HallucinationIssueSchema.parse(issue)).toThrow();
    });

    it('should require severity field', () => {
      const issue = {
        type: 'import-hallucination',
        message: 'Test'
        // Missing 'severity'
      };

      expect(() => HallucinationIssueSchema.parse(issue)).toThrow();
    });

    it('should require message field', () => {
      const issue = {
        type: 'import-hallucination',
        severity: 'critical'
        // Missing 'message'
      };

      expect(() => HallucinationIssueSchema.parse(issue)).toThrow();
    });
  });

  describe('Optional Fields', () => {
    it('should accept issue without location', () => {
      const issue = {
        type: 'import-hallucination' as IssueType,
        severity: 'critical' as IssueSeverity,
        message: 'Test'
        // No location
      };

      const parsed = HallucinationIssueSchema.parse(issue);
      expect(parsed.location).toBeUndefined();
    });

    it('should accept issue with location', () => {
      const issue = {
        type: 'import-hallucination' as IssueType,
        severity: 'critical' as IssueSeverity,
        message: 'Test',
        location: {
          file: '/path/to/file.ts',
          line: 10,
          column: 5
        }
      };

      const parsed = HallucinationIssueSchema.parse(issue);
      expect(parsed.location).toEqual({
        file: '/path/to/file.ts',
        line: 10,
        column: 5
      });
    });

    it('should accept issue without suggestion', () => {
      const issue = {
        type: 'function-hallucination' as IssueType,
        severity: 'major' as IssueSeverity,
        message: 'Function not found'
        // No suggestion
      };

      const parsed = HallucinationIssueSchema.parse(issue);
      expect(parsed.suggestion).toBeUndefined();
    });

    it('should accept issue with suggestion', () => {
      const issue = {
        type: 'function-hallucination' as IssueType,
        severity: 'major' as IssueSeverity,
        message: 'Function not found',
        suggestion: 'Did you mean validateEmail?'
      };

      const parsed = HallucinationIssueSchema.parse(issue);
      expect(parsed.suggestion).toBe('Did you mean validateEmail?');
    });
  });

  describe('Auto-Fix Structure', () => {
    it('should accept issue without autoFix', () => {
      const issue = {
        type: 'import-hallucination' as IssueType,
        severity: 'critical' as IssueSeverity,
        message: 'Package not found'
      };

      const parsed = HallucinationIssueSchema.parse(issue);
      expect(parsed.autoFix).toBeUndefined();
    });

    it('should accept issue with autoFix', () => {
      const issue = {
        type: 'package-hallucination' as IssueType,
        severity: 'critical' as IssueSeverity,
        message: 'Package not installed',
        autoFix: {
          type: 'install-package',
          data: {
            package: 'lodash',
            version: '^4.17.21'
          }
        }
      };

      const parsed = HallucinationIssueSchema.parse(issue);
      expect(parsed.autoFix).toEqual({
        type: 'install-package',
        data: {
          package: 'lodash',
          version: '^4.17.21'
        }
      });
    });

    it('should validate autoFix has type field', () => {
      const issue = {
        type: 'package-hallucination' as IssueType,
        severity: 'critical' as IssueSeverity,
        message: 'Test',
        autoFix: {
          // Missing 'type'
          data: { package: 'lodash' }
        }
      };

      expect(() => HallucinationIssueSchema.parse(issue)).toThrow();
    });
  });

  describe('Confidence Field', () => {
    it('should default confidence to 1.0 if not provided', () => {
      const issue = {
        type: 'import-hallucination' as IssueType,
        severity: 'critical' as IssueSeverity,
        message: 'Test'
        // No confidence
      };

      const parsed = HallucinationIssueSchema.parse(issue);
      expect(parsed.confidence).toBe(1.0);
    });

    it('should accept custom confidence value', () => {
      const issue = {
        type: 'logic-hallucination' as IssueType,
        severity: 'major' as IssueSeverity,
        message: 'Test',
        confidence: 0.85
      };

      const parsed = HallucinationIssueSchema.parse(issue);
      expect(parsed.confidence).toBe(0.85);
    });

    it('should reject confidence < 0', () => {
      const issue = {
        type: 'import-hallucination' as IssueType,
        severity: 'critical' as IssueSeverity,
        message: 'Test',
        confidence: -0.5
      };

      expect(() => HallucinationIssueSchema.parse(issue)).toThrow();
    });

    it('should reject confidence > 1', () => {
      const issue = {
        type: 'import-hallucination' as IssueType,
        severity: 'critical' as IssueSeverity,
        message: 'Test',
        confidence: 1.5
      };

      expect(() => HallucinationIssueSchema.parse(issue)).toThrow();
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should allow creating valid issue with TypeScript types', () => {
      // This is a compile-time check, but we can verify runtime behavior
      const issue: HallucinationIssue = {
        type: 'function-hallucination',
        severity: 'major',
        message: 'Function validateEmail does not exist',
        location: {
          file: 'src/utils/validation.ts',
          line: 42
        },
        suggestion: 'Did you mean validateEmailAddress?',
        confidence: 0.95
      };

      const parsed = HallucinationIssueSchema.parse(issue);
      expect(parsed).toEqual(issue);
    });
  });

  // Note: Custom matcher tests removed for simplicity
  // The core validation is handled by Zod schema tests above
});
