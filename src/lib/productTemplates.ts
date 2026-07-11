/**
 * Rule-based product templates. Zero AI, zero credits.
 * Given category + name + a couple of hints, we deterministically
 * generate description, hook, effects, usage, tags and SEO.
 */

export type TemplateKey =
  | 'bastudofter'
  | 'hudvard'
  | 'kosttillskott'
  | 'ljus'
  | 'cbd'
  | 'hemtextil'
  | 'smycken'
  | 'mode'
  | 'elektronik'
  | 'generic';

export interface TemplateAsk {
  key: string;
  question: string;
  placeholder?: string;
  optional?: boolean;
  chips?: string[]; // quick suggestion chips
}

export interface TemplateOutput {
  description: string;
  hook: string;
  extendedDescription: string;
  effects: string;
  usage: string;
  ingredients?: string;
  storage?: string;
  safety?: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  tags: string[];
  productType: string;
  prebuyNote: string;
  weightGrams?: number;
}

export interface ProductTemplate {
  key: TemplateKey;
  label: string;
  emoji: string;
  productType: string; // matches productCategories value
  detect: string[]; // keywords in title that pick this
  asks: TemplateAsk[]; // template-specific follow-up asks
  build: (title: string, price: string, extras: Record<string, string>) => TemplateOutput;
}

const seoKeywords = (base: string[]) => base.map(s => s.toLowerCase()).join(', ');
const cleanTitle = (t: string) => t.trim().replace(/\s+/g, ' ');

const TEMPLATES: ProductTemplate[] = [
  {
    key: 'bastudofter',
    label: 'Bastudoft',
    emoji: '🧖',
    productType: 'Bastudofter',
    detect: ['bastu', 'sauna', 'aufguss', 'bastudoft', 'löyly'],
    asks: [
      { key: 'scent', question: 'Vilken doft?', placeholder: 't.ex. Eukalyptus & Mynta', chips: ['Eukalyptus', 'Mynta', 'Björk', 'Tallbarr', 'Lavendel', 'Menthol'] },
      { key: 'volume', question: 'Storlek (ml)?', placeholder: '250', chips: ['100', '250', '500', '1000'], optional: true },
    ],
    build: (title, _price, x) => {
      const scent = x.scent || 'Naturlig';
      const vol = x.volume ? `${x.volume} ml` : '';
      const t = cleanTitle(title);
      return {
        description: `${t} — en handblandad bastudoft med ${scent.toLowerCase()}. Släpp ångan, andas in och låt bastun bli en riktig upplevelse.`,
        hook: `Bastu som doftar ${scent.toLowerCase()}. Naturligt, kraftfullt, svensktillverkat.`,
        extendedDescription: `Vår ${t.toLowerCase()} är framtagen för dig som vill lyfta bastuupplevelsen. Doften av ${scent.toLowerCase()} sprids jämnt i bastun och skapar en ren, uppfriskande atmosfär. Endast naturliga eteriska oljor — inga syntetiska tillsatser.`,
        effects: `• Renar och friskar upp luften\n• Djupare andning och avslappning\n• Behaglig, långvarig doft`,
        usage: `Blanda 1–2 kapsyler i en hink vatten (ca 3–5 liter). Häll på heta stenar i portioner. Justera efter smak.`,
        storage: `Förvaras svalt och mörkt. Skaka före användning.`,
        safety: `Endast för utvärtes bruk. Undvik direkt kontakt med hud och ögon.`,
        metaTitle: `${t} — Naturlig bastudoft ${vol}`.trim(),
        metaDescription: `${t} med ${scent.toLowerCase()}. Handblandad bastudoft utan syntetiska tillsatser. Fri frakt över 500 kr.`,
        metaKeywords: seoKeywords(['bastudoft', scent, 'sauna', 'aufguss', 'eterisk olja', t]),
        tags: ['bastu', 'naturlig', 'aromaterapi', scent.toLowerCase()],
        productType: 'Bastudofter',
        prebuyNote: `Vi förbereder nästa batch av ${t}. Reservera din flaska nu — inga pengar dras.`,
        weightGrams: x.volume ? parseInt(x.volume) + 50 : 300,
      };
    },
  },
  {
    key: 'hudvard',
    label: 'Hudvård / Kroppsvård',
    emoji: '🧴',
    productType: 'Kroppsvård',
    detect: ['tvål', 'schampo', 'balsam', 'lotion', 'kräm', 'serum', 'ansikt', 'hud', 'body', 'olja'],
    asks: [
      { key: 'skin', question: 'Vilken hudtyp passar den för?', chips: ['Torr hud', 'Fet hud', 'Känslig hud', 'Alla hudtyper'], optional: true },
      { key: 'scent', question: 'Doft?', placeholder: 't.ex. Lavendel', optional: true },
    ],
    build: (title, _price, x) => {
      const t = cleanTitle(title);
      const skin = x.skin || 'Alla hudtyper';
      const scent = x.scent || 'mild naturlig';
      return {
        description: `${t} — mild och effektiv hudvård för ${skin.toLowerCase()}. Fri från parabener, sulfater och parfym. Endast rena, giftfria råvaror.`,
        hook: `Ren hudvård. Inga onödiga tillsatser.`,
        extendedDescription: `${t} är formulerad för att ge huden det den faktiskt behöver — inget mer. Vi använder ${scent.toLowerCase()} doft och råvaror som du kan uttala. Passar ${skin.toLowerCase()}.`,
        effects: `• Återfuktar och mjukgör\n• Skyddar hudens naturliga barriär\n• Giftfri, vegansk formula`,
        usage: `Applicera på ren hud morgon och kväll. Massera in i cirkulära rörelser.`,
        storage: `Förvaras i rumstemperatur. Undvik direkt solljus.`,
        safety: `Endast för utvärtes bruk. Vid rodnad, avbryt användning.`,
        metaTitle: `${t} — Naturlig hudvård`,
        metaDescription: `${t}. Naturlig, giftfri hudvård för ${skin.toLowerCase()}. Vegansk och svensktillverkad.`,
        metaKeywords: seoKeywords(['hudvård', 'naturlig', 'vegansk', 'giftfri', skin, t]),
        tags: ['hudvård', 'naturlig', 'vegansk', 'giftfri'],
        productType: 'Kroppsvård',
        prebuyNote: `Nästa batch av ${t} är på väg. Reservera din — vi hör av oss när den släpps.`,
        weightGrams: 200,
      };
    },
  },
  {
    key: 'kosttillskott',
    label: 'Kosttillskott',
    emoji: '💊',
    productType: 'Kroppsvård',
    detect: ['vitamin', 'magnesium', 'kollagen', 'omega', 'protein', 'kosttillskott', 'tillskott'],
    asks: [
      { key: 'dose', question: 'Rekommenderad daglig dos?', placeholder: 't.ex. 2 kapslar', chips: ['1 kapsel', '2 kapslar', '1 tsk', '1 msk'] },
      { key: 'count', question: 'Antal per förpackning?', placeholder: '60', optional: true },
    ],
    build: (title, _price, x) => {
      const t = cleanTitle(title);
      const dose = x.dose || '1–2 kapslar';
      const count = x.count ? `${x.count} st per förpackning` : '';
      return {
        description: `${t} — rent kosttillskott utan onödiga tillsatser. ${count}`,
        hook: `Rent tillskott. Ingen fyllnad.`,
        extendedDescription: `${t} är framtaget för att stötta din vardag med de byggstenar din kropp behöver. Ingen konstgjord färg, inga onödiga bindemedel.`,
        effects: `• Stödjer normal funktion\n• Ren formula utan tillsatser\n• Testat och kvalitetssäkrat`,
        usage: `${dose} dagligen tillsammans med måltid och vatten.`,
        storage: `Förvaras svalt och torrt, utom räckhåll för barn.`,
        safety: `Överskrid inte rekommenderad dos. Kosttillskott ersätter inte en varierad kost.`,
        metaTitle: `${t} — Kosttillskott`,
        metaDescription: `${t}. Rent kosttillskott, ${dose} per dag. Fri frakt över 500 kr.`,
        metaKeywords: seoKeywords(['kosttillskott', 'naturlig', t]),
        tags: ['kosttillskott', 'hälsa', 'naturlig'],
        productType: 'Kroppsvård',
        prebuyNote: `Nästa batch av ${t} tillverkas nu. Reservera din — inga pengar dras.`,
        weightGrams: 150,
      };
    },
  },
  {
    key: 'ljus',
    label: 'Doftljus',
    emoji: '🕯️',
    productType: 'Ljus',
    detect: ['ljus', 'candle', 'doftljus', 'stearin', 'sojavax'],
    asks: [
      { key: 'scent', question: 'Vilken doft?', chips: ['Vanilj', 'Lavendel', 'Sandelträ', 'Citrus', 'Skog', 'Kaffe'] },
      { key: 'burnTime', question: 'Brinntid (timmar)?', placeholder: '40', optional: true, chips: ['20', '40', '60', '80'] },
    ],
    build: (title, _price, x) => {
      const t = cleanTitle(title);
      const scent = x.scent || 'Naturlig';
      const burn = x.burnTime ? `${x.burnTime} timmars brinntid` : 'Lång brinntid';
      return {
        description: `${t} — handgjutet doftljus med ${scent.toLowerCase()}. ${burn}.`,
        hook: `Ljus som doftar hem.`,
        extendedDescription: `${t} är gjutet i sojavax och doftsatt med ${scent.toLowerCase()}. En ren låga, en varm doft och en atmosfär du kommer att sakna när ljuset brunnit ut.`,
        effects: `• Naturligt sojavax\n• ${burn}\n• Ren, sotfri låga`,
        usage: `Låt brinna 2–3 timmar första gången så vaxet smälter jämnt. Trimma veken till 5 mm mellan varje användning.`,
        storage: `Förvaras svalt. Undvik direkt solljus.`,
        safety: `Lämna aldrig ett brinnande ljus utan uppsikt. Placera på värmetålig yta.`,
        metaTitle: `${t} — Handgjutet doftljus`,
        metaDescription: `${t} med ${scent.toLowerCase()}. Handgjutet i sojavax. ${burn}.`,
        metaKeywords: seoKeywords(['doftljus', scent, 'sojavax', t]),
        tags: ['ljus', 'doftljus', 'handgjord', scent.toLowerCase()],
        productType: 'Ljus',
        prebuyNote: `Nästa gjutning av ${t} är igång. Reservera ditt ljus — inga pengar dras.`,
        weightGrams: 350,
      };
    },
  },
  {
    key: 'cbd',
    label: 'CBD',
    emoji: '🌿',
    productType: 'CBD',
    detect: ['cbd', 'hampa', 'hemp'],
    asks: [
      { key: 'strength', question: 'Styrka?', chips: ['5%', '10%', '15%', '20%'] },
      { key: 'volume', question: 'Volym (ml)?', placeholder: '10', chips: ['10', '30'], optional: true },
    ],
    build: (title, _price, x) => {
      const t = cleanTitle(title);
      const s = x.strength || '10%';
      const v = x.volume || '10';
      return {
        description: `${t} — ${s} full spectrum CBD-olja, ${v} ml. Kallpressad, lab-testad, ren.`,
        hook: `Ren CBD. Lab-testad.`,
        extendedDescription: `${t} är framtagen med kallpressad hampaolja och full spectrum-extrakt. Varje batch tredjeparts-testas för renhet och styrka.`,
        effects: `• ${s} CBD full spectrum\n• Kallpressad hampaolja\n• Lab-testad renhet`,
        usage: `Placera några droppar under tungan, håll kvar i 60 sek och svälj. Börja lågt, öka gradvis.`,
        storage: `Förvaras svalt och mörkt. Skaka före användning.`,
        safety: `Ej avsedd för gravida eller ammande. Kontakta läkare vid medicinering.`,
        metaTitle: `${t} — ${s} CBD-olja ${v}ml`,
        metaDescription: `${t}. ${s} full spectrum CBD, ${v} ml. Lab-testad. Fri frakt över 500 kr.`,
        metaKeywords: seoKeywords(['cbd', 'hampa', 'cbd-olja', s, t]),
        tags: ['cbd', 'naturlig', 'hampa'],
        productType: 'CBD',
        prebuyNote: `Nästa batch av ${t} kommer snart. Reservera din — inga pengar dras.`,
        weightGrams: parseInt(v) + 40,
      };
    },
  },
  {
    key: 'hemtextil',
    label: 'Hemtextil',
    emoji: '🛏️',
    productType: 'Hemtextil',
    detect: ['handduk', 'pläd', 'kudde', 'lakan', 'överkast'],
    asks: [
      { key: 'material', question: 'Material?', chips: ['Ekologisk bomull', 'Linne', 'Ull', 'Bambu'], optional: true },
      { key: 'size', question: 'Storlek?', placeholder: 't.ex. 50x70 cm', optional: true },
    ],
    build: (title, _price, x) => {
      const t = cleanTitle(title);
      const mat = x.material || 'Naturmaterial';
      return {
        description: `${t} i ${mat.toLowerCase()}. Mjuk, hållbar och tillverkad med omsorg.`,
        hook: `Mjuk lyx. Ansvarsfullt tillverkad.`,
        extendedDescription: `${t} är gjord av ${mat.toLowerCase()} som blir mjukare för varje tvätt. Formgiven för att hålla i många år.`,
        effects: `• ${mat}\n• Åldras vackert\n• OEKO-TEX certifierad`,
        usage: `Maskintvätt 40°C. Torktumla på låg värme.`,
        storage: `Vik torrt. Undvik direkt solljus vid torkning.`,
        safety: `Följ tvättrådsetiketten.`,
        metaTitle: `${t} — ${mat}`,
        metaDescription: `${t} i ${mat.toLowerCase()}. Hållbart tillverkad. Fri frakt över 500 kr.`,
        metaKeywords: seoKeywords(['hemtextil', mat, t]),
        tags: ['hemtextil', 'naturlig', 'hållbar'],
        productType: 'Hemtextil',
        prebuyNote: `Nästa leverans av ${t} är på väg. Reservera din — inga pengar dras.`,
        weightGrams: 500,
      };
    },
  },
  {
    key: 'smycken',
    label: 'Smycken',
    emoji: '💍',
    productType: 'Smycken',
    detect: ['ring', 'halsband', 'armband', 'örhänge', 'silver', 'guld', 'smycke'],
    asks: [
      { key: 'material', question: 'Material?', chips: ['925 Silver', '18k Guld', 'Rostfritt stål'] },
      { key: 'size', question: 'Storlek?', placeholder: 't.ex. 18 mm', optional: true },
    ],
    build: (title, _price, x) => {
      const t = cleanTitle(title);
      const mat = x.material || '925 Silver';
      return {
        description: `${t} i ${mat}. Tidlös design, gjord för att bäras varje dag.`,
        hook: `Ett smycke som stannar.`,
        extendedDescription: `${t} är noga tillverkat i ${mat}. Anlöper inte, hypoallergent och redo för både vardag och fest.`,
        effects: `• ${mat}\n• Hypoallergent\n• Livstidsgaranti`,
        usage: `Torka av med mjuk trasa. Undvik parfym och klor direkt på smycket.`,
        storage: `Förvaras i medföljande påse när det inte används.`,
        safety: `Håll utom räckhåll för små barn.`,
        metaTitle: `${t} — ${mat}`,
        metaDescription: `${t} i ${mat}. Handplockad kvalitet. Fri frakt över 500 kr.`,
        metaKeywords: seoKeywords(['smycken', mat, t]),
        tags: ['smycken', mat.toLowerCase()],
        productType: 'Smycken',
        prebuyNote: `Nästa parti av ${t} är på väg. Reservera ditt — inga pengar dras.`,
        weightGrams: 30,
      };
    },
  },
  {
    key: 'mode',
    label: 'Mode',
    emoji: '👕',
    productType: 'Mode',
    detect: ['tröja', 'hoodie', 'tshirt', 't-shirt', 'jacka', 'byxa', 'keps', 'mössa'],
    asks: [
      { key: 'material', question: 'Material?', chips: ['Ekologisk bomull', 'Återvunnen polyester', 'Ull'], optional: true },
      { key: 'size', question: 'Vilka storlekar?', placeholder: 'S, M, L, XL', optional: true },
    ],
    build: (title, _price, x) => {
      const t = cleanTitle(title);
      const mat = x.material || 'Ekologisk bomull';
      return {
        description: `${t} i ${mat.toLowerCase()}. Enkel snitt, hållbar kvalitet.`,
        hook: `Kläder som håller.`,
        extendedDescription: `${t} är sydd i ${mat.toLowerCase()} med fokus på passform och hållbarhet. Ingen fast fashion.`,
        effects: `• ${mat}\n• Rättvist producerad\n• Åldras vackert`,
        usage: `Maskintvätt 30°C. Undvik torktumlare för längre livslängd.`,
        storage: `Häng eller vik. Undvik direkt solljus.`,
        safety: `—`,
        metaTitle: `${t} — ${mat}`,
        metaDescription: `${t} i ${mat.toLowerCase()}. Hållbart mode.`,
        metaKeywords: seoKeywords(['mode', mat, t]),
        tags: ['mode', 'hållbar', mat.toLowerCase()],
        productType: 'Mode',
        prebuyNote: `Nästa produktion av ${t} är planerad. Reservera din storlek — inga pengar dras.`,
        weightGrams: 400,
      };
    },
  },
  {
    key: 'elektronik',
    label: 'Elektronik',
    emoji: '🔌',
    productType: 'Elektronik',
    detect: ['laddare', 'kabel', 'högtalare', 'hörlur', 'lampa', 'elektronik'],
    asks: [
      { key: 'spec', question: 'Viktigaste specifikation?', placeholder: 't.ex. USB-C, 20W', optional: true },
      { key: 'warranty', question: 'Garanti (år)?', placeholder: '2', chips: ['1', '2', '3'], optional: true },
    ],
    build: (title, _price, x) => {
      const t = cleanTitle(title);
      const spec = x.spec || 'Modern standard';
      const w = x.warranty || '2';
      return {
        description: `${t} — ${spec}. ${w} års garanti.`,
        hook: `Funkar. Håller. Punkt.`,
        extendedDescription: `${t} är utvald för att göra ett jobb bra: ${spec}. Levereras med ${w} års garanti.`,
        effects: `• ${spec}\n• ${w} års garanti\n• Testad prestanda`,
        usage: `Följ medföljande manual.`,
        storage: `Förvaras torrt.`,
        safety: `Endast för avsett bruk.`,
        metaTitle: `${t} — ${spec}`,
        metaDescription: `${t}. ${spec}. ${w} års garanti.`,
        metaKeywords: seoKeywords(['elektronik', t]),
        tags: ['elektronik'],
        productType: 'Elektronik',
        prebuyNote: `Nästa leverans av ${t} är på väg. Reservera din — inga pengar dras.`,
        weightGrams: 300,
      };
    },
  },
  {
    key: 'generic',
    label: 'Annat',
    emoji: '📦',
    productType: '',
    detect: [],
    asks: [],
    build: (title, _price) => {
      const t = cleanTitle(title);
      return {
        description: `${t} — noga utvald kvalitet från 4ThePeople.`,
        hook: `Handplockat. För dig.`,
        extendedDescription: `${t} är en av våra handplockade produkter. Vi väljer bara sånt vi själva skulle använda.`,
        effects: `• Noga utvald kvalitet\n• Hållbar tillverkning\n• Fri frakt över 500 kr`,
        usage: `Se förpackning eller kontakta oss vid frågor.`,
        storage: `Förvaras enligt förpackningens anvisningar.`,
        safety: `—`,
        metaTitle: `${t} — 4ThePeople`,
        metaDescription: `${t}. Handplockad kvalitet från 4ThePeople.`,
        metaKeywords: seoKeywords([t]),
        tags: ['handplockad'],
        productType: '',
        prebuyNote: `Nästa parti av ${t} är på väg. Reservera din — inga pengar dras.`,
        weightGrams: 200,
      };
    },
  },
];

export function getTemplates(): ProductTemplate[] {
  return TEMPLATES;
}

export function detectTemplate(title: string): ProductTemplate {
  const t = title.toLowerCase();
  for (const tpl of TEMPLATES) {
    if (tpl.detect.some(k => t.includes(k))) return tpl;
  }
  return TEMPLATES.find(x => x.key === 'generic')!;
}

export function findTemplate(key: TemplateKey): ProductTemplate {
  return TEMPLATES.find(t => t.key === key) || TEMPLATES.find(t => t.key === 'generic')!;
}
