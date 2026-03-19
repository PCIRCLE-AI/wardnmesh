import { useTranslation } from 'react-i18next';
import type { AppStatus } from '../../lib/types';
import logoImage from '../../assets/logo.png';

interface StatusHeaderProps {
  status: AppStatus;
}

export function StatusHeader({ status }: StatusHeaderProps) {
  const { t } = useTranslation();
  const isProtected = status.protected && status.isArmed;

  return (
    <div className="p-4 border-b border-[var(--color-bg-tertiary)]">
      <div className="flex items-center gap-3">
        {/* WardnMesh Logo */}
        <div className={`relative ${isProtected ? 'pulse-glow' : ''}`}>
          <img
            src={logoImage}
            alt="WardnMesh Logo"
            width="48"
            height="48"
            className="transition-all duration-300 rounded-lg"
          />
        </div>

        <div className="flex-1">
          <h1 className="text-lg font-semibold text-[var(--color-text)]">
            {t('common.appName')}
          </h1>
          <p className={`text-sm ${isProtected ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]'}`}>
            {isProtected ? t('trayPanel.protectedTitle') : t('trayPanel.unprotectedTitle')}
          </p>
          {/* API Key Status Indicator */}
          {status.hasApiKey && (
            <div className="flex items-center gap-1 mt-1" title="API Key securely stored in system keychain">
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="text-green-500"
              >
                <path
                  d="M10 3L4.5 8.5L2 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-xs text-green-500">API Key Stored</span>
            </div>
          )}
        </div>

        {/* Status badge */}
        <div className={`
          px-2 py-1 rounded-full text-xs font-medium
          ${isProtected
            ? 'bg-[var(--color-brand)]/20 text-[var(--color-brand)]'
            : 'bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)]'
          }
        `}>
          {t(`trayPanel.protectionLevels.${status.protectionLevel}`)}
        </div>
      </div>
    </div>
  );
}
