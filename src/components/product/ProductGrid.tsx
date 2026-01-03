import { useState } from 'react';
import { motion } from 'framer-motion';
import { Grid, Zap, Square, Battery, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProductCard from '@/components/product/ProductCard';
import { products, categories } from '@/data/products';

const iconMap: Record<string, React.ElementType> = {
  Grid,
  Zap,
  Square,
  Battery,
  Settings,
};

const ProductGrid = () => {
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredProducts =
    activeCategory === 'all'
      ? products
      : products.filter((product) => product.category === activeCategory);

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
            Utforska vårt sortiment av högkvalitativa laddlösningar för alla behov
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap justify-center gap-2 md:gap-3 mb-12"
        >
          {categories.map((category) => {
            const Icon = iconMap[category.icon];
            return (
              <Button
                key={category.id}
                variant={activeCategory === category.id ? 'default' : 'outline'}
                onClick={() => setActiveCategory(category.id)}
                className="gap-2"
              >
                <Icon className="w-4 h-4" />
                {category.name}
              </Button>
            );
          })}
        </motion.div>

        {/* Products Grid */}
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {filteredProducts.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </motion.div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Inga produkter hittades i denna kategori.
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductGrid;
