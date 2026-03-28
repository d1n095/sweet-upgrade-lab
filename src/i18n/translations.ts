export type EULanguage =
  | 'sv' | 'en' | 'fi' | 'da' | 'no'
  | 'de' | 'fr' | 'es' | 'nl' | 'pl'
  | 'it' | 'pt' | 'ro' | 'cs' | 'hu'
  | 'el' | 'sk' | 'bg' | 'hr' | 'sl'
  | 'lt' | 'lv' | 'et' | 'mt' | 'ga';

export type TranslationMap = Record<string, string>;

export const translations: Record<EULanguage, TranslationMap> = {
  sv: {
    products: 'Produkter',
    categories: 'Kategorier',
    settings: 'Inställningar',
  },
  en: {
    products: 'Products',
    categories: 'Categories',
    settings: 'Settings',
  },
  fi: {},
  da: {},
  no: {},
  de: {},
  fr: {},
  es: {},
  nl: {},
  pl: {},
  it: {},
  pt: {},
  ro: {},
  cs: {},
  hu: {},
  el: {},
  sk: {},
  bg: {},
  hr: {},
  sl: {},
  lt: {},
  lv: {},
  et: {},
  mt: {},
  ga: {},
};

export function t(lang: string, key: string): string {
  return (translations as Record<string, TranslationMap>)[lang]?.[key]
    || translations['en']?.[key]
    || key;
}
