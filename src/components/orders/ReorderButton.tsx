import { useState } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { useLanguage } from '@/context/LanguageContext';
import { fetchDbProductByHandle } from '@/lib/products';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReorderButtonProps {
  orderId: string;
  items: any[];
  size?: 'sm' | 'default';
}

const ReorderButton = ({ orderId, items, size = 'sm' }: ReorderButtonProps) => {
  const { language } = useLanguage();
  const { addItem } = useCartStore();
  const [loading, setLoading] = useState(false);

  const handleReorder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);

    try {
      let addedCount = 0;

      for (const item of items) {
        const productId = item.id || item.product_id;
        if (!productId) continue;

        // Try to find the product in DB
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .eq('is_visible', true)
          .eq('is_sellable', true)
          .maybeSingle();

        if (product && product.stock > 0) {
          // Create a cart-compatible item
          addItem({
            product: {
              node: {
                id: product.id,
                title: product.title_sv,
                handle: product.handle || product.id,
                images: {
                  edges: product.image_urls?.length
                    ? [{ node: { url: product.image_urls[0], altText: product.title_sv } }]
                    : [],
                },
                variants: {
                  edges: [{
                    node: {
                      id: product.id,
                      title: 'Default',
                      price: { amount: String(product.price), currencyCode: product.currency || 'SEK' },
                      availableForSale: true,
                    },
                  }],
                },
                priceRange: {
                  minVariantPrice: { amount: String(product.price), currencyCode: product.currency || 'SEK' },
                },
              },
            } as any,
            variantId: product.id,
            variantTitle: 'Default',
            price: { amount: String(product.price), currencyCode: product.currency || 'SEK' },
            quantity: item.quantity || 1,
            selectedOptions: [],
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        toast.success(
          language === 'sv'
            ? `${addedCount} produkt(er) tillagda i varukorgen`
            : `${addedCount} product(s) added to cart`
        );
      } else {
        toast.error(
          language === 'sv'
            ? 'Produkterna är inte längre tillgängliga'
            : 'Products are no longer available'
        );
      }
    } catch (err) {
      toast.error(language === 'sv' ? 'Kunde inte lägga om order' : 'Failed to reorder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleReorder}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
      {language === 'sv' ? 'Köp igen' : 'Buy again'}
    </Button>
  );
};

export default ReorderButton;
