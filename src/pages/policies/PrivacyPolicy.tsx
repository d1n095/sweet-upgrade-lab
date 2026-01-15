import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';

const PrivacyPolicy = () => {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={language === 'sv' ? 'Integritetspolicy' : 'Privacy Policy'}
        description={language === 'sv' 
          ? 'Läs om hur vi hanterar dina personuppgifter och dina rättigheter enligt GDPR.'
          : 'Read about how we handle your personal data and your rights under GDPR.'}
        canonical="/policies/privacy"
      />
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Shield className="w-4 h-4" />
              GDPR
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-8">
              {language === 'sv' ? 'Integritetspolicy' : 'Privacy Policy'}
            </h1>
            
            <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
              <h2 className="font-display text-xl font-semibold text-foreground">{language === 'sv' ? 'Personuppgifter' : 'Personal Data'}</h2>
              <p>{language === 'sv' ? 'Vi samlar endast in uppgifter som är nödvändiga för att behandla din order: namn, adress, e-post och telefonnummer.' : 'We only collect data necessary for processing your order: name, address, email, and phone number.'}</p>
              
              <h2 className="font-display text-xl font-semibold text-foreground">{language === 'sv' ? 'Dina rättigheter' : 'Your Rights'}</h2>
              <p>{language === 'sv' ? 'Du har rätt att begära tillgång till, rättelse av, eller radering av dina personuppgifter. Kontakta oss för att utöva dessa rättigheter.' : 'You have the right to access, correct, or delete your personal data. Contact us to exercise these rights.'}</p>
              
              <h2 className="font-display text-xl font-semibold text-foreground">Cookies</h2>
              <p>{language === 'sv' ? 'Vi använder nödvändiga cookies för att webbplatsen ska fungera samt analytiska cookies för att förbättra upplevelsen.' : 'We use necessary cookies for website functionality and analytical cookies to improve the experience.'}</p>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
