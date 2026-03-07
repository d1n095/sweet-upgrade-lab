import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, UserPlus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReviewList from './ReviewList';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import AuthModal from '@/components/auth/AuthModal';

const MemberReviewsSection = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [hasReviews, setHasReviews] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const content = {
    sv: {
      title: 'Recensioner',
      subtitle: 'Äkta feedback från verifierade köpare',
      noReviewsTitle: 'Inga recensioner ännu',
      noReviewsDesc: 'Bli den första att dela din upplevelse.',
      joinCta: 'Bli medlem',
      loginCta: 'Logga in',
    },
    en: {
      title: 'Reviews',
      subtitle: 'Real feedback from verified buyers',
      noReviewsTitle: 'No reviews yet',
      noReviewsDesc: 'Be the first to share your experience.',
      joinCta: 'Become a member',
      loginCta: 'Log in',
    }
  };

  const t = content[getContentLang(language)] || content.en;

  useEffect(() => {
    const checkForReviews = async () => {
      try {
        const { count, error } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('is_approved', true);
        if (!error && count && count > 0) setHasReviews(true);
      } catch (error) {
        console.error('Failed to check reviews:', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkForReviews();
  }, []);

  if (isLoading) return null;

  if (hasReviews) {
    return (
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-2">{t.title}</h2>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </motion.div>
          <div className="max-w-2xl mx-auto">
            <ReviewList limit={6} showProductTitle />
          </div>
          <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto text-center"
        >
          <MessageCircle className="w-5 h-5 text-accent mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">{t.noReviewsTitle}</h2>
          <p className="text-sm text-muted-foreground mb-6">{t.noReviewsDesc}</p>
          
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => setShowAuthModal(true)} size="sm" className="rounded-xl">
              <UserPlus className="w-4 h-4 mr-1.5" />
              {t.joinCta}
            </Button>
            {!user && (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowAuthModal(true)}>
                <LogIn className="w-4 h-4 mr-1.5" />
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
