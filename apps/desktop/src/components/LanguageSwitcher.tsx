import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n/config';

const languageNames: Record<string, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  ja: '日本語',
  es: 'Español',
  fr: 'Français',
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div className="language-switcher">
      <select
        value={i18n.language}
        onChange={handleLanguageChange}
        className="w-full px-3 py-2 rounded-lg text-xs
          bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)]
          text-[var(--color-text)]
          focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]
          transition-colors cursor-pointer"
        aria-label="Select language"
      >
        {supportedLanguages.map((lang) => (
          <option key={lang} value={lang}>
            {languageNames[lang]}
          </option>
        ))}
      </select>
    </div>
  );
}
