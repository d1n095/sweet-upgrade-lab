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

const Index = () => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const { sections, getSection, isSectionVisible } = usePageSections('home');

  // Sort blocks by display_order from DB, only render visible main blocks
  const orderedBlocks = sections
    .filter(s => MAIN_BLOCK_KEYS.includes(s.section_key) && s.is_visible)
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={lang === 'sv' ? '4thepeople - Giftfria Produkter för Europa' : '4thepeople - Toxin-Free Products for Europe'}
        description={lang === 'sv'
          ? 'Noggrant utvalda giftfria produkter till ärliga priser.'
          : 'Carefully curated toxin-free products at honest prices.'}
        keywords="giftfri, naturlig, kroppsvård, hållbart, europeisk, ekologisk"
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
