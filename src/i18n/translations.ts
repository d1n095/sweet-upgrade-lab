import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/context/LanguageContext';

export type { Language } from '@/context/LanguageContext';

/**
 * Static translation hook — resolves a key against the compiled translation table.
 * Fallback order: requested language → English → Swedish → raw key.
 * No AI or network calls are made.
 */
export function useT() {
  const { language } = useLanguage();

  const t = (key: string): string => {
    const entry = translations[key];
    if (!entry) {
      console.warn('[MISSING LANG]', key, language);
      return key;
    }
    return (entry as any)[language] ?? entry.en ?? entry.sv ?? key;
  };

  return t;
}
