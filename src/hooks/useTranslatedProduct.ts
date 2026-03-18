import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export function useTranslatedProduct(product: DbProduct | null) {
  const { contentLang } = useLanguage();
  const lang = contentLang;

  // Swedish defaults (always available)
  const svFields: TranslatedFields = product ? {
    title: product.title_sv,
    description: product.description_sv || '',
    ingredients: product.ingredients_sv || '',
    feeling: product.feeling_sv || '',
    effects: product.effects_sv || '',
    usage: product.usage_sv || '',
    extendedDescription: product.extended_description_sv || '',
    recipe: product.recipe_sv || '',
  } : { title: '', description: '', ingredients: '', feeling: '', effects: '', usage: '', extendedDescription: '', recipe: '' };

  const [translated, setTranslated] = useState<TranslatedFields>(svFields);
  const [isTranslating, setIsTranslating] = useState(false);

  const translate = useCallback(async () => {
    if (!product || lang === 'sv') {
      setTranslated(svFields);
      return;
    }

    const cacheKey = `${product.id}_${lang}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      setTranslated(cached);
      return;
    }

    // Build texts to translate (only non-empty)
    const textsToTranslate: Record<string, string> = {};
    if (svFields.title) textsToTranslate.title = svFields.title;
    if (svFields.description) textsToTranslate.description = svFields.description;
    if (svFields.ingredients) textsToTranslate.ingredients = svFields.ingredients;
    if (svFields.feeling) textsToTranslate.feeling = svFields.feeling;
    if (svFields.effects) textsToTranslate.effects = svFields.effects;
    if (svFields.usage) textsToTranslate.usage = svFields.usage;
    if (svFields.extendedDescription) textsToTranslate.extendedDescription = svFields.extendedDescription;
    if (svFields.recipe) textsToTranslate.recipe = svFields.recipe;

    if (Object.keys(textsToTranslate).length === 0) {
      setTranslated(svFields);
      return;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-product', {
        body: { texts: textsToTranslate, targetLang: lang },
      });

      if (error || !data?.translations) {
        console.error('Translation failed:', error);
        setTranslated(svFields);
      } else {
        const result: TranslatedFields = {
          title: data.translations.title || svFields.title,
          description: data.translations.description || svFields.description,
          ingredients: data.translations.ingredients || svFields.ingredients,
          feeling: data.translations.feeling || svFields.feeling,
          effects: data.translations.effects || svFields.effects,
          usage: data.translations.usage || svFields.usage,
          extendedDescription: data.translations.extendedDescription || svFields.extendedDescription,
          recipe: data.translations.recipe || svFields.recipe,
        };
        translationCache.set(cacheKey, result);
        setTranslated(result);
      }
    } catch (err) {
      console.error('Translation error:', err);
      setTranslated(svFields);
    } finally {
      setIsTranslating(false);
    }
  }, [product?.id, lang]);

  useEffect(() => {
    if (lang === 'sv') {
      setTranslated(svFields);
    } else {
      translate();
    }
  }, [product?.id, lang]);

  return { ...translated, isTranslating };
}
