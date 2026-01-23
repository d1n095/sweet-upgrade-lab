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
    }
  };

  const t = content[language as 'sv' | 'en'] || content.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName || !formData.email) {
      toast.error(language === 'sv' ? 'Fyll i obligatoriska fält' : 'Please fill in required fields');
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
      toast.error(language === 'sv' ? 'Kunde inte skicka förfrågan' : 'Could not submit inquiry');
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
                    {language === 'sv' ? 'Skicka ny förfrågan' : 'Send new inquiry'}
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
                          {language === 'sv' ? 'Skickar...' : 'Sending...'}
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
                {language === 'sv' ? 'Eller kontakta oss direkt:' : 'Or contact us directly:'}
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
