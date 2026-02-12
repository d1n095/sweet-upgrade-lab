import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Send, Check, TrendingDown, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type LangKey = 'sv' | 'en' | 'no' | 'da' | 'de' | 'fi' | 'nl' | 'fr' | 'es' | 'pl';

// Product category-specific properties with full 10-language coverage
const categoryProperties: Record<string, Record<LangKey, string[]>> = {
  deodorant: {
    sv: ['Bra för känslig hud', 'Utan aluminium', 'Utan parfym', 'Utan alkohol', 'Naturliga ingredienser', 'Långvarig effekt'],
    en: ['Good for sensitive skin', 'Aluminum-free', 'Fragrance-free', 'Alcohol-free', 'Natural ingredients', 'Long-lasting'],
    no: ['Bra for sensitiv hud', 'Uten aluminium', 'Uten parfyme', 'Uten alkohol', 'Naturlige ingredienser', 'Langvarig effekt'],
    da: ['God til sensitiv hud', 'Uden aluminium', 'Uden parfume', 'Uden alkohol', 'Naturlige ingredienser', 'Langvarig effekt'],
    de: ['Gut für empfindliche Haut', 'Aluminiumfrei', 'Parfümfrei', 'Alkoholfrei', 'Natürliche Inhaltsstoffe', 'Langanhaltend'],
    fi: ['Hyvä herkälle iholle', 'Alumiiniton', 'Hajusteeton', 'Alkoholiton', 'Luonnolliset ainesosat', 'Pitkäkestoinen'],
    nl: ['Goed voor gevoelige huid', 'Aluminiumvrij', 'Geurvrij', 'Alcoholvrij', 'Natuurlijke ingrediënten', 'Langdurig'],
    fr: ['Bon pour peaux sensibles', 'Sans aluminium', 'Sans parfum', 'Sans alcool', 'Ingrédients naturels', 'Longue durée'],
    es: ['Bueno para piel sensible', 'Sin aluminio', 'Sin fragancia', 'Sin alcohol', 'Ingredientes naturales', 'Larga duración'],
    pl: ['Dobry dla wrażliwej skóry', 'Bez aluminium', 'Bez zapachu', 'Bez alkoholu', 'Naturalne składniki', 'Długotrwały'],
  },
  soap: {
    sv: ['Handgjord', 'Parfymfri', 'Återfuktande', 'Exfolierande', 'För alla hudtyper', 'Naturliga oljor'],
    en: ['Handmade', 'Fragrance-free', 'Moisturizing', 'Exfoliating', 'For all skin types', 'Natural oils'],
    no: ['Håndlaget', 'Parfymefri', 'Fuktighetsgivende', 'Eksfolierende', 'For alle hudtyper', 'Naturlige oljer'],
    da: ['Håndlavet', 'Parfumefri', 'Fugtgivende', 'Eksfolierende', 'Til alle hudtyper', 'Naturlige olier'],
    de: ['Handgemacht', 'Parfümfrei', 'Feuchtigkeitsspendend', 'Peeling', 'Für alle Hauttypen', 'Natürliche Öle'],
    fi: ['Käsintehty', 'Hajusteeton', 'Kosteuttava', 'Kuoriva', 'Kaikille ihotyypeille', 'Luonnolliset öljyt'],
    nl: ['Handgemaakt', 'Geurvrij', 'Vochtinbrengend', 'Exfoliërend', 'Voor alle huidtypes', 'Natuurlijke oliën'],
    fr: ['Fait main', 'Sans parfum', 'Hydratant', 'Exfoliant', 'Pour tous types de peau', 'Huiles naturelles'],
    es: ['Hecho a mano', 'Sin fragancia', 'Hidratante', 'Exfoliante', 'Para todos los tipos de piel', 'Aceites naturales'],
    pl: ['Ręcznie robione', 'Bez zapachu', 'Nawilżające', 'Złuszczające', 'Dla wszystkich typów skóry', 'Naturalne olejki'],
  },
  shampoo: {
    sv: ['Sulfatfri', 'Silikonfri', 'Vegansk', 'För torrt hår', 'För fett hår', 'Mot mjäll', 'Volymgivande'],
    en: ['Sulfate-free', 'Silicone-free', 'Vegan', 'For dry hair', 'For oily hair', 'Anti-dandruff', 'Volumizing'],
    no: ['Sulfatfri', 'Silikonfri', 'Vegansk', 'For tørt hår', 'For fett hår', 'Mot flass', 'Volumgivende'],
    da: ['Sulfatfri', 'Silikonfri', 'Vegansk', 'Til tørt hår', 'Til fedtet hår', 'Mod skæl', 'Volumgivende'],
    de: ['Sulfatfrei', 'Silikonfrei', 'Vegan', 'Für trockenes Haar', 'Für fettiges Haar', 'Anti-Schuppen', 'Volumengebend'],
    fi: ['Sulfaatiton', 'Silikoniton', 'Vegaaninen', 'Kuiville hiuksille', 'Rasvaisille hiuksille', 'Hilseenpoisto', 'Tuuheuttava'],
    nl: ['Sulfaatvrij', 'Siliconenvrij', 'Veganistisch', 'Voor droog haar', 'Voor vet haar', 'Anti-roos', 'Volumegevend'],
    fr: ['Sans sulfate', 'Sans silicone', 'Végan', 'Pour cheveux secs', 'Pour cheveux gras', 'Antipelliculaire', 'Volumisant'],
    es: ['Sin sulfatos', 'Sin silicona', 'Vegano', 'Para cabello seco', 'Para cabello graso', 'Anticaspa', 'Voluminizador'],
    pl: ['Bez siarczanów', 'Bez silikonu', 'Wegański', 'Do suchych włosów', 'Do przetłuszczających', 'Przeciwłupieżowy', 'Dodający objętości'],
  },
  cream: {
    sv: ['Intensiv fukt', 'Lätt konsistens', 'Doftneutral', 'Med SPF', 'Anti-age', 'Nattkräm', 'Dagkräm'],
    en: ['Intense moisture', 'Light texture', 'Fragrance-neutral', 'With SPF', 'Anti-aging', 'Night cream', 'Day cream'],
    no: ['Intens fuktighet', 'Lett konsistens', 'Duftnøytral', 'Med SPF', 'Anti-age', 'Nattkrem', 'Dagkrem'],
    da: ['Intens fugt', 'Let konsistens', 'Duftneutral', 'Med SPF', 'Anti-age', 'Natcreme', 'Dagcreme'],
    de: ['Intensive Feuchtigkeit', 'Leichte Textur', 'Duftneutral', 'Mit LSF', 'Anti-Aging', 'Nachtcreme', 'Tagescreme'],
    fi: ['Intensiivinen kosteutus', 'Kevyt koostumus', 'Hajusteeton', 'SPF:llä', 'Anti-age', 'Yövoide', 'Päivävoide'],
    nl: ['Intense hydratatie', 'Lichte textuur', 'Geurneutraal', 'Met SPF', 'Anti-aging', 'Nachtcrème', 'Dagcrème'],
    fr: ['Hydratation intense', 'Texture légère', 'Neutre en parfum', 'Avec SPF', 'Anti-âge', 'Crème de nuit', 'Crème de jour'],
    es: ['Hidratación intensa', 'Textura ligera', 'Sin fragancia', 'Con SPF', 'Antiedad', 'Crema de noche', 'Crema de día'],
    pl: ['Intensywne nawilżenie', 'Lekka konsystencja', 'Bezzapachowy', 'Z SPF', 'Anti-age', 'Krem na noc', 'Krem na dzień'],
  },
  candle: {
    sv: ['Bivax', 'Sojavax', 'Rapsvax', 'Bomullsveke', 'Parfymfri', 'Eteriska oljor', 'Lång brinntid'],
    en: ['Beeswax', 'Soy wax', 'Rapeseed wax', 'Cotton wick', 'Fragrance-free', 'Essential oils', 'Long burn time'],
    no: ['Bivoks', 'Soyavoks', 'Rapsvoks', 'Bomullsveke', 'Parfymefri', 'Eteriske oljer', 'Lang brenntid'],
    da: ['Bivoks', 'Sojavoks', 'Rapsvoks', 'Bomuldsvæge', 'Parfumefri', 'Æteriske olier', 'Lang brændetid'],
    de: ['Bienenwachs', 'Sojawachs', 'Rapswachs', 'Baumwolldocht', 'Parfümfrei', 'Ätherische Öle', 'Lange Brenndauer'],
    fi: ['Mehiläisvaha', 'Soijavaha', 'Rypsivaha', 'Puuvillasydän', 'Hajusteeton', 'Eteeriset öljyt', 'Pitkä paloaika'],
    nl: ['Bijenwas', 'Sojawas', 'Koolzaadwas', 'Katoenen lont', 'Geurvrij', 'Essentiële oliën', 'Lange brandtijd'],
    fr: ['Cire d\'abeille', 'Cire de soja', 'Cire de colza', 'Mèche coton', 'Sans parfum', 'Huiles essentielles', 'Longue durée'],
    es: ['Cera de abejas', 'Cera de soja', 'Cera de colza', 'Mecha de algodón', 'Sin fragancia', 'Aceites esenciales', 'Larga duración'],
    pl: ['Wosk pszczeli', 'Wosk sojowy', 'Wosk rzepakowy', 'Knot bawełniany', 'Bez zapachu', 'Olejki eteryczne', 'Długi czas palenia'],
  },
  clothing: {
    sv: ['Ekologisk bomull', 'Hampa', 'Linne', 'Återvunnet material', 'GOTS-certifierad', 'OEKO-TEX', 'Fair Trade'],
    en: ['Organic cotton', 'Hemp', 'Linen', 'Recycled material', 'GOTS certified', 'OEKO-TEX', 'Fair Trade'],
    no: ['Økologisk bomull', 'Hamp', 'Lin', 'Gjenvunnet materiale', 'GOTS-sertifisert', 'OEKO-TEX', 'Fair Trade'],
    da: ['Økologisk bomuld', 'Hamp', 'Hør', 'Genbrugt materiale', 'GOTS-certificeret', 'OEKO-TEX', 'Fair Trade'],
    de: ['Bio-Baumwolle', 'Hanf', 'Leinen', 'Recyceltes Material', 'GOTS-zertifiziert', 'OEKO-TEX', 'Fair Trade'],
    fi: ['Luomupuuvilla', 'Hamppu', 'Pellava', 'Kierrätetty materiaali', 'GOTS-sertifioitu', 'OEKO-TEX', 'Reilu kauppa'],
    nl: ['Biologisch katoen', 'Hennep', 'Linnen', 'Gerecycled materiaal', 'GOTS-gecertificeerd', 'OEKO-TEX', 'Fair Trade'],
    fr: ['Coton bio', 'Chanvre', 'Lin', 'Matériau recyclé', 'Certifié GOTS', 'OEKO-TEX', 'Commerce équitable'],
    es: ['Algodón orgánico', 'Cáñamo', 'Lino', 'Material reciclado', 'Certificado GOTS', 'OEKO-TEX', 'Comercio justo'],
    pl: ['Bawełna organiczna', 'Konopie', 'Len', 'Materiał z recyklingu', 'Certyfikat GOTS', 'OEKO-TEX', 'Fair Trade'],
  },
  electronics: {
    sv: ['Lång batteritid', 'Snabbladdning', 'USB-C', 'Vattentålig', 'Solcellsdriven', 'Energieffektiv', 'Hållbart material'],
    en: ['Long battery life', 'Fast charging', 'USB-C', 'Water resistant', 'Solar powered', 'Energy efficient', 'Durable material'],
    no: ['Lang batteritid', 'Hurtiglading', 'USB-C', 'Vanntett', 'Soldrevet', 'Energieffektiv', 'Holdbart materiale'],
    da: ['Lang batteritid', 'Hurtig opladning', 'USB-C', 'Vandafvisende', 'Soldrevet', 'Energieffektiv', 'Holdbart materiale'],
    de: ['Lange Akkulaufzeit', 'Schnellladung', 'USB-C', 'Wasserfest', 'Solarbetrieben', 'Energieeffizient', 'Langlebiges Material'],
    fi: ['Pitkä akun kesto', 'Pikalataus', 'USB-C', 'Vedenkestävä', 'Aurinkokäyttöinen', 'Energiatehokas', 'Kestävä materiaali'],
    nl: ['Lange batterijduur', 'Snel opladen', 'USB-C', 'Waterbestendig', 'Zonne-energie', 'Energiezuinig', 'Duurzaam materiaal'],
    fr: ['Longue autonomie', 'Charge rapide', 'USB-C', 'Résistant à l\'eau', 'Solaire', 'Économe en énergie', 'Matériau durable'],
    es: ['Larga duración de batería', 'Carga rápida', 'USB-C', 'Resistente al agua', 'Solar', 'Eficiente energéticamente', 'Material duradero'],
    pl: ['Długi czas pracy baterii', 'Szybkie ładowanie', 'USB-C', 'Wodoodporny', 'Zasilany słonecznie', 'Energooszczędny', 'Trwały materiał'],
  },
};

// Certifications with 10-language coverage
const certifications: Record<LangKey, string[]> = {
  sv: ['Ekologisk', 'Vegansk', 'Allergivänlig', 'Hållbar', 'Giftfri', 'Svensktillverkad', 'EU-tillverkad', 'Fair Trade', 'GOTS', 'OEKO-TEX', 'Kravmärkt', 'Naturlig'],
  en: ['Organic', 'Vegan', 'Allergy-friendly', 'Sustainable', 'Toxin-free', 'Swedish made', 'EU made', 'Fair Trade', 'GOTS', 'OEKO-TEX', 'KRAV certified', 'Natural'],
  no: ['Økologisk', 'Vegansk', 'Allergievennlig', 'Bærekraftig', 'Giftfri', 'Norskprodusert', 'EU-produsert', 'Fair Trade', 'GOTS', 'OEKO-TEX', 'Krav-merket', 'Naturlig'],
  da: ['Økologisk', 'Vegansk', 'Allergivenlig', 'Bæredygtig', 'Giftfri', 'Dansk produceret', 'EU-produceret', 'Fair Trade', 'GOTS', 'OEKO-TEX', 'Krav-mærket', 'Naturlig'],
  de: ['Bio', 'Vegan', 'Allergikerfreundlich', 'Nachhaltig', 'Schadstofffrei', 'Made in Germany', 'Made in EU', 'Fair Trade', 'GOTS', 'OEKO-TEX', 'KRAV-zertifiziert', 'Natürlich'],
  fi: ['Luomu', 'Vegaaninen', 'Allergiaystävällinen', 'Kestävä', 'Myrkytön', 'Suomessa valmistettu', 'EU:ssa valmistettu', 'Reilu kauppa', 'GOTS', 'OEKO-TEX', 'KRAV-sertifioitu', 'Luonnollinen'],
  nl: ['Biologisch', 'Veganistisch', 'Allergievriendelijk', 'Duurzaam', 'Gifvrij', 'Nederlands gemaakt', 'EU-gemaakt', 'Fair Trade', 'GOTS', 'OEKO-TEX', 'KRAV-gecertificeerd', 'Natuurlijk'],
  fr: ['Bio', 'Végan', 'Hypoallergénique', 'Durable', 'Sans toxines', 'Fabriqué en France', 'Fabriqué en UE', 'Commerce équitable', 'GOTS', 'OEKO-TEX', 'Certifié KRAV', 'Naturel'],
  es: ['Orgánico', 'Vegano', 'Hipoalergénico', 'Sostenible', 'Sin tóxicos', 'Hecho en España', 'Hecho en UE', 'Comercio justo', 'GOTS', 'OEKO-TEX', 'Certificado KRAV', 'Natural'],
  pl: ['Organiczny', 'Wegański', 'Hipoalergiczny', 'Zrównoważony', 'Bez toksyn', 'Made in Poland', 'Made in EU', 'Fair Trade', 'GOTS', 'OEKO-TEX', 'Certyfikat KRAV', 'Naturalny'],
};

// Product type options with 10-language coverage
const productTypeOptions: Record<LangKey, { value: string; label: string }[]> = {
  sv: [
    { value: 'deodorant', label: 'Deodorant' },
    { value: 'soap', label: 'Tvål' },
    { value: 'shampoo', label: 'Schampo' },
    { value: 'cream', label: 'Kräm' },
    { value: 'candle', label: 'Ljus' },
    { value: 'clothing', label: 'Kläder' },
    { value: 'electronics', label: 'Elektronik' },
    { value: 'other', label: 'Annat' },
  ],
  en: [
    { value: 'deodorant', label: 'Deodorant' },
    { value: 'soap', label: 'Soap' },
    { value: 'shampoo', label: 'Shampoo' },
    { value: 'cream', label: 'Cream' },
    { value: 'candle', label: 'Candle' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'other', label: 'Other' },
  ],
  no: [
    { value: 'deodorant', label: 'Deodorant' },
    { value: 'soap', label: 'Såpe' },
    { value: 'shampoo', label: 'Sjampo' },
    { value: 'cream', label: 'Krem' },
    { value: 'candle', label: 'Stearinlys' },
    { value: 'clothing', label: 'Klær' },
    { value: 'electronics', label: 'Elektronikk' },
    { value: 'other', label: 'Annet' },
  ],
  da: [
    { value: 'deodorant', label: 'Deodorant' },
    { value: 'soap', label: 'Sæbe' },
    { value: 'shampoo', label: 'Shampoo' },
    { value: 'cream', label: 'Creme' },
    { value: 'candle', label: 'Stearinlys' },
    { value: 'clothing', label: 'Tøj' },
    { value: 'electronics', label: 'Elektronik' },
    { value: 'other', label: 'Andet' },
  ],
  de: [
    { value: 'deodorant', label: 'Deodorant' },
    { value: 'soap', label: 'Seife' },
    { value: 'shampoo', label: 'Shampoo' },
    { value: 'cream', label: 'Creme' },
    { value: 'candle', label: 'Kerze' },
    { value: 'clothing', label: 'Kleidung' },
    { value: 'electronics', label: 'Elektronik' },
    { value: 'other', label: 'Sonstiges' },
  ],
  fi: [
    { value: 'deodorant', label: 'Deodorantti' },
    { value: 'soap', label: 'Saippua' },
    { value: 'shampoo', label: 'Shampoo' },
    { value: 'cream', label: 'Voide' },
    { value: 'candle', label: 'Kynttilä' },
    { value: 'clothing', label: 'Vaatteet' },
    { value: 'electronics', label: 'Elektroniikka' },
    { value: 'other', label: 'Muu' },
  ],
  nl: [
    { value: 'deodorant', label: 'Deodorant' },
    { value: 'soap', label: 'Zeep' },
    { value: 'shampoo', label: 'Shampoo' },
    { value: 'cream', label: 'Crème' },
    { value: 'candle', label: 'Kaars' },
    { value: 'clothing', label: 'Kleding' },
    { value: 'electronics', label: 'Elektronica' },
    { value: 'other', label: 'Anders' },
  ],
  fr: [
    { value: 'deodorant', label: 'Déodorant' },
    { value: 'soap', label: 'Savon' },
    { value: 'shampoo', label: 'Shampooing' },
    { value: 'cream', label: 'Crème' },
    { value: 'candle', label: 'Bougie' },
    { value: 'clothing', label: 'Vêtements' },
    { value: 'electronics', label: 'Électronique' },
    { value: 'other', label: 'Autre' },
  ],
  es: [
    { value: 'deodorant', label: 'Desodorante' },
    { value: 'soap', label: 'Jabón' },
    { value: 'shampoo', label: 'Champú' },
    { value: 'cream', label: 'Crema' },
    { value: 'candle', label: 'Vela' },
    { value: 'clothing', label: 'Ropa' },
    { value: 'electronics', label: 'Electrónica' },
    { value: 'other', label: 'Otro' },
  ],
  pl: [
    { value: 'deodorant', label: 'Dezodorant' },
    { value: 'soap', label: 'Mydło' },
    { value: 'shampoo', label: 'Szampon' },
    { value: 'cream', label: 'Krem' },
    { value: 'candle', label: 'Świeca' },
    { value: 'clothing', label: 'Odzież' },
    { value: 'electronics', label: 'Elektronika' },
    { value: 'other', label: 'Inne' },
  ],
};

const ProductSuggestions = () => {
  const { language } = useLanguage();
  const lang = (language || 'en') as LangKey;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    productCategory: '',
    productName: '',
    properties: [] as string[],
    customProperties: '',
    usage: '',
    certifications: [] as string[],
    email: '',
  });

  const content: Record<LangKey, {
    title: string;
    subtitle: string;
    description: string;
    categoryLabel: string;
    categoryPlaceholder: string;
    productNameLabel: string;
    productNamePlaceholder: string;
    propertiesLabel: string;
    propertiesHint: string;
    customPropertiesLabel: string;
    customPropertiesPlaceholder: string;
    usageLabel: string;
    usagePlaceholder: string;
    certificationsLabel: string;
    emailLabel: string;
    emailPlaceholder: string;
    submit: string;
    success: string;
    successDescription: string;
    benefits: string[];
    sendMore: string;
  }> = {
    sv: {
      title: 'Önska en produkt',
      subtitle: 'Hjälp oss hitta rätt produkter',
      description: 'Berätta vad du letar efter! Vi bryr oss inte om märken - vi vill veta vilken typ av produkt och vilka egenskaper som är viktiga för dig. Då kan vi hitta eller ta fram en bättre och billigare version.',
      categoryLabel: 'Vad är det för typ av produkt?',
      categoryPlaceholder: 'Välj produktkategori',
      productNameLabel: 'Beskriv produkten (valfritt)',
      productNamePlaceholder: 'T.ex. En naturlig deodorant för vardagsbruk',
      propertiesLabel: 'Vilka egenskaper är viktiga?',
      propertiesHint: 'Klicka på de egenskaper som passar eller skriv egna nedan',
      customPropertiesLabel: 'Andra egenskaper',
      customPropertiesPlaceholder: 'Beskriv andra egenskaper som är viktiga för dig...',
      usageLabel: 'Vad ska du använda produkten till?',
      usagePlaceholder: 'T.ex. Daglig användning, träning, som present, till barn...',
      certificationsLabel: 'Viktiga certifieringar/egenskaper:',
      emailLabel: 'Din e-post (valfritt)',
      emailPlaceholder: 'Vi meddelar dig när produkten finns',
      submit: 'Skicka önskemål',
      success: 'Tack för ditt önskemål!',
      successDescription: 'Vi har tagit emot din förfrågan och kommer undersöka möjligheterna att ta fram en produkt som passar dina behov.',
      benefits: ['Vi hittar bättre alternativ', 'Lägre pris än märkesprodukter', 'Fokus på funktion, inte varumärke'],
      sendMore: 'Skicka fler önskemål',
    },
    en: {
      title: 'Request a product',
      subtitle: 'Help us find the right products',
      description: "Tell us what you're looking for! We don't care about brands - we want to know what type of product and what properties matter to you. Then we can find or create a better and cheaper version.",
      categoryLabel: 'What type of product is it?',
      categoryPlaceholder: 'Select product category',
      productNameLabel: 'Describe the product (optional)',
      productNamePlaceholder: 'E.g. A natural deodorant for everyday use',
      propertiesLabel: 'What properties are important?',
      propertiesHint: 'Click the properties that apply or add your own below',
      customPropertiesLabel: 'Other properties',
      customPropertiesPlaceholder: 'Describe other properties that are important to you...',
      usageLabel: 'What will you use the product for?',
      usagePlaceholder: 'E.g. Daily use, workouts, as a gift, for children...',
      certificationsLabel: 'Important certifications/properties:',
      emailLabel: 'Your email (optional)',
      emailPlaceholder: "We'll notify you when available",
      submit: 'Submit request',
      success: 'Thanks for your request!',
      successDescription: 'We have received your request and will investigate how to find a product that fits your needs.',
      benefits: ['We find better alternatives', 'Lower price than branded products', 'Focus on function, not brand'],
      sendMore: 'Send more requests',
    },
    no: {
      title: 'Ønsk et produkt',
      subtitle: 'Hjelp oss finne riktige produkter',
      description: 'Fortell oss hva du leter etter! Vi bryr oss ikke om merker - vi vil vite hvilken type produkt og hvilke egenskaper som er viktige for deg.',
      categoryLabel: 'Hva slags produkt er det?',
      categoryPlaceholder: 'Velg produktkategori',
      productNameLabel: 'Beskriv produktet (valgfritt)',
      productNamePlaceholder: 'F.eks. En naturlig deodorant for daglig bruk',
      propertiesLabel: 'Hvilke egenskaper er viktige?',
      propertiesHint: 'Klikk på egenskapene som passer eller legg til egne nedenfor',
      customPropertiesLabel: 'Andre egenskaper',
      customPropertiesPlaceholder: 'Beskriv andre egenskaper som er viktige for deg...',
      usageLabel: 'Hva skal du bruke produktet til?',
      usagePlaceholder: 'F.eks. Daglig bruk, trening, som gave...',
      certificationsLabel: 'Viktige sertifiseringer:',
      emailLabel: 'Din e-post (valgfritt)',
      emailPlaceholder: 'Vi varsler deg når produktet er tilgjengelig',
      submit: 'Send ønske',
      success: 'Takk for ønsket ditt!',
      successDescription: 'Vi har mottatt forespørselen din og vil undersøke mulighetene.',
      benefits: ['Vi finner bedre alternativer', 'Lavere pris', 'Fokus på funksjon'],
      sendMore: 'Send flere ønsker',
    },
    da: {
      title: 'Ønsk et produkt',
      subtitle: 'Hjælp os med at finde de rigtige produkter',
      description: 'Fortæl os hvad du leder efter! Vi er ligeglade med mærker - vi vil vide hvilken type produkt og hvilke egenskaper der er vigtige for dig.',
      categoryLabel: 'Hvad er det for en type produkt?',
      categoryPlaceholder: 'Vælg produktkategori',
      productNameLabel: 'Beskriv produktet (valgfrit)',
      productNamePlaceholder: 'F.eks. En naturlig deodorant til daglig brug',
      propertiesLabel: 'Hvilke egenskaber er vigtige?',
      propertiesHint: 'Klik på de egenskaber der passer eller tilføj dine egne nedenfor',
      customPropertiesLabel: 'Andre egenskaber',
      customPropertiesPlaceholder: 'Beskriv andre egenskaber der er vigtige for dig...',
      usageLabel: 'Hvad skal du bruge produktet til?',
      usagePlaceholder: 'F.eks. Daglig brug, træning, som gave...',
      certificationsLabel: 'Vigtige certificeringer:',
      emailLabel: 'Din e-mail (valgfrit)',
      emailPlaceholder: 'Vi giver besked når produktet er tilgængeligt',
      submit: 'Send ønske',
      success: 'Tak for dit ønske!',
      successDescription: 'Vi har modtaget din anmodning og vil undersøge mulighederne.',
      benefits: ['Vi finder bedre alternativer', 'Lavere pris', 'Fokus på funktion'],
      sendMore: 'Send flere ønsker',
    },
    de: {
      title: 'Produkt wünschen',
      subtitle: 'Helfen Sie uns, die richtigen Produkte zu finden',
      description: 'Erzählen Sie uns, was Sie suchen! Marken sind uns egal - wir möchten wissen, welche Art von Produkt und welche Eigenschaften für Sie wichtig sind.',
      categoryLabel: 'Was für ein Produkt ist es?',
      categoryPlaceholder: 'Produktkategorie wählen',
      productNameLabel: 'Beschreiben Sie das Produkt (optional)',
      productNamePlaceholder: 'Z.B. Ein natürliches Deodorant für den täglichen Gebrauch',
      propertiesLabel: 'Welche Eigenschaften sind wichtig?',
      propertiesHint: 'Klicken Sie auf die passenden Eigenschaften oder fügen Sie unten eigene hinzu',
      customPropertiesLabel: 'Andere Eigenschaften',
      customPropertiesPlaceholder: 'Beschreiben Sie andere Eigenschaften, die Ihnen wichtig sind...',
      usageLabel: 'Wofür werden Sie das Produkt verwenden?',
      usagePlaceholder: 'Z.B. Täglicher Gebrauch, Sport, als Geschenk...',
      certificationsLabel: 'Wichtige Zertifizierungen:',
      emailLabel: 'Ihre E-Mail (optional)',
      emailPlaceholder: 'Wir benachrichtigen Sie, wenn verfügbar',
      submit: 'Wunsch senden',
      success: 'Danke für Ihren Wunsch!',
      successDescription: 'Wir haben Ihre Anfrage erhalten und werden die Möglichkeiten prüfen.',
      benefits: ['Wir finden bessere Alternativen', 'Niedrigerer Preis', 'Fokus auf Funktion'],
      sendMore: 'Weitere Wünsche senden',
    },
    fi: {
      title: 'Toivo tuotetta',
      subtitle: 'Auta meitä löytämään oikeat tuotteet',
      description: 'Kerro meille mitä etsit! Emme välitä merkeistä - haluamme tietää millainen tuote ja mitkä ominaisuudet ovat sinulle tärkeitä.',
      categoryLabel: 'Millainen tuote on kyseessä?',
      categoryPlaceholder: 'Valitse tuotekategoria',
      productNameLabel: 'Kuvaile tuotetta (valinnainen)',
      productNamePlaceholder: 'Esim. Luonnollinen deodorantti päivittäiseen käyttöön',
      propertiesLabel: 'Mitkä ominaisuudet ovat tärkeitä?',
      propertiesHint: 'Napsauta sopivia ominaisuuksia tai lisää omia alla',
      customPropertiesLabel: 'Muut ominaisuudet',
      customPropertiesPlaceholder: 'Kuvaile muita tärkeitä ominaisuuksia...',
      usageLabel: 'Mihin käytät tuotetta?',
      usagePlaceholder: 'Esim. Päivittäinen käyttö, urheilu, lahjaksi...',
      certificationsLabel: 'Tärkeät sertifikaatit:',
      emailLabel: 'Sähköpostisi (valinnainen)',
      emailPlaceholder: 'Ilmoitamme kun tuote on saatavilla',
      submit: 'Lähetä toive',
      success: 'Kiitos toiveestasi!',
      successDescription: 'Olemme vastaanottaneet pyyntösi ja tutkimme mahdollisuuksia.',
      benefits: ['Löydämme parempia vaihtoehtoja', 'Halvempi hinta', 'Fokus toiminnassa'],
      sendMore: 'Lähetä lisää toiveita',
    },
    nl: {
      title: 'Vraag een product aan',
      subtitle: 'Help ons de juiste producten te vinden',
      description: 'Vertel ons wat je zoekt! Merken interesseren ons niet - we willen weten welk type product en welke eigenschappen belangrijk voor je zijn.',
      categoryLabel: 'Wat voor soort product is het?',
      categoryPlaceholder: 'Selecteer productcategorie',
      productNameLabel: 'Beschrijf het product (optioneel)',
      productNamePlaceholder: 'Bijv. Een natuurlijke deodorant voor dagelijks gebruik',
      propertiesLabel: 'Welke eigenschappen zijn belangrijk?',
      propertiesHint: 'Klik op de eigenschappen die van toepassing zijn of voeg hieronder je eigen toe',
      customPropertiesLabel: 'Andere eigenschappen',
      customPropertiesPlaceholder: 'Beschrijf andere eigenschappen die belangrijk voor je zijn...',
      usageLabel: 'Waarvoor ga je het product gebruiken?',
      usagePlaceholder: 'Bijv. Dagelijks gebruik, sport, als cadeau...',
      certificationsLabel: 'Belangrijke certificeringen:',
      emailLabel: 'Je e-mail (optioneel)',
      emailPlaceholder: 'We laten je weten wanneer beschikbaar',
      submit: 'Verzoek verzenden',
      success: 'Bedankt voor je verzoek!',
      successDescription: 'We hebben je verzoek ontvangen en zullen de mogelijkheden onderzoeken.',
      benefits: ['We vinden betere alternatieven', 'Lagere prijs', 'Focus op functie'],
      sendMore: 'Meer verzoeken verzenden',
    },
    fr: {
      title: 'Demander un produit',
      subtitle: 'Aidez-nous à trouver les bons produits',
      description: 'Dites-nous ce que vous cherchez ! Les marques ne nous intéressent pas - nous voulons savoir quel type de produit et quelles propriétés sont importantes pour vous.',
      categoryLabel: 'Quel type de produit est-ce ?',
      categoryPlaceholder: 'Sélectionner une catégorie',
      productNameLabel: 'Décrivez le produit (optionnel)',
      productNamePlaceholder: 'Ex. Un déodorant naturel pour un usage quotidien',
      propertiesLabel: 'Quelles propriétés sont importantes ?',
      propertiesHint: 'Cliquez sur les propriétés qui s\'appliquent ou ajoutez les vôtres ci-dessous',
      customPropertiesLabel: 'Autres propriétés',
      customPropertiesPlaceholder: 'Décrivez d\'autres propriétés importantes pour vous...',
      usageLabel: 'À quoi allez-vous utiliser le produit ?',
      usagePlaceholder: 'Ex. Usage quotidien, sport, cadeau...',
      certificationsLabel: 'Certifications importantes :',
      emailLabel: 'Votre email (optionnel)',
      emailPlaceholder: 'Nous vous préviendrons quand disponible',
      submit: 'Envoyer la demande',
      success: 'Merci pour votre demande !',
      successDescription: 'Nous avons reçu votre demande et allons explorer les possibilités.',
      benefits: ['Nous trouvons de meilleures alternatives', 'Prix plus bas', 'Focus sur la fonction'],
      sendMore: 'Envoyer plus de demandes',
    },
    es: {
      title: 'Solicitar un producto',
      subtitle: 'Ayúdanos a encontrar los productos adecuados',
      description: '¡Cuéntanos qué buscas! No nos importan las marcas - queremos saber qué tipo de producto y qué propiedades son importantes para ti.',
      categoryLabel: '¿Qué tipo de producto es?',
      categoryPlaceholder: 'Seleccionar categoría',
      productNameLabel: 'Describe el producto (opcional)',
      productNamePlaceholder: 'Ej. Un desodorante natural para uso diario',
      propertiesLabel: '¿Qué propiedades son importantes?',
      propertiesHint: 'Haz clic en las propiedades que aplican o añade las tuyas abajo',
      customPropertiesLabel: 'Otras propiedades',
      customPropertiesPlaceholder: 'Describe otras propiedades importantes para ti...',
      usageLabel: '¿Para qué usarás el producto?',
      usagePlaceholder: 'Ej. Uso diario, deporte, regalo...',
      certificationsLabel: 'Certificaciones importantes:',
      emailLabel: 'Tu email (opcional)',
      emailPlaceholder: 'Te avisaremos cuando esté disponible',
      submit: 'Enviar solicitud',
      success: '¡Gracias por tu solicitud!',
      successDescription: 'Hemos recibido tu solicitud y exploraremos las posibilidades.',
      benefits: ['Encontramos mejores alternativas', 'Precio más bajo', 'Enfoque en función'],
      sendMore: 'Enviar más solicitudes',
    },
    pl: {
      title: 'Zaproponuj produkt',
      subtitle: 'Pomóż nam znaleźć odpowiednie produkty',
      description: 'Powiedz nam czego szukasz! Nie zależy nam na markach - chcemy wiedzieć jaki typ produktu i jakie właściwości są dla Ciebie ważne.',
      categoryLabel: 'Jaki to typ produktu?',
      categoryPlaceholder: 'Wybierz kategorię produktu',
      productNameLabel: 'Opisz produkt (opcjonalnie)',
      productNamePlaceholder: 'Np. Naturalny dezodorant do codziennego użytku',
      propertiesLabel: 'Jakie właściwości są ważne?',
      propertiesHint: 'Kliknij pasujące właściwości lub dodaj własne poniżej',
      customPropertiesLabel: 'Inne właściwości',
      customPropertiesPlaceholder: 'Opisz inne ważne dla Ciebie właściwości...',
      usageLabel: 'Do czego będziesz używać produktu?',
      usagePlaceholder: 'Np. Codzienne użycie, sport, prezent...',
      certificationsLabel: 'Ważne certyfikaty:',
      emailLabel: 'Twój email (opcjonalnie)',
      emailPlaceholder: 'Powiadomimy gdy będzie dostępny',
      submit: 'Wyślij prośbę',
      success: 'Dziękujemy za prośbę!',
      successDescription: 'Otrzymaliśmy Twoje zgłoszenie i zbadamy możliwości.',
      benefits: ['Znajdujemy lepsze alternatywy', 'Niższa cena', 'Skupiamy się na funkcji'],
      sendMore: 'Wyślij więcej próśb',
    },
  };

  const t = content[lang] || content.en;
  const currentCertifications = certifications[lang] || certifications.en;
  const currentProductTypes = productTypeOptions[lang] || productTypeOptions.en;
  const currentCategoryProperties = formData.productCategory && categoryProperties[formData.productCategory]
    ? categoryProperties[formData.productCategory][lang] || categoryProperties[formData.productCategory].en
    : [];

  const toggleProperty = (prop: string) => {
    setFormData(prev => ({
      ...prev,
      properties: prev.properties.includes(prop)
        ? prev.properties.filter(p => p !== prop)
        : [...prev.properties, prop],
    }));
  };

  const toggleCertification = (cert: string) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter(c => c !== cert)
        : [...prev.certifications, cert],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productCategory) {
      toast.error(lang === 'sv' ? 'Välj en produktkategori' : 'Please select a product category');
      return;
    }

    setIsSubmitting(true);

    try {
      const message = [
        `Kategori: ${formData.productCategory}`,
        formData.productName ? `Beskrivning: ${formData.productName}` : '',
        formData.properties.length > 0 ? `Egenskaper: ${formData.properties.join(', ')}` : '',
        formData.customProperties ? `Andra egenskaper: ${formData.customProperties}` : '',
        formData.usage ? `Användning: ${formData.usage}` : '',
        formData.certifications.length > 0 ? `Certifieringar: ${formData.certifications.join(', ')}` : '',
      ].filter(Boolean).join('\n\n');

      const { error } = await supabase.from('interest_logs').insert({
        interest_type: 'product_suggestion',
        message,
        email: formData.email || null,
        category: formData.productCategory,
      });

      if (error) throw error;

      setIsSubmitted(true);
      setFormData({ productCategory: '', productName: '', properties: [], customProperties: '', usage: '', certifications: [], email: '' });
      toast.success(t.success);
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      toast.error(lang === 'sv' ? 'Kunde inte skicka förslaget' : 'Could not submit suggestion');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-background via-secondary/20 to-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent mb-4">
              <Lightbulb className="w-4 h-4" />
              <span className="text-sm font-medium">{t.subtitle}</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold mb-4">{t.title}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{t.description}</p>
          </div>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {t.benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-full text-sm"
              >
                <TrendingDown className="w-4 h-4 text-primary" />
                <span>{benefit}</span>
              </motion.div>
            ))}
          </div>

          {/* Form */}
          {isSubmitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-2xl p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">{t.success}</h3>
              <p className="text-muted-foreground mb-6">{t.successDescription}</p>
              <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                {t.sendMore}
              </Button>
            </motion.div>
          ) : (
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-2xl p-6 md:p-8"
            >
              <div className="space-y-6">
                {/* Product Category */}
                <div>
                  <Label className="text-base font-medium mb-2 block">{t.categoryLabel} *</Label>
                  <Select
                    value={formData.productCategory}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, productCategory: value, properties: [] }))}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder={t.categoryPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {currentProductTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Product Description */}
                <div>
                  <Label className="text-base font-medium mb-2 block">{t.productNameLabel}</Label>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    {lang === 'sv' 
                      ? 'Beskriv vad produkten gör, vilka egenskaper den har, och varför just den produkten. T.ex. "En deodorant som är bra för känslig hud och doftar lavendel" eller "Ett ljus av bivax med lång brinntid".'
                      : 'Describe what the product does, its properties, and why this specific product. E.g. "A deodorant good for sensitive skin with lavender scent" or "A beeswax candle with long burn time".'}
                  </p>
                  <Textarea
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    placeholder={t.productNamePlaceholder}
                    rows={3}
                  />
                </div>

                {/* Category-specific properties */}
                {currentCategoryProperties.length > 0 && (
                  <div>
                    <Label className="text-base font-medium mb-2 block">{t.propertiesLabel}</Label>
                    <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      {t.propertiesHint}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {currentCategoryProperties.map((prop) => (
                        <label
                          key={prop}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer transition-all ${
                            formData.properties.includes(prop)
                              ? 'bg-primary/10 border-primary text-primary'
                              : 'bg-secondary/30 border-border hover:bg-secondary/50'
                          }`}
                        >
                          <Checkbox
                            checked={formData.properties.includes(prop)}
                            onCheckedChange={() => toggleProperty(prop)}
                            className="hidden"
                          />
                          <span className="text-sm font-medium">{prop}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom properties */}
                <div>
                  <Label className="text-base font-medium mb-2 block">{t.customPropertiesLabel}</Label>
                  <Textarea
                    value={formData.customProperties}
                    onChange={(e) => setFormData({ ...formData, customProperties: e.target.value })}
                    placeholder={t.customPropertiesPlaceholder}
                    rows={3}
                  />
                </div>

                {/* Usage */}
                <div>
                  <Label className="text-base font-medium mb-2 block">{t.usageLabel}</Label>
                  <Input
                    value={formData.usage}
                    onChange={(e) => setFormData({ ...formData, usage: e.target.value })}
                    placeholder={t.usagePlaceholder}
                    className="h-12"
                  />
                </div>

                {/* Certifications */}
                <div>
                  <Label className="text-base font-medium mb-3 block">{t.certificationsLabel}</Label>
                  <div className="flex flex-wrap gap-3">
                    {currentCertifications.map((cert) => (
                      <label
                        key={cert}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer transition-all ${
                          formData.certifications.includes(cert)
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-secondary/30 border-border hover:bg-secondary/50'
                        }`}
                      >
                        <Checkbox
                          checked={formData.certifications.includes(cert)}
                          onCheckedChange={() => toggleCertification(cert)}
                          className="hidden"
                        />
                        <span className="text-sm font-medium">{cert}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <Label className="text-base font-medium mb-2 block">{t.emailLabel}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t.emailPlaceholder}
                    className="h-12"
                  />
                </div>

                <Button type="submit" size="lg" className="w-full h-14 text-base gap-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      {t.submit}
                    </>
                  )}
                </Button>
              </div>
            </motion.form>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default ProductSuggestions;
