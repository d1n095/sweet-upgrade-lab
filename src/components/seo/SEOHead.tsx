import { Helmet } from 'react-helmet-async';
import { storeConfig } from '@/config/storeConfig';

export interface BreadcrumbItem {
  name: string;
  url: string; // path like "/produkter" or absolute URL
}

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  noindex?: boolean;
  schemaType?: 'Store' | 'Organization' | 'Product' | 'Article' | 'FAQPage';
  schemaData?: Record<string, unknown>;
  breadcrumbs?: BreadcrumbItem[];
}

const SEOHead = ({
  title,
  description,
  keywords,
  canonical,
  ogImage = 'https://jjvbvrgjanisbuhalevj.supabase.co/storage/v1/object/public/public-assets/og-image.jpg',
  ogType = 'website',
  noindex = false,
  schemaType = 'Store',
  schemaData,
  breadcrumbs,
}: SEOHeadProps) => {
  const fullTitle = title.includes('4thepeople') || title.includes('4ThePeople')
    ? title
    : `${title} | 4thepeople`;
  const siteUrl = storeConfig.siteUrl;
  const canonicalUrl = canonical ? `${siteUrl}${canonical}` : undefined;

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: storeConfig.company.name,
    url: siteUrl,
    logo: `${siteUrl}/favicon.png`,
    email: storeConfig.contact.email,
    foundingDate: String(storeConfig.foundingYear),
    sameAs: [
      storeConfig.social.instagram,
      storeConfig.social.facebook,
      storeConfig.social.twitter,
    ].filter(Boolean),
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Stockholm',
      addressCountry: 'SE',
    },
  };

  const buildPrimarySchema = () => {
    const base = { '@context': 'https://schema.org' };
    switch (schemaType) {
      case 'Organization':
        return orgSchema;
      case 'Store':
        return {
          ...base,
          '@type': 'Store',
          name: storeConfig.company.name,
          description,
          url: siteUrl,
          email: storeConfig.contact.email,
          address: orgSchema.address,
          priceRange: '$$',
          currenciesAccepted: storeConfig.currency.code,
          paymentAccepted: 'Klarna, Kort, Swish, PayPal',
          ...schemaData,
        };
      case 'Product':
        return {
          ...base,
          '@type': 'Product',
          brand: { '@type': 'Brand', name: storeConfig.company.name },
          ...schemaData,
        };
      case 'FAQPage':
        return { ...base, '@type': 'FAQPage', ...schemaData };
      case 'Article':
        return { ...base, '@type': 'Article', ...schemaData };
      default:
        return {
          ...base,
          '@type': 'WebSite',
          name: storeConfig.company.name,
          url: siteUrl,
          ...schemaData,
        };
    }
  };

  const breadcrumbSchema = breadcrumbs && breadcrumbs.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: b.name,
          item: b.url.startsWith('http') ? b.url : `${siteUrl}${b.url}`,
        })),
      }
    : null;

  // Always emit Organization on non-Organization pages too (idempotent — Google dedupes by @id/@type+url)
  const emitSeparateOrganization = schemaType !== 'Organization' && schemaType !== 'Store';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large" />
      )}

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

      {/* Primary Schema */}
      <script type="application/ld+json">
        {JSON.stringify(buildPrimarySchema())}
      </script>

      {/* Organization schema (always present except when primary IS Organization/Store which already includes org data) */}
      {emitSeparateOrganization && (
        <script type="application/ld+json">{JSON.stringify(orgSchema)}</script>
      )}

      {/* Breadcrumbs */}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
    </Helmet>
  );
};

export default SEOHead;
