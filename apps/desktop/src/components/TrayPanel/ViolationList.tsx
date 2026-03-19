import { useTranslation } from 'react-i18next';
import type { Violation, ThreatLevel } from '../../lib/types';
import { formatTimeAgo } from '../../lib/helpers';

interface ViolationListProps {
  violations: Violation[];
}

const threatColors: Record<ThreatLevel, string> = {
  CRITICAL: 'var(--color-danger)',
  HIGH: '#ff6666',
  MEDIUM: 'var(--color-warning)',
  LOW: '#ffcc00',
  INFO: 'var(--color-text-muted)',
};

const actionColors: Record<string, string> = {
  BLOCKED: 'var(--color-danger)',
  WARNED: 'var(--color-warning)',
  ALLOWED: 'var(--color-success)',
};

export function ViolationList({ violations }: ViolationListProps) {
  const { t } = useTranslation();

  if (!violations || violations.length === 0) {
    return (
      <div className="p-4 flex-1">
        <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
          {t('trayPanel.violations.title')}
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-muted)]">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor" className="opacity-30 mb-2">
            <path d="M16 2L2 8v8c0 9.55 5.97 18.44 14 22 8.03-3.56 14-12.45 14-22V8L16 2zm0 4l10 4.44V16c0 7.15-4.42 13.83-10 16.95-5.58-3.12-10-9.8-10-16.95v-7.56L16 6z" />
          </svg>
          <p className="text-xs">{t('trayPanel.violations.empty')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex-1 overflow-y-auto">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">
        {t('trayPanel.violations.title')} ({violations.length})
      </h3>
      <div className="space-y-2">
        {violations.slice(0, 5).map((violation, index) => (
          <div
            key={violation.id || `violation-${index}`}
            className="p-3 rounded-lg bg-[var(--color-bg-secondary)] fade-in hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                {/* Threat level indicator */}
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: threatColors[violation.threatLevel] }}
                />
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {violation.toolName}
                </span>
              </div>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: `${actionColors[violation.action]}20`,
                  color: actionColors[violation.action],
                }}
              >
                {t(`trayPanel.violations.actions.${violation.action}`)}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-1">
              {violation.reason}
            </p>
            <span className="text-[10px] text-[var(--color-text-muted)] opacity-60">
              {formatTimeAgo(violation.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
