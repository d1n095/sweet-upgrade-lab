import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  price: number;
  stock: number;
  sku: string | null;
  is_active: boolean;
  display_order: number;
}

export function useProductVariants(productId: string | undefined) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!productId) return;

    const load = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped = data.map((v) => ({
          ...v,
          price: Number(v.price),
        }));
        setVariants(mapped);
        // Auto-select first in-stock variant, fallback to first
        const firstInStock = mapped.find((v) => v.stock > 0);
        setSelectedVariant(firstInStock || mapped[0]);
      } else {
        setVariants([]);
        setSelectedVariant(null);
      }
      setIsLoading(false);
    };

    load();
  }, [productId]);

  const hasVariants = variants.length > 1;

  return { variants, selectedVariant, setSelectedVariant, hasVariants, isLoading };
}
