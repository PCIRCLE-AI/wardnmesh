import { useState } from 'react';
import { Overview } from './Overview';
import { AuditLog } from './AuditLog';
import { RulesManager } from './RulesManager';
import { DecisionsManager } from './DecisionsManager';
import { Settings } from './Settings';

type Tab = 'overview' | 'audit' | 'rules' | 'decisions' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '\u{1F4CA}' },
  { id: 'audit', label: 'Audit Log', icon: '\u{1F4CB}' },
  { id: 'rules', label: 'Rules', icon: '\u{1F6E1}\uFE0F' },
  { id: 'decisions', label: 'Decisions', icon: '\u2705' },
  { id: 'settings', label: 'Settings', icon: '\u2699\uFE0F' },
];

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="flex h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Sidebar */}
      <aside className="w-48 border-r border-[var(--color-border)] p-3 flex flex-col gap-1">
        <h1 className="text-sm font-bold mb-3 px-2">{'\u{1F6E1}\uFE0F'} WardnMesh</h1>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`text-left text-xs px-2 py-1.5 rounded transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)] font-medium'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </aside>

      {/* Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'overview' && <Overview />}
        {activeTab === 'audit' && <AuditLog />}
        {activeTab === 'rules' && <RulesManager />}
        {activeTab === 'decisions' && <DecisionsManager />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
