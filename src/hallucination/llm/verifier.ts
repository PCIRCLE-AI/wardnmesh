/**
 * LLM Verifier (Claude Haiku Integration)
 *
 * Uses Claude Haiku to verify AI completion claims by analyzing
 * the claim against provided evidence.
 *
 * Features:
 * - Claim verification with confidence scoring
 * - Evidence-based analysis (code, tests, docs, context)
 * - Structured JSON output parsing
 * - Robust error handling
 * - Configurable LLM parameters
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Verification claim with evidence
 */
export interface VerificationClaim {
  /** The AI's claim to verify */
  statement: string;

  /** Supporting evidence */
  evidence: {
    /** Source code */
    code?: string;
    /** Test code or test results */
    tests?: string;
    /** Documentation */
    documentation?: string;
    /** Additional context */
    context?: string;
    /** Any other relevant information */
    [key: string]: string | undefined;
  };
}

/**
 * Verification result
 */
export interface VerificationResult {
  /** Whether the claim is verified */
  verified: boolean;

  /** Confidence level (0-1) */
  confidence: number;

  /** Reasoning for the verification decision */
  reasoning: string;

  /** Error message if verification failed */
  error?: string;
}

/**
 * LLM Verifier options
 */
export interface LlmVerifierOptions {
  /** Anthropic API key */
  apiKey: string;

  /** Model to use (default: claude-haiku-4-5) */
  model?: string;

  /** Temperature for LLM (default: 0.3 for factual analysis) */
  temperature?: number;

  /** Max tokens for response (default: 1000) */
  maxTokens?: number;

  /** Optional: pre-initialized Anthropic client (for testing) */
  anthropicClient?: Anthropic;
}

/**
 * LLM response format (internal)
 */
interface LlmResponse {
  verified: boolean;
  confidence: number;
  reasoning: string;
}

/**
 * LLM Verifier
 *
 * Uses Claude Haiku to verify AI completion claims
 */
export class LlmVerifier {
  private client: Anthropic;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(options: LlmVerifierOptions) {
    this.client = options.anthropicClient || new Anthropic({
      apiKey: options.apiKey
    });

    this.model = options.model || 'claude-haiku-4-5';
    this.temperature = options.temperature !== undefined ? options.temperature : 0.3;
    this.maxTokens = options.maxTokens || 1000;
  }

  /**
   * Verify a claim against provided evidence
   *
   * @param claim - The claim to verify
   * @returns Verification result
   */
  async verify(claim: VerificationClaim): Promise<VerificationResult> {
    try {
      // Generate prompt
      const prompt = this.generatePrompt(claim);

      // Call Claude Haiku
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Parse response
      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return this.createErrorResult('No text response from LLM');
      }

      const result = this.parseResponse(textContent.text);
      return result;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Generate verification prompt
   *
   * @param claim - Claim to verify
   * @returns Formatted prompt
   */
  private generatePrompt(claim: VerificationClaim): string {
    const { statement, evidence } = claim;

    let prompt = `You are a code verification expert. Your task is to verify whether an AI's claim is accurate based on the provided evidence.

**Claim to Verify:**
"${statement}"

**Evidence:**
`;

    // Add evidence sections
    if (evidence.code) {
      prompt += `\n**Code:**
\`\`\`
${evidence.code}
\`\`\`
`;
    }

    if (evidence.tests) {
      prompt += `\n**Tests:**
\`\`\`
${evidence.tests}
\`\`\`
`;
    }

    if (evidence.documentation) {
      prompt += `\n**Documentation:**
${evidence.documentation}
`;
    }

    if (evidence.context) {
      prompt += `\n**Context:**
${evidence.context}
`;
    }

    // Add any other evidence fields
    for (const [key, value] of Object.entries(evidence)) {
      if (!['code', 'tests', 'documentation', 'context'].includes(key) && value) {
        prompt += `\n**${key}:**
${value}
`;
      }
    }

    prompt += `

**Instructions:**
Analyze whether the claim is accurate based on the evidence. Consider:
1. Does the evidence support the claim?
2. Is the claim exaggerated or understated?
3. Are there contradictions between the claim and evidence?
4. Is the implementation complete as claimed?

Respond with a JSON object in this exact format:
{
  "verified": boolean,
  "confidence": number (0.0 to 1.0),
  "reasoning": "string explaining your decision"
}

Be precise and factual. Do not make assumptions beyond the provided evidence.`;

    return prompt;
  }

  /**
   * Parse LLM JSON response
   *
   * @param text - Raw LLM response text
   * @returns Parsed verification result
   */
  private parseResponse(text: string): VerificationResult {
    try {
      // Trim whitespace
      const cleaned = text.trim();

      // Parse JSON
      const parsed = JSON.parse(cleaned) as Partial<LlmResponse>;

      // Extract fields with defaults
      const verified = parsed.verified ?? false;
      const rawConfidence = parsed.confidence ?? 0;
      const reasoning = parsed.reasoning || 'No reasoning provided';

      // Clamp confidence to [0, 1]
      const confidence = Math.max(0, Math.min(1, rawConfidence));

      return {
        verified,
        confidence,
        reasoning
      };
    } catch (error) {
      // JSON parse error
      return {
        verified: false,
        confidence: 0,
        reasoning: 'Failed to parse LLM response',
        error: `Parse error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Handle API errors
   *
   * @param error - Error from API call
   * @returns Error result
   */
  private handleError(error: unknown): VerificationResult {
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      const originalMessage = error.message;
      errorMessage = originalMessage;

      // Check for specific error types (status codes)
      if ('status' in error) {
        const status = (error as any).status;
        if (status === 429) {
          errorMessage = 'Rate limit exceeded';
        } else if (status === 401) {
          errorMessage = 'Invalid API key';
        } else if (status === 500) {
          errorMessage = 'LLM service error';
        }
      }

      // Check for network errors (BEFORE timeout check to preserve network error prefix)
      if (originalMessage.toLowerCase().includes('network')) {
        errorMessage = `Network error: ${originalMessage.toLowerCase().includes('timeout') ? 'timeout' : errorMessage}`;
      }
      // Check for timeout (if not already handled as network error)
      else if (errorMessage.toLowerCase().includes('timeout')) {
        errorMessage = 'Timeout waiting for LLM response';
      }
    }

    return this.createErrorResult(errorMessage);
  }

  /**
   * Create error result
   *
   * @param errorMessage - Error message
   * @returns Error verification result
   */
  private createErrorResult(errorMessage: string): VerificationResult {
    return {
      verified: false,
      confidence: 0,
      reasoning: 'Verification failed due to error',
      error: errorMessage
    };
  }
}
