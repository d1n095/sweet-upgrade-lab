import { useState } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Mail, Bell, Check, ArrowRight, Shield, Sparkles, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { useInsightLogger } from '@/hooks/useInsightLogger';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const CBD = () => {
  const { language } = useLanguage();
  const { logInterest } = useInsightLogger();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    
    await logInterest('cbd_interest', {
      category: 'cbd',
      email: email.trim(),
      message: message.trim() || undefined,
    });

    setIsSubmitted(true);
    setIsLoading(false);
    toast.success(
      (content[language as keyof typeof content] || content.en).success.title
    );
  };

  const content = {
    sv: {
      hero: {
        badge: 'Kommer snart',
        title: 'CBD & Hampaprodukter',
        subtitle: 'Vi förbereder ett noggrant utvalt sortiment av högkvalitativa CBD- och hampaprodukter. Var först att få veta när de finns tillgängliga.',
      },
      benefits: [
        { icon: Shield, title: 'Labbtestade', description: 'Alla produkter är tredjepartsverifierade för renhet och styrka.' },
        { icon: Leaf, title: 'Ekologiskt odlat', description: 'Från hållbara europeiska odlingar med full spårbarhet.' },
        { icon: Sparkles, title: 'Premiumkvalitet', description: 'Endast de bästa extraktionsmetoderna för maximal effekt.' },
        { icon: Heart, title: 'Naturligt välmående', description: 'Produkter för balans, återhämtning och dagligt välbefinnande.' },
      ],
      form: {
        title: 'Bli notifierad',
        subtitle: 'Skriv upp dig för att få veta först när vi lanserar vårt CBD-sortiment.',
        emailPlaceholder: 'Din e-postadress',
        messagePlaceholder: 'Finns det något speciellt du letar efter? (valfritt)',
        button: 'Meddela mig',
        submitting: 'Skickar...',
      },
      success: {
        title: 'Tack för ditt intresse!',
        subtitle: 'Vi skickar ett mail när CBD-produkterna är tillgängliga.',
      },
      legal: 'Vi följer alla svenska och EU-regler för CBD-produkter. Alla produkter innehåller mindre än 0.2% THC.',
    },
    en: {
      hero: {
        badge: 'Coming Soon',
        title: 'CBD & Hemp Products',
        subtitle: 'We\'re preparing a carefully curated selection of high-quality CBD and hemp products. Be the first to know when they\'re available.',
      },
      benefits: [
        { icon: Shield, title: 'Lab Tested', description: 'All products are third-party verified for purity and potency.' },
        { icon: Leaf, title: 'Organically Grown', description: 'From sustainable European farms with full traceability.' },
        { icon: Sparkles, title: 'Premium Quality', description: 'Only the best extraction methods for maximum effectiveness.' },
        { icon: Heart, title: 'Natural Wellness', description: 'Products for balance, recovery, and daily wellbeing.' },
      ],
      form: {
        title: 'Get Notified',
        subtitle: 'Sign up to be the first to know when we launch our CBD range.',
        emailPlaceholder: 'Your email address',
        messagePlaceholder: 'Is there something specific you\'re looking for? (optional)',
        button: 'Notify me',
        submitting: 'Sending...',
      },
      success: {
        title: 'Thanks for your interest!',
        subtitle: 'We\'ll send you an email when CBD products are available.',
      },
      legal: 'We comply with all Swedish and EU regulations for CBD products. All products contain less than 0.2% THC.',
    },
    no: {
      hero: {
        badge: 'Kommer snart',
        title: 'CBD & Hampeprodukter',
        subtitle: 'Vi forbereder et nøye utvalgt sortiment av høykvalitets CBD- og hampeprodukter. Bli den første som vet når de er tilgjengelige.',
      },
      benefits: [
        { icon: Shield, title: 'Laboratorietestet', description: 'Alle produkter er tredjeparts verifisert for renhet og styrke.' },
        { icon: Leaf, title: 'Økologisk dyrket', description: 'Fra bærekraftige europeiske gårder med full sporbarhet.' },
        { icon: Sparkles, title: 'Premiumkvalitet', description: 'Kun de beste ekstraksjonmetodene for maksimal effekt.' },
        { icon: Heart, title: 'Naturlig velvære', description: 'Produkter for balanse, restitusjon og daglig velvære.' },
      ],
      form: {
        title: 'Bli varslet',
        subtitle: 'Meld deg på for å være den første som vet når vi lanserer vårt CBD-sortiment.',
        emailPlaceholder: 'Din e-postadresse',
        messagePlaceholder: 'Er det noe spesielt du leter etter? (valgfritt)',
        button: 'Varsle meg',
        submitting: 'Sender...',
      },
      success: {
        title: 'Takk for din interesse!',
        subtitle: 'Vi sender deg en e-post når CBD-produktene er tilgjengelige.',
      },
      legal: 'Vi følger alle norske og EU-regler for CBD-produkter. Alle produkter inneholder mindre enn 0,2 % THC.',
    },
    da: {
      hero: {
        badge: 'Kommer snart',
        title: 'CBD & Hempeprodukter',
        subtitle: 'Vi forbereder et omhyggeligt udvalgt sortiment af højakvalitets CBD- og hempeprodukter. Vær den første til at vide, når de er tilgængelige.',
      },
      benefits: [
        { icon: Shield, title: 'Laboratorietestet', description: 'Alle produkter er tredjeparts verificeret for renhed og styrke.' },
        { icon: Leaf, title: 'Økologisk dyrket', description: 'Fra bæredygtige europæiske gårde med fuld sporbarhed.' },
        { icon: Sparkles, title: 'Premiumkvalitet', description: 'Kun de bedste ekstraktionsmetoder for maksimal effekt.' },
        { icon: Heart, title: 'Naturligt velvære', description: 'Produkter til balance, restitution og dagligt velvære.' },
      ],
      form: {
        title: 'Bliv notificeret',
        subtitle: 'Tilmeld dig for at være den første til at vide, når vi lancerer vores CBD-sortiment.',
        emailPlaceholder: 'Din e-mailadresse',
        messagePlaceholder: 'Er der noget bestemt du leder efter? (valgfrit)',
        button: 'Giv mig besked',
        submitting: 'Sender...',
      },
      success: {
        title: 'Tak for din interesse!',
        subtitle: 'Vi sender dig en e-mail, når CBD-produkterne er tilgængelige.',
      },
      legal: 'Vi overholder alle danske og EU-regler for CBD-produkter. Alle produkter indeholder mindre end 0,2 % THC.',
    },
    de: {
      hero: {
        badge: 'Demnächst verfügbar',
        title: 'CBD & Hanfprodukte',
        subtitle: 'Wir bereiten eine sorgfältig zusammengestellte Auswahl hochwertiger CBD- und Hanfprodukte vor. Sei der Erste, der es erfährt.',
      },
      benefits: [
        { icon: Shield, title: 'Laborgetestet', description: 'Alle Produkte werden von Dritten auf Reinheit und Potenz geprüft.' },
        { icon: Leaf, title: 'Biologisch angebaut', description: 'Von nachhaltigen europäischen Betrieben mit vollständiger Rückverfolgbarkeit.' },
        { icon: Sparkles, title: 'Premiumqualität', description: 'Nur die besten Extraktionsmethoden für maximale Wirksamkeit.' },
        { icon: Heart, title: 'Natürliches Wohlbefinden', description: 'Produkte für Balance, Erholung und tägliches Wohlbefinden.' },
      ],
      form: {
        title: 'Benachrichtigt werden',
        subtitle: 'Melde dich an, um als Erster zu erfahren, wenn wir unser CBD-Sortiment launchen.',
        emailPlaceholder: 'Deine E-Mail-Adresse',
        messagePlaceholder: 'Suchst du etwas Bestimmtes? (optional)',
        button: 'Benachrichtige mich',
        submitting: 'Wird gesendet...',
      },
      success: {
        title: 'Danke für dein Interesse!',
        subtitle: 'Wir senden dir eine E-Mail, wenn CBD-Produkte verfügbar sind.',
      },
      legal: 'Wir halten alle deutschen und EU-Vorschriften für CBD-Produkte ein. Alle Produkte enthalten weniger als 0,2 % THC.',
    },
    fi: {
      hero: {
        badge: 'Tulossa pian',
        title: 'CBD & Hampputuotteet',
        subtitle: 'Valmistelemme huolellisesti valittua valikoimaa korkealaatuisia CBD- ja hampputuotteita. Ole ensimmäinen, joka saa tietää.',
      },
      benefits: [
        { icon: Shield, title: 'Laboratoriotestattu', description: 'Kaikki tuotteet ovat kolmannen osapuolen varmentamia puhtauden ja tehokkuuden osalta.' },
        { icon: Leaf, title: 'Luonnonmukaisesti viljelty', description: 'Kestäviltä eurooppalaisilta tiloilta täydellä jäljitettävyydellä.' },
        { icon: Sparkles, title: 'Huippulaatu', description: 'Vain parhaat uuttomenetelmät maksimaalisen tehokkuuden saavuttamiseksi.' },
        { icon: Heart, title: 'Luonnollinen hyvinvointi', description: 'Tuotteet tasapainoon, palautumiseen ja päivittäiseen hyvinvointiin.' },
      ],
      form: {
        title: 'Saa ilmoitus',
        subtitle: 'Ilmoittaudu saadaksesi ensimmäisenä tietää, kun lanseeraamme CBD-valikoimamme.',
        emailPlaceholder: 'Sähköpostiosoitteesi',
        messagePlaceholder: 'Etsitkö jotain erityistä? (valinnainen)',
        button: 'Ilmoita minulle',
        submitting: 'Lähetetään...',
      },
      success: {
        title: 'Kiitos kiinnostuksestasi!',
        subtitle: 'Lähetämme sinulle sähköpostin, kun CBD-tuotteet ovat saatavilla.',
      },
      legal: 'Noudatamme kaikkia suomalaisia ja EU:n CBD-tuotteita koskevia säännöksiä. Kaikki tuotteet sisältävät alle 0,2 % THC:tä.',
    },
    nl: {
      hero: {
        badge: 'Binnenkort beschikbaar',
        title: 'CBD & Hennepproducten',
        subtitle: 'We bereiden een zorgvuldig samengesteld assortiment van hoogwaardige CBD- en hennepproducten voor. Wees de eerste die het weet.',
      },
      benefits: [
        { icon: Shield, title: 'Laboratoriumgetest', description: 'Alle producten zijn door derden geverifieerd op zuiverheid en potentie.' },
        { icon: Leaf, title: 'Biologisch geteeld', description: 'Van duurzame Europese boerderijen met volledige traceerbaarheid.' },
        { icon: Sparkles, title: 'Premiumkwaliteit', description: 'Alleen de beste extractiemethoden voor maximale effectiviteit.' },
        { icon: Heart, title: 'Natuurlijk welzijn', description: 'Producten voor balans, herstel en dagelijks welzijn.' },
      ],
      form: {
        title: 'Ontvang een melding',
        subtitle: 'Schrijf je in om als eerste te weten wanneer we ons CBD-assortiment lanceren.',
        emailPlaceholder: 'Jouw e-mailadres',
        messagePlaceholder: 'Is er iets specifieks waarnaar je op zoek bent? (optioneel)',
        button: 'Meld mij',
        submitting: 'Verzenden...',
      },
      success: {
        title: 'Bedankt voor je interesse!',
        subtitle: 'We sturen je een e-mail wanneer CBD-producten beschikbaar zijn.',
      },
      legal: 'We voldoen aan alle Nederlandse en EU-regelgeving voor CBD-producten. Alle producten bevatten minder dan 0,2% THC.',
    },
    fr: {
      hero: {
        badge: 'Bientôt disponible',
        title: 'Produits CBD & Chanvre',
        subtitle: 'Nous préparons une sélection soigneusement choisie de produits CBD et chanvre de haute qualité. Soyez le premier à le savoir.',
      },
      benefits: [
        { icon: Shield, title: 'Testé en laboratoire', description: 'Tous les produits sont vérifiés par des tiers pour leur pureté et leur puissance.' },
        { icon: Leaf, title: 'Cultivé biologiquement', description: "Provenant de fermes européennes durables avec une traçabilité complète." },
        { icon: Sparkles, title: 'Qualité premium', description: 'Uniquement les meilleures méthodes d\'extraction pour une efficacité maximale.' },
        { icon: Heart, title: 'Bien-être naturel', description: 'Produits pour l\'équilibre, la récupération et le bien-être quotidien.' },
      ],
      form: {
        title: 'Être notifié',
        subtitle: 'Inscrivez-vous pour être le premier informé du lancement de notre gamme CBD.',
        emailPlaceholder: 'Votre adresse e-mail',
        messagePlaceholder: 'Y a-t-il quelque chose de spécifique que vous recherchez ? (optionnel)',
        button: 'Me notifier',
        submitting: 'Envoi en cours...',
      },
      success: {
        title: 'Merci pour votre intérêt !',
        subtitle: 'Nous vous enverrons un e-mail lorsque les produits CBD seront disponibles.',
      },
      legal: 'Nous respectons toutes les réglementations françaises et européennes relatives aux produits CBD. Tous les produits contiennent moins de 0,2 % de THC.',
    },
    es: {
      hero: {
        badge: 'Próximamente',
        title: 'Productos CBD & Cáñamo',
        subtitle: 'Estamos preparando una selección cuidadosamente elegida de productos CBD y cáñamo de alta calidad. Sé el primero en saberlo.',
      },
      benefits: [
        { icon: Shield, title: 'Probado en laboratorio', description: 'Todos los productos están verificados por terceros en cuanto a pureza y potencia.' },
        { icon: Leaf, title: 'Cultivado ecológicamente', description: 'De granjas europeas sostenibles con plena trazabilidad.' },
        { icon: Sparkles, title: 'Calidad premium', description: 'Solo los mejores métodos de extracción para máxima efectividad.' },
        { icon: Heart, title: 'Bienestar natural', description: 'Productos para el equilibrio, la recuperación y el bienestar diario.' },
      ],
      form: {
        title: 'Recibir notificación',
        subtitle: 'Regístrate para ser el primero en saber cuándo lanzamos nuestra gama CBD.',
        emailPlaceholder: 'Tu dirección de correo electrónico',
        messagePlaceholder: '¿Hay algo específico que estás buscando? (opcional)',
        button: 'Notificarme',
        submitting: 'Enviando...',
      },
      success: {
        title: '¡Gracias por tu interés!',
        subtitle: 'Te enviaremos un correo electrónico cuando los productos CBD estén disponibles.',
      },
      legal: 'Cumplimos con todas las normativas españolas y de la UE sobre productos CBD. Todos los productos contienen menos del 0,2 % de THC.',
    },
    pl: {
      hero: {
        badge: 'Wkrótce dostępne',
        title: 'Produkty CBD & Konopie',
        subtitle: 'Przygotowujemy starannie dobrany asortyment wysokiej jakości produktów CBD i konopnych. Bądź pierwszym, który się dowie.',
      },
      benefits: [
        { icon: Shield, title: 'Przetestowane laboratoryjnie', description: 'Wszystkie produkty są weryfikowane przez strony trzecie pod kątem czystości i mocy.' },
        { icon: Leaf, title: 'Uprawiane ekologicznie', description: 'Z zrównoważonych europejskich gospodarstw z pełną identyfikowalnością.' },
        { icon: Sparkles, title: 'Jakość premium', description: 'Tylko najlepsze metody ekstrakcji dla maksymalnej skuteczności.' },
        { icon: Heart, title: 'Naturalne samopoczucie', description: 'Produkty dla równowagi, regeneracji i codziennego dobrostanu.' },
      ],
      form: {
        title: 'Otrzymaj powiadomienie',
        subtitle: 'Zapisz się, aby jako pierwszy dowiedzieć się o uruchomieniu naszej oferty CBD.',
        emailPlaceholder: 'Twój adres e-mail',
        messagePlaceholder: 'Czy szukasz czegoś konkretnego? (opcjonalnie)',
        button: 'Powiadom mnie',
        submitting: 'Wysyłanie...',
      },
      success: {
        title: 'Dziękujemy za zainteresowanie!',
        subtitle: 'Wyślemy Ci e-mail, gdy produkty CBD będą dostępne.',
      },
      legal: 'Przestrzegamy wszystkich polskich i unijnych przepisów dotyczących produktów CBD. Wszystkie produkty zawierają mniej niż 0,2% THC.',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 md:pt-32">
        {/* Hero Section */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="decorative-circle w-[600px] h-[600px] bg-primary/5 -top-48 -right-48" />
          <div className="decorative-circle w-[400px] h-[400px] bg-accent/5 bottom-0 -left-32" />
          
          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-3xl mx-auto"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
                <Leaf className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-accent">{t.hero.badge}</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6">
                {t.hero.title}
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                {t.hero.subtitle}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Benefits Grid */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {t.benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="group bg-card border border-border rounded-2xl p-6 hover:shadow-elevated transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-display font-semibold text-lg mb-2">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Interest Form */}
        <section className="py-16 md:py-24 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="max-w-xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-card border border-border rounded-2xl p-8 md:p-10 shadow-elevated"
              >
                {!isSubmitted ? (
                  <>
                    <div className="text-center mb-8">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Bell className="w-7 h-7 text-primary" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">
                        {t.form.title}
                      </h2>
                      <p className="text-muted-foreground">{t.form.subtitle}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Input
                          type="email"
                          placeholder={t.form.emailPlaceholder}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-12 rounded-xl"
                        />
                      </div>
                      <div>
                        <Textarea
                          placeholder={t.form.messagePlaceholder}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={3}
                          className="rounded-xl resize-none"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90"
                      >
                        {isLoading ? t.form.submitting : t.form.button}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-xl font-display font-semibold mb-2">
                      {t.success.title}
                    </h3>
                    <p className="text-muted-foreground">{t.success.subtitle}</p>
                  </div>
                )}
              </motion.div>

              <p className="text-center text-xs text-muted-foreground mt-6 max-w-md mx-auto">
                {t.legal}
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CBD;
