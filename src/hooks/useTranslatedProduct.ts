import { useMemo } from 'react';
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
  const { language } = useLanguage();

  // Treat Scandinavian languages as Swedish (mutually intelligible).
  // translate-product function has been removed; fall back to Swedish for all languages.
  const fields = useMemo(() => getSvFields(product), [product]);

  return { ...fields, isTranslating: false };
}
