import { Helmet } from 'react-helmet-async';
import { storeConfig } from '@/config/storeConfig';

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  noindex?: boolean;
  schemaType?: 'Store' | 'Product' | 'Article' | 'FAQPage';
  schemaData?: Record<string, unknown>;
}

const SEOHead = ({
  title,
  description,
  keywords,
  canonical,
  ogImage = 'https://lovable.dev/opengraph-image-p98pqg.png',
  ogType = 'website',
  noindex = false,
  schemaType = 'Store',
  schemaData
}: SEOHeadProps) => {
  const fullTitle = title.includes('4thepeople') ? title : `${title} | 4thepeople`;
  const siteUrl = 'https://4thepeople.se';
  const canonicalUrl = canonical ? `${siteUrl}${canonical}` : undefined;

  // Generate schema.org structured data
  const getSchemaMarkup = () => {
    const baseSchema = {
      '@context': 'https://schema.org',
    };

    switch (schemaType) {
      case 'Store':
        return {
          ...baseSchema,
          '@type': 'Store',
          name: storeConfig.company.name,
          description: description,
          url: siteUrl,
          email: storeConfig.contact.email,
          telephone: storeConfig.contact.phone,
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Stockholm',
            addressCountry: 'SE'
          },
          priceRange: '$$',
          currenciesAccepted: storeConfig.currency.code,
          paymentAccepted: 'Klarna, Kort, Swish, PayPal',
          ...schemaData
        };
      case 'Product':
        return {
          ...baseSchema,
          '@type': 'Product',
          ...schemaData
        };
      case 'FAQPage':
        return {
          ...baseSchema,
          '@type': 'FAQPage',
          ...schemaData
        };
      default:
        return {
          ...baseSchema,
          '@type': 'WebSite',
          name: storeConfig.company.name,
          url: siteUrl,
          ...schemaData
        };
    }
  };

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={storeConfig.company.name} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Canonical */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Schema.org Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(getSchemaMarkup())}
      </script>
    </Helmet>
  );
};

export default SEOHead;
