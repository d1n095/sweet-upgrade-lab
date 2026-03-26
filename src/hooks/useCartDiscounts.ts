import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCartStore } from '@/stores/cartStore';

interface VolumeDiscount {
  id: string;
  min_quantity: number;
  discount_percent: number;
  shopify_product_id: string | null;
  is_global: boolean;
  excluded_product_ids: string[];
  stackable: boolean;
  label: string | null;
}

interface BundlePricing {
  id: string;
  name: string;
  description: string | null;
  discount_percent: number;
  product_ids: string[];
}

export interface CartDiscount {
  type: 'volume' | 'bundle';
  name: string;
  description?: string;
  discountPercent: number;
  applicableItems: string[];
  discountAmount: number;
}

export function useCartDiscounts() {
  const items = useCartStore(state => state.items);
  const [volumeDiscounts, setVolumeDiscounts] = useState<VolumeDiscount[]>([]);
  const [bundles, setBundles] = useState<BundlePricing[]>([]);
  const [discounts, setDiscounts] = useState<CartDiscount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDiscountRules = async () => {
      setIsLoading(true);
      try {
        const [{ data: volumeData }, { data: bundleData }] = await Promise.all([
          supabase.from('volume_discounts').select('*').order('min_quantity', { ascending: true }),
          supabase.from('bundle_pricing').select(`
            id, name, description, discount_percent,
            bundle_products ( shopify_product_id )
          `).eq('is_active', true),
        ]);

        if (volumeData) {
          setVolumeDiscounts(volumeData.map((v: any) => ({
            ...v,
            excluded_product_ids: v.excluded_product_ids || [],
            stackable: v.stackable ?? true,
          })));
        }

        if (bundleData) {
          setBundles(bundleData.map(b => ({
            id: b.id,
            name: b.name,
            description: b.description,
            discount_percent: b.discount_percent,
            product_ids: b.bundle_products?.map((bp: any) => bp.shopify_product_id) || [],
          })));
        }
      } catch (error) {
        console.error('Error fetching discount rules:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiscountRules();
  }, []);

  useEffect(() => {
    if (isLoading || items.length === 0) {
      setDiscounts([]);
      return;
    }

    const calculatedDiscounts: CartDiscount[] = [];

    // --- Volume discounts (only best applicable, no double-dipping) ---
    const globalVDs = volumeDiscounts.filter(vd => vd.is_global && !vd.shopify_product_id);
    
    // Find best global volume discount
    const eligibleGlobal = globalVDs
      .map(vd => {
        const excluded = vd.excluded_product_ids || [];
        const eligibleItems = items.filter(item => !excluded.includes(item.product.node.id));
        const eligibleQty = eligibleItems.reduce((sum, item) => sum + item.quantity, 0);
        return { ...vd, eligibleItems, eligibleQty };
      })
      .filter(vd => vd.eligibleQty >= vd.min_quantity)
      .sort((a, b) => b.discount_percent - a.discount_percent);

    const bestGlobal = eligibleGlobal[0];
    const globalAppliedIds = new Set<string>();

    if (bestGlobal) {
      const cartTotal = bestGlobal.eligibleItems.reduce(
        (sum, item) => sum + parseFloat(item.price.amount) * item.quantity, 0
      );
      calculatedDiscounts.push({
        type: 'volume',
        name: bestGlobal.label || `Mängdrabatt ${bestGlobal.discount_percent}%`,
        description: `${bestGlobal.eligibleQty} produkter i korgen`,
        discountPercent: bestGlobal.discount_percent,
        applicableItems: bestGlobal.eligibleItems.map(i => i.variantId),
        discountAmount: cartTotal * (bestGlobal.discount_percent / 100),
      });
      
      // If not stackable, skip all other discounts
      if (!bestGlobal.stackable) {
        setDiscounts(calculatedDiscounts);
        return;
      }
      
      bestGlobal.eligibleItems.forEach(i => globalAppliedIds.add(i.variantId));
    }

    // Product-specific volume discounts (skip items already covered by non-stackable global)
    items.forEach(item => {
      if (globalAppliedIds.has(item.variantId) && bestGlobal && !bestGlobal.stackable) return;
      
      const productDiscount = volumeDiscounts
        .filter(vd => vd.shopify_product_id === item.product.node.id && item.quantity >= vd.min_quantity)
        .sort((a, b) => b.discount_percent - a.discount_percent)[0];

      if (productDiscount) {
        const itemTotal = parseFloat(item.price.amount) * item.quantity;
        calculatedDiscounts.push({
          type: 'volume',
          name: `Mängdrabatt ${productDiscount.discount_percent}%`,
          description: `${item.quantity}+ st ${item.product.node.title}`,
          discountPercent: productDiscount.discount_percent,
          applicableItems: [item.variantId],
          discountAmount: itemTotal * (productDiscount.discount_percent / 100),
        });
      }
    });

    // --- Bundle discounts ---
    bundles.forEach(bundle => {
      if (bundle.product_ids.length < 2) return;
      const cartProductIds = items.map(item => item.product.node.id);
      if (!bundle.product_ids.every(pid => cartProductIds.includes(pid))) return;

      const bundleItems = items.filter(item => bundle.product_ids.includes(item.product.node.id));
      const bundleTotal = bundleItems.reduce(
        (sum, item) => sum + parseFloat(item.price.amount) * item.quantity, 0
      );
      calculatedDiscounts.push({
        type: 'bundle',
        name: bundle.name,
        description: bundle.description || 'Paketrabatt',
        discountPercent: bundle.discount_percent,
        applicableItems: bundleItems.map(i => i.variantId),
        discountAmount: bundleTotal * (bundle.discount_percent / 100),
      });
    });

    setDiscounts(calculatedDiscounts);
  }, [items, volumeDiscounts, bundles, isLoading]);

  const totalDiscount = discounts.reduce((sum, d) => sum + d.discountAmount, 0);

  const getDiscountedTotal = () => {
    const subtotal = items.reduce(
      (sum, item) => sum + parseFloat(item.price.amount) * item.quantity, 0
    );
    return Math.max(0, subtotal - totalDiscount);
  };

  return {
    discounts,
    totalDiscount,
    getDiscountedTotal,
    isLoading,
    volumeDiscounts,
    bundles,
  };
}
