import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Check, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { useCartStore } from '@/stores/cartStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface RelatedProduct {
  id: string;
  title_sv: string;
  handle: string | null;
  price: number;
  original_price: number | null;
  image_urls: string[] | null;
  badge: string | null;
}

interface Props {
  productId: string;
  limit?: number;
}

const RelatedProducts = ({ productId, limit = 4 }: Props) => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const [products, setProducts] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const { addItem } = useCartStore();

  useEffect(() => {
    const load = async () => {
      try {
        const { data: tagRels } = await supabase
          .from('product_tag_relations')
          .select('tag_id')
          .eq('product_id', productId);

        const { data: catRels } = await supabase
          .from('product_categories')
          .select('category_id')
          .eq('product_id', productId);

        const tagIds = (tagRels || []).map(r => r.tag_id);
        const catIds = (catRels || []).map(r => r.category_id);

        if (tagIds.length === 0 && catIds.length === 0) {
          // Fallback: fetch random active products
          const { data } = await supabase
            .from('products')
            .select('id, title_sv, handle, price, original_price, image_urls, badge')
            .eq('is_visible', true).eq('status', 'active')
            .neq('id', productId)
            .limit(limit);
          setProducts((data || []) as RelatedProduct[]);
          setLoading(false);
          return;
        }

        let relatedIds = new Set<string>();

        if (tagIds.length > 0) {
          const { data: tagMatches } = await supabase
            .from('product_tag_relations')
            .select('product_id')
            .in('tag_id', tagIds)
            .neq('product_id', productId);
          (tagMatches || []).forEach(m => relatedIds.add(m.product_id));
        }

        if (catIds.length > 0) {
          const { data: catMatches } = await supabase
            .from('product_categories')
            .select('product_id')
            .in('category_id', catIds)
            .neq('product_id', productId);
          (catMatches || []).forEach(m => relatedIds.add(m.product_id));
        }

        if (relatedIds.size === 0) {
          setLoading(false);
          return;
        }

        const { data: prods } = await supabase
          .from('products')
          .select('id, title_sv, handle, price, original_price, image_urls, badge')
          .in('id', Array.from(relatedIds).slice(0, limit))
          .eq('is_visible', true)
          .eq('status', 'active');

        setProducts((prods || []) as RelatedProduct[]);
      } catch (err) {

      } finally {
        setLoading(false);
      }
    };
    load();
  }, [productId, limit]);

  const handleQuickAdd = (product: RelatedProduct) => {
    const cartProduct = {
      dbId: product.id,
      node: {
        id: product.id,
        title: product.title_sv,
        handle: product.handle || product.id,
        description: '',
        productType: '',
        tags: [],
        priceRange: { minVariantPrice: { amount: product.price.toString(), currencyCode: 'SEK' } },
        images: { edges: product.image_urls?.[0] ? [{ node: { url: product.image_urls[0], altText: product.title_sv } }] : [] },
        variants: { edges: [{ node: { id: product.id + '-variant', title: 'Default', availableForSale: true, price: { amount: product.price.toString(), currencyCode: 'SEK' }, selectedOptions: [] } }] },
      }
    } as any;

    addItem({
      product: cartProduct,
      variantId: product.id + '-variant',
      variantTitle: 'Default',
      price: { amount: product.price.toString(), currencyCode: 'SEK' },
      quantity: 1,
      selectedOptions: [],
    });

    setAddedIds(prev => new Set(prev).add(product.id));
    setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(product.id); return n; }), 1500);
    toast.success(lang === 'sv' ? 'Tillagd i kundvagn' : 'Added to cart');
  };

  if (loading || products.length === 0) return null;

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="mt-16 pt-12 border-t border-border">
      <div className="text-center mb-8">
        <h2 className="font-display text-2xl font-semibold">
          {lang === 'sv' ? 'Passar bra med' : 'Goes well with'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === 'sv' ? 'Komplettera din beställning' : 'Complete your order'}
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((p, i) => {
          const isAdded = addedIds.has(p.id);
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="group"
            >
              <div className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
                <Link to={`/product/${p.handle || p.id}`} className="block">
                  <div className="aspect-square bg-secondary/30 overflow-hidden">
                    {p.image_urls?.[0] ? (
                      <img
                        src={p.image_urls[0]}
                        alt={p.title_sv}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Package className="w-8 h-8 opacity-20" />
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-3 flex flex-col flex-1">
                  <Link to={`/product/${p.handle || p.id}`}>
                    <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">{p.title_sv}</p>
                  </Link>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-sm font-bold">{formatPrice(p.price)}</p>
                    {p.original_price && p.original_price > p.price && (
                      <p className="text-xs text-muted-foreground line-through">{formatPrice(p.original_price)}</p>
                    )}
                  </div>
                  <div className="mt-auto pt-2">
                    <Button
                      size="sm"
                      variant={isAdded ? 'secondary' : 'default'}
                      className="w-full h-9 text-xs font-semibold"
                      onClick={() => handleQuickAdd(p)}
                    >
                      {isAdded ? (
                        <><Check className="w-3.5 h-3.5 mr-1" />{lang === 'sv' ? 'Tillagd' : 'Added'}</>
                      ) : (
                        <><Plus className="w-3.5 h-3.5 mr-1" />{lang === 'sv' ? 'Lägg till' : 'Add'}</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default RelatedProducts;
