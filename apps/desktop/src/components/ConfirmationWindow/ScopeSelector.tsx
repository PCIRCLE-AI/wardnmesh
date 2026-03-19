import { useTranslation } from 'react-i18next';

type Scope = 'once' | 'session' | 'project' | 'always';

interface ScopeSelectorProps {
  value: Scope;
  onChange: (scope: Scope) => void;
}

const SCOPES: { value: Scope; labelKey: string; descKey: string }[] = [
  { value: 'once', labelKey: 'confirmation.scope.once', descKey: 'confirmation.scope.onceDesc' },
  { value: 'session', labelKey: 'confirmation.scope.session', descKey: 'confirmation.scope.sessionDesc' },
  { value: 'project', labelKey: 'confirmation.scope.project', descKey: 'confirmation.scope.projectDesc' },
  { value: 'always', labelKey: 'confirmation.scope.always', descKey: 'confirmation.scope.alwaysDesc' },
];

export function ScopeSelector({ value, onChange }: ScopeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1.5">
      {SCOPES.map((scope) => (
        <label
          key={scope.value}
          className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
            value === scope.value
              ? 'bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/30'
              : 'hover:bg-[var(--color-bg-secondary)]'
          }`}
        >
          <input
            type="radio"
            name="scope"
            value={scope.value}
            checked={value === scope.value}
            onChange={() => onChange(scope.value)}
            className="accent-[var(--color-brand)]"
          />
          <div>
            <span className="text-sm font-medium">{t(scope.labelKey, scope.value)}</span>
            <p className="text-xs text-[var(--color-text-muted)]">{t(scope.descKey, '')}</p>
          </div>
        </label>
      ))}
    </div>
  );
}
