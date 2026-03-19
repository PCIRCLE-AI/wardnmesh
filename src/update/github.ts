/**
 * GitHub API Client
 *
 * Fetches latest release information from GitHub Releases API.
 */

import https from 'https';
import type { GitHubRelease, VersionInfo } from './types';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'PCIRCLE-AI';
const REPO_NAME = 'wardnmesh';
const REQUEST_TIMEOUT_MS = 5000; // 5 seconds

export class GitHubClient {
  /**
   * Fetch latest release from GitHub
   */
  async fetchLatestRelease(): Promise<VersionInfo | null> {
    try {
      const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
      const release = await this.makeRequest<GitHubRelease>(url);

      if (!release || release.draft || release.prerelease) {
        return null;
      }

      // Strip 'v' prefix if present (e.g., v2.1.0 → 2.1.0)
      const version = release.tag_name.replace(/^v/, '');

      return {
        version,
        releaseDate: release.published_at,
        releaseNotes: release.body || 'No release notes available',
        releaseUrl: release.html_url,
      };
    } catch (error) {
      // Fail gracefully - offline or API down (silent failure)
      return null;
    }
  }

  /**
   * Make HTTPS request to GitHub API
   */
  private makeRequest<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': 'WardnMesh-CLI',
          'Accept': 'application/vnd.github+json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data) as T;
              resolve(parsed);
            } catch (error) {
              reject(new Error('Failed to parse GitHub API response'));
            }
          } else if (res.statusCode === 404) {
            reject(new Error('Repository or release not found'));
          } else if (res.statusCode === 403) {
            reject(new Error('GitHub API rate limit exceeded'));
          } else {
            reject(new Error(`GitHub API error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('GitHub API request timeout'));
      });
    });
  }
}
