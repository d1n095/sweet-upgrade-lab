import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Send, Check, TrendingDown, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ProductSuggestions = () => {
  const { language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    productType: '',
    properties: '',
    usage: '',
    certifications: [] as string[],
    email: ''
  });

  const content: Record<string, {
    title: string;
    subtitle: string;
    description: string;
    productTypeLabel: string;
    productTypePlaceholder: string;
    propertiesLabel: string;
    propertiesPlaceholder: string;
    propertiesHint: string;
    usageLabel: string;
    usagePlaceholder: string;
    certificationsLabel: string;
    emailLabel: string;
    emailPlaceholder: string;
    submit: string;
    success: string;
    successDescription: string;
    benefits: string[];
    certOptions: string[];
  }> = {
    sv: {
      title: 'Önska en produkt',
      subtitle: 'Hjälp oss hitta rätt produkter',
      description: 'Berätta vad du letar efter! Vi bryr oss inte om märken - vi vill veta vilken typ av produkt och vilka egenskaper som är viktiga för dig. Då kan vi hitta eller ta fram en bättre och billigare version.',
      productTypeLabel: 'Vad är det för typ av produkt?',
      productTypePlaceholder: 'T.ex. Deodorant, Tvål, Ljus, Solcellsladdare...',
      propertiesLabel: 'Vilka egenskaper är viktiga?',
      propertiesPlaceholder: 'Beskriv vad produkten ska kunna eller ha:\n• Bra för känslig hud\n• Parfymfri\n• Naturliga ingredienser\n• Lång batteritid\n• Tillverkad av bivax\n• Etc.',
      propertiesHint: 'Var så specifik du kan - det hjälper oss hitta rätt!',
      usageLabel: 'Vad ska du använda produkten till?',
      usagePlaceholder: 'T.ex. Daglig användning, träning, som present, till barn...',
      certificationsLabel: 'Viktiga certifieringar/egenskaper:',
      emailLabel: 'Din e-post (valfritt)',
      emailPlaceholder: 'Vi meddelar dig när produkten finns',
      submit: 'Skicka önskemål',
      success: 'Tack för ditt önskemål!',
      successDescription: 'Vi har tagit emot din förfrågan och kommer undersöka möjligheterna att ta fram en produkt som passar dina behov.',
      benefits: [
        'Vi hittar bättre alternativ',
        'Lägre pris än märkesprodukter',
        'Fokus på funktion, inte varumärke'
      ],
      certOptions: ['Ekologisk', 'Vegansk', 'Allergivänlig', 'Hållbar', 'Giftfri', 'Svensktillverkad']
    },
    en: {
      title: 'Request a product',
      subtitle: 'Help us find the right products',
      description: "Tell us what you're looking for! We don't care about brands - we want to know what type of product and what properties matter to you. Then we can find or create a better and cheaper version.",
      productTypeLabel: 'What type of product is it?',
      productTypePlaceholder: 'E.g. Deodorant, Soap, Candle, Solar charger...',
      propertiesLabel: 'What properties are important?',
      propertiesPlaceholder: "Describe what the product should do or have:\n• Good for sensitive skin\n• Fragrance-free\n• Natural ingredients\n• Long battery life\n• Made from beeswax\n• Etc.",
      propertiesHint: 'Be as specific as you can - it helps us find the right product!',
      usageLabel: 'What will you use the product for?',
      usagePlaceholder: 'E.g. Daily use, workouts, as a gift, for children...',
      certificationsLabel: 'Important certifications/properties:',
      emailLabel: 'Your email (optional)',
      emailPlaceholder: "We'll notify you when available",
      submit: 'Submit request',
      success: 'Thanks for your request!',
      successDescription: 'We have received your request and will investigate how to find a product that fits your needs.',
      benefits: [
        'We find better alternatives',
        'Lower price than branded products',
        'Focus on function, not brand'
      ],
      certOptions: ['Organic', 'Vegan', 'Allergy-friendly', 'Sustainable', 'Toxin-free', 'Locally made']
    },
    no: {
      title: 'Ønsk et produkt',
      subtitle: 'Hjelp oss finne riktige produkter',
      description: 'Fortell oss hva du leter etter! Vi bryr oss ikke om merker - vi vil vite hvilken type produkt og hvilke egenskaper som er viktige for deg.',
      productTypeLabel: 'Hva slags produkt er det?',
      productTypePlaceholder: 'F.eks. Deodorant, Såpe, Stearinlys, Solcellelader...',
      propertiesLabel: 'Hvilke egenskaper er viktige?',
      propertiesPlaceholder: 'Beskriv hva produktet skal kunne eller ha:\n• Bra for sensitiv hud\n• Parfymefri\n• Naturlige ingredienser',
      propertiesHint: 'Vær så spesifikk du kan!',
      usageLabel: 'Hva skal du bruke produktet til?',
      usagePlaceholder: 'F.eks. Daglig bruk, trening, som gave...',
      certificationsLabel: 'Viktige sertifiseringer:',
      emailLabel: 'Din e-post (valgfritt)',
      emailPlaceholder: 'Vi varsler deg når produktet er tilgjengelig',
      submit: 'Send ønske',
      success: 'Takk for ønsket ditt!',
      successDescription: 'Vi har mottatt forespørselen din og vil undersøke mulighetene.',
      benefits: ['Vi finner bedre alternativer', 'Lavere pris', 'Fokus på funksjon'],
      certOptions: ['Økologisk', 'Vegansk', 'Allergievennlig', 'Bærekraftig', 'Giftfri', 'Lokalprodusert']
    },
    da: {
      title: 'Ønsk et produkt',
      subtitle: 'Hjælp os med at finde de rigtige produkter',
      description: 'Fortæl os hvad du leder efter! Vi er ligeglade med mærker - vi vil vide hvilken type produkt og hvilke egenskaber der er vigtige for dig.',
      productTypeLabel: 'Hvad er det for en type produkt?',
      productTypePlaceholder: 'F.eks. Deodorant, Sæbe, Stearinlys, Solcelleoplader...',
      propertiesLabel: 'Hvilke egenskaber er vigtige?',
      propertiesPlaceholder: 'Beskriv hvad produktet skal kunne:\n• God til sensitiv hud\n• Parfumefri\n• Naturlige ingredienser',
      propertiesHint: 'Vær så specifik som muligt!',
      usageLabel: 'Hvad skal du bruge produktet til?',
      usagePlaceholder: 'F.eks. Daglig brug, træning, som gave...',
      certificationsLabel: 'Vigtige certificeringer:',
      emailLabel: 'Din e-mail (valgfrit)',
      emailPlaceholder: 'Vi giver besked når produktet er tilgængeligt',
      submit: 'Send ønske',
      success: 'Tak for dit ønske!',
      successDescription: 'Vi har modtaget din anmodning og vil undersøge mulighederne.',
      benefits: ['Vi finder bedre alternativer', 'Lavere pris', 'Fokus på funktion'],
      certOptions: ['Økologisk', 'Vegansk', 'Allergivenlig', 'Bæredygtig', 'Giftfri', 'Lokalt produceret']
    },
    de: {
      title: 'Produkt wünschen',
      subtitle: 'Helfen Sie uns, die richtigen Produkte zu finden',
      description: 'Erzählen Sie uns, was Sie suchen! Marken sind uns egal - wir möchten wissen, welche Art von Produkt und welche Eigenschaften für Sie wichtig sind.',
      productTypeLabel: 'Was für ein Produkt ist es?',
      productTypePlaceholder: 'Z.B. Deodorant, Seife, Kerze, Solarladegerät...',
      propertiesLabel: 'Welche Eigenschaften sind wichtig?',
      propertiesPlaceholder: 'Beschreiben Sie, was das Produkt können sollte:\n• Gut für empfindliche Haut\n• Parfümfrei\n• Natürliche Inhaltsstoffe',
      propertiesHint: 'Seien Sie so spezifisch wie möglich!',
      usageLabel: 'Wofür werden Sie das Produkt verwenden?',
      usagePlaceholder: 'Z.B. Täglicher Gebrauch, Sport, als Geschenk...',
      certificationsLabel: 'Wichtige Zertifizierungen:',
      emailLabel: 'Ihre E-Mail (optional)',
      emailPlaceholder: 'Wir benachrichtigen Sie, wenn verfügbar',
      submit: 'Wunsch senden',
      success: 'Danke für Ihren Wunsch!',
      successDescription: 'Wir haben Ihre Anfrage erhalten und werden die Möglichkeiten prüfen.',
      benefits: ['Wir finden bessere Alternativen', 'Niedrigerer Preis', 'Fokus auf Funktion'],
      certOptions: ['Bio', 'Vegan', 'Allergikerfreundlich', 'Nachhaltig', 'Schadstofffrei', 'Lokal hergestellt']
    },
    fi: {
      title: 'Toivo tuotetta',
      subtitle: 'Auta meitä löytämään oikeat tuotteet',
      description: 'Kerro meille mitä etsit! Emme välitä merkeistä - haluamme tietää millainen tuote ja mitkä ominaisuudet ovat sinulle tärkeitä.',
      productTypeLabel: 'Millainen tuote on kyseessä?',
      productTypePlaceholder: 'Esim. Deodorantti, Saippua, Kynttilä, Aurinkopaneelilataaja...',
      propertiesLabel: 'Mitkä ominaisuudet ovat tärkeitä?',
      propertiesPlaceholder: 'Kuvaile mitä tuotteen tulisi osata:\n• Hyvä herkälle iholle\n• Hajusteeton\n• Luonnolliset ainesosat',
      propertiesHint: 'Ole mahdollisimman tarkka!',
      usageLabel: 'Mihin käytät tuotetta?',
      usagePlaceholder: 'Esim. Päivittäinen käyttö, urheilu, lahjaksi...',
      certificationsLabel: 'Tärkeät sertifikaatit:',
      emailLabel: 'Sähköpostisi (valinnainen)',
      emailPlaceholder: 'Ilmoitamme kun tuote on saatavilla',
      submit: 'Lähetä toive',
      success: 'Kiitos toiveestasi!',
      successDescription: 'Olemme vastaanottaneet pyyntösi ja tutkimme mahdollisuuksia.',
      benefits: ['Löydämme parempia vaihtoehtoja', 'Halvempi hinta', 'Fokus toiminnassa'],
      certOptions: ['Luomu', 'Vegaani', 'Allergiaystävällinen', 'Kestävä', 'Myrkytön', 'Paikallisesti valmistettu']
    }
  };

  const t = content[language] || content.en;

  const toggleCertification = (cert: string) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter(c => c !== cert)
        : [...prev.certifications, cert]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productType.trim()) {
      toast.error(language === 'sv' ? 'Ange en produkttyp' : 'Please enter a product type');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const message = [
        `Produkttyp: ${formData.productType}`,
        formData.properties ? `Egenskaper: ${formData.properties}` : '',
        formData.usage ? `Användning: ${formData.usage}` : '',
        formData.certifications.length > 0 ? `Certifieringar: ${formData.certifications.join(', ')}` : ''
      ].filter(Boolean).join('\n\n');

      const { error } = await supabase
        .from('interest_logs')
        .insert({
          interest_type: 'product_suggestion',
          message,
          email: formData.email || null,
          category: 'product_request'
        });

      if (error) throw error;
      
      setIsSubmitted(true);
      setFormData({ productType: '', properties: '', usage: '', certifications: [], email: '' });
      toast.success(t.success);
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      toast.error(language === 'sv' ? 'Kunde inte skicka förslaget' : 'Could not submit suggestion');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-background via-secondary/20 to-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent mb-4">
              <Lightbulb className="w-4 h-4" />
              <span className="text-sm font-medium">{t.subtitle}</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold mb-4">
              {t.title}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t.description}
            </p>
          </div>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {t.benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-full text-sm"
              >
                <TrendingDown className="w-4 h-4 text-primary" />
                <span>{benefit}</span>
              </motion.div>
            ))}
          </div>

          {/* Form */}
          {isSubmitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-2xl p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">{t.success}</h3>
              <p className="text-muted-foreground mb-6">{t.successDescription}</p>
              <Button
                variant="outline"
                onClick={() => setIsSubmitted(false)}
              >
                {language === 'sv' ? 'Skicka fler önskemål' : 'Send more requests'}
              </Button>
            </motion.div>
          ) : (
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-2xl p-6 md:p-8"
            >
              <div className="space-y-6">
                {/* Product Type */}
                <div>
                  <Label className="text-base font-medium mb-2 block">
                    {t.productTypeLabel} *
                  </Label>
                  <Input
                    value={formData.productType}
                    onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                    placeholder={t.productTypePlaceholder}
                    className="h-12"
                    required
                  />
                </div>

                {/* Properties */}
                <div>
                  <Label className="text-base font-medium mb-2 block">
                    {t.propertiesLabel} *
                  </Label>
                  <Textarea
                    value={formData.properties}
                    onChange={(e) => setFormData({ ...formData, properties: e.target.value })}
                    placeholder={t.propertiesPlaceholder}
                    rows={5}
                    className="whitespace-pre-wrap"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    {t.propertiesHint}
                  </p>
                </div>

                {/* Usage */}
                <div>
                  <Label className="text-base font-medium mb-2 block">
                    {t.usageLabel}
                  </Label>
                  <Input
                    value={formData.usage}
                    onChange={(e) => setFormData({ ...formData, usage: e.target.value })}
                    placeholder={t.usagePlaceholder}
                    className="h-12"
                  />
                </div>

                {/* Certifications */}
                <div>
                  <Label className="text-base font-medium mb-3 block">
                    {t.certificationsLabel}
                  </Label>
                  <div className="flex flex-wrap gap-3">
                    {t.certOptions.map((cert) => (
                      <label
                        key={cert}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer transition-all ${
                          formData.certifications.includes(cert)
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-secondary/30 border-border hover:bg-secondary/50'
                        }`}
                      >
                        <Checkbox
                          checked={formData.certifications.includes(cert)}
                          onCheckedChange={() => toggleCertification(cert)}
                          className="hidden"
                        />
                        <span className="text-sm font-medium">{cert}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Email */}
                <div>
                  <Label className="text-base font-medium mb-2 block">
                    {t.emailLabel}
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t.emailPlaceholder}
                    className="h-12"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full mt-8 h-14 text-base font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    {language === 'sv' ? 'Skickar...' : 'Sending...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    {t.submit}
                  </span>
                )}
              </Button>
            </motion.form>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default ProductSuggestions;
