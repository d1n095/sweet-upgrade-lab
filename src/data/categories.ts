import { Cpu, Shirt, Droplets, Grid, Flame, Flame as SaunaIcon, Sparkles, Gem, Bed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Category {
  id: string;
  name: { [key: string]: string };
  icon: LucideIcon;
  query?: string;
  isBestsellerFilter?: boolean;
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
    id: 'bestsaljare', 
    name: { sv: 'Bästsäljare', en: 'Bestsellers', no: 'Bestselgere', da: 'Bestsellere', de: 'Bestseller', fi: 'Bestsellerit', nl: 'Bestsellers', fr: 'Meilleures ventes', es: 'Más vendidos', pl: 'Bestsellery' }, 
    icon: Flame,
    isBestsellerFilter: true
  },
  { 
    id: 'elektronik', 
    name: { sv: 'Elektronik', en: 'Electronics', no: 'Elektronikk', da: 'Elektronik', de: 'Elektronik', fi: 'Elektroniikka', nl: 'Elektronica', fr: 'Électronique', es: 'Electrónica', pl: 'Elektronika' }, 
    icon: Cpu,
    query: 'product_type:Elektronik'
  },
  { 
    id: 'klader', 
    name: { sv: 'Mode', en: 'Fashion', no: 'Mote', da: 'Mode', de: 'Mode', fi: 'Muoti', nl: 'Mode', fr: 'Mode', es: 'Moda', pl: 'Moda' }, 
    icon: Shirt,
    query: 'product_type:"Hampa-kläder" OR product_type:Kläder'
  },
  { 
    id: 'kroppsvard', 
    name: { sv: 'Kroppsvård', en: 'Body Care', no: 'Kroppsvård', da: 'Kropspleje', de: 'Körperpflege', fi: 'Vartalonhoito', nl: 'Lichaamsverzorging', fr: 'Soins corporels', es: 'Cuidado corporal', pl: 'Pielęgnacja ciała' }, 
    icon: Droplets,
    query: 'product_type:Kroppsvård'
  },
  { 
    id: 'ljus', 
    name: { sv: 'Ljus', en: 'Candles', no: 'Lys', da: 'Lys', de: 'Kerzen', fi: 'Kynttilät', nl: 'Kaarsen', fr: 'Bougies', es: 'Velas', pl: 'Świece' }, 
    icon: Sparkles,
    query: 'product_type:Ljus'
  },
  { 
    id: 'smycken', 
    name: { sv: 'Smycken & Silver', en: 'Jewelry & Silver', no: 'Smykker', da: 'Smykker', de: 'Schmuck', fi: 'Korut', nl: 'Sieraden', fr: 'Bijoux', es: 'Joyas', pl: 'Biżuteria' }, 
    icon: Gem,
    query: 'product_type:Smycken'
  },
  { 
    id: 'bastudofter', 
    name: { sv: 'Bastudofter', en: 'Sauna Scents', no: 'Badstudufter', da: 'Saunadufte', de: 'Saunadüfte', fi: 'Saunatuoksut', nl: 'Saunageuren', fr: 'Parfums sauna', es: 'Aromas sauna', pl: 'Zapachy do sauny' }, 
    icon: SaunaIcon,
    query: 'product_type:Bastudofter'
  },
  { 
    id: 'hem-textil', 
    name: { sv: 'Hemtextil', en: 'Home Textiles', no: 'Hjemmetekstil', da: 'Hjemmetekstil', de: 'Heimtextilien', fi: 'Kodintekstiilit', nl: 'Woontextiel', fr: 'Textiles maison', es: 'Textiles hogar', pl: 'Tekstylia domowe' }, 
    icon: Bed,
    query: 'product_type:Hemtextil OR product_type:Sängkläder OR product_type:Handdukar OR product_type:Filtar'
  },
];
