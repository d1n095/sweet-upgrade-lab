import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, Gift, CheckCircle, ShieldX, ShieldCheck } from 'lucide-react';
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
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [isVerifiedPurchase, setIsVerifiedPurchase] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [eligibilityMessage, setEligibilityMessage] = useState('');

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
      errorDuplicate: 'Du har redan recenserat denna produkt',
      success: 'Recension skickad!',
      notPurchased: 'Endast verifierade köpare kan lämna recension',
      notPurchasedDesc: 'Köp produkten och invänta bekräftad betalning för att kunna recensera.',
      alreadyReviewedTitle: 'Du har redan recenserat',
      alreadyReviewedDesc: 'Du kan bara lämna en recension per produkt.',
      checking: 'Kontrollerar köpstatus...',
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
      errorDuplicate: 'You have already reviewed this product',
      success: 'Review submitted!',
      notPurchased: 'Only verified buyers can leave a review',
      notPurchasedDesc: 'Purchase the product and wait for payment confirmation to leave a review.',
      alreadyReviewedTitle: 'Already reviewed',
      alreadyReviewedDesc: 'You can only leave one review per product.',
      checking: 'Checking purchase status...',
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  // Check eligibility when user or product changes
  useEffect(() => {
    const checkEligibility = async () => {
      if (!user) {
        setIsCheckingEligibility(false);
        return;
      }

      setIsCheckingEligibility(true);
      try {
        const { data, error } = await supabase.rpc('check_review_eligibility', {
          p_user_id: user.id,
          p_product_id: productId,
        });

        if (error) throw error;

        if (data && data.length > 0) {
          const result = data[0];
          setCanReview(result.can_review);
          setIsVerifiedPurchase(result.is_verified_purchase);
          setAlreadyReviewed(result.already_reviewed);
          setEligibilityMessage(result.message);
        } else {
          setCanReview(false);
        }
      } catch (err) {
        console.error('Failed to check review eligibility:', err);
        setCanReview(false);
      } finally {
        setIsCheckingEligibility(false);
      }
    };

    checkEligibility();
  }, [user, productId]);

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
      // Double-check eligibility server-side before insert
      const { data: eligibility } = await supabase.rpc('check_review_eligibility', {
        p_user_id: user.id,
        p_product_id: productId,
      });

      if (!eligibility || eligibility.length === 0 || !eligibility[0].can_review) {
        const msg = eligibility?.[0]?.already_reviewed ? t.errorDuplicate : t.notPurchased;
        toast.error(msg);
        setIsSubmitting(false);
        return;
      }

      const { data: review, error: reviewError } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          shopify_product_id: productId,
          shopify_product_handle: productHandle,
          product_title: productTitle,
          rating,
          comment: comment.trim(),
          is_verified_purchase: true,
          is_approved: false,
        })
        .select()
        .single();

      if (reviewError) {
        // Handle unique constraint violation
        if (reviewError.code === '23505') {
          toast.error(t.errorDuplicate);
          setAlreadyReviewed(true);
          setCanReview(false);
          return;
        }
        throw reviewError;
      }

      // Notify admin
      safeInvoke('notify-review', {
          productTitle,
          rating,
          comment: comment.trim(),
          userEmail: user.email,
        }).catch(err => console.error('Failed to notify admin:', err));

      // Create reward
      const discountCode = `REV${Date.now().toString(36).toUpperCase()}`;
      await supabase
        .from('review_rewards')
        .insert({
          user_id: user.id,
          review_id: review.id,
          discount_code: discountCode,
          discount_percent: 10,
        })
        .then(({ error }) => {
          if (error) console.error('Failed to create reward:', error);
        });

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

  // Not logged in — silently hide
  if (!user) return null;

  // Loading eligibility — silently hide
  if (isCheckingEligibility) return null;

  // Already reviewed or not a verified buyer — silently hide
  if (alreadyReviewed || !canReview) return null;

  // Successfully submitted
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

  // Review form for verified buyers
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
).catch(err => console.error('Failed to notify admin:', err));

      // Create reward
      const discountCode = `REV${Date.now().toString(36).toUpperCase()}`;
      await supabase
        .from('review_rewards')
        .insert({
          user_id: user.id,
          review_id: review.id,
          discount_code: discountCode,
          discount_percent: 10,
        })
        .then(({ error }) => {
          if (error) console.error('Failed to create reward:', error);
        });

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

  // Not logged in — silently hide
  if (!user) return null;

  // Loading eligibility — silently hide
  if (isCheckingEligibility) return null;

  // Already reviewed or not a verified buyer — silently hide
  if (alreadyReviewed || !canReview) return null;

  // Successfully submitted
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

  // Review form for verified buyers
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
