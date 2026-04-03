import { useEffect } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import IngredientPhilosophy from '@/components/sections/IngredientPhilosophy';
import AboutCompact from '@/components/sections/AboutCompact';
import HomepageBestsellers from '@/components/sections/HomepageBestsellers';
import HomepageReviews from '@/components/sections/HomepageReviews';
import HomepageContact from '@/components/sections/HomepageContact';
import HomepageSustainability from '@/components/sections/HomepageSustainability';
import HomepageNewProducts from '@/components/sections/HomepageNewProducts';
import HomepageValues from '@/components/sections/HomepageValues';
import HomepageTimeline from '@/components/sections/HomepageTimeline';
import FloatingContactButton from '@/components/trust/FloatingContactButton';
import SEOHead from '@/components/seo/SEOHead';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { trackPageView } from '@/utils/analytics';
import { usePageSections, PageSection } from '@/hooks/usePageSections';

// Block registry: maps section_key to component
const BLOCK_COMPONENTS: Record<string, React.ComponentType<{ sections: PageSection[]; getSection: (key: string) => PageSection | undefined; isSectionVisible: (key: string) => boolean }>> = {
  hero: Hero,
  philosophy: IngredientPhilosophy,
  about_compact: AboutCompact,
  bestsellers: HomepageBestsellers,
  reviews: HomepageReviews,
  contact: HomepageContact,
  sustainability: HomepageSustainability,
  new_products: HomepageNewProducts,
  values: HomepageValues,
  timeline: HomepageTimeline,
};

// Main blocks that should render (not sub-items like philosophy_step_*)
const MAIN_BLOCK_KEYS = ['hero', 'philosophy', 'about_compact', 'bestsellers', 'reviews', 'contact', 'sustainability', 'new_products', 'values', 'timeline'];

const SEO_CONTENT: Record<string, { title: string; description: string; keywords: string }> = {
  sv: { title: '4thepeople - Giftfria Produkter för Europa', description: 'Noggrant utvalda giftfria produkter till ärliga priser.', keywords: 'giftfri, naturlig, kroppsvård, hållbart, europeisk, ekologisk' },
  en: { title: '4thepeople - Toxin-Free Products for Europe', description: 'Carefully curated toxin-free products at honest prices.', keywords: 'toxin-free, natural, body care, sustainable, european, organic' },
  no: { title: '4thepeople - Giftfrie Produkter for Europa', description: 'Nøye utvalgte giftfrie produkter til ærlige priser.', keywords: 'giftfri, naturlig, kroppsstell, bærekraftig, europeisk, økologisk' },
  da: { title: '4thepeople - Giftfrie Produkter til Europa', description: 'Omhyggeligt udvalgte giftfrie produkter til ærlige priser.', keywords: 'giftfri, naturlig, kropspleje, bæredygtig, europæisk, økologisk' },
  de: { title: '4thepeople - Schadstofffreie Produkte für Europa', description: 'Sorgfältig kuratierte schadstofffreie Produkte zu fairen Preisen.', keywords: 'schadstoffrei, natürlich, körperpflege, nachhaltig, europäisch, bio' },
  fi: { title: '4thepeople - Myrkyttömiä Tuotteita Euroopalle', description: 'Huolellisesti valitut myrkyttömät tuotteet rehellisin hinnoin.', keywords: 'myrkytön, luonnollinen, kehonhoito, kestävä, eurooppalainen, luomu' },
  nl: { title: '4thepeople - Gifvrije Producten voor Europa', description: 'Zorgvuldig geselecteerde gifvrije producten voor eerlijke prijzen.', keywords: 'gifvrij, natuurlijk, lichaamsverzorging, duurzaam, europees, biologisch' },
  fr: { title: "4thepeople - Produits Sans Toxines pour l'Europe", description: 'Des produits sans toxines soigneusement sélectionnés à des prix honnêtes.', keywords: 'sans toxines, naturel, soins du corps, durable, européen, biologique' },
  es: { title: '4thepeople - Productos Sin Tóxicos para Europa', description: 'Productos sin tóxicos cuidadosamente seleccionados a precios honestos.', keywords: 'sin tóxicos, natural, cuidado corporal, sostenible, europeo, ecológico' },
  pl: { title: '4thepeople - Produkty bez Toksyn dla Europy', description: 'Starannie wyselekcjonowane produkty bez toksyn w uczciwych cenach.', keywords: 'bez toksyn, naturalny, pielęgnacja ciała, zrównoważony, europejski, ekologiczny' },
};

const Index = () => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const { sections, getSection, isSectionVisible } = usePageSections('home');

  useEffect(() => {
    trackPageView('home', language);
  }, [language]);

  // Sort blocks by display_order from DB, only render visible main blocks
  const orderedBlocks = sections
    .filter(s => MAIN_BLOCK_KEYS.includes(s.section_key) && s.is_visible)
    .sort((a, b) => a.display_order - b.display_order);

  const seo = SEO_CONTENT[lang] ?? SEO_CONTENT.en;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        canonical="/"
        schemaType="Store"
      />
      <Header />
      <main>
        {orderedBlocks.map(block => {
          const Component = BLOCK_COMPONENTS[block.section_key];
          if (!Component) return null;
          return (
            <Component
              key={block.id}
              sections={sections}
              getSection={getSection}
              isSectionVisible={isSectionVisible}
            />
          );
        })}
        {/* Fallback: if no sections loaded yet, show hero */}
        {sections.length === 0 && (
          <Hero sections={[]} getSection={() => undefined} isSectionVisible={() => true} />
        )}
      </main>
      <Footer />
      <FloatingContactButton />
    </div>
  );
};

export default Index;
