import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Package, Users, HandshakeIcon, Mail, Phone, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { storeConfig } from '@/config/storeConfig';

const Business = () => {
  const { language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    message: ''
  });

  const content = {
    sv: {
      title: 'Handla som Företag',
      subtitle: 'Stora beställningar? Kontakta oss för specialpriser och anpassade lösningar.',
      description: 'Vi välkomnar företag som vill beställa våra produkter. Kontakta oss för att diskutera era behov, volymrabatter och leveransmöjligheter.',
      benefits: [
        { icon: Package, title: 'Volymrabatter', description: 'Bättre priser vid större beställningar' },
        { icon: Users, title: 'Personlig kontakt', description: 'Dedikerad support för företagskunder' },
        { icon: HandshakeIcon, title: 'Flexibla lösningar', description: 'Anpassade efter era behov' },
        { icon: Building2, title: 'Faktura', description: 'Möjlighet till fakturabetalning' },
      ],
      formTitle: 'Kontakta oss',
      formDescription: 'Fyll i formuläret nedan så återkommer vi inom 24 timmar.',
      companyLabel: 'Företagsnamn',
      contactLabel: 'Kontaktperson',
      emailLabel: 'E-post',
      phoneLabel: 'Telefon',
      messageLabel: 'Beskriv era behov',
      messagePlaceholder: 'Vilka produkter är ni intresserade av? Uppskattad ordervolym?',
      submit: 'Skicka förfrågan',
      success: 'Tack för din förfrågan!',
      successDescription: 'Vi har tagit emot ditt meddelande och återkommer inom 24 timmar.',
      note: 'OBS: Vi erbjuder för närvarande inte automatisk momsavdragning eller företagsinloggning. Alla beställningar hanteras manuellt för att ge er personlig service.',
      fillRequired: 'Fyll i obligatoriska fält',
      sending: 'Skickar...',
      submitError: 'Kunde inte skicka förfrågan',
      newInquiry: 'Skicka ny förfrågan',
      contactDirectly: 'Eller kontakta oss direkt:',
    },
    en: {
      title: 'Business Customers',
      subtitle: 'Large orders? Contact us for special pricing and custom solutions.',
      description: 'We welcome businesses looking to order our products. Contact us to discuss your needs, volume discounts, and delivery options.',
      benefits: [
        { icon: Package, title: 'Volume Discounts', description: 'Better prices for larger orders' },
        { icon: Users, title: 'Personal Contact', description: 'Dedicated support for business customers' },
        { icon: HandshakeIcon, title: 'Flexible Solutions', description: 'Customized to your needs' },
        { icon: Building2, title: 'Invoice', description: 'Invoice payment available' },
      ],
      formTitle: 'Contact Us',
      formDescription: "Fill out the form below and we'll get back to you within 24 hours.",
      companyLabel: 'Company Name',
      contactLabel: 'Contact Person',
      emailLabel: 'Email',
      phoneLabel: 'Phone',
      messageLabel: 'Describe your needs',
      messagePlaceholder: 'Which products are you interested in? Estimated order volume?',
      submit: 'Send Inquiry',
      success: 'Thanks for your inquiry!',
      successDescription: "We've received your message and will respond within 24 hours.",
      note: 'NOTE: We currently do not offer automatic VAT deduction or business login. All orders are handled manually to provide you with personalized service.',
      fillRequired: 'Please fill in required fields',
      sending: 'Sending...',
      submitError: 'Could not submit inquiry',
      newInquiry: 'Send new inquiry',
      contactDirectly: 'Or contact us directly:',
    },
    no: {
      title: 'Bedriftskunder',
      subtitle: 'Store bestillinger? Kontakt oss for spesialpris og tilpassede løsninger.',
      description: 'Vi ønsker bedrifter velkommen som ønsker å bestille produktene våre. Kontakt oss for å diskutere behovene dine, volumrabatter og leveringsalternativer.',
      benefits: [
        { icon: Package, title: 'Volumrabatter', description: 'Bedre priser for større bestillinger' },
        { icon: Users, title: 'Personlig kontakt', description: 'Dedikert support for bedriftskunder' },
        { icon: HandshakeIcon, title: 'Fleksible løsninger', description: 'Tilpasset dine behov' },
        { icon: Building2, title: 'Faktura', description: 'Fakturabetaling tilgjengelig' },
      ],
      formTitle: 'Kontakt oss',
      formDescription: 'Fyll ut skjemaet nedenfor, så svarer vi innen 24 timer.',
      companyLabel: 'Firmanavn',
      contactLabel: 'Kontaktperson',
      emailLabel: 'E-post',
      phoneLabel: 'Telefon',
      messageLabel: 'Beskriv behovene dine',
      messagePlaceholder: 'Hvilke produkter er dere interessert i? Estimert ordrevolum?',
      submit: 'Send forespørsel',
      success: 'Takk for forespørselen din!',
      successDescription: 'Vi har mottatt meldingen din og svarer innen 24 timer.',
      note: 'MERK: Vi tilbyr for øyeblikket ikke automatisk momsavtrekk eller bedriftspålogging. Alle bestillinger håndteres manuelt for å gi deg personlig service.',
      fillRequired: 'Fyll ut obligatoriske felt',
      sending: 'Sender...',
      submitError: 'Kunne ikke sende forespørsel',
      newInquiry: 'Send ny forespørsel',
      contactDirectly: 'Eller kontakt oss direkte:',
    },
    da: {
      title: 'Erhvervskunder',
      subtitle: 'Store ordrer? Kontakt os for specialpriser og skræddersyede løsninger.',
      description: 'Vi byder virksomheder velkomne, der ønsker at bestille vores produkter. Kontakt os for at diskutere dine behov, volumenerabatter og leveringsmuligheder.',
      benefits: [
        { icon: Package, title: 'Mængderabatter', description: 'Bedre priser ved større ordrer' },
        { icon: Users, title: 'Personlig kontakt', description: 'Dedikeret support til erhvervskunder' },
        { icon: HandshakeIcon, title: 'Fleksible løsninger', description: 'Tilpasset dine behov' },
        { icon: Building2, title: 'Faktura', description: 'Fakturabetaling tilgængelig' },
      ],
      formTitle: 'Kontakt os',
      formDescription: 'Udfyld formularen nedenfor, og vi vender tilbage inden for 24 timer.',
      companyLabel: 'Firmanavn',
      contactLabel: 'Kontaktperson',
      emailLabel: 'E-mail',
      phoneLabel: 'Telefon',
      messageLabel: 'Beskriv jeres behov',
      messagePlaceholder: 'Hvilke produkter er I interesserede i? Estimeret ordrevolumen?',
      submit: 'Send forespørgsel',
      success: 'Tak for din forespørgsel!',
      successDescription: 'Vi har modtaget din besked og vender tilbage inden for 24 timer.',
      note: 'BEMÆRK: Vi tilbyder i øjeblikket ikke automatisk momsfradrag eller erhvervslogin. Alle ordrer håndteres manuelt for at give jer personlig service.',
      fillRequired: 'Udfyld venligst obligatoriske felter',
      sending: 'Sender...',
      submitError: 'Kunne ikke sende forespørgsel',
      newInquiry: 'Send ny forespørgsel',
      contactDirectly: 'Eller kontakt os direkte:',
    },
    de: {
      title: 'Geschäftskunden',
      subtitle: 'Große Bestellungen? Kontaktieren Sie uns für Sonderpreise und individuelle Lösungen.',
      description: 'Wir heißen Unternehmen willkommen, die unsere Produkte bestellen möchten. Kontaktieren Sie uns, um Ihre Bedürfnisse, Mengenrabatte und Liefermöglichkeiten zu besprechen.',
      benefits: [
        { icon: Package, title: 'Mengenrabatte', description: 'Bessere Preise bei größeren Bestellungen' },
        { icon: Users, title: 'Persönlicher Kontakt', description: 'Dedizierter Support für Geschäftskunden' },
        { icon: HandshakeIcon, title: 'Flexible Lösungen', description: 'Auf Ihre Bedürfnisse zugeschnitten' },
        { icon: Building2, title: 'Rechnung', description: 'Zahlung per Rechnung möglich' },
      ],
      formTitle: 'Kontaktieren Sie uns',
      formDescription: 'Füllen Sie das Formular unten aus und wir melden uns innerhalb von 24 Stunden.',
      companyLabel: 'Firmenname',
      contactLabel: 'Ansprechpartner',
      emailLabel: 'E-Mail',
      phoneLabel: 'Telefon',
      messageLabel: 'Beschreiben Sie Ihren Bedarf',
      messagePlaceholder: 'Welche Produkte interessieren Sie? Geschätztes Bestellvolumen?',
      submit: 'Anfrage senden',
      success: 'Danke für Ihre Anfrage!',
      successDescription: 'Wir haben Ihre Nachricht erhalten und melden uns innerhalb von 24 Stunden.',
      note: 'HINWEIS: Wir bieten derzeit keine automatische Mehrwertsteuererstattung oder Unternehmens-Login an. Alle Bestellungen werden manuell bearbeitet, um Ihnen einen persönlichen Service zu bieten.',
      fillRequired: 'Bitte füllen Sie die Pflichtfelder aus',
      sending: 'Wird gesendet...',
      submitError: 'Anfrage konnte nicht gesendet werden',
      newInquiry: 'Neue Anfrage senden',
      contactDirectly: 'Oder kontaktieren Sie uns direkt:',
    },
    fi: {
      title: 'Yritysasiakkaat',
      subtitle: 'Suuret tilaukset? Ota yhteyttä erikoishinnoittelua ja räätälöityjä ratkaisuja varten.',
      description: 'Toivotamme tervetulleeksi yritykset, jotka haluavat tilata tuotteitamme. Ota yhteyttä keskustellaksesi tarpeistasi, volyymialennuksista ja toimitusmahdollisuuksista.',
      benefits: [
        { icon: Package, title: 'Volyymialennukset', description: 'Paremmat hinnat suuremmille tilauksille' },
        { icon: Users, title: 'Henkilökohtainen yhteyshenkilö', description: 'Omistettu tuki yritysasiakkaille' },
        { icon: HandshakeIcon, title: 'Joustavat ratkaisut', description: 'Räätälöity tarpeisiisi' },
        { icon: Building2, title: 'Lasku', description: 'Laskumaksu saatavilla' },
      ],
      formTitle: 'Ota yhteyttä',
      formDescription: 'Täytä alla oleva lomake ja vastaamme 24 tunnin sisällä.',
      companyLabel: 'Yrityksen nimi',
      contactLabel: 'Yhteyshenkilö',
      emailLabel: 'Sähköposti',
      phoneLabel: 'Puhelin',
      messageLabel: 'Kuvaile tarpeitasi',
      messagePlaceholder: 'Mistä tuotteista olette kiinnostuneita? Arvioitu tilausvolyymi?',
      submit: 'Lähetä pyyntö',
      success: 'Kiitos tiedustelustasi!',
      successDescription: 'Olemme vastaanottaneet viestisi ja vastaamme 24 tunnin sisällä.',
      note: 'HUOM: Emme tällä hetkellä tarjoa automaattista arvonlisäverovähennystä tai yrityskirjautumista. Kaikki tilaukset käsitellään manuaalisesti henkilökohtaisen palvelun takaamiseksi.',
      fillRequired: 'Täytä pakolliset kentät',
      sending: 'Lähetetään...',
      submitError: 'Tiedustelua ei voitu lähettää',
      newInquiry: 'Lähetä uusi tiedustelu',
      contactDirectly: 'Tai ota yhteyttä suoraan:',
    },
    nl: {
      title: 'Zakelijke klanten',
      subtitle: 'Grote bestellingen? Neem contact op voor speciale prijzen en maatwerkoplossingen.',
      description: 'We verwelkomen bedrijven die onze producten willen bestellen. Neem contact op om uw behoeften, volumekortingen en leveringsmogelijkheden te bespreken.',
      benefits: [
        { icon: Package, title: 'Volumekortingen', description: 'Betere prijzen bij grotere bestellingen' },
        { icon: Users, title: 'Persoonlijk contact', description: 'Toegewijde ondersteuning voor zakelijke klanten' },
        { icon: HandshakeIcon, title: 'Flexibele oplossingen', description: 'Aangepast aan uw behoeften' },
        { icon: Building2, title: 'Factuur', description: 'Betaling op factuur mogelijk' },
      ],
      formTitle: 'Neem contact op',
      formDescription: 'Vul het onderstaande formulier in en we reageren binnen 24 uur.',
      companyLabel: 'Bedrijfsnaam',
      contactLabel: 'Contactpersoon',
      emailLabel: 'E-mail',
      phoneLabel: 'Telefoon',
      messageLabel: 'Beschrijf uw behoeften',
      messagePlaceholder: 'Welke producten interesseren u? Geschat bestelvolume?',
      submit: 'Aanvraag versturen',
      success: 'Bedankt voor uw aanvraag!',
      successDescription: 'We hebben uw bericht ontvangen en reageren binnen 24 uur.',
      note: 'LET OP: We bieden momenteel geen automatische btw-aftrek of zakelijke login. Alle bestellingen worden handmatig verwerkt om u persoonlijke service te bieden.',
      fillRequired: 'Vul verplichte velden in',
      sending: 'Verzenden...',
      submitError: 'Aanvraag kon niet worden verzonden',
      newInquiry: 'Nieuwe aanvraag versturen',
      contactDirectly: 'Of neem direct contact op:',
    },
    fr: {
      title: 'Clients professionnels',
      subtitle: 'Grandes commandes ? Contactez-nous pour des tarifs spéciaux et des solutions personnalisées.',
      description: 'Nous accueillons les entreprises souhaitant commander nos produits. Contactez-nous pour discuter de vos besoins, remises sur volume et options de livraison.',
      benefits: [
        { icon: Package, title: 'Remises sur volume', description: 'Meilleurs prix pour les grandes commandes' },
        { icon: Users, title: 'Contact personnel', description: 'Support dédié aux clients professionnels' },
        { icon: HandshakeIcon, title: 'Solutions flexibles', description: 'Adaptées à vos besoins' },
        { icon: Building2, title: 'Facture', description: 'Paiement par facture disponible' },
      ],
      formTitle: 'Contactez-nous',
      formDescription: 'Remplissez le formulaire ci-dessous et nous vous répondrons sous 24 heures.',
      companyLabel: 'Nom de l\'entreprise',
      contactLabel: 'Personne de contact',
      emailLabel: 'E-mail',
      phoneLabel: 'Téléphone',
      messageLabel: 'Décrivez vos besoins',
      messagePlaceholder: 'Quels produits vous intéressent ? Volume de commande estimé ?',
      submit: 'Envoyer la demande',
      success: 'Merci pour votre demande !',
      successDescription: 'Nous avons reçu votre message et vous répondrons sous 24 heures.',
      note: "REMARQUE : Nous n'offrons actuellement pas de déduction TVA automatique ni de connexion professionnelle. Toutes les commandes sont traitées manuellement pour vous offrir un service personnalisé.",
      fillRequired: 'Veuillez remplir les champs obligatoires',
      sending: 'Envoi en cours...',
      submitError: "Impossible d'envoyer la demande",
      newInquiry: 'Envoyer une nouvelle demande',
      contactDirectly: 'Ou contactez-nous directement :',
    },
    es: {
      title: 'Clientes empresariales',
      subtitle: '¿Pedidos grandes? Contáctanos para precios especiales y soluciones personalizadas.',
      description: 'Damos la bienvenida a empresas que deseen pedir nuestros productos. Contáctanos para hablar sobre tus necesidades, descuentos por volumen y opciones de entrega.',
      benefits: [
        { icon: Package, title: 'Descuentos por volumen', description: 'Mejores precios en pedidos grandes' },
        { icon: Users, title: 'Contacto personal', description: 'Soporte dedicado para clientes empresariales' },
        { icon: HandshakeIcon, title: 'Soluciones flexibles', description: 'Adaptadas a tus necesidades' },
        { icon: Building2, title: 'Factura', description: 'Pago por factura disponible' },
      ],
      formTitle: 'Contáctanos',
      formDescription: 'Rellena el formulario a continuación y te responderemos en 24 horas.',
      companyLabel: 'Nombre de la empresa',
      contactLabel: 'Persona de contacto',
      emailLabel: 'Correo electrónico',
      phoneLabel: 'Teléfono',
      messageLabel: 'Describe tus necesidades',
      messagePlaceholder: '¿Qué productos os interesan? ¿Volumen de pedido estimado?',
      submit: 'Enviar consulta',
      success: '¡Gracias por tu consulta!',
      successDescription: 'Hemos recibido tu mensaje y responderemos en 24 horas.',
      note: 'NOTA: Actualmente no ofrecemos deducción automática de IVA ni inicio de sesión empresarial. Todos los pedidos se gestionan manualmente para ofrecerte un servicio personalizado.',
      fillRequired: 'Por favor rellena los campos obligatorios',
      sending: 'Enviando...',
      submitError: 'No se pudo enviar la consulta',
      newInquiry: 'Enviar nueva consulta',
      contactDirectly: 'O contáctanos directamente:',
    },
    pl: {
      title: 'Klienci biznesowi',
      subtitle: 'Duże zamówienia? Skontaktuj się z nami w sprawie specjalnych cen i niestandardowych rozwiązań.',
      description: 'Witamy firmy, które chcą zamawiać nasze produkty. Skontaktuj się z nami, aby omówić swoje potrzeby, rabaty ilościowe i możliwości dostawy.',
      benefits: [
        { icon: Package, title: 'Rabaty ilościowe', description: 'Lepsze ceny przy większych zamówieniach' },
        { icon: Users, title: 'Osobisty kontakt', description: 'Dedykowane wsparcie dla klientów biznesowych' },
        { icon: HandshakeIcon, title: 'Elastyczne rozwiązania', description: 'Dostosowane do Twoich potrzeb' },
        { icon: Building2, title: 'Faktura', description: 'Płatność na fakturę dostępna' },
      ],
      formTitle: 'Skontaktuj się z nami',
      formDescription: 'Wypełnij poniższy formularz, a my odpowiemy w ciągu 24 godzin.',
      companyLabel: 'Nazwa firmy',
      contactLabel: 'Osoba kontaktowa',
      emailLabel: 'E-mail',
      phoneLabel: 'Telefon',
      messageLabel: 'Opisz swoje potrzeby',
      messagePlaceholder: 'Jakie produkty Cię interesują? Szacowana wielkość zamówienia?',
      submit: 'Wyślij zapytanie',
      success: 'Dziękujemy za zapytanie!',
      successDescription: 'Otrzymaliśmy Twoją wiadomość i odpowiemy w ciągu 24 godzin.',
      note: 'UWAGA: Obecnie nie oferujemy automatycznego odliczenia VAT ani logowania firmowego. Wszystkie zamówienia są obsługiwane ręcznie, aby zapewnić Ci spersonalizowaną obsługę.',
      fillRequired: 'Proszę wypełnić wymagane pola',
      sending: 'Wysyłanie...',
      submitError: 'Nie można wysłać zapytania',
      newInquiry: 'Wyślij nowe zapytanie',
      contactDirectly: 'Lub skontaktuj się bezpośrednio:',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName || !formData.email) {
      toast.error(t.fillRequired);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('interest_logs')
        .insert({
          interest_type: 'business_inquiry',
          message: `Company: ${formData.companyName}, Contact: ${formData.contactPerson}, Phone: ${formData.phone}, Message: ${formData.message}`,
          email: formData.email,
          category: 'b2b'
        });

      if (error) throw error;
      
      setIsSubmitted(true);
      toast.success(t.success);
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      toast.error(t.submitError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t.title}
        description={t.description}
        keywords="företag, b2b, företagskunder, volymrabatt, grossist"
        canonical="/business"
      />
      <Header />

      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary mb-6">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">B2B</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {t.title}
            </h1>
            <p className="text-xl text-muted-foreground mb-4">
              {t.subtitle}
            </p>
            <p className="text-muted-foreground">
              {t.description}
            </p>
          </motion.div>

          {/* Benefits */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {t.benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6 text-center"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Form Section */}
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border rounded-2xl p-8"
            >
              {isSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-2">{t.success}</h3>
                  <p className="text-muted-foreground mb-6">{t.successDescription}</p>
                  <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                    {t.newInquiry}
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="font-display text-2xl font-semibold mb-2">{t.formTitle}</h2>
                  <p className="text-muted-foreground mb-6">{t.formDescription}</p>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          {t.companyLabel} *
                        </label>
                        <Input
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          className="h-12"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          {t.contactLabel}
                        </label>
                        <Input
                          value={formData.contactPerson}
                          onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                          className="h-12"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          {t.emailLabel} *
                        </label>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="h-12"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          {t.phoneLabel}
                        </label>
                        <Input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="h-12"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {t.messageLabel}
                      </label>
                      <Textarea
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder={t.messagePlaceholder}
                        rows={4}
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full h-14 text-base font-semibold"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          {t.sending}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          {t.submit}
                          <ArrowRight className="w-5 h-5" />
                        </span>
                      )}
                    </Button>
                  </form>

                  <p className="text-xs text-muted-foreground mt-6 p-4 bg-secondary/30 rounded-lg">
                    {t.note}
                  </p>
                </>
              )}
            </motion.div>

            {/* Contact Info */}
            <div className="mt-8 text-center">
              <p className="text-muted-foreground mb-4">
                {t.contactDirectly}
              </p>
              <div className="flex flex-wrap justify-center gap-6">
                <a
                  href={`mailto:${storeConfig.contact.email}`}
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Mail className="w-4 h-4" />
                  {storeConfig.contact.email}
                </a>
                <a
                  href={`tel:${storeConfig.contact.phone}`}
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Phone className="w-4 h-4" />
                  {storeConfig.contact.phoneFormatted}
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Business;
