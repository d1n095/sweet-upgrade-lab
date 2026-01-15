import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, Package, Edit, Trash2, Loader2, 
  Image as ImageIcon, DollarSign, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ProductFormData {
  title: string;
  description: string;
  price: string;
  productType: string;
  tags: string;
  vendor: string;
}

const AdminProductManager = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    description: '',
    price: '',
    productType: '',
    tags: '',
    vendor: '4ThePeople',
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => fetchProducts(50),
  });

  const content = {
    sv: {
      title: 'Produkthantering',
      subtitle: 'Lägg till och redigera produkter',
      addProduct: 'Lägg till produkt',
      editProduct: 'Redigera produkt',
      productName: 'Produktnamn',
      description: 'Beskrivning',
      price: 'Pris (SEK)',
      category: 'Kategori',
      tags: 'Taggar (kommaseparerade)',
      vendor: 'Leverantör',
      save: 'Spara produkt',
      cancel: 'Avbryt',
      noProducts: 'Inga produkter hittades',
      loading: 'Laddar produkter...',
      deleteConfirm: 'Är du säker på att du vill ta bort denna produkt?',
      productAdded: 'Produkt tillagd!',
      productUpdated: 'Produkt uppdaterad!',
      productDeleted: 'Produkt borttagen!',
      error: 'Något gick fel',
    },
    en: {
      title: 'Product Management',
      subtitle: 'Add and edit products',
      addProduct: 'Add Product',
      editProduct: 'Edit Product',
      productName: 'Product Name',
      description: 'Description',
      price: 'Price (SEK)',
      category: 'Category',
      tags: 'Tags (comma separated)',
      vendor: 'Vendor',
      save: 'Save Product',
      cancel: 'Cancel',
      noProducts: 'No products found',
      loading: 'Loading products...',
      deleteConfirm: 'Are you sure you want to delete this product?',
      productAdded: 'Product added!',
      productUpdated: 'Product updated!',
      productDeleted: 'Product deleted!',
      error: 'Something went wrong',
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      price: '',
      productType: '',
      tags: '',
      vendor: '4ThePeople',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Call the Shopify product creation API via edge function
      const response = await fetch('/api/shopify/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          body: formData.description,
          product_type: formData.productType,
          tags: formData.tags,
          vendor: formData.vendor,
          variants: [{
            price: formData.price,
          }],
        }),
      });

      if (response.ok) {
        toast.success(t.productAdded);
        resetForm();
        setIsAddDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
        queryClient.invalidateQueries({ queryKey: ['shopify-products'] });
      } else {
        throw new Error('Failed to create product');
      }
    } catch (error) {
      console.error('Failed to create product:', error);
      toast.error(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (amount: string, currencyCode: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              {t.addProduct}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                {t.addProduct}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t.productName}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Naturlig Deodorant"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t.description}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Aluminiumfri, naturlig doft..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">{t.price}</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="159"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productType">{t.category}</Label>
                  <Input
                    id="productType"
                    value={formData.productType}
                    onChange={(e) => setFormData(prev => ({ ...prev, productType: e.target.value }))}
                    placeholder="Kroppsvård"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">{t.tags}</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="naturlig, ekologisk, vegansk"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  className="flex-1"
                >
                  {t.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.title || !formData.price}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t.save
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Product List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {productsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{t.noProducts}</p>
        ) : (
          products.slice(0, 6).map((product: ShopifyProduct) => (
            <motion.div
              key={product.node.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                {product.node.images.edges[0]?.node && (
                  <img
                    src={product.node.images.edges[0].node.url}
                    alt={product.node.title}
                    className="w-full h-full object-cover"
                  />
                )}
                {!product.node.images.edges[0]?.node && (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{product.node.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(
                    product.node.priceRange.minVariantPrice.amount,
                    product.node.priceRange.minVariantPrice.currencyCode
                  )}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {product.node.variants.edges[0]?.node.availableForSale 
                  ? (language === 'sv' ? 'I lager' : 'In stock')
                  : (language === 'sv' ? 'Slut' : 'Out of stock')
                }
              </Badge>
            </motion.div>
          ))
        )}
      </div>

      {products.length > 6 && (
        <p className="text-xs text-center text-muted-foreground">
          {language === 'sv' 
            ? `+ ${products.length - 6} fler produkter`
            : `+ ${products.length - 6} more products`
          }
        </p>
      )}
    </div>
  );
};

export default AdminProductManager;
