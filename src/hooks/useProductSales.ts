import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';

interface ProductSale {
  shopify_product_id: string;
  total_quantity_sold: number;
  product_title: string;
}

interface SalesData {
  [productId: string]: number;
}

// Singleton store for sales data with realtime updates
let salesCache: SalesData = {};
let isInitialized = false;
let listeners: Set<() => void> = new Set();

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

const initializeRealtimeSubscription = async () => {
  if (isInitialized) return;
  isInitialized = true;

  // Fetch initial data
  const { data, error } = await supabase
    .from('product_sales')
    .select('shopify_product_id, total_quantity_sold');

  if (!error && data) {
    salesCache = {};
    (data as ProductSale[]).forEach(sale => {
      salesCache[sale.shopify_product_id] = sale.total_quantity_sold;
    });
    notifyListeners();
  }

  // Subscribe to realtime updates
  supabase
    .channel('product_sales_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'product_sales'
      },
      (payload) => {
        const newRecord = payload.new as ProductSale | null;
        if (newRecord) {
          salesCache[newRecord.shopify_product_id] = newRecord.total_quantity_sold;
          notifyListeners();
        }
      }
    )
    .subscribe();
};

export const useProductSales = () => {
  const { language } = useLanguage();
  const [salesData, setSalesData] = useState<SalesData>(salesCache);

  useEffect(() => {
    initializeRealtimeSubscription();

    const listener = () => {
      setSalesData({ ...salesCache });
    };

    listeners.add(listener);
    
    // Set initial data
    setSalesData({ ...salesCache });

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const getSoldCount = useCallback((productId: string): number => {
    // Handle both full GID and numeric ID formats
    const numericId = productId.replace('gid://shopify/Product/', '');
    return salesData[numericId] || salesData[productId] || 0;
  }, [salesData]);

  const getStatus = useCallback((productId: string): { status: string; count: number } | null => {
    const count = getSoldCount(productId);
    
    if (count === 0) return null;

    if (count > 25) {
      return {
        status: language === 'sv' ? 'Många har upptäckt denna' : 'Many have discovered this',
        count
      };
    } else if (count > 15) {
      return {
        status: language === 'sv' ? '🔥 Trendar' : '🔥 Trending',
        count
      };
    } else if (count > 5) {
      return {
        status: language === 'sv' ? 'Populär' : 'Popular',
        count
      };
    }
    
    return null;
  }, [getSoldCount, language]);

  const isBestseller = useCallback((productId: string): boolean => {
    return getSoldCount(productId) > 10;
  }, [getSoldCount]);

  return { salesData, getSoldCount, getStatus, isBestseller };
};

// Hook for individual product tracking
export const useProductSoldCount = (productId: string) => {
  const { getSoldCount, getStatus, isBestseller } = useProductSales();
  
  return {
    soldCount: getSoldCount(productId),
    status: getStatus(productId),
    isBestseller: isBestseller(productId)
  };
};