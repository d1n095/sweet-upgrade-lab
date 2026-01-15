import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BESTSELLER_THRESHOLD = 10; // Products with >10 sales are bestsellers

interface BestsellerData {
  shopify_product_id: string;
  total_quantity_sold: number;
}

export const useBestsellers = () => {
  const [bestsellers, setBestsellers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBestsellers = async () => {
      try {
        const { data, error } = await supabase
          .from('product_sales')
          .select('shopify_product_id, total_quantity_sold')
          .gt('total_quantity_sold', BESTSELLER_THRESHOLD);

        if (error) {
          console.error('Error fetching bestsellers:', error);
          return;
        }

        const bestsellerIds = new Set(
          (data as BestsellerData[])?.map(item => item.shopify_product_id) || []
        );
        setBestsellers(bestsellerIds);
      } catch (err) {
        console.error('Failed to fetch bestsellers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBestsellers();
  }, []);

  const isBestseller = (productId: string): boolean => {
    // Extract numeric ID from Shopify GID format
    const numericId = productId.replace('gid://shopify/Product/', '');
    return bestsellers.has(numericId) || bestsellers.has(productId);
  };

  return { bestsellers, isBestseller, loading };
};

// Create a singleton store for bestsellers to avoid multiple fetches
let cachedBestsellers: Set<string> | null = null;
let fetchPromise: Promise<Set<string>> | null = null;

export const getBestsellersSet = async (): Promise<Set<string>> => {
  if (cachedBestsellers) return cachedBestsellers;
  
  if (fetchPromise) return fetchPromise;
  
  fetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('product_sales')
        .select('shopify_product_id, total_quantity_sold')
        .gt('total_quantity_sold', BESTSELLER_THRESHOLD);

      if (error) {
        console.error('Error fetching bestsellers:', error);
        return new Set<string>();
      }

      cachedBestsellers = new Set(
        (data as BestsellerData[])?.map(item => item.shopify_product_id) || []
      );
      return cachedBestsellers;
    } catch (err) {
      console.error('Failed to fetch bestsellers:', err);
      return new Set<string>();
    }
  })();
  
  return fetchPromise;
};

export const checkIsBestseller = async (productId: string): Promise<boolean> => {
  const bestsellers = await getBestsellersSet();
  const numericId = productId.replace('gid://shopify/Product/', '');
  return bestsellers.has(numericId) || bestsellers.has(productId);
};
