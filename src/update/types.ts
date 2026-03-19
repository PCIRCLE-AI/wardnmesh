/**
 * Update System Types
 *
 * Type definitions for the WardnMesh update checker system.
 */

export type UpdatePriority = 'CRITICAL' | 'IMPORTANT' | 'MINOR';

export interface VersionInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  releaseUrl: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  priority?: UpdatePriority;
  releaseNotes?: string;
  releaseUrl?: string;
  shouldNotify: boolean;
}

export interface CacheData {
  lastChecked: string;
  latestVersion: string;
  currentVersion: string;
  priority: UpdatePriority;
  lastNotified: string;
  releaseNotes: string;
  releaseUrl: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}
