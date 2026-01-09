import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MemberPrice {
  shopify_product_id: string;
  shopify_variant_id: string;
  member_price: number;
}

interface VolumeDiscount {
  shopify_product_id: string | null;
  min_quantity: number;
  discount_percent: number;
  is_global: boolean;
}

interface BundlePricing {
  id: string;
  name: string;
  description: string | null;
  discount_percent: number;
  product_ids: string[];
}

export const useMemberPrices = () => {
  const [memberPrices, setMemberPrices] = useState<Map<string, number>>(new Map());
  const [volumeDiscounts, setVolumeDiscounts] = useState<VolumeDiscount[]>([]);
  const [bundles, setBundles] = useState<BundlePricing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPricingData = async () => {
      try {
        // Fetch member prices
        const { data: pricesData } = await supabase
          .from('member_prices')
          .select('*');

        if (pricesData) {
          const priceMap = new Map<string, number>();
          pricesData.forEach((p: MemberPrice) => {
            priceMap.set(p.shopify_variant_id, Number(p.member_price));
          });
          setMemberPrices(priceMap);
        }

        // Fetch volume discounts
        const { data: volumeData } = await supabase
          .from('volume_discounts')
          .select('*')
          .order('min_quantity', { ascending: true });

        if (volumeData) {
          setVolumeDiscounts(volumeData.map((v) => ({
            ...v,
            discount_percent: Number(v.discount_percent)
          })));
        }

        // Fetch bundles with products
        const { data: bundleData } = await supabase
          .from('bundle_pricing')
          .select('*')
          .eq('is_active', true);

        if (bundleData) {
          const bundlesWithProducts = await Promise.all(
            bundleData.map(async (bundle) => {
              const { data: products } = await supabase
                .from('bundle_products')
                .select('shopify_product_id')
                .eq('bundle_id', bundle.id);

              return {
                ...bundle,
                discount_percent: Number(bundle.discount_percent),
                product_ids: products?.map(p => p.shopify_product_id) || []
              };
            })
          );
          setBundles(bundlesWithProducts);
        }
      } catch (error) {
        console.error('Error fetching pricing data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPricingData();
  }, []);

  const getMemberPrice = (variantId: string): number | null => {
    return memberPrices.get(variantId) ?? null;
  };

  const getVolumeDiscount = (productId: string | null, quantity: number): number => {
    // Check product-specific discounts first
    const productDiscounts = volumeDiscounts.filter(
      v => v.shopify_product_id === productId && quantity >= v.min_quantity
    );

    if (productDiscounts.length > 0) {
      // Get highest applicable discount
      return Math.max(...productDiscounts.map(d => d.discount_percent));
    }

    // Fall back to global discounts
    const globalDiscounts = volumeDiscounts.filter(
      v => v.is_global && quantity >= v.min_quantity
    );

    if (globalDiscounts.length > 0) {
      return Math.max(...globalDiscounts.map(d => d.discount_percent));
    }

    return 0;
  };

  const checkBundleDiscount = (cartProductIds: string[]): BundlePricing | null => {
    for (const bundle of bundles) {
      const hasAllProducts = bundle.product_ids.every(
        id => cartProductIds.includes(id)
      );
      if (hasAllProducts && bundle.product_ids.length > 0) {
        return bundle;
      }
    }
    return null;
  };

  return {
    memberPrices,
    volumeDiscounts,
    bundles,
    loading,
    getMemberPrice,
    getVolumeDiscount,
    checkBundleDiscount,
  };
};
