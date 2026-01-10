import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CartItem, useCartStore } from '@/stores/cartStore';

interface VolumeDiscount {
  id: string;
  min_quantity: number;
  discount_percent: number;
  shopify_product_id: string | null;
  is_global: boolean;
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
  applicableItems: string[]; // variant IDs
  discountAmount: number;
}

export function useCartDiscounts() {
  const items = useCartStore(state => state.items);
  const [volumeDiscounts, setVolumeDiscounts] = useState<VolumeDiscount[]>([]);
  const [bundles, setBundles] = useState<BundlePricing[]>([]);
  const [discounts, setDiscounts] = useState<CartDiscount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch discount rules from database
  useEffect(() => {
    const fetchDiscountRules = async () => {
      setIsLoading(true);
      try {
        // Fetch volume discounts
        const { data: volumeData } = await supabase
          .from('volume_discounts')
          .select('*')
          .order('min_quantity', { ascending: true });

        // Fetch bundle pricing with products
        const { data: bundleData } = await supabase
          .from('bundle_pricing')
          .select(`
            id,
            name,
            description,
            discount_percent,
            bundle_products (
              shopify_product_id
            )
          `)
          .eq('is_active', true);

        if (volumeData) {
          setVolumeDiscounts(volumeData);
        }

        if (bundleData) {
          const formattedBundles = bundleData.map(bundle => ({
            id: bundle.id,
            name: bundle.name,
            description: bundle.description,
            discount_percent: bundle.discount_percent,
            product_ids: bundle.bundle_products?.map((bp: any) => bp.shopify_product_id) || []
          }));
          setBundles(formattedBundles);
        }
      } catch (error) {
        console.error('Error fetching discount rules:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiscountRules();
  }, []);

  // Calculate applicable discounts based on cart items
  useEffect(() => {
    if (isLoading || items.length === 0) {
      setDiscounts([]);
      return;
    }

    const calculatedDiscounts: CartDiscount[] = [];

    // Calculate volume discounts
    items.forEach(item => {
      const productId = item.product.node.id;
      
      // Find applicable volume discount (product-specific or global)
      const productDiscount = volumeDiscounts.find(
        vd => vd.shopify_product_id === productId && item.quantity >= vd.min_quantity
      );
      
      const globalDiscount = volumeDiscounts.find(
        vd => vd.is_global && !vd.shopify_product_id && item.quantity >= vd.min_quantity
      );

      const applicableDiscount = productDiscount || globalDiscount;
      
      if (applicableDiscount) {
        const itemTotal = parseFloat(item.price.amount) * item.quantity;
        const discountAmount = itemTotal * (applicableDiscount.discount_percent / 100);
        
        calculatedDiscounts.push({
          type: 'volume',
          name: `Mängdrabatt ${applicableDiscount.discount_percent}%`,
          description: `Köp ${applicableDiscount.min_quantity}+ st`,
          discountPercent: applicableDiscount.discount_percent,
          applicableItems: [item.variantId],
          discountAmount: discountAmount
        });
      }
    });

    // Calculate bundle discounts
    bundles.forEach(bundle => {
      if (bundle.product_ids.length < 2) return;

      // Check if all bundle products are in cart
      const cartProductIds = items.map(item => item.product.node.id);
      const allProductsInCart = bundle.product_ids.every(pid => cartProductIds.includes(pid));

      if (allProductsInCart) {
        // Calculate discount on the bundle items
        const bundleItems = items.filter(item => 
          bundle.product_ids.includes(item.product.node.id)
        );
        
        const bundleTotal = bundleItems.reduce(
          (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
          0
        );
        
        const discountAmount = bundleTotal * (bundle.discount_percent / 100);
        
        calculatedDiscounts.push({
          type: 'bundle',
          name: bundle.name,
          description: bundle.description || 'Paketrabatt',
          discountPercent: bundle.discount_percent,
          applicableItems: bundleItems.map(i => i.variantId),
          discountAmount: discountAmount
        });
      }
    });

    setDiscounts(calculatedDiscounts);
  }, [items, volumeDiscounts, bundles, isLoading]);

  const totalDiscount = discounts.reduce((sum, d) => sum + d.discountAmount, 0);

  const getDiscountedTotal = () => {
    const subtotal = items.reduce(
      (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
      0
    );
    return Math.max(0, subtotal - totalDiscount);
  };

  return {
    discounts,
    totalDiscount,
    getDiscountedTotal,
    isLoading,
    volumeDiscounts,
    bundles
  };
}
