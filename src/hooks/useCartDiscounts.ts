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
    
    // Calculate total items in cart for global volume discount
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    // Find the best applicable global volume discount based on total cart quantity
    const applicableGlobalDiscounts = volumeDiscounts
      .filter(vd => vd.is_global && !vd.shopify_product_id && totalQuantity >= vd.min_quantity)
      .sort((a, b) => b.discount_percent - a.discount_percent);
    
    const bestGlobalDiscount = applicableGlobalDiscounts[0];

    if (bestGlobalDiscount) {
      // Apply global discount to entire cart
      const cartTotal = items.reduce(
        (sum, item) => sum + parseFloat(item.price.amount) * item.quantity,
        0
      );
      const discountAmount = cartTotal * (bestGlobalDiscount.discount_percent / 100);
      
      calculatedDiscounts.push({
        type: 'volume',
        name: `Mängdrabatt ${bestGlobalDiscount.discount_percent}%`,
        description: `${totalQuantity} produkter i korgen`,
        discountPercent: bestGlobalDiscount.discount_percent,
        applicableItems: items.map(i => i.variantId),
        discountAmount: discountAmount
      });
    }

    // Also check product-specific volume discounts
    items.forEach(item => {
      const productId = item.product.node.id;
      
      const productDiscount = volumeDiscounts.find(
        vd => vd.shopify_product_id === productId && item.quantity >= vd.min_quantity
      );
      
      if (productDiscount) {
        const itemTotal = parseFloat(item.price.amount) * item.quantity;
        const discountAmount = itemTotal * (productDiscount.discount_percent / 100);
        
        calculatedDiscounts.push({
          type: 'volume',
          name: `Mängdrabatt ${productDiscount.discount_percent}%`,
          description: `${item.quantity}+ st ${item.product.node.title}`,
          discountPercent: productDiscount.discount_percent,
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
