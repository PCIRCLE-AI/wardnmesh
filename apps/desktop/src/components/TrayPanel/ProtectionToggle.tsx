import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Spinner } from '../Spinner';

interface ProtectionToggleProps {
  isArmed: boolean;
  onToggle: () => void;
  loading?: boolean;
}

export function ProtectionToggle({ isArmed, onToggle, loading }: ProtectionToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="p-4 border-t border-[var(--color-bg-tertiary)]">
      <button
        onClick={onToggle}
        disabled={loading}
        className={`
          w-full py-3 px-4 rounded-lg font-medium text-sm
          transition-all duration-200 flex items-center justify-center gap-2
          ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}
          ${isArmed
            ? 'bg-[var(--color-danger)]/20 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/30'
            : 'bg-[var(--color-brand)]/20 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/30'
          }
        `}
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            {isArmed ? (
              // Pause icon
              <path d="M5 3h2v10H5V3zm4 0h2v10H9V3z" />
            ) : (
              // Play/Shield icon
              <path d="M8 0L1 3v5c0 5.55 2.98 10.74 7 12 4.02-1.26 7-6.45 7-12V3L8 0z" />
            )}
          </svg>
        )}
        {isArmed ? t('common.deactivate') : t('common.activate')}
      </button>

      {/* Quick actions */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => invoke('open_dashboard').catch(() => {})}
          className="flex-1 py-2 px-3 rounded-lg text-xs font-medium
            bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]
            hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]
            transition-colors flex items-center justify-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M10.5 1.5H1.5V10.5H5.25V9H3V3H9V5.25H10.5V1.5Z" />
            <path d="M7.5 4.5L6.44 5.56L8.38 7.5H6V9H10.5V4.5H9L9 8.38L7.06 6.44L6 7.5L7.5 4.5Z" />
          </svg>
          {t('trayPanel.menu.openDashboard')}
        </button>
        <button
          onClick={() => invoke('open_external_url', { url: 'https://github.com/anthropics/wardnmesh' }).catch(() => {})}
          className="flex-1 py-2 px-3 rounded-lg text-xs font-medium
            bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]
            hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]
            transition-colors flex items-center justify-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 0C2.7 0 0 2.7 0 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6zm.75 9h-1.5V5.25h1.5V9zm0-4.5h-1.5v-1.5h1.5v1.5z" />
          </svg>
          {t('activation.needHelp').split('?')[0]}
        </button>
      </div>
    </div>
  );
}
