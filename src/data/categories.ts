import { Shirt, Droplets, Sparkles, Leaf, Grid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Category {
  id: string;
  name: { sv: string; en: string };
  icon: LucideIcon;
  query?: string; // Shopify search query
}

export const categories: Category[] = [
  { 
    id: 'all', 
    name: { sv: 'Alla produkter', en: 'All products' }, 
    icon: Grid,
    query: undefined
  },
  { 
    id: 'clothing', 
    name: { sv: 'Kläder', en: 'Clothing' }, 
    icon: Shirt,
    query: 'product_type:Clothing OR tag:kläder OR tag:hampa OR tag:bomull'
  },
  { 
    id: 'skincare', 
    name: { sv: 'Hudvård', en: 'Skincare' }, 
    icon: Sparkles,
    query: 'product_type:Skincare OR tag:hudvård OR tag:skincare'
  },
  { 
    id: 'hygiene', 
    name: { sv: 'Hygien', en: 'Hygiene' }, 
    icon: Droplets,
    query: 'product_type:Hygiene OR tag:hygien OR tag:tvål OR tag:schampo'
  },
  { 
    id: 'sustainable', 
    name: { sv: 'Hållbart', en: 'Sustainable' }, 
    icon: Leaf,
    query: 'tag:hållbart OR tag:sustainable OR tag:eco'
  },
];
