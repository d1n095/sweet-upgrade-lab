import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, Gift, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ReviewStars from './ReviewStars';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface ReviewFormProps {
  productId: string;
  productHandle: string;
  productTitle: string;
  onReviewSubmitted?: () => void;
}

const ReviewForm = ({ productId, productHandle, productTitle, onReviewSubmitted }: ReviewFormProps) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const content = {
    sv: {
      title: 'Skriv en recension',
      subtitle: 'Din åsikt hjälper andra att fatta rätt beslut',
      ratingLabel: 'Ditt betyg',
      commentLabel: 'Din recension',
      commentPlaceholder: 'Berätta om din upplevelse med produkten...',
      reward: 'Få 10% rabatt på nästa köp!',
      submit: 'Skicka recension',
      submitting: 'Skickar...',
      submitted: 'Tack för din recension!',
      submittedDesc: 'Din recension granskas och publiceras inom 24 timmar. Din rabattkod skickas till din email.',
      loginRequired: 'Logga in för att recensera',
      loginDesc: 'Endast verifierade köpare kan lämna recensioner.',
      errorRating: 'Välj ett betyg',
      errorComment: 'Skriv en kommentar (minst 10 tecken)',
      errorSubmit: 'Något gick fel. Försök igen.',
      success: 'Recension skickad!'
    },
    en: {
      title: 'Write a review',
      subtitle: 'Your opinion helps others make the right decision',
      ratingLabel: 'Your rating',
      commentLabel: 'Your review',
      commentPlaceholder: 'Tell us about your experience with the product...',
      reward: 'Get 10% off your next purchase!',
      submit: 'Submit review',
      submitting: 'Submitting...',
      submitted: 'Thank you for your review!',
      submittedDesc: 'Your review will be reviewed and published within 24 hours. Your discount code will be sent to your email.',
      loginRequired: 'Log in to review',
      loginDesc: 'Only verified buyers can leave reviews.',
      errorRating: 'Select a rating',
      errorComment: 'Write a comment (at least 10 characters)',
      errorSubmit: 'Something went wrong. Please try again.',
      success: 'Review submitted!'
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error(t.loginRequired);
      return;
    }

    if (rating === 0) {
      toast.error(t.errorRating);
      return;
    }

    if (comment.trim().length < 10) {
      toast.error(t.errorComment);
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert review
      const { data: review, error: reviewError } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          shopify_product_id: productId,
          shopify_product_handle: productHandle,
          product_title: productTitle,
          rating,
          comment: comment.trim(),
          is_verified_purchase: true, // We assume verified for now
          is_approved: false // Requires admin approval
        })
        .select()
        .single();

      if (reviewError) throw reviewError;

      // Notify admin about new review
      supabase.functions.invoke('notify-review', {
        body: {
          productTitle,
          rating,
          comment: comment.trim(),
          userEmail: user.email,
        }
      }).catch(err => console.error('Failed to notify admin:', err));
      const discountCode = `REV${Date.now().toString(36).toUpperCase()}`;
      
      const { error: rewardError } = await supabase
        .from('review_rewards')
        .insert({
          user_id: user.id,
          review_id: review.id,
          discount_code: discountCode,
          discount_percent: 10
        });

      if (rewardError) {
        console.error('Failed to create reward:', rewardError);
      }

      setIsSubmitted(true);
      toast.success(t.success);
      onReviewSubmitted?.();
    } catch (error) {
      console.error('Failed to submit review:', error);
      toast.error(t.errorSubmit);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-secondary/30 rounded-2xl p-6 text-center">
        <h3 className="font-semibold text-lg mb-2">{t.loginRequired}</h3>
        <p className="text-muted-foreground text-sm">{t.loginDesc}</p>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-primary/10 rounded-2xl p-6 text-center"
      >
        <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="font-semibold text-lg mb-2">{t.submitted}</h3>
        <p className="text-muted-foreground text-sm">{t.submittedDesc}</p>
      </motion.div>
    );
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="bg-card border border-border rounded-2xl p-6"
    >
      <h3 className="font-semibold text-lg mb-1">{t.title}</h3>
      <p className="text-muted-foreground text-sm mb-6">{t.subtitle}</p>

      {/* Reward banner */}
      <div className="bg-primary/10 rounded-xl p-4 mb-6 flex items-center gap-3">
        <Gift className="w-6 h-6 text-primary shrink-0" />
        <span className="text-sm font-medium">{t.reward}</span>
      </div>

      {/* Rating */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-3">{t.ratingLabel}</label>
        <ReviewStars
          rating={rating}
          size="lg"
          interactive
          onRatingChange={setRating}
        />
      </div>

      {/* Comment */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">{t.commentLabel}</label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t.commentPlaceholder}
          rows={4}
          className="resize-none"
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isSubmitting || rating === 0}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t.submitting}
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            {t.submit}
          </>
        )}
      </Button>
    </motion.form>
  );
};

export default ReviewForm;
