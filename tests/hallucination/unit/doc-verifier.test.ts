/**
 * Unit tests for Documentation Verifier
 *
 * Testing Strategy:
 * - Test fetching official documentation
 * - Test API usage verification against docs
 * - Test error handling (404, network errors)
 * - Test LLM-based comparison
 * - Test caching mechanism
 * - Test multiple documentation sources
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// These imports will fail initially - that's expected in TDD!
import {
  DocumentationVerifier,
  ApiUsageCheck,
  DocVerificationResult,
  DocumentationSource
} from '../../../src/hallucination/llm/doc-verifier';

describe('DocumentationVerifier', () => {
  let verifier: DocumentationVerifier;
  let mockFetch: any;
  let mockLlmVerifier: any;

  beforeEach(() => {
    // Mock global fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Mock LLM verifier
    mockLlmVerifier = {
      verify: jest.fn()
    };

    verifier = new DocumentationVerifier({
      llmVerifier: mockLlmVerifier
    });
  });

  describe('Fetch Official Documentation', () => {
    it('should fetch documentation from URL', async () => {
      const mockHtmlDoc = `
        <html>
          <body>
            <h1>useEffect</h1>
            <p>useEffect is a React Hook that lets you synchronize a component with an external system.</p>
            <code>useEffect(setup, dependencies?)</code>
          </body>
        </html>
      `;

      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        status: 200,
        text: async () => mockHtmlDoc
      }));

      const doc = await verifier.fetchDocumentation({
        url: 'https://react.dev/reference/react/useEffect'
      });

      expect(doc).toBeDefined();
      expect(doc!.content).toContain('useEffect');
      expect(doc!.content).toContain('React Hook');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://react.dev/reference/react/useEffect'
      );
    });

    it('should handle 404 not found', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 404
      }));

      const doc = await verifier.fetchDocumentation({
        url: 'https://example.com/nonexistent'
      });

      expect(doc).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')));

      const doc = await verifier.fetchDocumentation({
        url: 'https://example.com/api'
      });

      expect(doc).toBeNull();
    });

    it('should extract text content from HTML', async () => {
      const mockHtml = `
        <html>
          <head><title>API Docs</title></head>
          <body>
            <nav>Navigation</nav>
            <main>
              <h1>API Function</h1>
              <p>This is the main content.</p>
            </main>
            <footer>Footer</footer>
          </body>
        </html>
      `;

      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => mockHtml
      }));

      const doc = await verifier.fetchDocumentation({
        url: 'https://example.com/api'
      });

      expect(doc?.content).toContain('API Function');
      expect(doc?.content).toContain('main content');
      // Should not include script/style tags
      expect(doc?.content).not.toContain('<script>');
      expect(doc?.content).not.toContain('<style>');
    });

    it('should cache fetched documentation', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '<html><body>Content</body></html>'
      }));

      // First fetch
      await verifier.fetchDocumentation({
        url: 'https://example.com/api'
      });

      // Second fetch (should use cache)
      await verifier.fetchDocumentation({
        url: 'https://example.com/api'
      });

      // fetch should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should support multiple documentation sources', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '<html><body>Docs</body></html>'
      }));

      // npm package documentation
      const npmDoc = await verifier.fetchDocumentation({
        package: 'react',
        api: 'useEffect'
      });

      // Direct URL
      const urlDoc = await verifier.fetchDocumentation({
        url: 'https://react.dev/reference/react/useEffect'
      });

      expect(npmDoc).toBeDefined();
      expect(urlDoc).toBeDefined();
    });
  });

  describe('Verify API Usage Against Documentation', () => {
    it('should verify correct API usage', async () => {
      const check: ApiUsageCheck = {
        package: 'react',
        version: '18.0.0',
        apiName: 'useEffect',
        usage: `
          useEffect(() => {
            const subscription = api.subscribe();
            return () => subscription.unsubscribe();
          }, [api]);
        `
      };

      // Mock documentation fetch
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => `
          <html><body>
            <h1>useEffect</h1>
            <p>useEffect accepts a setup function and optional dependencies array.</p>
            <p>The setup function can return a cleanup function.</p>
          </body></html>
        `
      }));

      // Mock LLM verification
      mockLlmVerifier.verify.mockImplementation(() => Promise.resolve({
        verified: true,
        confidence: 0.95,
        reasoning: 'Usage follows documented pattern: setup function with cleanup and dependencies array.'
      }));

      const result = await verifier.verifyApiUsage(check);

      expect(result.correct).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect incorrect API usage', async () => {
      const check: ApiUsageCheck = {
        package: 'react',
        version: '18.0.0',
        apiName: 'useEffect',
        usage: `
          useEffect(() => {
            fetchData();
          });
          // Missing dependencies array
        `
      };

      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '<html><body>useEffect requires dependencies</body></html>'
      }));

      mockLlmVerifier.verify.mockImplementation(() => Promise.resolve({
        verified: false,
        confidence: 0.88,
        reasoning: 'Missing dependencies array. This can cause infinite re-renders.'
      }));

      const result = await verifier.verifyApiUsage(check);

      expect(result.correct).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('dependencies');
    });

    it('should detect deprecated API usage', async () => {
      const check: ApiUsageCheck = {
        package: 'react',
        version: '18.0.0',
        apiName: 'componentWillMount',
        usage: 'componentWillMount() { this.setState({...}); }'
      };

      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '<html><body>DEPRECATED: Use useEffect instead</body></html>'
      }));

      mockLlmVerifier.verify.mockImplementation(() => Promise.resolve({
        verified: false,
        confidence: 0.99,
        reasoning: 'componentWillMount is deprecated in React 18. Use useEffect hook instead.'
      }));

      const result = await verifier.verifyApiUsage(check);

      expect(result.correct).toBe(false);
      expect(result.issues[0]).toContain('deprecated');
      expect(result.suggestions[0]).toContain('useEffect');
    });
  });

  describe('Documentation Source Resolution', () => {
    it('should resolve documentation URL from package name', async () => {
      const sources = verifier.resolveDocumentationSources({
        package: 'react',
        api: 'useEffect'
      });

      expect(sources).toBeDefined();
      expect(sources.length).toBeGreaterThan(0);
      expect(sources[0].url).toContain('react');
    });

    it('should support popular packages', async () => {
      const packages = ['react', 'vue', 'angular', 'express', 'axios'];

      for (const pkg of packages) {
        const sources = verifier.resolveDocumentationSources({
          package: pkg,
          api: 'test'
        });

        expect(sources.length).toBeGreaterThan(0);
      }
    });

    it('should fallback to npm documentation', async () => {
      const sources = verifier.resolveDocumentationSources({
        package: 'unknown-package',
        api: 'someApi'
      });

      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some(s => s.url.includes('npmjs.com'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing documentation gracefully', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: false,
        status: 404
      }));

      const check: ApiUsageCheck = {
        package: 'fake-package',
        version: '1.0.0',
        apiName: 'fakeApi',
        usage: 'fakeApi()'
      };

      const result = await verifier.verifyApiUsage(check);

      expect(result.correct).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.error).toContain('documentation not found');
    });

    it('should handle LLM verification errors', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '<html><body>Docs</body></html>'
      }));

      mockLlmVerifier.verify.mockImplementation(() => Promise.reject(new Error('LLM error')));

      const check: ApiUsageCheck = {
        package: 'test',
        version: '1.0.0',
        apiName: 'api',
        usage: 'api()'
      };

      const result = await verifier.verifyApiUsage(check);

      expect(result.correct).toBe(false);
      expect(result.error).toContain('verification failed');
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '<html><body>Content</body></html>'
      }));

      await verifier.fetchDocumentation({ url: 'https://example.com/api' });
      verifier.clearCache();
      await verifier.fetchDocumentation({ url: 'https://example.com/api' });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should have separate cache entries for different URLs', async () => {
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        text: async () => '<html><body>Content</body></html>'
      }));

      await verifier.fetchDocumentation({ url: 'https://example.com/api1' });
      await verifier.fetchDocumentation({ url: 'https://example.com/api2' });
      await verifier.fetchDocumentation({ url: 'https://example.com/api1' }); // Cache hit

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
