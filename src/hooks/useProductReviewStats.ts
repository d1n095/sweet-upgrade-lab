import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ReviewStats {
  count: number;
  average: number;
}

const cache = new Map<string, ReviewStats>();

export const useProductReviewStats = (productHandle: string | undefined) => {
  const [stats, setStats] = useState<ReviewStats>({ count: 0, average: 0 });

  useEffect(() => {
    if (!productHandle) return;

    if (cache.has(productHandle)) {
      setStats(cache.get(productHandle)!);
      return;
    }

    const load = async () => {
      try {
        const { data } = await supabase
          .from('reviews')
          .select('rating')
          .eq('is_approved', true)
          .eq('product_handle', productHandle);

        if (data && data.length > 0) {
          const sum = data.reduce((acc, r) => acc + r.rating, 0);
          const result = {
            count: data.length,
            average: Math.round((sum / data.length) * 10) / 10,
          };
          cache.set(productHandle, result);
          setStats(result);
        }
      } catch {
        // silent
      }
    };

    load();
  }, [productHandle]);

  return stats;
};
