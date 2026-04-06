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

// Language system: STATIC_ONLY — no external calls, no AI translation.
// All product content is served from static database fields (Swedish fallback).
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
  useLanguage(); // consumed for future static per-language DB fields; no AI involved

  // Static-only: always return fields from the database. No fetch, no AI, no invoke.
  return { ...getSvFields(product), isTranslating: false };
}