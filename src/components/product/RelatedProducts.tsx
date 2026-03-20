import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { motion } from 'framer-motion';

interface RelatedProduct {
  id: string;
  title_sv: string;
  handle: string | null;
  price: number;
  image_urls: string[] | null;
  badge: string | null;
}

interface Props {
  productId: string;
  limit?: number;
}

const RelatedProducts = ({ productId, limit = 4 }: Props) => {
  const { language } = useLanguage();
  const lang = language === 'no' || language === 'da' ? 'sv' : language;
  const [products, setProducts] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Get this product's tag IDs
        const { data: tagRels } = await supabase
          .from('product_tag_relations')
          .select('tag_id')
          .eq('product_id', productId);

        // Get this product's category IDs
        const { data: catRels } = await supabase
          .from('product_categories')
          .select('category_id')
          .eq('product_id', productId);

        const tagIds = (tagRels || []).map(r => r.tag_id);
        const catIds = (catRels || []).map(r => r.category_id);

        if (tagIds.length === 0 && catIds.length === 0) {
          setLoading(false);
          return;
        }

        // Find products sharing tags
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
          .select('id, title_sv, handle, price, image_urls, badge')
          .in('id', Array.from(relatedIds).slice(0, limit))
          .eq('is_visible', true)
          .eq('status', 'active');

        setProducts((prods || []) as RelatedProduct[]);
      } catch (err) {
        console.error('Failed to load related products:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [productId, limit]);

  if (loading || products.length === 0) return null;

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="mt-16 pt-12 border-t border-border">
      <h2 className="font-display text-2xl font-semibold mb-8 text-center">
        {lang === 'sv' ? 'Relaterade produkter' : 'Related products'}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          >
            <Link
              to={`/product/${p.handle || p.id}`}
              className="group block rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-square bg-secondary/30 overflow-hidden">
                {p.image_urls?.[0] ? (
                  <img
                    src={p.image_urls[0]}
                    alt={p.title_sv}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    Ingen bild
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium truncate">{p.title_sv}</p>
                <p className="text-sm font-bold mt-1">{formatPrice(p.price)}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default RelatedProducts;
