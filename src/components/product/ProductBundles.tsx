import { useEffect, useState } from 'react';
import { Package, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { motion } from 'framer-motion';

interface Bundle {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  discount_percent: number;
}

interface Props {
  productId: string;
}

const ProductBundles = ({ productId }: Props) => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const [bundles, setBundles] = useState<Bundle[]>([]);

  useEffect(() => {
    const load = async () => {
      // Find bundles containing this product
      const { data: bundleItems } = await supabase
        .from('bundle_items')
        .select('bundle_id')
        .eq('product_id', productId);

      if (!bundleItems || bundleItems.length === 0) return;

      const bundleIds = [...new Set(bundleItems.map(b => b.bundle_id))];

      const { data } = await supabase
        .from('bundles')
        .select('id, name, name_en, description, description_en, discount_percent')
        .in('id', bundleIds)
        .eq('is_active', true);

      setBundles((data || []) as Bundle[]);
    };
    load();
  }, [productId]);

  if (bundles.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5"
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-accent" />
        {lang === 'sv' ? 'Spara med paket' : 'Save with bundles'}
      </p>
      <div className="space-y-2">
        {bundles.map(bundle => (
          <div
            key={bundle.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-accent/5 border border-accent/20"
          >
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {lang === 'en' && bundle.name_en ? bundle.name_en : bundle.name}
              </p>
              {(bundle.description || bundle.description_en) && (
                <p className="text-xs text-muted-foreground truncate">
                  {lang === 'en' && bundle.description_en ? bundle.description_en : bundle.description}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span className="text-sm font-bold text-accent">-{bundle.discount_percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default ProductBundles;
