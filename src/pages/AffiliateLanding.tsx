import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Share2, DollarSign, TrendingUp, Users, Check, 
  ArrowRight, Gift, Wallet, Loader2, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AffiliateLanding = () => {
  const { language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    social_media: '',
    followers_count: '',
    platform: '',
    why_join: '',
  });

  const content = {
    sv: {
      badge: 'Affiliate-program',
      title: 'Tjäna pengar genom att dela produkter du älskar',
      subtitle: 'Gå med i vårt affiliate-program och tjäna provision på varje försäljning. Ingen startavgift, inga dolda kostnader.',
      benefits: [
        { icon: DollarSign, title: 'Upp till 15% provision', desc: 'Tjäna på varje försäljning du genererar' },
        { icon: Gift, title: '10% rabatt till dina följare', desc: 'Dina följare får rabatt med din kod' },
        { icon: Wallet, title: 'Flexibla utbetalningar', desc: 'Ta ut när som helst, från 1 kr' },
        { icon: TrendingUp, title: 'Realtidsstatistik', desc: 'Följ dina intäkter i din dashboard' },
      ],
      howItWorks: 'Så fungerar det',
      steps: [
        { step: '1', title: 'Ansök', desc: 'Fyll i formuläret nedan' },
        { step: '2', title: 'Godkänns', desc: 'Vi granskar din ansökan inom 24h' },
        { step: '3', title: 'Dela', desc: 'Få din unika kod och börja tjäna' },
        { step: '4', title: 'Tjäna', desc: 'Provision på varje försäljning' },
      ],
      formTitle: 'Ansök nu',
      formSubtitle: 'Fyll i dina uppgifter så hör vi av oss inom 24 timmar',
      name: 'Namn',
      email: 'Email',
      phone: 'Telefon (valfritt)',
      socialMedia: 'Sociala medier-profil',
      followersCount: 'Antal följare',
      platform: 'Huvudsaklig plattform',
      whyJoin: 'Varför vill du bli affiliate?',
      submit: 'Skicka ansökan',
      successTitle: 'Tack för din ansökan!',
      successMessage: 'Vi granskar din ansökan och hör av oss inom 24 timmar.',
      faq: 'Vanliga frågor',
      faqs: [
        { q: 'Hur mycket kan jag tjäna?', a: 'Det beror på din målgrupp. Våra bästa affiliates tjänar flera tusen kronor per månad.' },
        { q: 'När får jag min provision?', a: 'Du kan begära utbetalning när som helst direkt i din dashboard.' },
        { q: 'Behöver jag betala skatt?', a: 'Ja, du ansvarar för att redovisa dina intäkter till Skatteverket.' },
        { q: 'Kan jag vara affiliate om jag har få följare?', a: 'Ja! Vi värderar engagemang högre än antal följare.' },
      ],
    },
    en: {
      badge: 'Affiliate Program',
      title: 'Earn money by sharing products you love',
      subtitle: 'Join our affiliate program and earn commission on every sale. No startup fee, no hidden costs.',
      benefits: [
        { icon: DollarSign, title: 'Up to 15% commission', desc: 'Earn on every sale you generate' },
        { icon: Gift, title: '10% discount for your followers', desc: 'Your followers get discount with your code' },
        { icon: Wallet, title: 'Flexible payouts', desc: 'Withdraw anytime, from 1 SEK' },
        { icon: TrendingUp, title: 'Real-time stats', desc: 'Track your earnings in your dashboard' },
      ],
      howItWorks: 'How it works',
      steps: [
        { step: '1', title: 'Apply', desc: 'Fill in the form below' },
        { step: '2', title: 'Get approved', desc: 'We review your application within 24h' },
        { step: '3', title: 'Share', desc: 'Get your unique code and start earning' },
        { step: '4', title: 'Earn', desc: 'Commission on every sale' },
      ],
      formTitle: 'Apply now',
      formSubtitle: "Fill in your details and we'll get back to you within 24 hours",
      name: 'Name',
      email: 'Email',
      phone: 'Phone (optional)',
      socialMedia: 'Social media profile',
      followersCount: 'Number of followers',
      platform: 'Main platform',
      whyJoin: 'Why do you want to become an affiliate?',
      submit: 'Submit application',
      successTitle: 'Thank you for your application!',
      successMessage: "We'll review your application and get back to you within 24 hours.",
      faq: 'FAQ',
      faqs: [
        { q: 'How much can I earn?', a: 'It depends on your audience. Our top affiliates earn several thousand SEK per month.' },
        { q: 'When do I get my commission?', a: 'You can request payout anytime directly in your dashboard.' },
        { q: 'Do I need to pay taxes?', a: 'Yes, you are responsible for reporting your income to the tax authorities.' },
        { q: 'Can I be an affiliate with few followers?', a: 'Yes! We value engagement more than follower count.' },
      ],
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('affiliate_applications')
        .insert({
          name: formData.name,
          email: formData.email.toLowerCase(),
          phone: formData.phone || null,
          social_media: formData.social_media,
          followers_count: formData.followers_count,
          platform: formData.platform,
          why_join: formData.why_join,
        });

      if (error) throw error;
      setIsSubmitted(true);
    } catch (error) {
      console.error('Failed to submit application:', error);
      toast.error(language === 'sv' ? 'Något gick fel' : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={language === 'sv' ? 'Affiliate-program - Tjäna pengar' : 'Affiliate Program - Earn Money'}
        description={language === 'sv'
          ? 'Gå med i vårt affiliate-program och tjäna upp till 15% provision på varje försäljning.'
          : 'Join our affiliate program and earn up to 15% commission on every sale.'}
        keywords="affiliate, partner, tjäna pengar, provision, influencer"
        canonical="/affiliate"
      />
      <Header />

      <main className="pt-24 pb-20">
        {/* Hero */}
        <section className="container mx-auto px-4 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-600 text-sm font-medium mb-6">
              <Share2 className="w-4 h-4" />
              {t.badge}
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold mb-6">
              {t.title}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t.subtitle}
            </p>
          </motion.div>
        </section>

        {/* Benefits */}
        <section className="bg-secondary/30 py-16 mb-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {t.benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-xl p-6 text-center"
                >
                  <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="w-7 h-7 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="container mx-auto px-4 mb-20">
          <h2 className="font-display text-3xl font-semibold text-center mb-12">
            {t.howItWorks}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {t.steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-4 text-white font-bold text-2xl">
                  {step.step}
                </div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Application Form */}
        <section className="container mx-auto px-4 mb-20">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-2xl p-8"
            >
              {isSubmitted ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                    <Check className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="font-display text-2xl font-semibold mb-2">{t.successTitle}</h3>
                  <p className="text-muted-foreground">{t.successMessage}</p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <h2 className="font-display text-2xl font-semibold mb-2">{t.formTitle}</h2>
                    <p className="text-muted-foreground">{t.formSubtitle}</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">{t.name} *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t.email} *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">{t.phone}</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="social_media">{t.socialMedia} *</Label>
                        <Input
                          id="social_media"
                          placeholder="@username"
                          value={formData.social_media}
                          onChange={(e) => setFormData({ ...formData, social_media: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="platform">{t.platform} *</Label>
                        <Select
                          value={formData.platform}
                          onValueChange={(value) => setFormData({ ...formData, platform: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'sv' ? 'Välj plattform' : 'Select platform'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="tiktok">TikTok</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="blog">Blog</SelectItem>
                            <SelectItem value="other">{language === 'sv' ? 'Annat' : 'Other'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="followers_count">{t.followersCount} *</Label>
                        <Select
                          value={formData.followers_count}
                          onValueChange={(value) => setFormData({ ...formData, followers_count: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'sv' ? 'Välj antal' : 'Select count'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0-1000">0 - 1,000</SelectItem>
                            <SelectItem value="1000-5000">1,000 - 5,000</SelectItem>
                            <SelectItem value="5000-10000">5,000 - 10,000</SelectItem>
                            <SelectItem value="10000-50000">10,000 - 50,000</SelectItem>
                            <SelectItem value="50000+">50,000+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="why_join">{t.whyJoin} *</Label>
                      <Textarea
                        id="why_join"
                        value={formData.why_join}
                        onChange={(e) => setFormData({ ...formData, why_join: e.target.value })}
                        rows={4}
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                      disabled={isSubmitting || !formData.platform || !formData.followers_count}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {t.submit}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-semibold text-center mb-12">{t.faq}</h2>
          <div className="max-w-2xl mx-auto space-y-4">
            {t.faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-card border border-border rounded-xl p-6"
              >
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AffiliateLanding;