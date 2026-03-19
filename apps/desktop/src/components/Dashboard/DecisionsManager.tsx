import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Decision {
  id: number;
  rule_id: string;
  scope: string;
  approved: boolean;
  project_dir: string | null;
  created_at: string;
}

export function DecisionsManager() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [scopeFilter, setScopeFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDecisions = useCallback(async () => {
    try {
      const result = await invoke<Decision[]>('get_decisions', { scope: scopeFilter });
      setDecisions(result);
    } catch (err) {
      setError(String(err));
    }
  }, [scopeFilter]);

  useEffect(() => { fetchDecisions(); }, [fetchDecisions]);

  const revoke = async (id: number) => {
    try {
      await invoke('revoke_decision', { id });
      setDecisions(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Decisions ({decisions.length})</h2>
        <select
          value={scopeFilter || ''}
          onChange={(e) => setScopeFilter(e.target.value || null)}
          className="text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1"
        >
          <option value="">All Scopes</option>
          <option value="session">Session</option>
          <option value="project">Project</option>
          <option value="always">Always</option>
        </select>
      </div>

      {error && <div className="text-red-400 text-sm mb-2">{error}</div>}

      {decisions.length === 0 && (
        <p className="text-[var(--color-text-muted)] text-sm">No cached decisions.</p>
      )}

      <div className="space-y-1">
        {decisions.map((d) => (
          <div key={d.id} className="flex items-center gap-2 p-2 rounded bg-[var(--color-bg-secondary)] text-xs">
            <span className="font-mono flex-1">{d.rule_id}</span>
            <span className="text-[var(--color-text-muted)]">{d.scope}</span>
            <span className={d.approved ? 'text-green-400' : 'text-red-400'}>
              {d.approved ? 'allow' : 'block'}
            </span>
            <button
              onClick={() => revoke(d.id)}
              className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-300 hover:bg-red-800/50"
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
