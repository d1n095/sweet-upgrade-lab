import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, Eye, EyeOff, Loader2, Edit, Save, X,
  Plus, Minus, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { fetchProducts, ShopifyProduct } from '@/lib/shopify';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface LocalInventory {
  [productId: string]: {
    visible: boolean;
    stock: number;
    allowOversell: boolean;
  };
}

const AdminInventoryManager = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [localInventory, setLocalInventory] = useState<LocalInventory>({});
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [stockValue, setStockValue] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-inventory-products'],
    queryFn: () => fetchProducts(50),
  });

  const content = {
    sv: {
      title: 'Lager & Synlighet',
      subtitle: 'Hantera produktsynlighet och lagersaldo',
      visible: 'Synlig',
      hidden: 'Dold',
      stock: 'Lager',
      inStock: 'I lager',
      outOfStock: 'Slut i lager',
      allowOversell: 'Tillåt köp vid slutsålt',
      editStock: 'Ändra lager',
      save: 'Spara',
      cancel: 'Avbryt',
      stockUpdated: 'Lagersaldo uppdaterat!',
      visibilityUpdated: 'Synlighet uppdaterad!',
      error: 'Något gick fel',
      noProducts: 'Inga produkter',
      loading: 'Laddar...',
      units: 'st',
    },
    en: {
      title: 'Inventory & Visibility',
      subtitle: 'Manage product visibility and stock',
      visible: 'Visible',
      hidden: 'Hidden',
      stock: 'Stock',
      inStock: 'In stock',
      outOfStock: 'Out of stock',
      allowOversell: 'Allow purchase when sold out',
      editStock: 'Edit stock',
      save: 'Save',
      cancel: 'Cancel',
      stockUpdated: 'Stock updated!',
      visibilityUpdated: 'Visibility updated!',
      error: 'Something went wrong',
      noProducts: 'No products',
      loading: 'Loading...',
      units: 'pcs',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  const getProductInventory = (productId: string) => {
    return localInventory[productId] || {
      visible: true,
      stock: 100,
      allowOversell: true,
    };
  };

  const toggleVisibility = async (productId: string) => {
    const current = getProductInventory(productId);
    setLocalInventory((prev) => ({
      ...prev,
      [productId]: {
        ...current,
        visible: !current.visible,
      },
    }));
    toast.success(t.visibilityUpdated);
  };

  const toggleOversell = (productId: string) => {
    const current = getProductInventory(productId);
    setLocalInventory((prev) => ({
      ...prev,
      [productId]: {
        ...current,
        allowOversell: !current.allowOversell,
      },
    }));
  };

  const handleEditStock = (productId: string, currentStock: number) => {
    setEditingStock(productId);
    setStockValue(currentStock);
  };

  const handleSaveStock = (productId: string) => {
    const current = getProductInventory(productId);
    setLocalInventory((prev) => ({
      ...prev,
      [productId]: {
        ...current,
        stock: stockValue,
      },
    }));
    setEditingStock(null);
    toast.success(t.stockUpdated);
  };

  const adjustStock = (productId: string, delta: number) => {
    const current = getProductInventory(productId);
    const newStock = Math.max(0, current.stock + delta);
    setLocalInventory((prev) => ({
      ...prev,
      [productId]: {
        ...current,
        stock: newStock,
      },
    }));
  };

  const formatPrice = (amount: string, currencyCode: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <Package className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h3 className="font-semibold">{t.title}</h3>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      {/* Products List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {products.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{t.noProducts}</p>
        ) : (
          products.map((product: ShopifyProduct) => {
            const inventory = getProductInventory(product.node.id);
            const isEditing = editingStock === product.node.id;

            return (
              <motion.div
                key={product.node.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`p-4 rounded-lg border transition-colors ${
                  inventory.visible
                    ? 'bg-secondary/50 border-border'
                    : 'bg-muted/50 border-muted opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Product Image */}
                  <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                    {product.node.images.edges[0]?.node ? (
                      <img
                        src={product.node.images.edges[0].node.url}
                        alt={product.node.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm truncate">{product.node.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(
                            product.node.priceRange.minVariantPrice.amount,
                            product.node.priceRange.minVariantPrice.currencyCode
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleVisibility(product.node.id)}
                        >
                          {inventory.visible ? (
                            <Eye className="w-4 h-4 text-green-600" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Stock Controls */}
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      {isEditing ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="number"
                            value={stockValue}
                            onChange={(e) => setStockValue(Number(e.target.value))}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') {
                                handleSaveStock(product.node.id);
                              } else if (e.key === 'Escape') {
                                setEditingStock(null);
                              }
                            }}
                            className="w-24 h-8 text-sm"
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveStock(product.node.id);
                            }}
                          >
                            <Save className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingStock(null);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => adjustStock(product.node.id, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <Badge
                            variant={inventory.stock > 0 ? 'outline' : 'destructive'}
                            className="cursor-pointer"
                            onClick={() => handleEditStock(product.node.id, inventory.stock)}
                          >
                            {inventory.stock} {t.units}
                          </Badge>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => adjustStock(product.node.id, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      )}

                      {/* Stock Status */}
                      {inventory.stock === 0 && !inventory.allowOversell && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {t.outOfStock}
                        </Badge>
                      )}

                      {/* Oversell Toggle */}
                      <div className="flex items-center gap-2 ml-auto">
                        <Label className="text-xs text-muted-foreground">{t.allowOversell}</Label>
                        <Switch
                          checked={inventory.allowOversell}
                          onCheckedChange={() => toggleOversell(product.node.id)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminInventoryManager;
