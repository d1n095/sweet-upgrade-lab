// Central store configuration - single source of truth for all store settings
export const storeConfig = {
  // Company founding year
  foundingYear: 2026,

  // Shipping
  shipping: {
    cost: 39, // SEK - reduced from 59
    freeShippingThreshold: 500, // SEK
    // Smart shipping: free between 480-520 for "generous" feel
    generousFreeMin: 480,
    generousFreeMax: 520,
    deliveryTime: {
      sv: '7–10 arbetsdagar från våra leverantörer',
      en: '7–10 business days from our suppliers',
    },
    deliveryDays: '7-10',
    provider: 'Pålitliga leverantörer',
  },

  // Returns
  returns: {
    period: 30, // days - updated to 30 days
    freeReturns: false,
  },

  // Contact
  contact: {
    email: 'support@4thepeople.se',
    phone: '+46701234567',
    phoneFormatted: '070-123 45 67',
  },

  // Social media
  social: {
    instagram: 'https://instagram.com/4thepeople',
    facebook: 'https://facebook.com/4thepeople',
    twitter: 'https://twitter.com/4thepeople',
  },

  // Stock status thresholds
  stock: {
    lowStockThreshold: 5,
    veryLowStockThreshold: 2,
  },

  // Categories - matching Shopify product_type values
  categories: [
    {
      id: 'bestsaljare',
      name: { sv: 'Bästsäljare', en: 'Bestsellers' },
      description: { sv: 'Våra mest populära produkter', en: 'Our most popular products' },
      shopifyProductType: '__bestseller__',
      active: true,
    },
    {
      id: 'elektronik',
      name: { sv: 'Elektronik', en: 'Electronics' },
      description: { sv: 'Laddare, powerbanks, kablar', en: 'Chargers, powerbanks, cables' },
      shopifyProductType: 'Elektronik',
      active: true,
    },
    {
      id: 'klader',
      name: { sv: 'Kläder', en: 'Clothing' },
      description: { sv: 'Hållbara kläder', en: 'Sustainable clothing' },
      shopifyProductType: 'Kläder',
      active: true,
    },
    {
      id: 'kroppsvard',
      name: { sv: 'Kroppsvård', en: 'Body Care' },
      description: { sv: 'Naturlig tvål, tandvård, hudvård', en: 'Natural soap, dental care, skincare' },
      shopifyProductType: 'Kroppsvård',
      active: true,
    },
    {
      id: 'ljus',
      name: { sv: 'Ljus', en: 'Candles' },
      description: { sv: 'Naturliga ljus och doftljus', en: 'Natural candles and scented candles' },
      shopifyProductType: 'Ljus',
      active: true,
    },
    {
      id: 'smycken',
      name: { sv: 'Smycken & Silver', en: 'Jewelry & Silver' },
      description: { sv: 'Smycken och silveraccessoarer', en: 'Jewelry and silver accessories' },
      shopifyProductType: 'Smycken',
      active: true,
    },
    {
      id: 'bastudofter',
      name: { sv: 'Bastudofter', en: 'Sauna Scents' },
      description: { sv: 'Naturliga bastudofter', en: 'Natural sauna scents' },
      shopifyProductType: 'Bastudofter',
      active: true,
    },
    {
      id: 'hem-textil',
      name: { sv: 'Hemtextil', en: 'Home Textiles' },
      description: { sv: 'Sängkläder, filtar, handdukar', en: 'Bedding, blankets, towels' },
      shopifyProductType: 'Hemtextil',
      active: true,
    },
    {
      id: 'cbd',
      name: { sv: 'CBD', en: 'CBD' },
      description: { sv: 'CBD-produkter (kommer snart)', en: 'CBD products (coming soon)' },
      shopifyProductType: 'CBD',
      active: false, // Hidden but structure exists
    },
  ],

  // Currency
  currency: {
    code: 'SEK',
    symbol: 'kr',
    locale: 'sv-SE',
  },

  // Company info
  company: {
    name: '4ThePeople',
    tagline: {
      sv: 'Naturligt & Hållbart',
      en: 'Natural & Sustainable',
    },
    registrationNumber: '', // Add when available
    vatNumber: '', // Add when available
  },
} as const;

export type StoreConfig = typeof storeConfig;
