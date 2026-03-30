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

function getEnFields(product: DbProduct | null): TranslatedFields {
  if (!product) return { title: '', description: '', ingredients: '', feeling: '', effects: '', usage: '', extendedDescription: '', recipe: '' };
  const sv = getSvFields(product);
  return {
    title: product.title_en || sv.title,
    description: product.description_en || sv.description,
    ingredients: product.ingredients_en || sv.ingredients,
    feeling: product.feeling_en || sv.feeling,
    effects: product.effects_en || sv.effects,
    usage: product.usage_en || sv.usage,
    extendedDescription: product.extended_description_en || sv.extendedDescription,
    recipe: product.recipe_en || sv.recipe,
  };
}

export function useTranslatedProduct(product: DbProduct | null) {
  const { language } = useLanguage();

  // Scandinavian languages use Swedish fields; all others use English with sv fallback
  const useSv = language === 'sv' || language === 'no' || language === 'da';
  const translated = useSv ? getSvFields(product) : getEnFields(product);

  return { ...translated, isTranslating: false };
}