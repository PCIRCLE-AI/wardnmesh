import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface DashboardStats {
  total_scans: number;
  total_blocks: number;
  total_allows: number;
  rules_enabled: number;
  rules_disabled: number;
  active_sessions: number;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
      <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

export function Overview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<DashboardStats>('get_stats')
      .then(setStats)
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <div className="p-4 text-[var(--color-danger)]">Failed to load stats: {error}</div>;
  }

  if (!stats) {
    return <div className="p-4 text-[var(--color-text-muted)]">Loading...</div>;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Overview</h2>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Scans" value={stats.total_scans} color="text-[var(--color-text-primary)]" />
        <StatCard label="Blocked" value={stats.total_blocks} color="text-red-400" />
        <StatCard label="Allowed" value={stats.total_allows} color="text-green-400" />
        <StatCard label="Active Sessions" value={stats.active_sessions} color="text-blue-400" />
        <StatCard label="Rules Enabled" value={stats.rules_enabled} color="text-[var(--color-text-primary)]" />
        <StatCard label="Rules Disabled" value={stats.rules_disabled} color="text-yellow-400" />
      </div>
    </div>
  );
}
