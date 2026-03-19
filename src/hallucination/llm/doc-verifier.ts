/**
 * Documentation Verifier
 *
 * Fetches official documentation and verifies API usage against it
 * using LLM-based comparison.
 *
 * Features:
 * - Documentation fetching from URLs
 * - HTML text extraction
 * - LLM-based API usage verification
 * - Documentation source resolution for popular packages
 * - Caching for performance
 * - Comprehensive error handling
 */

import type { LlmVerifier, VerificationClaim } from './verifier';

/**
 * API usage check input
 */
export interface ApiUsageCheck {
  /** Package name */
  package: string;

  /** Package version */
  version: string;

  /** API name (function, class, hook, etc.) */
  apiName: string;

  /** Code snippet showing usage */
  usage: string;
}

/**
 * Documentation verification result
 */
export interface DocVerificationResult {
  /** Whether the usage is correct */
  correct: boolean;

  /** Confidence level (0-1) */
  confidence: number;

  /** List of issues found */
  issues: string[];

  /** Suggestions for fixing issues */
  suggestions: string[];

  /** Error message if verification failed */
  error?: string;
}

/**
 * Documentation source
 */
export interface DocumentationSource {
  /** Documentation URL */
  url: string;

  /** Package name (optional) */
  package?: string;

  /** API name (optional) */
  api?: string;
}

/**
 * Fetched documentation
 */
export interface FetchedDocumentation {
  /** Extracted text content */
  content: string;

  /** Source URL */
  url: string;

  /** Fetch timestamp */
  fetchedAt: Date;
}

/**
 * Documentation Verifier options
 */
export interface DocumentationVerifierOptions {
  /** LLM verifier for claim verification */
  llmVerifier: LlmVerifier;
}

/**
 * Documentation Verifier
 *
 * Fetches and verifies API usage against official documentation
 */
export class DocumentationVerifier {
  private llmVerifier: LlmVerifier;
  private cache: Map<string, FetchedDocumentation>;

  // Popular package documentation URLs
  private static readonly DOC_SOURCES: Record<string, (api?: string) => string> = {
    react: (api) => api ? `https://react.dev/reference/react/${api}` : 'https://react.dev',
    vue: (api) => api ? `https://vuejs.org/api/${api}.html` : 'https://vuejs.org',
    angular: (api) => api ? `https://angular.io/api/${api}` : 'https://angular.io',
    express: (api) => api ? `https://expressjs.com/en/api.html#${api}` : 'https://expressjs.com',
    axios: (api) => api ? `https://axios-http.com/docs/api_intro#${api}` : 'https://axios-http.com'
  };

  constructor(options: DocumentationVerifierOptions) {
    this.llmVerifier = options.llmVerifier;
    this.cache = new Map();
  }

  /**
   * Fetch documentation from URL or package
   *
   * @param source - Documentation source
   * @returns Fetched documentation or null if failed
   */
  async fetchDocumentation(
    source: DocumentationSource | { package: string; api?: string }
  ): Promise<FetchedDocumentation | null> {
    try {
      // Determine URL
      let url: string;
      if ('url' in source) {
        url = source.url;
      } else {
        // Resolve from package name
        const sources = this.resolveDocumentationSources({
          package: source.package,
          api: source.api || ''
        });
        if (sources.length === 0) {
          return null;
        }
        url = sources[0].url;
      }

      // Check cache
      const cached = this.cache.get(url);
      if (cached) {
        return cached;
      }

      // Fetch documentation
      const response = await fetch(url);

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      const content = this.extractTextFromHtml(html);

      const doc: FetchedDocumentation = {
        content,
        url,
        fetchedAt: new Date()
      };

      // Cache result
      this.cache.set(url, doc);

      return doc;
    } catch (error) {
      // Network error or other failure
      return null;
    }
  }

  /**
   * Verify API usage against documentation
   *
   * @param check - API usage check
   * @returns Verification result
   */
  async verifyApiUsage(check: ApiUsageCheck): Promise<DocVerificationResult> {
    try {
      // Fetch documentation
      const doc = await this.fetchDocumentation({
        package: check.package,
        api: check.apiName
      });

      if (!doc) {
        return {
          correct: false,
          confidence: 0,
          issues: [],
          suggestions: [],
          error: 'documentation not found'
        };
      }

      // Use LLM to verify usage against documentation
      const claim: VerificationClaim = {
        statement: `The following usage of ${check.apiName} from ${check.package}@${check.version} is correct according to the documentation`,
        evidence: {
          code: check.usage,
          documentation: doc.content
        }
      };

      const llmResult = await this.llmVerifier.verify(claim);

      // Extract issues and suggestions from reasoning
      const issues = this.extractIssuesFromReasoning(llmResult.reasoning, llmResult.verified);
      const suggestions = this.extractSuggestionsFromReasoning(llmResult.reasoning, llmResult.verified);

      return {
        correct: llmResult.verified,
        confidence: llmResult.confidence,
        issues,
        suggestions
      };
    } catch (error) {
      return {
        correct: false,
        confidence: 0,
        issues: [],
        suggestions: [],
        error: 'verification failed'
      };
    }
  }

  /**
   * Resolve documentation sources from package name
   *
   * @param source - Package and API info
   * @returns List of possible documentation URLs
   */
  resolveDocumentationSources(source: {
    package: string;
    api?: string;
  }): DocumentationSource[] {
    const sources: DocumentationSource[] = [];

    // Check if we have a known documentation source
    const docUrlFn = DocumentationVerifier.DOC_SOURCES[source.package];
    if (docUrlFn) {
      sources.push({
        url: docUrlFn(source.api),
        package: source.package,
        api: source.api
      });
    }

    // Fallback to npm documentation
    sources.push({
      url: `https://www.npmjs.com/package/${source.package}`,
      package: source.package,
      api: source.api
    });

    return sources;
  }

  /**
   * Clear documentation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Extract plain text from HTML
   *
   * @param html - HTML string
   * @returns Extracted text
   */
  private extractTextFromHtml(html: string): string {
    // Remove script and style tags
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    // Normalize whitespace
    text = text.replace(/\s+/g, ' ');
    text = text.trim();

    return text;
  }

  /**
   * Extract issues from LLM reasoning
   *
   * @param reasoning - LLM reasoning text
   * @param verified - Whether verification passed
   * @returns List of issues
   */
  private extractIssuesFromReasoning(reasoning: string, verified: boolean): string[] {
    if (verified) {
      return [];
    }

    const issues: string[] = [];
    const lower = reasoning.toLowerCase();

    // Common issue patterns
    if (lower.includes('missing dependencies') || lower.includes('dependencies array')) {
      issues.push('Missing dependencies array');
    }

    if (lower.includes('deprecated')) {
      issues.push('API is deprecated');
    }

    if (lower.includes('parameter') && (lower.includes('wrong') || lower.includes('incorrect'))) {
      issues.push('Incorrect parameter type or usage');
    }

    if (lower.includes('function') && lower.includes('not a')) {
      issues.push('Expected a function but got a different type');
    }

    // If no specific issue found, use first sentence of reasoning
    if (issues.length === 0 && !verified) {
      const firstSentence = reasoning.split(/[.!?]/)[0];
      if (firstSentence) {
        issues.push(firstSentence.trim());
      }
    }

    return issues;
  }

  /**
   * Extract suggestions from LLM reasoning
   *
   * @param reasoning - LLM reasoning text
   * @param verified - Whether verification passed
   * @returns List of suggestions
   */
  private extractSuggestionsFromReasoning(reasoning: string, verified: boolean): string[] {
    if (verified) {
      return [];
    }

    const suggestions: string[] = [];
    const lower = reasoning.toLowerCase();

    // Common suggestion patterns
    if (lower.includes('use useeffect') || lower.includes('useeffect hook')) {
      suggestions.push('Use useEffect hook instead');
    }

    if (lower.includes('use') && lower.includes('instead')) {
      // Extract "use X instead" pattern
      const match = reasoning.match(/[Uu]se ([^.]+) instead/);
      if (match) {
        suggestions.push(`Use ${match[1]} instead`);
      }
    }

    if (lower.includes('should')) {
      // Extract "should X" patterns
      const shouldMatches = reasoning.match(/[Ss]hould ([^.]+)/g);
      if (shouldMatches) {
        shouldMatches.forEach((match) => {
          suggestions.push(match.trim());
        });
      }
    }

    return suggestions;
  }
}
