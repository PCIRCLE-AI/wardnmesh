/**
 * Unit tests for LLM Verifier (Claude Haiku Integration)
 *
 * Testing Strategy:
 * - Test verification of true completion claims
 * - Test detection of false/exaggerated claims
 * - Test LLM API error handling
 * - Test JSON response parsing
 * - Test prompt template generation
 * - Test confidence scoring
 * - Test edge cases (timeout, malformed responses)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// These imports will fail initially - that's expected in TDD!
import {
  LlmVerifier,
  VerificationClaim,
  VerificationResult,
  LlmVerifierOptions
} from '../../../src/hallucination/llm/verifier';

describe('LlmVerifier', () => {
  let verifier: LlmVerifier;
  let mockAnthropicClient: any;

  beforeEach(() => {
    // Mock Anthropic API client
    mockAnthropicClient = {
      messages: {
        create: jest.fn()
      }
    };

    verifier = new LlmVerifier({
      apiKey: 'test-api-key',
      model: 'claude-haiku-4-5',
      anthropicClient: mockAnthropicClient
    });
  });

  describe('Verify True Completion Claims', () => {
    it('should verify valid completion claim with evidence', async () => {
      const claim: VerificationClaim = {
        statement: 'I have implemented the add() function',
        evidence: {
          code: 'function add(a: number, b: number): number { return a + b; }',
          tests: 'expect(add(1, 2)).toBe(3);',
          context: 'User asked to create an add function'
        }
      };

      // Mock LLM response: claim is verified
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verified: true,
              confidence: 0.95,
              reasoning: 'The code implements add() function as claimed, with correct type annotations and working test.'
            })
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reasoning).toContain('implements add() function');
    });

    it('should verify claim with multiple pieces of evidence', async () => {
      const claim: VerificationClaim = {
        statement: 'I have added error handling to the API',
        evidence: {
          code: 'try { await fetch(...) } catch (error) { logger.error(error); throw new ApiError(...); }',
          tests: 'expect(() => api.call()).rejects.toThrow(ApiError);',
          documentation: 'API now throws ApiError on network failures',
          context: 'User requested robust error handling'
        }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verified: true,
              confidence: 0.92,
              reasoning: 'Error handling implemented with try-catch, custom error type, logging, and tests.'
            })
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('Detect False/Exaggerated Claims', () => {
    it('should detect claim with no supporting evidence', async () => {
      const claim: VerificationClaim = {
        statement: 'I have implemented a complete authentication system',
        evidence: {
          code: 'const user = { name: "test" };',
          context: 'User asked for authentication'
        }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verified: false,
              confidence: 0.85,
              reasoning: 'Code only creates a simple user object. No password hashing, JWT, sessions, or security measures. Claim is exaggerated.'
            })
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reasoning).toContain('exaggerated');
    });

    it('should detect partial implementation claimed as complete', async () => {
      const claim: VerificationClaim = {
        statement: 'All tests are passing',
        evidence: {
          tests: 'Test Suites: 1 failed, 4 passed',
          context: 'User asked to ensure all tests pass'
        }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verified: false,
              confidence: 0.98,
              reasoning: 'Evidence shows "1 failed" test suite. Claim of "all tests passing" is false.'
            })
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.95);
      expect(result.reasoning).toContain('1 failed');
    });

    it('should detect claim contradicted by evidence', async () => {
      const claim: VerificationClaim = {
        statement: 'I have fixed the bug and tests now pass',
        evidence: {
          code: 'function divide(a, b) { return a / b; }', // Still has division by zero bug
          tests: 'FAIL: divide by zero returns Infinity',
          context: 'User asked to fix division by zero bug'
        }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verified: false,
              confidence: 0.94,
              reasoning: 'Code still allows division by zero. Test explicitly fails on this case. Bug not fixed.'
            })
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(false);
      expect(result.reasoning).toContain('Bug not fixed');
    });
  });

  describe('LLM API Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const claim: VerificationClaim = {
        statement: 'I have completed the task',
        evidence: { code: 'console.log("done");' }
      };

      mockAnthropicClient.messages.create.mockRejectedValue(
        new Error('Network error: timeout')
      );

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Verification failed');
      expect(result.error).toContain('Network error');
    });

    it('should handle API rate limits', async () => {
      const claim: VerificationClaim = {
        statement: 'Task complete',
        evidence: { code: 'done' }
      };

      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      mockAnthropicClient.messages.create.mockRejectedValue(rateLimitError);

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Rate limit');
    });

    it('should handle invalid API key', async () => {
      const claim: VerificationClaim = {
        statement: 'Done',
        evidence: { code: 'x' }
      };

      const authError = new Error('Invalid API key');
      (authError as any).status = 401;
      mockAnthropicClient.messages.create.mockRejectedValue(authError);

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should handle API timeout', async () => {
      const claim: VerificationClaim = {
        statement: 'Complete',
        evidence: { code: 'y' }
      };

      mockAnthropicClient.messages.create.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(false);
      expect(result.error).toContain('Timeout');
    });
  });

  describe('JSON Response Parsing', () => {
    it('should parse valid JSON response', async () => {
      const claim: VerificationClaim = {
        statement: 'Implemented',
        evidence: { code: 'function x() {}' }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"verified": true, "confidence": 0.88, "reasoning": "Valid implementation"}'
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(true);
      expect(result.confidence).toBe(0.88);
      expect(result.reasoning).toBe('Valid implementation');
    });

    it('should handle JSON with extra whitespace', async () => {
      const claim: VerificationClaim = {
        statement: 'Done',
        evidence: { code: 'x' }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '\n\n  {"verified": false, "confidence": 0.7, "reasoning": "Incomplete"}  \n'
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(false);
      expect(result.confidence).toBe(0.7);
    });

    it('should handle malformed JSON response', async () => {
      const claim: VerificationClaim = {
        statement: 'Complete',
        evidence: { code: 'z' }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'This is not JSON at all'
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.error).toContain('Parse error');
    });

    it('should handle JSON missing required fields', async () => {
      const claim: VerificationClaim = {
        statement: 'Done',
        evidence: { code: 'w' }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"verified": true}' // Missing confidence and reasoning
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(true);
      expect(result.confidence).toBeDefined();
      expect(result.reasoning).toBeDefined();
    });

    it('should handle JSON with unexpected fields', async () => {
      const claim: VerificationClaim = {
        statement: 'Complete',
        evidence: { code: 'v' }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"verified": true, "confidence": 0.9, "reasoning": "OK", "extra": "ignored", "foo": 123}'
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(true);
      expect(result.confidence).toBe(0.9);
      expect(result.reasoning).toBe('OK');
      // Extra fields should be ignored
    });
  });

  describe('Prompt Template Generation', () => {
    it('should generate prompt with all evidence fields', async () => {
      const claim: VerificationClaim = {
        statement: 'Implemented feature X',
        evidence: {
          code: 'const x = 1;',
          tests: 'expect(x).toBe(1);',
          documentation: 'Feature X documented',
          context: 'User requested feature X'
        }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"verified": true, "confidence": 0.9, "reasoning": "OK"}'
          }
        ]
      });

      await verifier.verify(claim);

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Implemented feature X')
            })
          ])
        })
      );

      const callArgs = mockAnthropicClient.messages.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user').content;

      expect(userMessage).toContain('const x = 1');
      expect(userMessage).toContain('expect(x).toBe(1)');
      expect(userMessage).toContain('Feature X documented');
      expect(userMessage).toContain('User requested feature X');
    });

    it('should handle evidence with only code', async () => {
      const claim: VerificationClaim = {
        statement: 'Fixed bug',
        evidence: {
          code: 'if (x !== 0) { return a / x; }'
        }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"verified": true, "confidence": 0.8, "reasoning": "OK"}'
          }
        ]
      });

      await verifier.verify(claim);

      const callArgs = mockAnthropicClient.messages.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user').content;

      expect(userMessage).toContain('Fixed bug');
      expect(userMessage).toContain('if (x !== 0)');
    });
  });

  describe('Confidence Scoring', () => {
    it('should clamp confidence to 0-1 range', async () => {
      const claim: VerificationClaim = {
        statement: 'Done',
        evidence: { code: 'x' }
      };

      // LLM returns out-of-range confidence
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"verified": true, "confidence": 1.5, "reasoning": "OK"}'
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.confidence).toBeLessThanOrEqual(1.0);
      expect(result.confidence).toBeGreaterThanOrEqual(0.0);
    });

    it('should default to 0 confidence on error', async () => {
      const claim: VerificationClaim = {
        statement: 'Complete',
        evidence: { code: 'y' }
      };

      mockAnthropicClient.messages.create.mockRejectedValue(
        new Error('API error')
      );

      const result = await verifier.verify(claim);

      expect(result.confidence).toBe(0);
    });
  });

  describe('Custom Options', () => {
    it('should allow custom model selection', async () => {
      const customVerifier = new LlmVerifier({
        apiKey: 'test-key',
        model: 'claude-opus-4-6',
        anthropicClient: mockAnthropicClient
      });

      const claim: VerificationClaim = {
        statement: 'Done',
        evidence: { code: 'x' }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"verified": true, "confidence": 0.9, "reasoning": "OK"}'
          }
        ]
      });

      await customVerifier.verify(claim);

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-opus-4-6'
        })
      );
    });

    it('should allow custom temperature', async () => {
      const customVerifier = new LlmVerifier({
        apiKey: 'test-key',
        temperature: 0.2,
        anthropicClient: mockAnthropicClient
      });

      const claim: VerificationClaim = {
        statement: 'Complete',
        evidence: { code: 'z' }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"verified": true, "confidence": 0.9, "reasoning": "OK"}'
          }
        ]
      });

      await customVerifier.verify(claim);

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty evidence', async () => {
      const claim: VerificationClaim = {
        statement: 'Task done',
        evidence: {}
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"verified": false, "confidence": 0.1, "reasoning": "No evidence provided"}'
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(false);
      expect(result.confidence).toBeLessThan(0.2);
    });

    it('should handle very long evidence', async () => {
      const claim: VerificationClaim = {
        statement: 'Implemented',
        evidence: {
          code: 'x'.repeat(10000)
        }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"verified": true, "confidence": 0.9, "reasoning": "OK"}'
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result).toBeDefined();
      expect(result.verified).toBe(true);
    });

    it('should handle special characters in claim', async () => {
      const claim: VerificationClaim = {
        statement: 'Fixed: "error" with <special> & {chars}',
        evidence: {
          code: 'const msg = "error resolved";'
        }
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"verified": true, "confidence": 0.85, "reasoning": "OK"}'
          }
        ]
      });

      const result = await verifier.verify(claim);

      expect(result.verified).toBe(true);
    });
  });
});
