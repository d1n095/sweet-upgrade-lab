import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TranslationResult {
  translations: Record<string, string>;
}

const ALL_LANGUAGES = ['sv', 'en', 'no', 'da', 'de', 'fi', 'nl', 'fr', 'es', 'pl'] as const;

export function useAutoTranslate() {
  const [isTranslating, setIsTranslating] = useState(false);

  const translate = async (
    text: string,
    sourceLanguage: string = 'sv',
    context: string = 'e-commerce product/category'
  ): Promise<Record<string, string> | null> => {
    if (!text.trim()) return null;

    const targetLanguages = ALL_LANGUAGES.filter((l) => l !== sourceLanguage);

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke<TranslationResult>('auto-translate', {
        body: { text, sourceLanguage, targetLanguages, context },
      });

      if (error) throw error;
      if (!data?.translations) throw new Error('No translations returned');

      return data.translations;
    } catch (err) {
      console.error('Translation failed:', err);
      return null;
    } finally {
      setIsTranslating(false);
    }
  };

  return { translate, isTranslating };
}
