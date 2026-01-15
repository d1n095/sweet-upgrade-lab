import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, UserPlus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReviewList from './ReviewList';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import AuthModal from '@/components/auth/AuthModal';

const MemberReviewsSection = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [hasReviews, setHasReviews] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const content = {
    sv: {
      title: 'Recensioner från våra medlemmar',
      subtitle: 'Äkta feedback från verifierade köpare',
      noReviewsTitle: 'Vi är nya, men vi växer med ditt förtroende',
      noReviewsSubtitle: 'Din feedback är vår framtid',
      noReviewsDesc: 'Har du handlat av oss? Logga in och dela din erfarenhet. Varje recension hjälper oss bli bättre och andra att fatta rätt beslut.',
      joinCta: 'Bli medlem och påverka sortimentet',
      loginCta: 'Logga in',
      memberBenefits: [
        '✓ Recensera produkter du köpt',
        '✓ 10% rabatt på nästa köp för varje recension',
        '✓ Exklusiva medlemserbjudanden'
      ]
    },
    en: {
      title: 'Reviews from our members',
      subtitle: 'Real feedback from verified buyers',
      noReviewsTitle: "We're new, but we grow with your trust",
      noReviewsSubtitle: 'Your feedback is our future',
      noReviewsDesc: 'Have you ordered from us? Log in and share your experience. Every review helps us improve and helps others make the right decision.',
      joinCta: 'Become a member and influence the assortment',
      loginCta: 'Log in',
      memberBenefits: [
        '✓ Review products you bought',
        '✓ 10% off your next purchase for each review',
        '✓ Exclusive member offers'
      ]
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    const checkForReviews = async () => {
      try {
        const { count, error } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('is_approved', true);

        if (!error && count && count > 0) {
          setHasReviews(true);
        }
      } catch (error) {
        console.error('Failed to check reviews:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkForReviews();
  }, []);

  if (isLoading) {
    return null;
  }

  // Show reviews if we have any
  if (hasReviews) {
    return (
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="font-display text-3xl md:text-4xl font-semibold mb-3">
              {t.title}
            </h2>
            <p className="text-muted-foreground text-lg">
              {t.subtitle}
            </p>
          </motion.div>

          <div className="max-w-3xl mx-auto">
            <ReviewList limit={6} showProductTitle />
          </div>

          {!user && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-10 text-center"
            >
              <Button onClick={() => setShowAuthModal(true)} size="lg">
                <UserPlus className="w-5 h-5 mr-2" />
                {t.joinCta}
              </Button>
            </motion.div>
          )}

          <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        </div>
      </section>
    );
  }

  // No reviews yet - show honest message
  return (
    <section className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="font-display text-3xl md:text-4xl font-semibold mb-3">
            {t.noReviewsTitle}
          </h2>
          <p className="text-lg text-primary font-medium mb-4">
            {t.noReviewsSubtitle}
          </p>
          <p className="text-muted-foreground leading-relaxed mb-8">
            {t.noReviewsDesc}
          </p>

          <div className="bg-card border border-border rounded-2xl p-6 mb-8 text-left max-w-md mx-auto">
            <h3 className="font-semibold mb-3 text-center">
              {language === 'sv' ? 'Medlemsfördelar' : 'Member benefits'}
            </h3>
            <ul className="space-y-2">
              {t.memberBenefits.map((benefit, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={() => setShowAuthModal(true)} size="lg">
              <UserPlus className="w-5 h-5 mr-2" />
              {t.joinCta}
            </Button>
            {!user && (
              <Button variant="outline" size="lg" onClick={() => setShowAuthModal(true)}>
                <LogIn className="w-5 h-5 mr-2" />
                {t.loginCta}
              </Button>
            )}
          </div>
        </motion.div>

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    </section>
  );
};

export default MemberReviewsSection;
