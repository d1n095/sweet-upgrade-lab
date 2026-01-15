import { Cpu, Shirt, Droplets, Leaf, Grid, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Category {
  id: string;
  name: { [key: string]: string };
  icon: LucideIcon;
  query?: string;
}

// These categories match storeConfig.categories
export const categories: Category[] = [
  { 
    id: 'all', 
    name: { sv: 'Alla', en: 'All', no: 'Alle', da: 'Alle', de: 'Alle', fi: 'Kaikki', nl: 'Alles', fr: 'Tout', es: 'Todo', pl: 'Wszystko' }, 
    icon: Grid,
    query: undefined
  },
  { 
    id: 'teknik', 
    name: { sv: 'Teknik', en: 'Tech', no: 'Teknologi', da: 'Teknologi', de: 'Technik', fi: 'Tekniikka', nl: 'Technologie', fr: 'Tech', es: 'Tecnología', pl: 'Technologia' }, 
    icon: Cpu,
    query: 'tag:teknik'
  },
  { 
    id: 'hampa-klader', 
    name: { sv: 'Hampa-kläder', en: 'Hemp Clothing', no: 'Hampeklær', da: 'Hampetøj', de: 'Hanf-Kleidung', fi: 'Hamppu-vaatteet', nl: 'Hennep-kleding', fr: 'Vêtements chanvre', es: 'Ropa de cáñamo', pl: 'Odzież konopna' }, 
    icon: Shirt,
    query: 'tag:hampa OR tag:klader'
  },
  { 
    id: 'kroppsvard', 
    name: { sv: 'Kroppsvård', en: 'Body Care', no: 'Kroppsvård', da: 'Kropspleje', de: 'Körperpflege', fi: 'Vartalonhoito', nl: 'Lichaamsverzorging', fr: 'Soins corporels', es: 'Cuidado corporal', pl: 'Pielęgnacja ciała' }, 
    icon: Droplets,
    query: 'tag:kroppsvard'
  },
];
