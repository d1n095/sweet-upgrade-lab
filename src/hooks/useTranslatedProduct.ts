import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeInvoke } from '@/lib/safeInvoke';
import { useLanguage } from '@/context/LanguageContext';
import type { DbProduct } from '@/lib/products';

interface TranslatedFields {
  title: string;
  description: string;
  ingredients: string;
  feeling: string;
  effects: string;
  usage: string;
  extendedDescription: string;
  recipe: string;
}

// Simple in-memory cache: productId+lang -> translated fields
const translationCache = new Map<string, TranslatedFields>();

function getSvFields(product: DbProduct | null): TranslatedFields {
  if (!product) return { title: '', description: '', ingredients: '', feeling: '', effects: '', usage: '', extendedDescription: '', recipe: '' };
  return {
    title: product.title_sv,
    description: product.description_sv || '',
    ingredients: product.ingredients_sv || '',
    feeling: product.feeling_sv || '',
    effects: product.effects_sv || '',
    usage: product.usage_sv || '',
    extendedDescription: product.extended_description_sv || '',
    recipe: product.recipe_sv || '',
  };
}

export function useTranslatedProduct(product: DbProduct | null) {
  // Use the ACTUAL language (de, fr, etc.), not contentLang which only returns sv/en
  const { language } = useLanguage();

  // Treat Scandinavian languages as Swedish (mutually intelligible)
  const lang = (language === 'no' || language === 'da') ? 'sv' : language;

  const svFields = getSvFields(product);
  const [translated, setTranslated] = useState<TranslatedFields>(svFields);
  const [isTranslating, setIsTranslating] = useState(false);
  const activeRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!product || lang === 'sv') {
      setTranslated(getSvFields(product));
      return;
    }

    const cacheKey = `${product.id}_${lang}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      setTranslated(cached);
      return;
    }

    // Build texts to translate (only non-empty)
    const fields = getSvFields(product);
    const textsToTranslate: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value) textsToTranslate[key] = value;
    }

    if (Object.keys(textsToTranslate).length === 0) {
      setTranslated(fields);
      return;
    }

    activeRequestRef.current = cacheKey;
    setIsTranslating(true);

    (async () => {
      try {
        const { data, error } = await safeInvoke({
          action: 'TRANSLATE_PRODUCT',
          fn: 'translate-product',
          body: { texts: textsToTranslate, targetLang: lang, productId: product.id },
        });

        // Only update if this is still the active request
        if (activeRequestRef.current !== cacheKey) return;

        if (error || !data?.translations) {
          console.error('Translation failed:', error);
          setTranslated(fields);
        } else {
          const result: TranslatedFields = {
            title: data.translations.title || fields.title,
            description: data.translations.description || fields.description,
            ingredients: data.translations.ingredients || fields.ingredients,
            feeling: data.translations.feeling || fields.feeling,
            effects: data.translations.effects || fields.effects,
            usage: data.translations.usage || fields.usage,
            extendedDescription: data.translations.extendedDescription || fields.extendedDescription,
            recipe: data.translations.recipe || fields.recipe,
          };
          translationCache.set(cacheKey, result);
          setTranslated(result);
        }
      } catch (err) {
        if (activeRequestRef.current === cacheKey) {
          console.error('Translation error:', err);
          setTranslated(fields);
        }
      } finally {
        if (activeRequestRef.current === cacheKey) {
          setIsTranslating(false);
        }
      }
    })();

    return () => {
      activeRequestRef.current = null;
    };
  }, [product?.id, lang]);

  return { ...translated, isTranslating };
}