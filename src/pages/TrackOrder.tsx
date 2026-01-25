import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Package, Truck, CheckCircle2, Clock, MapPin, AlertCircle, FileCheck, Building2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { storeConfig } from '@/config/storeConfig';

interface OrderData {
  id: string;
  shopify_order_number: string | null;
  status: string;
  tracking_number: string | null;
  estimated_delivery: string | null;
  created_at: string;
  items: unknown;
  total_amount: number;
  currency: string;
}

const TrackOrder = () => {
  const { language } = useLanguage();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [notFound, setNotFound] = useState(false);

  const statusSteps = [
    { 
      id: 'pending', 
      icon: FileCheck, 
      label: { 
        sv: 'Order mottagen', 
        en: 'Order received',
        no: 'Ordre mottatt',
        da: 'Ordre modtaget',
        de: 'Bestellung eingegangen'
      },
      description: { 
        sv: 'Vi har tagit emot din beställning', 
        en: 'We have received your order',
        no: 'Vi har mottatt din bestilling',
        da: 'Vi har modtaget din ordre',
        de: 'Wir haben Ihre Bestellung erhalten'
      }
    },
    { 
      id: 'processing', 
      icon: Package, 
      label: { 
        sv: 'Behandlas', 
        en: 'Processing',
        no: 'Behandles',
        da: 'Behandles',
        de: 'In Bearbeitung'
      },
      description: { 
        sv: 'Din order förbereds för leverans', 
        en: 'Your order is being prepared',
        no: 'Din ordre forberedes for levering',
        da: 'Din ordre forberedes til levering',
        de: 'Ihre Bestellung wird vorbereitet'
      }
    },
    { 
      id: 'shipped', 
      icon: Truck, 
      label: { 
        sv: 'På väg till dig', 
        en: 'On its way',
        no: 'På vei til deg',
        da: 'På vej til dig',
        de: 'Unterwegs zu Ihnen'
      },
      description: { 
        sv: 'Din order är på väg från leverantören', 
        en: 'Your order is on its way from the supplier',
        no: 'Din ordre er på vei fra leverandøren',
        da: 'Din ordre er på vej fra leverandøren',
        de: 'Ihre Bestellung ist auf dem Weg vom Lieferanten'
      }
    },
    { 
      id: 'in_transit', 
      icon: Building2, 
      label: { 
        sv: 'Ankommit distributionscenter', 
        en: 'Arrived at distribution',
        no: 'Ankommet distribusjonssenter',
        da: 'Ankommet distributionscenter',
        de: 'Im Verteilzentrum angekommen'
      },
      description: { 
        sv: 'Paketet är på väg till ditt område', 
        en: 'Package is heading to your area',
        no: 'Pakken er på vei til ditt område',
        da: 'Pakken er på vej til dit område',
        de: 'Paket ist auf dem Weg in Ihre Region'
      }
    },
    { 
      id: 'delivered', 
      icon: CheckCircle2, 
      label: { 
        sv: 'Utlevererad', 
        en: 'Delivered',
        no: 'Levert',
        da: 'Leveret',
        de: 'Zugestellt'
      },
      description: { 
        sv: 'Din order har levererats', 
        en: 'Your order has been delivered',
        no: 'Din ordre er levert',
        da: 'Din ordre er leveret',
        de: 'Ihre Bestellung wurde zugestellt'
      }
    },
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setNotFound(false);
    setOrderData(null);

    try {
      // Clean order number (remove # if present)
      const cleanOrderNumber = orderNumber.replace('#', '').trim();
      
      // Search in database
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`shopify_order_number.eq.${cleanOrderNumber},id.eq.${cleanOrderNumber}`)
        .eq('order_email', email.toLowerCase().trim())
        .maybeSingle();

      if (error) {
        console.error('Order search error:', error);
        setNotFound(true);
      } else if (data) {
        setOrderData(data);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.error('Order search failed:', err);
      setNotFound(true);
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusIndex = (status: string): number => {
    const statusOrder = ['pending', 'processing', 'shipped', 'in_transit', 'delivered'];
    return statusOrder.indexOf(status);
  };

  const getLabel = (labels: { sv: string; en: string; no: string; da: string; de: string }) => {
    return labels[language as keyof typeof labels] || labels.en;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const content = {
    sv: {
      pageTitle: 'Spåra din order',
      pageBadge: 'Orderspårning',
      pageDescription: 'Ange ditt ordernummer och e-postadress för att se status på din leverans.',
      orderNumber: 'Ordernummer',
      orderNumberPlaceholder: 'T.ex. #1001',
      email: 'E-postadress',
      emailPlaceholder: 'din@email.se',
      searchButton: 'Sök order',
      searching: 'Söker...',
      notFoundTitle: 'Ingen order hittades',
      notFoundDescription: 'Vi kunde inte hitta någon order med dessa uppgifter. Kontrollera att ordernumret och e-postadressen stämmer.',
      notFoundHelp: 'Behöver du hjälp? Kontakta vår kundtjänst.',
      contactUs: 'Kontakta oss',
      deliveryInfoTitle: 'Leveranstider',
      deliveryInfoText: `Våra produkter skickas från EU-baserade leverantörer och levereras normalt inom ${storeConfig.shipping.deliveryDays} arbetsdagar. Vi hanterar beställningar manuellt för att säkerställa kvalitet.`,
      orderDetails: 'Orderdetaljer',
      orderDate: 'Beställd',
      estimatedDelivery: 'Beräknad leverans',
      trackingNumber: 'Spårningsnummer'
    },
    en: {
      pageTitle: 'Track your order',
      pageBadge: 'Order Tracking',
      pageDescription: 'Enter your order number and email to check your delivery status.',
      orderNumber: 'Order number',
      orderNumberPlaceholder: 'E.g. #1001',
      email: 'Email address',
      emailPlaceholder: 'your@email.com',
      searchButton: 'Search order',
      searching: 'Searching...',
      notFoundTitle: 'No order found',
      notFoundDescription: 'We couldn\'t find any order with these details. Please check that the order number and email are correct.',
      notFoundHelp: 'Need help? Contact our customer service.',
      contactUs: 'Contact us',
      deliveryInfoTitle: 'Delivery times',
      deliveryInfoText: `Our products ship from EU-based suppliers and are normally delivered within ${storeConfig.shipping.deliveryDays} business days. We process orders manually to ensure quality.`,
      orderDetails: 'Order details',
      orderDate: 'Ordered',
      estimatedDelivery: 'Estimated delivery',
      trackingNumber: 'Tracking number'
    },
    no: {
      pageTitle: 'Spor din ordre',
      pageBadge: 'Ordresporing',
      pageDescription: 'Skriv inn ordrenummer og e-postadresse for å se leveringsstatus.',
      orderNumber: 'Ordrenummer',
      orderNumberPlaceholder: 'F.eks. #1001',
      email: 'E-postadresse',
      emailPlaceholder: 'din@epost.no',
      searchButton: 'Søk ordre',
      searching: 'Søker...',
      notFoundTitle: 'Ingen ordre funnet',
      notFoundDescription: 'Vi kunne ikke finne noen ordre med disse detaljene. Sjekk at ordrenummer og e-post stemmer.',
      notFoundHelp: 'Trenger du hjelp? Kontakt kundeservice.',
      contactUs: 'Kontakt oss',
      deliveryInfoTitle: 'Leveringstider',
      deliveryInfoText: `Våre produkter sendes fra EU-baserte leverandører og leveres normalt innen ${storeConfig.shipping.deliveryDays} virkedager.`,
      orderDetails: 'Ordredetaljer',
      orderDate: 'Bestilt',
      estimatedDelivery: 'Estimert levering',
      trackingNumber: 'Sporingsnummer'
    },
    da: {
      pageTitle: 'Spor din ordre',
      pageBadge: 'Ordresporing',
      pageDescription: 'Indtast dit ordrenummer og e-mail for at se leveringsstatus.',
      orderNumber: 'Ordrenummer',
      orderNumberPlaceholder: 'F.eks. #1001',
      email: 'E-mailadresse',
      emailPlaceholder: 'din@email.dk',
      searchButton: 'Søg ordre',
      searching: 'Søger...',
      notFoundTitle: 'Ingen ordre fundet',
      notFoundDescription: 'Vi kunne ikke finde nogen ordre med disse oplysninger. Tjek at ordrenummer og e-mail er korrekte.',
      notFoundHelp: 'Brug for hjælp? Kontakt kundeservice.',
      contactUs: 'Kontakt os',
      deliveryInfoTitle: 'Leveringstider',
      deliveryInfoText: `Vores produkter sendes fra EU-baserede leverandører og leveres normalt inden for ${storeConfig.shipping.deliveryDays} hverdage.`,
      orderDetails: 'Ordredetaljer',
      orderDate: 'Bestilt',
      estimatedDelivery: 'Forventet levering',
      trackingNumber: 'Sporingsnummer'
    },
    de: {
      pageTitle: 'Bestellung verfolgen',
      pageBadge: 'Sendungsverfolgung',
      pageDescription: 'Geben Sie Ihre Bestellnummer und E-Mail ein, um den Lieferstatus zu sehen.',
      orderNumber: 'Bestellnummer',
      orderNumberPlaceholder: 'Z.B. #1001',
      email: 'E-Mail-Adresse',
      emailPlaceholder: 'ihre@email.de',
      searchButton: 'Bestellung suchen',
      searching: 'Suche...',
      notFoundTitle: 'Keine Bestellung gefunden',
      notFoundDescription: 'Wir konnten keine Bestellung mit diesen Daten finden. Bitte überprüfen Sie Bestellnummer und E-Mail.',
      notFoundHelp: 'Brauchen Sie Hilfe? Kontaktieren Sie unseren Kundenservice.',
      contactUs: 'Kontaktieren Sie uns',
      deliveryInfoTitle: 'Lieferzeiten',
      deliveryInfoText: `Unsere Produkte werden von EU-Lieferanten versandt und in der Regel innerhalb von ${storeConfig.shipping.deliveryDays} Werktagen geliefert.`,
      orderDetails: 'Bestelldetails',
      orderDate: 'Bestellt am',
      estimatedDelivery: 'Voraussichtliche Lieferung',
      trackingNumber: 'Sendungsnummer'
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Truck className="w-4 h-4" />
              {t.pageBadge}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {t.pageTitle}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t.pageDescription}
            </p>
          </motion.div>

          {/* Search Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-xl mx-auto mb-12"
          >
            <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8">
              <form onSubmit={handleSearch} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="orderNumber">{t.orderNumber}</Label>
                  <Input
                    id="orderNumber"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    required
                    placeholder={t.orderNumberPlaceholder}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={t.emailPlaceholder}
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isSearching}>
                  {isSearching ? (
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 animate-spin" />
                      {t.searching}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      {t.searchButton}
                    </span>
                  )}
                </Button>
              </form>
            </div>
          </motion.div>

          {/* Not Found Message */}
          {notFound && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl mx-auto text-center"
            >
              <div className="bg-card border border-border/50 rounded-2xl p-8">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-display text-xl font-semibold mb-2">
                  {t.notFoundTitle}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t.notFoundDescription}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.notFoundHelp}
                </p>
                <Button variant="outline" className="mt-4" asChild>
                  <a href="/contact">{t.contactUs}</a>
                </Button>
              </div>
            </motion.div>
          )}

          {/* Order Status Display */}
          {orderData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t.orderDetails} #{orderData.shopify_order_number || orderData.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t.orderDate}: {formatDate(orderData.created_at)}
                    </p>
                  </div>
                  {orderData.estimated_delivery && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{t.estimatedDelivery}</p>
                      <p className="font-medium">{formatDate(orderData.estimated_delivery)}</p>
                    </div>
                  )}
                </div>

                {/* Status Timeline */}
                <div className="relative">
                  {statusSteps.map((step, index) => {
                    const currentIndex = getStatusIndex(orderData.status);
                    const isCompleted = index <= currentIndex;
                    const isCurrent = index === currentIndex;

                    return (
                      <div key={step.id} className="flex items-start gap-4 mb-6 last:mb-0">
                        <div className="relative flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isCompleted ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                          } ${isCurrent ? 'ring-4 ring-primary/20' : ''}`}>
                            <step.icon className="w-5 h-5" />
                          </div>
                          {index < statusSteps.length - 1 && (
                            <div className={`w-0.5 h-12 mt-2 ${
                              index < currentIndex ? 'bg-primary' : 'bg-border'
                            }`} />
                          )}
                        </div>
                        <div className="flex-1 pt-2">
                          <p className={`font-medium ${isCurrent ? 'text-primary' : ''}`}>
                            {getLabel(step.label)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {getLabel(step.description)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tracking Info */}
                {orderData.tracking_number && (
                  <div className="mt-8 pt-6 border-t border-border">
                    <div className="flex items-center gap-4">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">{t.trackingNumber}</p>
                        <p className="font-mono font-medium">{orderData.tracking_number}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Helpful Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto mt-12"
          >
            <div className="bg-primary/5 rounded-2xl p-6 text-center">
              <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-display text-lg font-semibold mb-2">
                {t.deliveryInfoTitle}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t.deliveryInfoText}
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TrackOrder;
