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
    },
    no: {
      title: 'Fraktinformasjon',
      badge: 'Frakt',
      intro: 'Vi streber etter å levere produktene dine så raskt og smidig som mulig. Her finner du all informasjon om våre leveringsalternativer.',
      infoCards: [
        { label: 'Fraktkostnad', value: `${storeConfig.shipping.cost} kr`, highlight: false },
        { label: 'Fri frakt over', value: `${storeConfig.shipping.freeShippingThreshold} kr`, highlight: true },
        { label: 'Leveringstid', value: storeConfig.shipping.deliveryTime.en, highlight: false },
        { label: 'Angrerett', value: `${storeConfig.returns.period} dager`, highlight: false },
      ],
      sections: [
        { title: 'Slik fungerer leveransen', icon: Package, text: 'Vi samarbeider med nøye utvalgte leverandører som sender produktene direkte til deg fra EU-baserte lager.' },
        { title: 'Leveringstider', icon: Clock, text: `Normal leveringstid er 7-10 virkedager. Dette inkluderer 1-3 virkedager for ordrebehandling og 4-7 virkedager for levering.` },
        { title: 'Leveringsområde', icon: Globe, text: 'Vi leverer til hele Europa. Ingen tollgebyrer eller importkostnader for EU-land.' },
        { title: 'Ordresporing', icon: MapPin, text: 'Når ordren er sendt, mottar du en e-post med sporingsinformasjon.' },
        { title: 'Viktig å vite', icon: AlertTriangle, text: 'Vi kan ikke garantere eksakte leveringsdatoer. Forsinkelser kan oppstå ved høytider.' }
      ]
    },
    da: {
      title: 'Fragtinformation',
      badge: 'Fragt',
      intro: 'Vi stræber efter at levere dine produkter så hurtigt og smidigt som muligt. Her finder du al information om vores leveringsmuligheder.',
      infoCards: [
        { label: 'Fragtomkostning', value: `${storeConfig.shipping.cost} kr`, highlight: false },
        { label: 'Gratis fragt over', value: `${storeConfig.shipping.freeShippingThreshold} kr`, highlight: true },
        { label: 'Leveringstid', value: storeConfig.shipping.deliveryTime.en, highlight: false },
        { label: 'Returret', value: `${storeConfig.returns.period} dage`, highlight: false },
      ],
      sections: [
        { title: 'Sådan fungerer leveringen', icon: Package, text: 'Vi samarbejder med omhyggeligt udvalgte leverandører, der sender produkterne direkte til dig fra EU-baserede lagre.' },
        { title: 'Leveringstider', icon: Clock, text: `Normal leveringstid er 7-10 hverdage. Dette inkluderer 1-3 hverdage til ordrebehandling og 4-7 hverdage til levering.` },
        { title: 'Leveringsområde', icon: Globe, text: 'Vi leverer til hele Europa. Ingen toldgebyrer eller importomkostninger for EU-lande.' },
        { title: 'Ordresporing', icon: MapPin, text: 'Når ordren er afsendt, modtager du en e-mail med sporingsinformation.' },
        { title: 'Vigtigt at vide', icon: AlertTriangle, text: 'Vi kan ikke garantere eksakte leveringsdatoer. Forsinkelser kan forekomme i højtider.' }
      ]
    },
    de: {
      title: 'Versandinformationen',
      badge: 'Versand',
      intro: 'Wir bemühen uns, Ihre Produkte so schnell und reibungslos wie möglich zu liefern. Hier finden Sie alle Informationen zu unseren Lieferoptionen.',
      infoCards: [
        { label: 'Versandkosten', value: `${storeConfig.shipping.cost} kr`, highlight: false },
        { label: 'Kostenloser Versand ab', value: `${storeConfig.shipping.freeShippingThreshold} kr`, highlight: true },
        { label: 'Lieferzeit', value: storeConfig.shipping.deliveryTime.en, highlight: false },
        { label: 'Rückgaberecht', value: `${storeConfig.returns.period} Tage`, highlight: false },
      ],
      sections: [
        { title: 'So funktioniert die Lieferung', icon: Package, text: 'Wir arbeiten mit sorgfältig ausgewählten Lieferanten zusammen, die Produkte direkt aus EU-Lagern an Sie versenden.' },
        { title: 'Lieferzeiten', icon: Clock, text: `Normale Lieferzeit beträgt 7-10 Werktage. Dies umfasst 1-3 Werktage für Auftragsbearbeitung und 4-7 Werktage für die Lieferung.` },
        { title: 'Liefergebiet', icon: Globe, text: 'Wir liefern in ganz Europa. Keine Zollgebühren oder Importkosten für EU-Länder.' },
        { title: 'Sendungsverfolgung', icon: MapPin, text: 'Sobald Ihre Bestellung versandt wurde, erhalten Sie eine E-Mail mit Tracking-Informationen.' },
        { title: 'Wichtig zu wissen', icon: AlertTriangle, text: 'Wir können keine exakten Liefertermine garantieren. Verzögerungen können während Feiertagen auftreten.' }
      ]
    },
    fi: {
      title: 'Toimitusehdot',
      badge: 'Toimitus',
      intro: 'Pyrimme toimittamaan tuotteesi mahdollisimman nopeasti ja sujuvasti. Täältä löydät kaikki tiedot toimitusvaihtoehdoistamme.',
      infoCards: [
        { label: 'Toimituskulut', value: `${storeConfig.shipping.cost} kr`, highlight: false },
        { label: 'Ilmainen toimitus yli', value: `${storeConfig.shipping.freeShippingThreshold} kr`, highlight: true },
        { label: 'Toimitusaika', value: storeConfig.shipping.deliveryTime.en, highlight: false },
        { label: 'Palautusoikeus', value: `${storeConfig.returns.period} päivää`, highlight: false },
      ],
      sections: [
        { title: 'Miten toimitus toimii', icon: Package, text: 'Teemme yhteistyötä huolellisesti valittujen toimittajien kanssa, jotka lähettävät tuotteet suoraan EU-varastoista.' },
        { title: 'Toimitusajat', icon: Clock, text: 'Normaali toimitusaika on 7-10 arkipäivää. Tämä sisältää 1-3 arkipäivää tilauksen käsittelyyn ja 4-7 arkipäivää toimitukseen.' },
        { title: 'Toimitusmaat', icon: Globe, text: 'Toimitamme kaikkialle Eurooppaan. Ei tullimaksuja EU-maihin.' },
        { title: 'Tilauksen seuranta', icon: MapPin, text: 'Kun tilauksesi on lähetetty, saat sähköpostin, jossa on seurantatiedot.' },
        { title: 'Tärkeää tietää', icon: AlertTriangle, text: 'Emme voi taata tarkkoja toimituspäiviä. Viivästyksiä voi esiintyä pyhäpäivinä.' }
      ]
    },
    nl: {
      title: 'Verzendinformatie',
      badge: 'Verzending',
      intro: 'We streven ernaar uw producten zo snel en soepel mogelijk te leveren. Hier vindt u alle informatie over onze leveringsopties.',
      infoCards: [
        { label: 'Verzendkosten', value: `${storeConfig.shipping.cost} kr`, highlight: false },
        { label: 'Gratis verzending vanaf', value: `${storeConfig.shipping.freeShippingThreshold} kr`, highlight: true },
        { label: 'Levertijd', value: storeConfig.shipping.deliveryTime.en, highlight: false },
        { label: 'Retourrecht', value: `${storeConfig.returns.period} dagen`, highlight: false },
      ],
      sections: [
        { title: 'Hoe levering werkt', icon: Package, text: 'We werken samen met zorgvuldig geselecteerde leveranciers die producten rechtstreeks vanuit EU-magazijnen verzenden.' },
        { title: 'Levertijden', icon: Clock, text: 'Normale levertijd is 7-10 werkdagen. Dit omvat 1-3 werkdagen voor orderverwerking en 4-7 werkdagen voor levering.' },
        { title: 'Leveringsgebied', icon: Globe, text: 'We leveren door heel Europa. Geen douanekosten of invoerkosten voor EU-landen.' },
        { title: 'Zending volgen', icon: MapPin, text: 'Zodra uw bestelling is verzonden, ontvangt u een e-mail met trackinginformatie.' },
        { title: 'Belangrijk om te weten', icon: AlertTriangle, text: 'We kunnen geen exacte leverdata garanderen. Vertragingen kunnen optreden tijdens feestdagen.' }
      ]
    },
    fr: {
      title: 'Informations de livraison',
      badge: 'Livraison',
      intro: 'Nous nous efforçons de livrer vos produits aussi rapidement et facilement que possible. Vous trouverez ici toutes les informations sur nos options de livraison.',
      infoCards: [
        { label: 'Frais de livraison', value: `${storeConfig.shipping.cost} kr`, highlight: false },
        { label: 'Livraison gratuite dès', value: `${storeConfig.shipping.freeShippingThreshold} kr`, highlight: true },
        { label: 'Délai de livraison', value: storeConfig.shipping.deliveryTime.en, highlight: false },
        { label: 'Droit de retour', value: `${storeConfig.returns.period} jours`, highlight: false },
      ],
      sections: [
        { title: 'Comment fonctionne la livraison', icon: Package, text: 'Nous travaillons avec des fournisseurs soigneusement sélectionnés qui expédient les produits directement depuis des entrepôts de l\'UE.' },
        { title: 'Délais de livraison', icon: Clock, text: 'Le délai de livraison normal est de 7 à 10 jours ouvrables. Cela comprend 1 à 3 jours pour le traitement et 4 à 7 jours pour la livraison.' },
        { title: 'Zone de livraison', icon: Globe, text: 'Nous livrons dans toute l\'Europe. Pas de frais de douane pour les pays de l\'UE.' },
        { title: 'Suivi de colis', icon: MapPin, text: 'Dès l\'expédition de votre commande, vous recevrez un e-mail avec les informations de suivi.' },
        { title: 'Important à savoir', icon: AlertTriangle, text: 'Nous ne pouvons pas garantir des dates de livraison exactes. Des retards peuvent survenir pendant les jours fériés.' }
      ]
    },
    es: {
      title: 'Información de envío',
      badge: 'Envío',
      intro: 'Nos esforzamos por entregar sus productos de la manera más rápida y fluida posible. Aquí encontrará toda la información sobre nuestras opciones de entrega.',
      infoCards: [
        { label: 'Gastos de envío', value: `${storeConfig.shipping.cost} kr`, highlight: false },
        { label: 'Envío gratuito desde', value: `${storeConfig.shipping.freeShippingThreshold} kr`, highlight: true },
        { label: 'Plazo de entrega', value: storeConfig.shipping.deliveryTime.en, highlight: false },
        { label: 'Derecho de devolución', value: `${storeConfig.returns.period} días`, highlight: false },
      ],
      sections: [
        { title: 'Cómo funciona la entrega', icon: Package, text: 'Trabajamos con proveedores cuidadosamente seleccionados que envían productos directamente desde almacenes de la UE.' },
        { title: 'Plazos de entrega', icon: Clock, text: 'El plazo de entrega normal es de 7 a 10 días hábiles. Esto incluye 1-3 días para procesar el pedido y 4-7 días para la entrega.' },
        { title: 'Zona de entrega', icon: Globe, text: 'Entregamos en toda Europa. Sin aranceles para los países de la UE.' },
        { title: 'Seguimiento del envío', icon: MapPin, text: 'Una vez enviado su pedido, recibirá un correo electrónico con la información de seguimiento.' },
        { title: 'Importante saber', icon: AlertTriangle, text: 'No podemos garantizar fechas de entrega exactas. Pueden producirse retrasos durante los días festivos.' }
      ]
    },
    pl: {
      title: 'Informacje o wysyłce',
      badge: 'Wysyłka',
      intro: 'Staramy się dostarczać produkty jak najszybciej i sprawnie. Tutaj znajdziesz wszystkie informacje o opcjach dostawy.',
      infoCards: [
        { label: 'Koszty wysyłki', value: `${storeConfig.shipping.cost} kr`, highlight: false },
        { label: 'Darmowa wysyłka od', value: `${storeConfig.shipping.freeShippingThreshold} kr`, highlight: true },
        { label: 'Czas dostawy', value: storeConfig.shipping.deliveryTime.en, highlight: false },
        { label: 'Prawo zwrotu', value: `${storeConfig.returns.period} dni`, highlight: false },
      ],
      sections: [
        { title: 'Jak działa dostawa', icon: Package, text: 'Współpracujemy ze starannie wybranymi dostawcami, którzy wysyłają produkty bezpośrednio z magazynów w UE.' },
        { title: 'Terminy dostawy', icon: Clock, text: 'Normalny czas dostawy wynosi 7-10 dni roboczych. Obejmuje to 1-3 dni na przetworzenie zamówienia i 4-7 dni na dostawę.' },
        { title: 'Obszar dostawy', icon: Globe, text: 'Dostarczamy na terenie całej Europy. Brak opłat celnych dla krajów UE.' },
        { title: 'Śledzenie przesyłki', icon: MapPin, text: 'Po wysłaniu zamówienia otrzymasz e-mail z informacjami o śledzeniu.' },
        { title: 'Ważne informacje', icon: AlertTriangle, text: 'Nie możemy zagwarantować dokładnych dat dostawy. Opóźnienia mogą wystąpić w święta.' }
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