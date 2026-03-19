import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AuditEntry {
  id: number;
  timestamp: string;
  rule_id: string;
  rule_name: string;
  severity: string;
  action: string;
  source: string;
  content_preview: string | null;
}

interface PaginatedAuditLog {
  items: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'text-red-400',
  major: 'text-yellow-400',
  minor: 'text-blue-400',
};

const ACTION_STYLES: Record<string, string> = {
  block: 'bg-red-900/30 text-red-300',
  allow: 'bg-green-900/30 text-green-300',
};

export function AuditLog() {
  const [data, setData] = useState<PaginatedAuditLog | null>(null);
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const limit = 15;

  const fetchData = useCallback(async () => {
    try {
      const result = await invoke<PaginatedAuditLog>('get_audit_log', {
        page,
        limit,
        severity: severity || null,
      });
      setData(result);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [page, severity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Audit Log</h2>
        <select
          value={severity || ''}
          onChange={(e) => { setSeverity(e.target.value || null); setPage(1); }}
          className="text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
        </select>
      </div>

      {error && <div className="text-red-400 text-sm mb-2">{error}</div>}

      {data && data.items.length === 0 && (
        <p className="text-[var(--color-text-muted)] text-sm">No audit entries found.</p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="space-y-1">
            {data.items.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 text-xs p-2 rounded bg-[var(--color-bg-secondary)]">
                <span className="text-[var(--color-text-muted)] w-32 shrink-0">
                  {entry.timestamp?.slice(0, 19).replace('T', ' ')}
                </span>
                <span className={`w-14 shrink-0 font-medium ${SEVERITY_STYLES[entry.severity] || ''}`}>
                  {entry.severity}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${ACTION_STYLES[entry.action] || ''}`}>
                  {entry.action}
                </span>
                <span className="truncate flex-1">{entry.rule_name}</span>
                <span className="text-[var(--color-text-muted)] shrink-0">{entry.source}</span>
              </div>
            ))}
          </div>

          {data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-2 py-1 text-xs rounded bg-[var(--color-bg-secondary)] disabled:opacity-30"
              >
                Prev
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">
                {page} / {data.total_pages}
              </span>
              <button
                disabled={page >= data.total_pages}
                onClick={() => setPage(p => p + 1)}
                className="px-2 py-1 text-xs rounded bg-[var(--color-bg-secondary)] disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
