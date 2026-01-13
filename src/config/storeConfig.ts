// Central store configuration - single source of truth for all store settings
export const storeConfig = {
  // Shipping
  shipping: {
    cost: 59, // SEK
    freeShippingThreshold: 499, // SEK - set to 0 to disable
    deliveryTime: {
      sv: '2–5 arbetsdagar från EU-lager',
      en: '2–5 business days from EU warehouse',
    },
    provider: 'EU Logistics',
  },

  // Returns
  returns: {
    period: 14, // days
    freeReturns: false,
  },

  // Contact
  contact: {
    email: 'hej@4thepeople.se',
    phone: '+46701234567',
    phoneFormatted: '070-123 45 67',
    address: {
      street: 'Naturvägen 1',
      zip: '123 45',
      city: 'Stockholm',
      country: 'Sverige',
    },
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

  // Categories
  categories: [
    {
      id: 'teknik',
      name: { sv: 'Teknik', en: 'Tech' },
      description: { sv: 'Laddare, adaptrar, hörlurar', en: 'Chargers, adapters, headphones' },
      shopifyTag: 'teknik',
      active: true,
    },
    {
      id: 'hampa-klader',
      name: { sv: 'Hampa-kläder', en: 'Hemp Clothing' },
      description: { sv: 'Hållbara kläder i hampa', en: 'Sustainable hemp clothing' },
      shopifyTag: 'hampa,klader',
      active: true,
    },
    {
      id: 'kroppsvard',
      name: { sv: 'Kroppsvård', en: 'Body Care' },
      description: { sv: 'Naturlig tvål, lotion', en: 'Natural soap, lotion' },
      shopifyTag: 'kroppsvard',
      active: true,
    },
    {
      id: 'cbd',
      name: { sv: 'CBD & Hampa', en: 'CBD & Hemp' },
      description: { sv: 'CBD-produkter (kommer snart)', en: 'CBD products (coming soon)' },
      shopifyTag: 'cbd',
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
