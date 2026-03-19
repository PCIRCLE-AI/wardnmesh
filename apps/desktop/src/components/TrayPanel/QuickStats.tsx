import { useTranslation } from 'react-i18next';
import type { AppStatus } from '../../lib/types';

interface QuickStatsProps {
  status: AppStatus;
}

export function QuickStats({ status }: QuickStatsProps) {
  const { t } = useTranslation();

  const stats = [
    {
      label: t('trayPanel.stats.blockedToday'),
      value: status.todayBlocked,
      color: status.todayBlocked > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM3.5 8a4.5 4.5 0 017.58-3.28L4.22 11.58A4.48 4.48 0 013.5 8zm4.5 4.5a4.48 4.48 0 01-3.08-.72l6.86-6.86A4.5 4.5 0 018 12.5z" />
        </svg>
      ),
    },
    {
      label: t('trayPanel.stats.toolCalls'),
      value: status.todayToolCalls,
      color: 'var(--color-text-muted)',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M14.5 1H1.5A1.5 1.5 0 000 2.5v11A1.5 1.5 0 001.5 15h13a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0014.5 1zM4 4h8v1H4V4zm0 2.5h8v1H4v-1zM4 9h5v1H4V9z" />
        </svg>
      ),
    },
    {
      label: t('trayPanel.stats.violations'),
      value: status.recentViolations?.length ?? 0,
      color: (status.recentViolations?.length ?? 0) > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1L0 15h16L8 1zm0 3l5.5 9.5h-11L8 4zm-.5 4v3h1V8h-1zm0 4v1h1v-1h-1z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-4 border-b border-[var(--color-bg-tertiary)]">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center p-2 rounded-lg bg-[var(--color-bg-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
          >
            <span style={{ color: stat.color }} className="mb-1">
              {stat.icon}
            </span>
            <span
              className="text-xl font-bold"
              style={{ color: stat.color }}
            >
              {stat.value}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)] text-center">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
