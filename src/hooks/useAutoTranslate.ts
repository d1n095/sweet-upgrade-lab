import { useState } from 'react';

export interface TranslationResult {
  translations: Record<string, string>;
}

/**
 * Simple translation hook — returns the source text as-is for all target languages.
 * The admin can manually fill in translations for each language.
 * No AI API calls are made.
 */
export function useAutoTranslate() {
  const [isTranslating] = useState(false);

  const translate = async (
    text: string,
    sourceLanguage: string = 'sv',
    _context: string = 'e-commerce product/category'
  ): Promise<Record<string, string> | null> => {
    if (!text.trim()) return null;

    // Return the source text for all languages — admin can edit manually
    const allLanguages = ['sv', 'en', 'no', 'da', 'de', 'fi', 'nl', 'fr', 'es', 'pl'];
    const translations: Record<string, string> = {};
    for (const lang of allLanguages) {
      translations[lang] = text;
    }
    return translations;
  };

  return { translate, isTranslating };
}
