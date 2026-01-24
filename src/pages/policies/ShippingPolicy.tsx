import { motion } from 'framer-motion';
import { Truck, Package, Clock, Globe, MapPin, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { storeConfig } from '@/config/storeConfig';
import SEOHead from '@/components/seo/SEOHead';

const ShippingPolicy = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      title: 'Fraktinformation',
      badge: 'Frakt',
      intro: 'Vi strävar efter att leverera dina produkter så snabbt och smidigt som möjligt. Här hittar du all information om våra leveransalternativ.',
      infoCards: [
        { label: 'Fraktkostnad', value: `${storeConfig.shipping.cost} kr`, highlight: false },
        { label: 'Fri frakt över', value: `${storeConfig.shipping.freeShippingThreshold} kr`, highlight: true },
        { label: 'Leveranstid', value: storeConfig.shipping.deliveryTime.sv, highlight: false },
        { label: 'Ångerrätt', value: `${storeConfig.returns.period} dagar`, highlight: false },
      ],
      sections: [
        {
          title: 'Så fungerar leveransen',
          icon: Package,
          text: `Vi samarbetar med noggrant utvalda leverantörer som skickar produkterna direkt till dig. Detta innebär att varorna kommer från EU-baserade lager, vilket säkerställer snabb leverans och inga oväntade tull- eller importavgifter.

När du lägger en beställning behandlar vi den manuellt för att säkerställa kvalitet och korrekthet. Därefter skickas produkten från vår leverantör direkt hem till dig.`
        },
        {
          title: 'Leveranstider',
          icon: Clock,
          text: `Normal leveranstid är ${storeConfig.shipping.deliveryTime.sv}. Detta inkluderar:
          
• 1-3 arbetsdagar för orderbehandling och kvalitetskontroll
• 4-7 arbetsdagar för leverans från EU-lager

Vid högsäsong (t.ex. julhandel, Black Friday) kan leveranstiden vara något längre. Vi rekommenderar att beställa i god tid inför speciella tillfällen.`
        },
        {
          title: 'Leveransområde',
          icon: Globe,
          text: `Vi levererar till hela Europa med fokus på Skandinavien. Alla produkter skickas från lager inom EU, vilket betyder:

• Inga tullavgifter
• Inga importkostnader  
• Snabbare leverans jämfört med leveranser utanför EU

Leverans till andra länder utanför EU kan erbjudas på förfrågan.`
        },
        {
          title: 'Spårning av order',
          icon: MapPin,
          text: `När din order har skickats får du ett e-postmeddelande med spårningsinformation. Med spårningsnumret kan du följa paketets väg fram till leverans.

Om du inte fått spårningsinformation inom 5 arbetsdagar efter orderbekräftelse, kontakta oss så hjälper vi dig.`
        },
        {
          title: 'Viktigt att veta',
          icon: AlertTriangle,
          text: `• Vi kan inte garantera exakta leveransdatum då vi är beroende av externa leverantörer
• Förseningar kan uppstå vid helger, högtider eller oförutsedda händelser
• Kontrollera alltid att leveransadressen är korrekt vid beställning
• Vid utebliven leverans eller skadade varor – kontakta oss omedelbart

Vi arbetar alltid för att ge dig bästa möjliga upplevelse och löser eventuella problem snabbt och professionellt.`
        }
      ]
    },
    en: {
      title: 'Shipping Information',
      badge: 'Shipping',
      intro: 'We strive to deliver your products as quickly and smoothly as possible. Here you\'ll find all information about our delivery options.',
      infoCards: [
        { label: 'Shipping cost', value: `${storeConfig.shipping.cost} kr`, highlight: false },
        { label: 'Free shipping over', value: `${storeConfig.shipping.freeShippingThreshold} kr`, highlight: true },
        { label: 'Delivery time', value: storeConfig.shipping.deliveryTime.en, highlight: false },
        { label: 'Return policy', value: `${storeConfig.returns.period} days`, highlight: false },
      ],
      sections: [
        {
          title: 'How Delivery Works',
          icon: Package,
          text: `We work with carefully selected suppliers who ship products directly to you. This means items come from EU-based warehouses, ensuring fast delivery and no unexpected customs or import fees.

When you place an order, we process it manually to ensure quality and accuracy. The product is then shipped from our supplier directly to your home.`
        },
        {
          title: 'Delivery Times',
          icon: Clock,
          text: `Normal delivery time is ${storeConfig.shipping.deliveryTime.en}. This includes:
          
• 1-3 business days for order processing and quality control
• 4-7 business days for delivery from EU warehouse

During peak seasons (e.g., Christmas, Black Friday) delivery times may be slightly longer. We recommend ordering in advance for special occasions.`
        },
        {
          title: 'Delivery Area',
          icon: Globe,
          text: `We deliver throughout Europe with a focus on Scandinavia. All products ship from warehouses within the EU, which means:

• No customs fees
• No import costs  
• Faster delivery compared to shipments from outside the EU

Delivery to countries outside the EU may be offered upon request.`
        },
        {
          title: 'Order Tracking',
          icon: MapPin,
          text: `When your order has been shipped, you'll receive an email with tracking information. With the tracking number, you can follow the package's journey to delivery.

If you haven't received tracking information within 5 business days after order confirmation, contact us and we'll help you.`
        },
        {
          title: 'Important to Know',
          icon: AlertTriangle,
          text: `• We cannot guarantee exact delivery dates as we depend on external suppliers
• Delays may occur during holidays, peak seasons, or unforeseen events
• Always verify that the delivery address is correct when ordering
• For missing deliveries or damaged goods – contact us immediately

We always work to give you the best possible experience and resolve any issues quickly and professionally.`
        }
      ]
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t.title}
        description={language === 'sv' 
          ? `Fri frakt över ${storeConfig.shipping.freeShippingThreshold} kr. ${storeConfig.shipping.deliveryTime.sv}. Leverans till hela Europa.`
          : `Free shipping over ${storeConfig.shipping.freeShippingThreshold} kr. ${storeConfig.shipping.deliveryTime.en}. Delivery throughout Europe.`}
        canonical="/policies/shipping"
      />
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Truck className="w-4 h-4" />
              {t.badge}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {t.title}
            </h1>
            <p className="text-lg text-muted-foreground mb-8">{t.intro}</p>
            
            {/* Quick Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {t.infoCards.map((card, index) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-xl border ${
                    card.highlight 
                      ? 'bg-accent/10 border-accent/30' 
                      : 'bg-card border-border/50'
                  }`}
                >
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className={`font-semibold text-lg ${card.highlight ? 'text-accent' : 'text-foreground'}`}>
                    {card.value}
                  </p>
                </motion.div>
              ))}
            </div>
            
            {/* Detailed Sections */}
            <div className="space-y-8">
              {t.sections.map((section, index) => {
                const IconComponent = section.icon;
                return (
                  <motion.div 
                    key={section.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="bg-card border border-border/50 rounded-2xl p-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <IconComponent className="w-5 h-5 text-primary" />
                      </div>
                      <h2 className="font-display text-xl font-semibold">{section.title}</h2>
                    </div>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                      {section.text}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* Contact CTA */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-12 text-center bg-secondary/50 rounded-2xl p-8"
            >
              <h3 className="font-display text-xl font-semibold mb-2">
                {language === 'sv' ? 'Har du frågor om leverans?' : 'Questions about delivery?'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {language === 'sv' 
                  ? 'Kontakta vår kundtjänst så hjälper vi dig.'
                  : 'Contact our customer service and we\'ll help you.'}
              </p>
              <a 
                href={`mailto:${storeConfig.contact.email}`}
                className="text-primary hover:underline font-medium"
              >
                {storeConfig.contact.email}
              </a>
            </motion.div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ShippingPolicy;