/**
 * Unit tests for GitHubClient
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GitHubClient } from '../github';
import https from 'https';
import type { IncomingMessage } from 'http';
import { EventEmitter } from 'events';

// Mock https module
jest.mock('https');

// Helper to create mock response
class MockResponse extends EventEmitter {
  statusCode?: number;

  constructor(statusCode: number) {
    super();
    this.statusCode = statusCode;
  }

  setData(data: string) {
    this.emit('data', data);
    this.emit('end');
  }
}

// Helper to create mock request
class MockRequest extends EventEmitter {
  destroy = jest.fn();
}

describe('GitHubClient', () => {
  let client: GitHubClient;
  let mockRequest: MockRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new GitHubClient();
    mockRequest = new MockRequest();
  });

  describe('Successful Release Fetch', () => {
    it('should fetch and parse latest release successfully', async () => {
      const mockRelease = {
        tag_name: 'v2.1.0',
        published_at: '2026-01-16T10:00:00Z',
        body: 'New features and improvements',
        html_url: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v2.1.0',
        draft: false,
        prerelease: false,
      };

      const mockResponse = new MockResponse(200);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData(JSON.stringify(mockRelease)), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result).toEqual({
        version: '2.1.0', // v prefix stripped
        releaseDate: '2026-01-16T10:00:00Z',
        releaseNotes: 'New features and improvements',
        releaseUrl: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v2.1.0',
      });
    });

    it('should strip v prefix from version tag', async () => {
      const mockRelease = {
        tag_name: 'v1.0.0',
        published_at: '2026-01-16T10:00:00Z',
        body: 'Release notes',
        html_url: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.0.0',
        draft: false,
        prerelease: false,
      };

      const mockResponse = new MockResponse(200);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData(JSON.stringify(mockRelease)), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result?.version).toBe('1.0.0');
    });

    it('should handle version tag without v prefix', async () => {
      const mockRelease = {
        tag_name: '2.0.0', // No v prefix
        published_at: '2026-01-16T10:00:00Z',
        body: 'Release notes',
        html_url: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/2.0.0',
        draft: false,
        prerelease: false,
      };

      const mockResponse = new MockResponse(200);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData(JSON.stringify(mockRelease)), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result?.version).toBe('2.0.0');
    });

    it('should handle empty release notes', async () => {
      const mockRelease = {
        tag_name: 'v1.1.0',
        published_at: '2026-01-16T10:00:00Z',
        body: '', // Empty body
        html_url: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.1.0',
        draft: false,
        prerelease: false,
      };

      const mockResponse = new MockResponse(200);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData(JSON.stringify(mockRelease)), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result?.releaseNotes).toBe('No release notes available');
    });
  });

  describe('Release Filtering', () => {
    it('should filter out draft releases', async () => {
      const mockRelease = {
        tag_name: 'v2.1.0',
        published_at: '2026-01-16T10:00:00Z',
        body: 'Draft release',
        html_url: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v2.1.0',
        draft: true, // Draft
        prerelease: false,
      };

      const mockResponse = new MockResponse(200);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData(JSON.stringify(mockRelease)), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result).toBeNull();
    });

    it('should filter out prerelease versions', async () => {
      const mockRelease = {
        tag_name: 'v2.1.0-beta.1',
        published_at: '2026-01-16T10:00:00Z',
        body: 'Beta release',
        html_url: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v2.1.0-beta.1',
        draft: false,
        prerelease: true, // Prerelease
      };

      const mockResponse = new MockResponse(200);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData(JSON.stringify(mockRelease)), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result).toBeNull();
    });

    it('should filter out both draft and prerelease', async () => {
      const mockRelease = {
        tag_name: 'v3.0.0-rc.1',
        published_at: '2026-01-16T10:00:00Z',
        body: 'RC release',
        html_url: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v3.0.0-rc.1',
        draft: true,
        prerelease: true,
      };

      const mockResponse = new MockResponse(200);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData(JSON.stringify(mockRelease)), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 Not Found gracefully', async () => {
      const mockResponse = new MockResponse(404);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData('Not Found'), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result).toBeNull(); // Silent failure
    });

    it('should handle 403 Rate Limit gracefully', async () => {
      const mockResponse = new MockResponse(403);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData('Rate limit exceeded'), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result).toBeNull(); // Silent failure
    });

    it('should handle invalid JSON response gracefully', async () => {
      const mockResponse = new MockResponse(200);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData('invalid json{'), 0); // Invalid JSON
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result).toBeNull(); // Silent failure
    });

    it('should handle network error gracefully', async () => {
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        setTimeout(() => mockRequest.emit('error', new Error('Network error')), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result).toBeNull(); // Silent failure
    });

    it('should handle request timeout gracefully', async () => {
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        setTimeout(() => mockRequest.emit('timeout'), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result).toBeNull(); // Silent failure
      expect(mockRequest.destroy).toHaveBeenCalled(); // Request destroyed on timeout
    });

    it('should handle HTTP 500 error gracefully', async () => {
      const mockResponse = new MockResponse(500);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData('Server error'), 0);
        return mockRequest as any;
      });

      const result = await client.fetchLatestRelease();

      expect(result).toBeNull(); // Silent failure
    });
  });

  describe('API Configuration', () => {
    it('should use correct GitHub API endpoint', async () => {
      const mockRelease = {
        tag_name: 'v1.0.0',
        published_at: '2026-01-16T10:00:00Z',
        body: 'Release',
        html_url: 'https://github.com/PCIRCLE-AI/wardnmesh/releases/tag/v1.0.0',
        draft: false,
        prerelease: false,
      };

      const mockResponse = new MockResponse(200);
      jest.mocked(https.get).mockImplementation((url, options, callback) => {
        if (typeof callback === 'function') {
          callback(mockResponse as unknown as IncomingMessage);
        }
        setTimeout(() => mockResponse.setData(JSON.stringify(mockRelease)), 0);
        return mockRequest as any;
      });

      await client.fetchLatestRelease();

      expect(https.get).toHaveBeenCalledWith(
        'https://api.github.com/repos/PCIRCLE-AI/wardnmesh/releases/latest',
        expect.objectContaining({
          headers: {
            'User-Agent': 'WardnMesh-CLI',
            'Accept': 'application/vnd.github+json',
          },
          timeout: 5000,
        }),
        expect.any(Function)
      );
    });
  });
});
