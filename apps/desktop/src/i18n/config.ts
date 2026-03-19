import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import en from './locales/en.json';
import zhTW from './locales/zh-TW.json';
import ja from './locales/ja.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

export const resources = {
  en: { translation: en },
  'zh-TW': { translation: zhTW },
  ja: { translation: ja },
  es: { translation: es },
  fr: { translation: fr },
} as const;

export const supportedLanguages = ['en', 'zh-TW', 'ja', 'es', 'fr'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
