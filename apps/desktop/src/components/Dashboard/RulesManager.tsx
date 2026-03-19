import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface RuleWithState {
  rule_id: string;
  enabled: boolean;
  custom_severity: string | null;
}

export function RulesManager() {
  const [rules, setRules] = useState<RuleWithState[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      const result = await invoke<RuleWithState[]>('get_all_rules');
      setRules(result);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await invoke('toggle_rule', { ruleId, enabled });
      setRules(prev => prev.map(r => r.rule_id === ruleId ? { ...r, enabled } : r));
    } catch (err) {
      setError(String(err));
    }
  };

  const filtered = rules.filter(r =>
    r.rule_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Rules ({rules.length})</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rules..."
          className="text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1 w-48"
        />
      </div>

      {error && <div className="text-red-400 text-sm mb-2">{error}</div>}

      <div className="space-y-1 max-h-[500px] overflow-y-auto">
        {filtered.map((rule) => (
          <div key={rule.rule_id} className="flex items-center justify-between p-2 rounded bg-[var(--color-bg-secondary)]">
            <span className="text-xs font-mono">{rule.rule_id}</span>
            <button
              onClick={() => toggleRule(rule.rule_id, !rule.enabled)}
              className={`text-xs px-2 py-0.5 rounded ${
                rule.enabled
                  ? 'bg-green-900/30 text-green-300'
                  : 'bg-red-900/30 text-red-300'
              }`}
            >
              {rule.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
