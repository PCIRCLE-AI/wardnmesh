import { useTranslation } from 'react-i18next';
import { useWardnState } from '../../hooks/useWardnState';
import { Spinner } from '../Spinner';
import { StatusHeader } from './StatusHeader';
import { QuickStats } from './QuickStats';
import { ViolationList } from './ViolationList';
import { ProtectionToggle } from './ProtectionToggle';

export function TrayPanel() {
  const { t } = useTranslation();
  const {
    status,
    loading,
    error,
    toggling,
    toggleProtection,
  } = useWardnState();

  if (loading) {
    return (
      <div className="tray-panel flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-2 text-[var(--color-brand)]" />
          <p className="text-sm text-[var(--color-text-muted)]">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tray-panel flex flex-col">
      {error && (
        <div className="px-4 py-2 bg-[var(--color-danger)]/10 border-b border-[var(--color-danger)]/20">
          <p className="text-xs text-[var(--color-danger)] text-center">
            {error}
          </p>
        </div>
      )}
      <StatusHeader status={status} />
      <QuickStats status={status} />
      <ViolationList violations={status.recentViolations} />
      <ProtectionToggle
        isArmed={status.isArmed}
        onToggle={toggleProtection}
        loading={toggling}
      />
    </div>
  );
}
