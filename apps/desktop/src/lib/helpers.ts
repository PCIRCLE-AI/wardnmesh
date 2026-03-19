import { invoke } from '@tauri-apps/api/core';

/**
 * Opens a URL in the system's default browser via Tauri.
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    await invoke('open_external_url', { url });
  } catch (err) {
    console.error('Failed to open URL via Tauri:', err);
  }
}

/**
 * Extracts a human-readable error message from an unknown error.
 */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Formats an OS identifier into a human-readable display name.
 */
export function formatOSName(os: string): string {
  switch (os) {
    case 'macos':
      return 'macOS';
    case 'windows':
      return 'Windows';
    case 'linux':
      return 'Linux';
    default:
      return 'Unknown';
  }
}

/**
 * Formats a timestamp into a relative time string (e.g., "5m ago").
 */
export function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return 'just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${Math.floor(diffHours / 24)}d ago`;
}
