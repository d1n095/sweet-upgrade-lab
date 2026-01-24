import { motion } from 'framer-motion';
import { RotateCcw, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { storeConfig } from '@/config/storeConfig';
import SEOHead from '@/components/seo/SEOHead';

const ReturnsPolicy = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      title: 'Retur & Återbetalning',
      badge: 'Returer',
      intro: `Vi vill att du ska vara helt nöjd med ditt köp. Om du av någon anledning inte är det har du ${storeConfig.returns.period} dagars ångerrätt enligt svensk konsumentlagstiftning.`,
      sections: [
        {
          title: 'Ångerrätt',
          icon: CheckCircle,
          items: [
            `Du har ${storeConfig.returns.period} dagars ångerrätt från den dag du mottar din beställning.`,
            'Ångerfristen börjar den dag du eller ett ombud tar emot varan.',
            'Du behöver inte ange något skäl för att utnyttja ångerrätten.',
            'Meddela oss om ditt beslut att ångra köpet via e-post innan fristen går ut.'
          ]
        },
        {
          title: 'Villkor för retur',
          icon: Package,
          items: [
            'Produkten ska vara oanvänd och i väsentligen samma skick som vid mottagandet.',
            'Produkten ska returneras i originalförpackning om möjligt.',
            'Du har rätt att öppna och inspektera produkten på samma sätt som i en fysisk butik.',
            'Värdeminskning på grund av onödig hantering kan dras av från återbetalningen.'
          ]
        },
        {
          title: 'Så här returnerar du',
          icon: RotateCcw,
          items: [
            `1. Kontakta oss på ${storeConfig.contact.email} med ditt ordernummer.`,
            '2. Vi skickar en returbekräftelse och eventuella returinstruktioner.',
            '3. Skicka tillbaka produkten inom 14 dagar från att du meddelat oss.',
            '4. Återbetalning sker inom 14 dagar efter att vi mottagit returen.',
            'Du står för returfrakt om inte produkten är defekt eller felaktig.'
          ]
        },
        {
          title: 'Undantag från ångerrätten',
          icon: AlertCircle,
          items: [
            'Hygienartiklar där förseglingen brutits (av hälsoskäl).',
            'Specialtillverkade eller personligt anpassade produkter.',
            'Produkter som snabbt kan försämras eller bli gamla.',
            'Förslutna ljud- eller bildupptagningar där förseglingen brutits.'
          ]
        }
      ],
      refundInfo: {
        title: 'Återbetalning',
        text: 'Återbetalning sker till samma betalningsmetod som användes vid köpet. Beroende på din bank kan det ta 3-5 bankdagar innan pengarna syns på ditt konto.'
      },
      defectInfo: {
        title: 'Defekta produkter',
        text: 'Om produkten är defekt eller skadad vid leverans kontaktar du oss omedelbart. Vi ersätter produkten eller återbetalar hela beloppet inklusive fraktkostnader. Du behöver inte stå för returfrakten vid reklamation.'
      }
    },
    en: {
      title: 'Returns & Refunds',
      badge: 'Returns',
      intro: `We want you to be completely satisfied with your purchase. If for any reason you're not, you have ${storeConfig.returns.period} days right of withdrawal according to Swedish consumer law.`,
      sections: [
        {
          title: 'Right of Withdrawal',
          icon: CheckCircle,
          items: [
            `You have ${storeConfig.returns.period} days right of withdrawal from the day you receive your order.`,
            'The withdrawal period starts the day you or a representative receives the product.',
            'You don\'t need to give any reason to exercise your right of withdrawal.',
            'Notify us of your decision to cancel before the deadline via email.'
          ]
        },
        {
          title: 'Return Conditions',
          icon: Package,
          items: [
            'The product must be unused and in substantially the same condition as when received.',
            'The product should be returned in original packaging if possible.',
            'You have the right to open and inspect the product as you would in a physical store.',
            'Depreciation due to unnecessary handling may be deducted from the refund.'
          ]
        },
        {
          title: 'How to Return',
          icon: RotateCcw,
          items: [
            `1. Contact us at ${storeConfig.contact.email} with your order number.`,
            '2. We\'ll send a return confirmation and any return instructions.',
            '3. Send back the product within 14 days of notifying us.',
            '4. Refund is processed within 14 days after we receive the return.',
            'You pay return shipping unless the product is defective or incorrect.'
          ]
        },
        {
          title: 'Exceptions to Right of Withdrawal',
          icon: AlertCircle,
          items: [
            'Hygiene products where the seal has been broken (for health reasons).',
            'Custom-made or personally customized products.',
            'Products that can quickly deteriorate or become outdated.',
            'Sealed audio or video recordings where the seal has been broken.'
          ]
        }
      ],
      refundInfo: {
        title: 'Refund',
        text: 'Refunds are made to the same payment method used at purchase. Depending on your bank, it may take 3-5 business days for the money to appear in your account.'
      },
      defectInfo: {
        title: 'Defective Products',
        text: 'If the product is defective or damaged upon delivery, contact us immediately. We will replace the product or refund the full amount including shipping costs. You don\'t pay return shipping for complaints.'
      }
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t.title}
        description={language === 'sv' 
          ? `${storeConfig.returns.period} dagars ångerrätt. Läs om hur du returnerar produkter och får återbetalning.`
          : `${storeConfig.returns.period} days right of withdrawal. Learn how to return products and get refunds.`}
        canonical="/policies/returns"
      />
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <RotateCcw className="w-4 h-4" />
              {t.badge}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {t.title}
            </h1>
            <p className="text-lg text-muted-foreground mb-12">{t.intro}</p>
            
            <div className="space-y-10">
              {t.sections.map((section, index) => {
                const IconComponent = section.icon;
                return (
                  <motion.div 
                    key={section.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-card border border-border/50 rounded-2xl p-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <IconComponent className="w-5 h-5 text-primary" />
                      </div>
                      <h2 className="font-display text-xl font-semibold">{section.title}</h2>
                    </div>
                    <ul className="space-y-3">
                      {section.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                );
              })}
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-10">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-accent/10 border border-accent/20 rounded-2xl p-6"
              >
                <h3 className="font-display text-lg font-semibold mb-3 text-accent">
                  {t.refundInfo.title}
                </h3>
                <p className="text-muted-foreground text-sm">{t.refundInfo.text}</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-primary/5 border border-primary/10 rounded-2xl p-6"
              >
                <h3 className="font-display text-lg font-semibold mb-3">
                  {t.defectInfo.title}
                </h3>
                <p className="text-muted-foreground text-sm">{t.defectInfo.text}</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ReturnsPolicy;