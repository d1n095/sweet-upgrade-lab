import { useState } from 'react';
import { motion } from 'framer-motion';
import { Filter, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ShopifyProductGrid from '@/components/product/ShopifyProductGrid';
import { storeConfig } from '@/config/storeConfig';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const Shop = () => {
  const { language } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('featured');

  const activeCategories = storeConfig.categories.filter(cat => cat.active);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {language === 'sv' ? 'Alla Produkter' : 'All Products'}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {language === 'sv' 
                ? 'Upptäck vårt sortiment av hållbara och naturliga produkter'
                : 'Discover our range of sustainable and natural products'}
            </p>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-8"
          >
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                {language === 'sv' ? 'Alla' : 'All'}
              </Button>
              {activeCategories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name[language]}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">
                    {language === 'sv' ? 'Utvalda' : 'Featured'}
                  </SelectItem>
                  <SelectItem value="price-low">
                    {language === 'sv' ? 'Pris: Lågt till högt' : 'Price: Low to high'}
                  </SelectItem>
                  <SelectItem value="price-high">
                    {language === 'sv' ? 'Pris: Högt till lågt' : 'Price: High to low'}
                  </SelectItem>
                  <SelectItem value="name">
                    {language === 'sv' ? 'Namn A-Ö' : 'Name A-Z'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>

          {/* Delivery info banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-8 text-center"
          >
            <p className="text-sm">
              <span className="font-medium">{storeConfig.shipping.deliveryTime[language]}</span>
              {' • '}
              <span>
                {language === 'sv' 
                  ? `Fri frakt över ${storeConfig.shipping.freeShippingThreshold} kr`
                  : `Free shipping over ${storeConfig.shipping.freeShippingThreshold} kr`}
              </span>
            </p>
          </motion.div>

          {/* Product Grid */}
          <ShopifyProductGrid />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Shop;
