import { motion } from 'framer-motion';
import { Heart, TrendingUp, Leaf, TreePine, Users } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';
import { useDonationStats } from '@/hooks/useDonationStats';
import LiveDonationFeed from '@/components/donations/LiveDonationFeed';
import DonationImpact from '@/components/donations/DonationImpact';

const Donations = () => {
  const { language, contentLang } = useLanguage();
  const donationStats = useDonationStats();

  const content: Record<string, {
    title: string;
    subtitle: string;
    totalCollected: string;
    treesPlanted: string;
    familiesHelped: string;
    howItWorks: string;
    howItWorksDesc: string;
    step1: string;
    step1Desc: string;
    step2: string;
    step2Desc: string;
    step3: string;
    step3Desc: string;
  }> = {
    sv: {
      title: 'Donationer & Påverkan',
      subtitle: 'Tillsammans gör vi skillnad. Varje köp bidrar till en bättre framtid.',
      totalCollected: 'Totalt insamlat',
      treesPlanted: 'Träd planterade',
      familiesHelped: 'Familjer hjälpta',
      howItWorks: 'Så fungerar det',
      howItWorksDesc: 'Vid varje köp kan du runda upp och bidra till våra projekt',
      step1: 'Handla som vanligt',
      step1Desc: 'Välj dina favoritprodukter i butiken',
      step2: 'Runda upp i kassan',
      step2Desc: 'Välj att runda upp till närmaste tiotal och bidra automatiskt',
      step3: 'Följ din påverkan',
      step3Desc: 'Se hur dina bidrag gör skillnad i realtid',
    },
    en: {
      title: 'Donations & Impact',
      subtitle: 'Together we make a difference. Every purchase contributes to a better future.',
      totalCollected: 'Total collected',
      treesPlanted: 'Trees planted',
      familiesHelped: 'Families helped',
      howItWorks: 'How it works',
      howItWorksDesc: 'With every purchase, you can round up and contribute to our projects',
      step1: 'Shop as usual',
      step1Desc: 'Choose your favorite products in the store',
      step2: 'Round up at checkout',
      step2Desc: 'Choose to round up to the nearest ten and contribute automatically',
      step3: 'Track your impact',
      step3Desc: 'See how your contributions make a difference in real time',
    },
    no: {
      title: 'Donasjoner & Påvirkning',
      subtitle: 'Sammen gjør vi en forskjell. Hvert kjøp bidrar til en bedre fremtid.',
      totalCollected: 'Totalt samlet inn',
      treesPlanted: 'Trær plantet',
      familiesHelped: 'Familier hjulpet',
      howItWorks: 'Slik fungerer det',
      howItWorksDesc: 'Ved hvert kjøp kan du runde opp og bidra til prosjektene våre',
      step1: 'Handle som vanlig',
      step1Desc: 'Velg favorittproduktene dine i butikken',
      step2: 'Rund opp i kassen',
      step2Desc: 'Velg å runde opp til nærmeste tier og bidra automatisk',
      step3: 'Følg din påvirkning',
      step3Desc: 'Se hvordan bidragene dine gjør en forskjell i sanntid',
    },
    da: {
      title: 'Donationer & Indvirkning',
      subtitle: 'Sammen gør vi en forskel. Hvert køb bidrager til en bedre fremtid.',
      totalCollected: 'I alt indsamlet',
      treesPlanted: 'Træer plantet',
      familiesHelped: 'Familier hjulpet',
      howItWorks: 'Sådan fungerer det',
      howItWorksDesc: 'Ved hvert køb kan du runde op og bidrage til vores projekter',
      step1: 'Shop som sædvanligt',
      step1Desc: 'Vælg dine yndlingsprodukter i butikken',
      step2: 'Rund op ved kassen',
      step2Desc: 'Vælg at runde op til nærmeste tier og bidrag automatisk',
      step3: 'Følg din indvirkning',
      step3Desc: 'Se hvordan dine bidrag gør en forskel i realtid',
    },
    de: {
      title: 'Spenden & Wirkung',
      subtitle: 'Gemeinsam machen wir einen Unterschied. Jeder Kauf trägt zu einer besseren Zukunft bei.',
      totalCollected: 'Insgesamt gesammelt',
      treesPlanted: 'Gepflanzte Bäume',
      familiesHelped: 'Geholfen Familien',
      howItWorks: 'So funktioniert es',
      howItWorksDesc: 'Bei jedem Kauf können Sie aufrunden und zu unseren Projekten beitragen',
      step1: 'Wie gewohnt einkaufen',
      step1Desc: 'Wählen Sie Ihre Lieblingsprodukte im Shop',
      step2: 'An der Kasse aufrunden',
      step2Desc: 'Wählen Sie, auf den nächsten Zehner aufzurunden und automatisch beizutragen',
      step3: 'Ihre Wirkung verfolgen',
      step3Desc: 'Sehen Sie, wie Ihre Beiträge in Echtzeit einen Unterschied machen',
    },
    fi: {
      title: 'Lahjoitukset & Vaikutus',
      subtitle: 'Yhdessä teemme eron. Jokainen ostos edistää parempaa tulevaisuutta.',
      totalCollected: 'Yhteensä kerätty',
      treesPlanted: 'Istutettuja puita',
      familiesHelped: 'Autettuja perheitä',
      howItWorks: 'Näin se toimii',
      howItWorksDesc: 'Jokaisen oston yhteydessä voit pyöristää ylöspäin ja osallistua projekteihimme',
      step1: 'Osta kuten tavallisesti',
      step1Desc: 'Valitse suosikkituotteesi kaupasta',
      step2: 'Pyöristä ylöspäin kassalla',
      step2Desc: 'Valitse pyöristys lähimpään kymmeneen ja osallistu automaattisesti',
      step3: 'Seuraa vaikutustasi',
      step3Desc: 'Katso, kuinka panoksesi tekevät eron reaaliajassa',
    },
    nl: {
      title: 'Donaties & Impact',
      subtitle: 'Samen maken we een verschil. Elke aankoop draagt bij aan een betere toekomst.',
      totalCollected: 'Totaal ingezameld',
      treesPlanted: 'Geplante bomen',
      familiesHelped: 'Geholpen gezinnen',
      howItWorks: 'Hoe het werkt',
      howItWorksDesc: 'Bij elke aankoop kun je afronden en bijdragen aan onze projecten',
      step1: 'Shop zoals gewoonlijk',
      step1Desc: 'Kies je favoriete producten in de winkel',
      step2: 'Afronden bij de kassa',
      step2Desc: 'Kies om af te ronden naar het dichtstbijzijnde tiental en draag automatisch bij',
      step3: 'Volg jouw impact',
      step3Desc: 'Zie hoe jouw bijdragen in realtime een verschil maken',
    },
    fr: {
      title: 'Dons & Impact',
      subtitle: 'Ensemble, nous faisons une différence. Chaque achat contribue à un meilleur avenir.',
      totalCollected: 'Total collecté',
      treesPlanted: 'Arbres plantés',
      familiesHelped: 'Familles aidées',
      howItWorks: 'Comment ça marche',
      howItWorksDesc: "À chaque achat, vous pouvez arrondir et contribuer à nos projets",
      step1: "Achetez comme d'habitude",
      step1Desc: 'Choisissez vos produits préférés dans la boutique',
      step2: 'Arrondissez à la caisse',
      step2Desc: "Choisissez d'arrondir à la dizaine supérieure et contribuez automatiquement",
      step3: 'Suivez votre impact',
      step3Desc: 'Voyez comment vos contributions font une différence en temps réel',
    },
    es: {
      title: 'Donaciones & Impacto',
      subtitle: 'Juntos hacemos la diferencia. Cada compra contribuye a un futuro mejor.',
      totalCollected: 'Total recaudado',
      treesPlanted: 'Árboles plantados',
      familiesHelped: 'Familias ayudadas',
      howItWorks: 'Cómo funciona',
      howItWorksDesc: 'Con cada compra, puedes redondear y contribuir a nuestros proyectos',
      step1: 'Compra como siempre',
      step1Desc: 'Elige tus productos favoritos en la tienda',
      step2: 'Redondea en la caja',
      step2Desc: 'Elige redondear a la decena más cercana y contribuye automáticamente',
      step3: 'Sigue tu impacto',
      step3Desc: 'Ve cómo tus contribuciones hacen la diferencia en tiempo real',
    },
    pl: {
      title: 'Darowizny & Wpływ',
      subtitle: 'Razem robimy różnicę. Każdy zakup przyczynia się do lepszej przyszłości.',
      totalCollected: 'Łącznie zebrano',
      treesPlanted: 'Zasadzonych drzew',
      familiesHelped: 'Rodzin, którym pomożono',
      howItWorks: 'Jak to działa',
      howItWorksDesc: 'Przy każdym zakupie możesz zaokrąglić kwotę i przyczynić się do naszych projektów',
      step1: 'Rób zakupy jak zwykle',
      step1Desc: 'Wybieraj ulubione produkty w sklepie',
      step2: 'Zaokrąglij przy kasie',
      step2Desc: 'Wybierz zaokrąglenie do najbliższej dziesiątki i automatycznie wpłać darowiznę',
      step3: 'Śledź swój wpływ',
      step3Desc: 'Zobacz, jak Twoje wkłady robią różnicę w czasie rzeczywistym',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t.title}
        description={t.subtitle}
        keywords="donationer, hållbarhet, miljö, träd, påverkan"
        canonical="/donations"
      />
      <Header />

      <main className="pt-24 pb-20">
        {/* Hero */}
        <section className="container mx-auto px-4 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Heart className="w-4 h-4" />
              {t.title}
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold mb-6">
              {t.title}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t.subtitle}
            </p>
          </motion.div>
        </section>

        {/* Stats */}
        <section className="container mx-auto px-4 mb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-8 text-center"
            >
              <TrendingUp className="w-8 h-8 text-primary mx-auto mb-3" />
              <p className="text-3xl font-bold text-primary">{donationStats.totalDonated} kr</p>
              <p className="text-sm text-muted-foreground mt-1">{t.totalCollected}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-2xl p-8 text-center"
            >
              <TreePine className="w-8 h-8 text-accent mx-auto mb-3" />
              <p className="text-3xl font-bold text-accent">{donationStats.treesPlanted}</p>
              <p className="text-sm text-muted-foreground mt-1">{t.treesPlanted}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-secondary to-secondary/50 border border-border rounded-2xl p-8 text-center"
            >
              <Users className="w-8 h-8 text-foreground mx-auto mb-3" />
              <p className="text-3xl font-bold">{donationStats.familiesHelped}</p>
              <p className="text-sm text-muted-foreground mt-1">{t.familiesHelped}</p>
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-card border-y border-border/50 py-16 mb-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="font-display text-3xl font-semibold mb-3">{t.howItWorks}</h2>
              <p className="text-muted-foreground">{t.howItWorksDesc}</p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { icon: Leaf, title: t.step1, desc: t.step1Desc, num: '1' },
                { icon: Heart, title: t.step2, desc: t.step2Desc, num: '2' },
                { icon: TrendingUp, title: t.step3, desc: t.step3Desc, num: '3' },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 relative">
                    <step.icon className="w-7 h-7 text-primary" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Live Feed + Impact */}
        <section className="container mx-auto px-4 mb-16">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <LiveDonationFeed />
            <DonationImpact />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Donations;