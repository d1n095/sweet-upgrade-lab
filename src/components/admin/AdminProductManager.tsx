import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, Package, Edit, Trash2, Loader2, 
  Image as ImageIcon, DollarSign, Tag, X, Save,
  Eye, EyeOff, Boxes
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Product categories
const productCategories = [
  { value: 'Kroppsvård', label: { sv: 'Kroppsvård', en: 'Body Care' } },
  { value: 'Elektronik', label: { sv: 'Elektronik', en: 'Electronics' } },
  { value: 'Mode', label: { sv: 'Mode', en: 'Fashion' } },
  { value: 'Ljus', label: { sv: 'Ljus', en: 'Candles' } },
  { value: 'Smycken', label: { sv: 'Smycken & Silver', en: 'Jewelry & Silver' } },
  { value: 'Bastudofter', label: { sv: 'Bastudofter', en: 'Sauna Scents' } },
  { value: 'Hemtextil', label: { sv: 'Hemtextil', en: 'Home Textiles' } },
  { value: 'CBD', label: { sv: 'CBD', en: 'CBD' } },
];

// Suggested tags
const suggestedTags = [
  'naturlig', 'ekologisk', 'vegansk', 'giftfri', 'hållbar', 
  'handgjord', 'svensktillverkad', 'nyhet', 'bästsäljare', 'limited'
];

interface ProductFormData {
  title: string;
  description: string;
  price: string;
  productType: string;
  tags: string;
  vendor: string;
  isVisible: boolean;
  inventory: number;
  allowOverselling: boolean;
}

const AdminProductManager = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    description: '',
    price: '',
    productType: '',
    tags: '',
    vendor: '4ThePeople',
    isVisible: true,
    inventory: 0,
    allowOverselling: false,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => fetchProducts(50),
  });

  const content = {
    sv: {
      title: 'Produkthantering',
      subtitle: 'Lägg till, redigera och ta bort produkter',
      addProduct: 'Lägg till produkt',
      editProduct: 'Redigera produkt',
      productName: 'Produktnamn',
      description: 'Beskrivning',
      price: 'Pris (SEK)',
      category: 'Kategori',
      tags: 'Taggar (kommaseparerade)',
      vendor: 'Leverantör',
      save: 'Spara produkt',
      update: 'Uppdatera',
      cancel: 'Avbryt',
      delete: 'Ta bort',
      noProducts: 'Inga produkter hittades',
      loading: 'Laddar produkter...',
      deleteConfirm: 'Är du säker?',
      deleteDescription: 'Denna åtgärd kan inte ångras. Produkten tas bort permanent.',
      productAdded: 'Produkt tillagd!',
      productUpdated: 'Produkt uppdaterad!',
      productDeleted: 'Produkt borttagen!',
      error: 'Något gick fel',
      inStock: 'I lager',
      outOfStock: 'Slut',
      moreProducts: 'fler produkter',
    },
    en: {
      title: 'Product Management',
      subtitle: 'Add, edit and delete products',
      addProduct: 'Add Product',
      editProduct: 'Edit Product',
      productName: 'Product Name',
      description: 'Description',
      price: 'Price (SEK)',
      category: 'Category',
      tags: 'Tags (comma separated)',
      vendor: 'Vendor',
      save: 'Save Product',
      update: 'Update',
      cancel: 'Cancel',
      delete: 'Delete',
      noProducts: 'No products found',
      loading: 'Loading products...',
      deleteConfirm: 'Are you sure?',
      deleteDescription: 'This action cannot be undone. The product will be permanently deleted.',
      productAdded: 'Product added!',
      productUpdated: 'Product updated!',
      productDeleted: 'Product deleted!',
      error: 'Something went wrong',
      inStock: 'In stock',
      outOfStock: 'Out of stock',
      moreProducts: 'more products',
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
      isVisible: true,
      inventory: 0,
      allowOverselling: false,
    });
    setSelectedProduct(null);
  };

  const handleEditClick = (product: ShopifyProduct) => {
    setSelectedProduct(product);
    const variant = product.node.variants.edges[0]?.node;
    setFormData({
      title: product.node.title,
      description: product.node.description || '',
      price: product.node.priceRange.minVariantPrice.amount,
      productType: '',
      tags: '',
      vendor: '4ThePeople',
      isVisible: true,
      inventory: 0,
      allowOverselling: false,
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (product: ShopifyProduct) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await supabase.functions.invoke('shopify-proxy', {
        body: {
          action: 'createProduct',
          data: {
            title: formData.title,
            body_html: formData.description,
            product_type: formData.productType,
            tags: formData.tags,
            vendor: formData.vendor,
            variants: [{
              price: formData.price,
            }],
          },
        },
      });

      if (response.error) throw response.error;

      toast.success(t.productAdded);
      resetForm();
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-products'] });
    } catch (error) {
      console.error('Failed to create product:', error);
      toast.error(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setIsSubmitting(true);

    try {
      // Extract the numeric ID from the Shopify GID
      const gid = selectedProduct.node.id;
      const numericId = gid.split('/').pop();

      const response = await supabase.functions.invoke('shopify-proxy', {
        body: {
          action: 'updateProduct',
          productId: numericId,
          data: {
            title: formData.title,
            body_html: formData.description,
            product_type: formData.productType,
            tags: formData.tags,
            vendor: formData.vendor,
          },
        },
      });

      if (response.error) throw response.error;

      toast.success(t.productUpdated);
      resetForm();
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-products'] });
    } catch (error) {
      console.error('Failed to update product:', error);
      toast.error(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;
    setIsSubmitting(true);

    try {
      const gid = selectedProduct.node.id;
      const numericId = gid.split('/').pop();

      const response = await supabase.functions.invoke('shopify-proxy', {
        body: {
          action: 'deleteProduct',
          productId: numericId,
        },
      });

      if (response.error) throw response.error;

      toast.success(t.productDeleted);
      setSelectedProduct(null);
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['shopify-products'] });
    } catch (error) {
      console.error('Failed to delete product:', error);
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

  const ProductForm = ({ isEdit = false, onSubmit }: { isEdit?: boolean; onSubmit: (e: React.FormEvent) => void }) => (
    <form onSubmit={onSubmit} className="space-y-4">
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
              disabled={isEdit}
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
          onClick={() => {
            resetForm();
            isEdit ? setIsEditDialogOpen(false) : setIsAddDialogOpen(false);
          }}
          className="flex-1"
        >
          {t.cancel}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !formData.title || (!isEdit && !formData.price)}
          className="flex-1"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {isEdit ? t.update : t.save}
            </>
          )}
        </Button>
      </div>
    </form>
  );

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
            <ProductForm onSubmit={handleSubmit} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Product List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {productsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{t.noProducts}</p>
        ) : (
          products.slice(0, 10).map((product: ShopifyProduct) => (
            <motion.div
              key={product.node.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
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
                  ? t.inStock
                  : t.outOfStock
                }
              </Badge>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEditClick(product)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteClick(product)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {products.length > 10 && (
        <p className="text-xs text-center text-muted-foreground">
          + {products.length - 10} {t.moreProducts}
        </p>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              {t.editProduct}
            </DialogTitle>
          </DialogHeader>
          <ProductForm isEdit onSubmit={handleUpdate} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteDescription}
              {selectedProduct && (
                <span className="block mt-2 font-medium text-foreground">
                  {selectedProduct.node.title}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedProduct(null)}>
              {t.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t.delete
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProductManager;