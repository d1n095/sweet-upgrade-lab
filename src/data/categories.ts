import { Cpu, Shirt, Droplets, Leaf, Grid, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Category {
  id: string;
  name: { sv: string; en: string; no: string; da: string; de: string };
  icon: LucideIcon;
  query?: string; // Shopify search query
}

// These categories match storeConfig.categories
export const categories: Category[] = [
  { 
    id: 'all', 
    name: { sv: 'Alla', en: 'All', no: 'Alle', da: 'Alle', de: 'Alle' }, 
    icon: Grid,
    query: undefined
  },
  { 
    id: 'teknik', 
    name: { sv: 'Teknik', en: 'Tech', no: 'Teknologi', da: 'Teknologi', de: 'Technik' }, 
    icon: Cpu,
    query: 'tag:teknik'
  },
  { 
    id: 'hampa-klader', 
    name: { sv: 'Hampa-kläder', en: 'Hemp Clothing', no: 'Hampeklær', da: 'Hampetøj', de: 'Hanf-Kleidung' }, 
    icon: Shirt,
    query: 'tag:hampa OR tag:klader'
  },
  { 
    id: 'kroppsvard', 
    name: { sv: 'Kroppsvård', en: 'Body Care', no: 'Kroppsvård', da: 'Kropspleje', de: 'Körperpflege' }, 
    icon: Droplets,
    query: 'tag:kroppsvard'
  },
];
