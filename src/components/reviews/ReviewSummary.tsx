import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';

interface ReviewSummaryProps {
  productHandle?: string;
}

const ReviewSummary = ({ productHandle }: ReviewSummaryProps) => {
  const { language } = useLanguage();
  const [stats, setStats] = useState({ count: 0, average: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const content = {
    sv: {
      reviews: 'recensioner',
      noReviews: 'Inga recensioner ännu'
    },
    en: {
      reviews: 'reviews',
      noReviews: 'No reviews yet'
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    const loadStats = async () => {
      try {
        let query = supabase
          .from('reviews')
          .select('rating')
          .eq('is_approved', true);

        if (productHandle) {
          query = query.eq('shopify_product_handle', productHandle);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
          const sum = data.reduce((acc, r) => acc + r.rating, 0);
          setStats({
            count: data.length,
            average: Math.round((sum / data.length) * 10) / 10
          });
        }
      } catch (error) {
        console.error('Failed to load review stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [productHandle]);

  if (isLoading || stats.count === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        <span className="font-semibold">{stats.average}</span>
      </div>
      <span className="text-muted-foreground text-sm">
        ({stats.count} {t.reviews})
      </span>
    </div>
  );
};

export default ReviewSummary;
