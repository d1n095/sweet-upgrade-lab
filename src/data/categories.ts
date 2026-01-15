import { Cpu, Shirt, Droplets, Grid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Category {
  id: string;
  name: { [key: string]: string };
  icon: LucideIcon;
  query?: string;
}

// Categories matching Shopify product_type values
export const categories: Category[] = [
  { 
    id: 'all', 
    name: { sv: 'Alla', en: 'All', no: 'Alle', da: 'Alle', de: 'Alle', fi: 'Kaikki', nl: 'Alles', fr: 'Tout', es: 'Todo', pl: 'Wszystko' }, 
    icon: Grid,
    query: undefined
  },
  { 
    id: 'elektronik', 
    name: { sv: 'Elektronik', en: 'Electronics', no: 'Elektronikk', da: 'Elektronik', de: 'Elektronik', fi: 'Elektroniikka', nl: 'Elektronica', fr: 'Électronique', es: 'Electrónica', pl: 'Elektronika' }, 
    icon: Cpu,
    query: 'product_type:Elektronik'
  },
  { 
    id: 'hampa-klader', 
    name: { sv: 'Hampa-kläder', en: 'Hemp Clothing', no: 'Hampeklær', da: 'Hampetøj', de: 'Hanf-Kleidung', fi: 'Hamppu-vaatteet', nl: 'Hennep-kleding', fr: 'Vêtements chanvre', es: 'Ropa de cáñamo', pl: 'Odzież konopna' }, 
    icon: Shirt,
    query: 'product_type:"Hampa-kläder"'
  },
  { 
    id: 'kroppsvard', 
    name: { sv: 'Kroppsvård', en: 'Body Care', no: 'Kroppsvård', da: 'Kropspleje', de: 'Körperpflege', fi: 'Vartalonhoito', nl: 'Lichaamsverzorging', fr: 'Soins corporels', es: 'Cuidado corporal', pl: 'Pielęgnacja ciała' }, 
    icon: Droplets,
    query: 'product_type:Kroppsvård'
  },
];
