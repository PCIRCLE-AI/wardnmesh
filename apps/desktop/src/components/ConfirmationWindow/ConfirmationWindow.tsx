import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SeverityBadge } from './SeverityBadge';
import { CountdownTimer } from './CountdownTimer';
import { ScopeSelector } from './ScopeSelector';

type Scope = 'once' | 'session' | 'project' | 'always';

const TIMEOUTS: Record<string, number> = {
  critical: 60000,
  major: 45000,
  minor: 30000,
};

export function ConfirmationWindow() {
  // Read params from URL search params (set by Rust when creating window)
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || '';
  const ruleId = params.get('ruleId') || '';
  const ruleName = params.get('ruleName') || 'Unknown Rule';
  const severity = params.get('severity') || 'major';
  const contentPreview = params.get('contentPreview') || '';
  const category = params.get('category') || '';

  const [scope, setScope] = useState<Scope>('once');
  const [responded, setResponded] = useState(false);

  const timeoutMs = TIMEOUTS[severity] || TIMEOUTS.major;

  const respond = useCallback(async (action: 'allow' | 'block') => {
    if (responded) return;
    setResponded(true);
    try {
      await invoke('respond_confirmation', { id, action, scope });
    } catch (err) {
      console.error('Failed to respond:', err);
    }
  }, [id, scope, responded]);

  const handleTimeout = useCallback(() => {
    respond('block');
  }, [respond]);

  if (responded) {
    return (
      <div className="p-6 flex items-center justify-center h-full bg-[var(--color-bg-primary)]">
        <p className="text-[var(--color-text-muted)]">Response sent. Closing...</p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 h-full bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl" role="img" aria-label="shield">&#x1f6e1;&#xfe0f;</span>
        <div className="flex-1">
          <h1 className="text-base font-semibold">Security Alert</h1>
          <p className="text-xs text-[var(--color-text-muted)]">{ruleId}</p>
        </div>
        <SeverityBadge severity={severity} />
      </div>

      {/* Rule Info */}
      <div className="bg-[var(--color-bg-secondary)] rounded-lg p-3">
        <p className="text-sm font-medium mb-1">{ruleName}</p>
        <p className="text-xs text-[var(--color-text-muted)]">Category: {category}</p>
      </div>

      {/* Content Preview */}
      {contentPreview && (
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-3">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Detected Content:</p>
          <code className="text-xs break-all">{contentPreview.slice(0, 200)}</code>
        </div>
      )}

      {/* Scope Selector */}
      <ScopeSelector value={scope} onChange={setScope} />

      {/* Countdown */}
      <CountdownTimer durationMs={timeoutMs} onTimeout={handleTimeout} />

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => respond('allow')}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
        >
          Allow {scope !== 'once' ? `(${scope})` : ''}
        </button>
        <button
          onClick={() => respond('block')}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          Block
        </button>
      </div>
    </div>
  );
}
