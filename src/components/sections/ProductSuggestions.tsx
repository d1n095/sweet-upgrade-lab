import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Send, Check, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ProductSuggestions = () => {
  const { language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    productName: '',
    description: '',
    email: ''
  });

  const content = {
    sv: {
      title: 'Önskelista',
      subtitle: 'Hjälp oss driva ned priserna',
      description: 'Saknar du en produkt? Berätta vad du letar efter! Vi samlar in önskemål och förhandlar direkt med leverantörer för att kunna erbjuda bättre produkter till lägre priser.',
      productLabel: 'Vad är det för typ av produkt?',
      productPlaceholder: 'Ex: Deodorant för känslig hud, Ekologiskt bivax-ljus...',
      descriptionLabel: 'Beskriv produkten och varför du vill ha den',
      descriptionPlaceholder: 'Berätta gärna:\n• Vilka egenskaper är viktiga? (t.ex. naturlig, parfymfri, vegan)\n• Vad ska produkten användas till?\n• Finns det specifika krav? (t.ex. allergivänlig, ekologisk)\n\nExempel: "En deodorant som fungerar för känslig hud, helst utan aluminium och med naturliga ingredienser."',
      emailLabel: 'Din e-post (valfritt)',
      emailPlaceholder: 'Vi meddelar dig när produkten finns',
      submit: 'Skicka förslag',
      success: 'Tack för ditt förslag!',
      successDescription: 'Vi har tagit emot din önskan och kommer undersöka möjligheterna att ta fram en bättre och billigare version.',
      benefits: [
        'Vi förhandlar för dig',
        'Bättre produkter, lägre pris',
        'Du påverkar sortimentet'
      ]
    },
    en: {
      title: 'Wishlist',
      subtitle: 'Help us drive down prices',
      description: "Missing a product? Tell us what you're looking for! We collect requests and negotiate directly with suppliers to offer better products at lower prices.",
      productLabel: 'What type of product is it?',
      productPlaceholder: 'Ex: Deodorant for sensitive skin, Organic beeswax candle...',
      descriptionLabel: 'Describe the product and why you want it',
      descriptionPlaceholder: "Please tell us:\n• What features are important? (e.g. natural, fragrance-free, vegan)\n• What will the product be used for?\n• Any specific requirements? (e.g. allergy-friendly, organic)\n\nExample: 'A deodorant that works for sensitive skin, preferably aluminum-free with natural ingredients.'",
      emailLabel: 'Your email (optional)',
      emailPlaceholder: "We'll notify you when available",
      submit: 'Send suggestion',
      success: 'Thanks for your suggestion!',
      successDescription: 'We have received your request and will investigate how to create a better, more affordable version.',
      benefits: [
        'We negotiate for you',
        'Better products, lower prices',
        'You influence our selection'
      ]
    }
  };

  const t = content[language as 'sv' | 'en'] || content.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productName.trim()) {
      toast.error(language === 'sv' ? 'Ange ett produktnamn' : 'Please enter a product name');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('interest_logs')
        .insert({
          interest_type: 'product_suggestion',
          message: `${formData.productName}${formData.description ? ` - ${formData.description}` : ''}`,
          email: formData.email || null,
          category: 'product_request'
        });

      if (error) throw error;
      
      setIsSubmitted(true);
      setFormData({ productName: '', description: '', email: '' });
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
                {language === 'sv' ? 'Skicka fler förslag' : 'Send more suggestions'}
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
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    {t.productLabel} *
                  </label>
                  <Input
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    placeholder={t.productPlaceholder}
                    className="h-12"
                    required
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    {t.descriptionLabel}
                  </label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t.descriptionPlaceholder}
                    rows={6}
                    className="whitespace-pre-wrap"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    {t.emailLabel}
                  </label>
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
                className="w-full mt-6 h-14 text-base font-semibold"
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
