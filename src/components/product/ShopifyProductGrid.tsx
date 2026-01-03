import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Loader2 } from 'lucide-react';
import ShopifyProductCard from '@/components/product/ShopifyProductCard';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';

const ShopifyProductGrid = () => {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true);
        const data = await fetchProducts(50);
        setProducts(data);
      } catch (err) {
        console.error('Failed to load products:', err);
        setError('Kunde inte ladda produkter');
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, []);

  return (
    <section id="products" className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            Våra <span className="text-gradient">Produkter</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Utforska vårt sortiment av hållbara teknikprodukter och naturliga kroppsvårdsprodukter
          </p>
        </motion.div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Laddar produkter...</p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="text-center py-12 text-destructive">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && products.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Package className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Inga produkter ännu</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Vi har inga produkter i butiken just nu. Berätta för oss vilka produkter du vill lägga till så skapar vi dem åt dig!
            </p>
          </motion.div>
        )}

        {/* Products Grid */}
        {!isLoading && products.length > 0 && (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {products.map((product, index) => (
              <ShopifyProductCard key={product.node.id} product={product} index={index} />
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default ShopifyProductGrid;
