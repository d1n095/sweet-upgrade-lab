import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Package, Clock, Mail, ArrowRight, Truck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Link, useSearchParams } from 'react-router-dom';
import { storeConfig } from '@/config/storeConfig';

const OrderConfirmation = () => {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order') || '';

  const content = {
    sv: {
      badge: 'Tack för din beställning!',
      title: 'Din order är mottagen',
      subtitle: 'Vi har tagit emot din beställning och påbörjar behandlingen inom kort.',
      orderNumberLabel: 'Ordernummer',
      steps: [
        {
          icon: CheckCircle,
          title: 'Order mottagen',
          description: 'Vi har tagit emot din beställning och skickat en bekräftelse till din e-post.'
        },
        {
          icon: Package,
          title: 'Vi behandlar din order',
          description: 'Vi granskar din beställning manuellt för att säkerställa kvalitet innan leverans.'
        },
        {
          icon: Truck,
          title: 'Leverans från leverantör',
          description: `Produkten skickas direkt från vår EU-baserade leverantör inom 1-3 arbetsdagar.`
        },
        {
          icon: Mail,
          title: 'Du får spårningsinformation',
          description: 'När paketet har skickats får du ett mail med spårningslänk.'
        }
      ],
      deliveryTime: `Beräknad leveranstid: ${storeConfig.shipping.deliveryDays} arbetsdagar`,
      emailInfo: 'En orderbekräftelse har skickats till din e-postadress.',
      trackOrder: 'Spåra din order',
      continueShopping: 'Fortsätt handla',
      questions: 'Har du frågor?',
      contactUs: 'Kontakta oss på'
    },
    en: {
      badge: 'Thank you for your order!',
      title: 'Your order is confirmed',
      subtitle: 'We have received your order and will begin processing it shortly.',
      orderNumberLabel: 'Order number',
      steps: [
        {
          icon: CheckCircle,
          title: 'Order received',
          description: 'We have received your order and sent a confirmation to your email.'
        },
        {
          icon: Package,
          title: 'We process your order',
          description: 'We manually review your order to ensure quality before shipping.'
        },
        {
          icon: Truck,
          title: 'Shipped from supplier',
          description: `The product ships directly from our EU-based supplier within 1-3 business days.`
        },
        {
          icon: Mail,
          title: 'You receive tracking info',
          description: 'When the package has been shipped, you\'ll receive an email with tracking.'
        }
      ],
      deliveryTime: `Estimated delivery: ${storeConfig.shipping.deliveryDays} business days`,
      emailInfo: 'An order confirmation has been sent to your email address.',
      trackOrder: 'Track your order',
      continueShopping: 'Continue shopping',
      questions: 'Have questions?',
      contactUs: 'Contact us at'
    },
    no: {
      badge: 'Takk for din bestilling!',
      title: 'Din ordre er bekreftet',
      subtitle: 'Vi har mottatt din bestilling og starter behandlingen snart.',
      orderNumberLabel: 'Ordrenummer',
      steps: [
        {
          icon: CheckCircle,
          title: 'Ordre mottatt',
          description: 'Vi har mottatt din bestilling og sendt en bekreftelse til din e-post.'
        },
        {
          icon: Package,
          title: 'Vi behandler din ordre',
          description: 'Vi gjennomgår din bestilling manuelt for å sikre kvalitet før levering.'
        },
        {
          icon: Truck,
          title: 'Sendes fra leverandør',
          description: `Produktet sendes direkte fra vår EU-baserte leverandør innen 1-3 virkedager.`
        },
        {
          icon: Mail,
          title: 'Du mottar sporingsinformasjon',
          description: 'Når pakken er sendt, får du en e-post med sporingslenke.'
        }
      ],
      deliveryTime: `Estimert leveringstid: ${storeConfig.shipping.deliveryDays} virkedager`,
      emailInfo: 'En ordrebekreftelse er sendt til din e-postadresse.',
      trackOrder: 'Spor din ordre',
      continueShopping: 'Fortsett å handle',
      questions: 'Har du spørsmål?',
      contactUs: 'Kontakt oss på'
    },
    da: {
      badge: 'Tak for din ordre!',
      title: 'Din ordre er bekræftet',
      subtitle: 'Vi har modtaget din ordre og begynder behandlingen snart.',
      orderNumberLabel: 'Ordrenummer',
      steps: [
        {
          icon: CheckCircle,
          title: 'Ordre modtaget',
          description: 'Vi har modtaget din ordre og sendt en bekræftelse til din e-mail.'
        },
        {
          icon: Package,
          title: 'Vi behandler din ordre',
          description: 'Vi gennemgår din ordre manuelt for at sikre kvalitet før levering.'
        },
        {
          icon: Truck,
          title: 'Sendes fra leverandør',
          description: `Produktet sendes direkte fra vores EU-baserede leverandør inden for 1-3 hverdage.`
        },
        {
          icon: Mail,
          title: 'Du modtager sporingsinformation',
          description: 'Når pakken er afsendt, får du en e-mail med sporingslink.'
        }
      ],
      deliveryTime: `Forventet leveringstid: ${storeConfig.shipping.deliveryDays} hverdage`,
      emailInfo: 'En ordrebekræftelse er sendt til din e-mailadresse.',
      trackOrder: 'Spor din ordre',
      continueShopping: 'Fortsæt med at handle',
      questions: 'Har du spørgsmål?',
      contactUs: 'Kontakt os på'
    },
    de: {
      badge: 'Vielen Dank für Ihre Bestellung!',
      title: 'Ihre Bestellung ist bestätigt',
      subtitle: 'Wir haben Ihre Bestellung erhalten und beginnen in Kürze mit der Bearbeitung.',
      orderNumberLabel: 'Bestellnummer',
      steps: [
        {
          icon: CheckCircle,
          title: 'Bestellung eingegangen',
          description: 'Wir haben Ihre Bestellung erhalten und eine Bestätigung an Ihre E-Mail gesendet.'
        },
        {
          icon: Package,
          title: 'Wir bearbeiten Ihre Bestellung',
          description: 'Wir prüfen Ihre Bestellung manuell, um Qualität vor dem Versand sicherzustellen.'
        },
        {
          icon: Truck,
          title: 'Versand vom Lieferanten',
          description: `Das Produkt wird direkt von unserem EU-Lieferanten innerhalb von 1-3 Werktagen versandt.`
        },
        {
          icon: Mail,
          title: 'Sie erhalten Tracking-Infos',
          description: 'Sobald das Paket versandt wurde, erhalten Sie eine E-Mail mit Tracking.'
        }
      ],
      deliveryTime: `Voraussichtliche Lieferzeit: ${storeConfig.shipping.deliveryDays} Werktage`,
      emailInfo: 'Eine Bestellbestätigung wurde an Ihre E-Mail-Adresse gesendet.',
      trackOrder: 'Bestellung verfolgen',
      continueShopping: 'Weiter einkaufen',
      questions: 'Haben Sie Fragen?',
      contactUs: 'Kontaktieren Sie uns unter'
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Success Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center mb-12"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-10 h-10 text-primary" />
            </motion.div>
            
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              {t.badge}
            </span>
            
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {t.title}
            </h1>
            <p className="text-muted-foreground text-lg mb-6">
              {t.subtitle}
            </p>

            {orderNumber && (
              <div className="inline-block bg-card border border-border/50 rounded-xl px-6 py-3">
                <p className="text-sm text-muted-foreground">{t.orderNumberLabel}</p>
                <p className="font-mono text-xl font-semibold">#{orderNumber}</p>
              </div>
            )}
          </motion.div>

          {/* Process Steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 mb-8"
          >
            <h2 className="font-display text-xl font-semibold mb-6 text-center">
              {language === 'sv' ? 'Vad händer nu?' : 'What happens next?'}
            </h2>
            
            <div className="space-y-6">
              {t.steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Delivery Time */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-primary/5 rounded-2xl p-6 text-center mb-8"
          >
            <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
            <p className="font-medium text-lg">{t.deliveryTime}</p>
            <p className="text-sm text-muted-foreground mt-2">{t.emailInfo}</p>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button asChild>
              <Link to="/track-order" className="flex items-center gap-2">
                {t.trackOrder}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/shop">{t.continueShopping}</Link>
            </Button>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center mt-12 text-sm text-muted-foreground"
          >
            <p>
              {t.questions}{' '}
              <a href={`mailto:${storeConfig.contact.email}`} className="text-primary hover:underline">
                {t.contactUs} {storeConfig.contact.email}
              </a>
            </p>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default OrderConfirmation;
