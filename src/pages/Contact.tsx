import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Send, Clock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { storeConfig } from '@/config/storeConfig';
import { toast } from 'sonner';
import SEOHead from '@/components/seo/SEOHead';
import { usePageSections } from '@/hooks/usePageSections';
import { supabase } from '@/integrations/supabase/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Contact = () => {
  const { t, language, contentLang } = useLanguage();
  const { getSection, isSectionVisible, loading } = usePageSections('contact');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    website: '', // honeypot — must stay empty
  });

  const lang = contentLang;
  const getLang = (sv: string | null | undefined, en: string | null | undefined) =>
    (lang === 'sv' ? sv : en) || sv || '';

  const headingSection = getSection('heading');
  const formSection = getSection('form');
  const infoSection = getSection('info');
  const faqSection = getSection('faq_link');

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = language === 'sv' ? 'Namn krävs' : 'Name is required';
    if (!formData.email.trim()) errs.email = language === 'sv' ? 'E-post krävs' : 'Email is required';
    else if (!EMAIL_RE.test(formData.email.trim())) errs.email = language === 'sv' ? 'Ogiltig e-post' : 'Invalid email';
    if (formData.message.trim().length < 10) {
      errs.message = language === 'sv'
        ? 'Meddelandet måste vara minst 10 tecken'
        : 'Message must be at least 10 characters';
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(language === 'sv' ? 'Kontrollera formuläret' : 'Please fix the form');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-contact', {
        body: {
          name: formData.name.trim(),
          email: formData.email.trim(),
          subject: formData.subject.trim(),
          message: formData.message.trim(),
          website: formData.website,
        },
      });

      if (error) throw error;
      if (data && (data as any).error) {
        if ((data as any).fields) setFieldErrors((data as any).fields);
        throw new Error((data as any).error);
      }

      toast.success(t('contact.thankyou'));
      setFormData({ name: '', email: '', subject: '', message: '', website: '' });
      setFieldErrors({});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(
        language === 'sv' ? `Kunde inte skicka: ${msg}` : `Could not send: ${msg}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: Mail,
      label: t('contact.email'),
      value: storeConfig.contact.email,
      href: `mailto:${storeConfig.contact.email}`,
    },
    {
      icon: Clock,
      label: t('contact.responsetime'),
      value: language === 'sv' ? 'Inom 48 timmar' : 'Within 48 hours',
      href: null,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={headingSection ? getLang(headingSection.title_sv, headingSection.title_en) : t('contact.title')}
        description={headingSection ? getLang(headingSection.content_sv, headingSection.content_en) : t('contact.subtitle')}
        keywords="kontakt, kundservice, support, frågor"
        canonical="/contact"
      />
      <Header />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {isSectionVisible('heading') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
                {headingSection ? getLang(headingSection.title_sv, headingSection.title_en) : t('contact.heading')}
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                {headingSection ? getLang(headingSection.content_sv, headingSection.content_en) : t('contact.subtitle')}
              </p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {isSectionVisible('form') && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8">
                  <h2 className="font-display text-2xl font-semibold mb-6">
                    {formSection ? getLang(formSection.title_sv, formSection.title_en) : t('contact.sendmessage')}
                  </h2>
                  
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">{t('contact.name')}</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t('contact.email')}</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="subject">{t('contact.subject')}</Label>
                      <Input
                        id="subject"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="message">{t('contact.message')}</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                        rows={5}
                      />
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        t('contact.sending')
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          {formSection ? getLang(formSection.title_sv, formSection.title_en) : t('contact.sendmessage')}
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {isSectionVisible('info') && (
                <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8">
                  <h2 className="font-display text-2xl font-semibold mb-6">
                    {infoSection ? getLang(infoSection.title_sv, infoSection.title_en) : t('contact.info')}
                  </h2>
                  
                  <div className="space-y-6">
                    {contactInfo.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <item.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                          {item.href ? (
                            <a href={item.href} className="font-medium hover:text-primary transition-colors">
                              {item.value}
                            </a>
                          ) : (
                            <p className="font-medium">{item.value}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isSectionVisible('faq_link') && (
                <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6">
                  <h3 className="font-display text-lg font-semibold mb-2">
                    {faqSection ? getLang(faqSection.title_sv, faqSection.title_en) : t('faq.title')}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {faqSection ? getLang(faqSection.content_sv, faqSection.content_en) : t('contact.faq')}
                  </p>
                  <Button variant="outline" asChild>
                    <a href="/#faq">{t('contact.viewfaq')}</a>
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
