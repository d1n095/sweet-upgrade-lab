import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, MessageCircle } from 'lucide-react';
import ReviewStars from './ReviewStars';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';

interface Review {
  id: string;
  rating: number;
  comment: string;
  product_title: string;
  is_verified_purchase: boolean;
  admin_response: string | null;
  created_at: string;
}

interface ReviewListProps {
  productHandle?: string;
  limit?: number;
  showProductTitle?: boolean;
}

const ReviewList = ({ productHandle, limit = 10, showProductTitle = false }: ReviewListProps) => {
  const { language } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const content = {
    sv: {
      title: 'Recensioner från våra medlemmar',
      noReviews: 'Inga recensioner ännu',
      noReviewsDesc: 'Bli den första att recensera!',
      verified: 'Verifierad köpare',
      adminResponse: 'Svar från 4thepeople'
    },
    en: {
      title: 'Reviews from our members',
      noReviews: 'No reviews yet',
      noReviewsDesc: 'Be the first to review!',
      verified: 'Verified buyer',
      adminResponse: 'Response from 4thepeople'
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    const loadReviews = async () => {
      try {
        let query = supabase
          .from('reviews')
          .select('id, rating, comment, product_title, is_verified_purchase, admin_response, created_at')
          .eq('is_approved', true)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (productHandle) {
          query = query.eq('shopify_product_handle', productHandle);
        }

        const { data, error } = await query;

        if (error) throw error;
        setReviews(data || []);
      } catch (error) {
        console.error('Failed to load reviews:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadReviews();
  }, [productHandle, limit]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Generate anonymous username from ID
  const getAnonymousName = (id: string) => {
    const names = ['Anna', 'Erik', 'Maria', 'Johan', 'Sara', 'Oskar', 'Emma', 'Lars', 'Karin', 'Anders'];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const name = names[hash % names.length];
    const letter = letters[hash % letters.length];
    return `${name}_${letter}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="bg-secondary/30 rounded-2xl p-8 text-center">
        <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
        <h3 className="font-semibold text-lg mb-2">{t.noReviews}</h3>
        <p className="text-muted-foreground text-sm">{t.noReviewsDesc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review, index) => (
        <motion.div
          key={review.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-card border border-border rounded-xl p-5"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{getAnonymousName(review.id)}</span>
                {review.is_verified_purchase && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    <BadgeCheck className="w-3 h-3" />
                    {t.verified}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{formatDate(review.created_at)}</span>
                {showProductTitle && (
                  <span className="text-foreground/70">• {review.product_title}</span>
                )}
              </div>
            </div>
            <ReviewStars rating={review.rating} size="sm" />
          </div>

          {/* Comment */}
          <p className="text-foreground/90 leading-relaxed">{review.comment}</p>

          {/* Admin response */}
          {review.admin_response && (
            <div className="mt-4 pl-4 border-l-2 border-primary/30">
              <p className="text-sm font-medium text-primary mb-1">{t.adminResponse}</p>
              <p className="text-sm text-muted-foreground">{review.admin_response}</p>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
};

export default ReviewList;
