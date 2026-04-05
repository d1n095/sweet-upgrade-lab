import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const usePurchaseHistory = () => {
  const { user } = useAuth();
  const [purchasedProductIds, setPurchasedProductIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setPurchasedProductIds(new Set());
      return;
    }

    const load = async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('items')
          .eq('user_id', user.id)
          .eq('payment_status', 'paid')
          .is('deleted_at', null);

        if (!data) return;

        const ids = new Set<string>();
        for (const order of data) {
          const items = order.items as any[];
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item.id) ids.add(item.id);
              if (item.product_id) ids.add(item.product_id);
            }
          }
        }
        setPurchasedProductIds(ids);
      } catch (err) {

      }
    };

    load();
  }, [user?.id]);

  return { purchasedProductIds, hasPurchased: (id: string) => purchasedProductIds.has(id) };
};
