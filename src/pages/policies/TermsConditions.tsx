import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const TermsConditions = () => {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <FileText className="w-4 h-4" />
              {language === 'sv' ? 'Villkor' : 'Terms'}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-8">
              {language === 'sv' ? 'Allmänna Villkor' : 'Terms & Conditions'}
            </h1>
            
            <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
              <h2 className="font-display text-xl font-semibold text-foreground">{language === 'sv' ? 'Allmänt' : 'General'}</h2>
              <p>{language === 'sv' ? 'Genom att handla hos oss godkänner du dessa villkor. Vi förbehåller oss rätten att uppdatera villkoren.' : 'By shopping with us, you accept these terms. We reserve the right to update the terms.'}</p>
              
              <h2 className="font-display text-xl font-semibold text-foreground">{language === 'sv' ? 'Priser' : 'Prices'}</h2>
              <p>{language === 'sv' ? 'Alla priser anges i SEK inklusive moms. Vi reserverar oss för eventuella prisändringar och felaktigheter.' : 'All prices are in SEK including VAT. We reserve the right for price changes and errors.'}</p>
              
              <h2 className="font-display text-xl font-semibold text-foreground">{language === 'sv' ? 'Betalning' : 'Payment'}</h2>
              <p>{language === 'sv' ? 'Betalning sker via säkra betalningslösningar. Ordern behandlas när betalningen är bekräftad.' : 'Payment is made through secure payment solutions. Orders are processed when payment is confirmed.'}</p>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsConditions;
