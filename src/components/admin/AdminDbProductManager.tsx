import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Package, Edit, Trash2, Loader2, AlertTriangle,
  Copy, EyeOff, Eye, CheckSquare, Square, Trash, MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdminProductForm, ProductFormData, AdminProductFormStrings
} from '@/components/admin/AdminProductForm';
import { fetchDbProducts, createDbProduct, updateDbProduct, deleteDbProduct, DbProduct } from '@/lib/products';

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

const suggestedTags = [
  'naturlig', 'ekologisk', 'vegansk', 'giftfri', 'hållbar',
  'handgjord', 'svensktillverkad', 'nyhet', 'bästsäljare', 'limited'
];

const emptyForm = (): ProductFormData => ({
  title: '',
  description: '',
  price: '',
  productType: '',
  tags: '',
  vendor: '4ThePeople',
  isVisible: true,
  inventory: 0,
  allowOverselling: false,
  imageUrls: [],
  ingredients: '',
  certifications: '',
});

const AdminDbProductManager = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<DbProduct | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-db-products'],
    queryFn: () => fetchDbProducts(true),
  });

  const sv = language === 'sv';

  const content: Record<string, AdminProductFormStrings & {
    title: string; subtitle: string; addProduct: string; editProduct: string;
    delete: string; noProducts: string; loading: string; deleteConfirm: string;
    deleteDescription: string; productAdded: string; productUpdated: string;
    productDeleted: string; error: string; inStock: string; outOfStock: string;
  }> = {
    sv: {
      title: 'Produkthantering', subtitle: 'Lägg till, redigera och ta bort produkter',
      addProduct: 'Lägg till produkt', editProduct: 'Redigera produkt',
      productName: 'Produktnamn (svenska)', description: 'Beskrivning (svenska)',
      price: 'Pris (SEK)', category: 'Kategori', selectCategory: 'Välj kategori',
      tags: 'Taggar', tagsPlaceholder: 'Klicka på förslag eller skriv egna',
      suggestedTags: 'Föreslagna taggar:', vendor: 'Leverantör',
      save: 'Spara produkt', update: 'Uppdatera', cancel: 'Avbryt',
      delete: 'Ta bort', noProducts: 'Inga produkter', loading: 'Laddar...',
      deleteConfirm: 'Är du säker?', deleteDescription: 'Produkten tas bort permanent.',
      productAdded: 'Produkt tillagd!', productUpdated: 'Produkt uppdaterad!',
      productDeleted: 'Produkt borttagen!', error: 'Något gick fel',
      inStock: 'I lager', outOfStock: 'Slut',
      visibility: 'Synlighet', visibleInStore: 'Synlig i butiken', hiddenFromStore: 'Dold från butiken',
      inventory: 'Lager', currentStock: 'Nuvarande lager',
      allowOverselling: 'Tillåt försäljning när slut', oversellHint: 'Kunder kan köpa även när lagret är 0',
    },
    en: {
      title: 'Product Management', subtitle: 'Add, edit and delete products',
      addProduct: 'Add Product', editProduct: 'Edit Product',
      productName: 'Product name (Swedish)', description: 'Description (Swedish)',
      price: 'Price (SEK)', category: 'Category', selectCategory: 'Select category',
      tags: 'Tags', tagsPlaceholder: 'Click suggestions or type your own',
      suggestedTags: 'Suggested tags:', vendor: 'Vendor',
      save: 'Save Product', update: 'Update', cancel: 'Cancel',
      delete: 'Delete', noProducts: 'No products', loading: 'Loading...',
      deleteConfirm: 'Are you sure?', deleteDescription: 'Product will be permanently deleted.',
      productAdded: 'Product added!', productUpdated: 'Product updated!',
      productDeleted: 'Product deleted!', error: 'Something went wrong',
      inStock: 'In stock', outOfStock: 'Out of stock',
      visibility: 'Visibility', visibleInStore: 'Visible in store', hiddenFromStore: 'Hidden from store',
      inventory: 'Inventory', currentStock: 'Current stock',
      allowOverselling: 'Allow overselling', oversellHint: 'Customers can buy even when stock is 0',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  const resetForm = () => setFormData(emptyForm());

  const openEdit = (product: DbProduct) => {
    setSelected(product);
    setFormData({
      title: product.title_sv,
      description: product.description_sv || '',
      price: product.price.toString(),
      productType: product.category || '',
      tags: (product.tags || []).join(', '),
      vendor: product.vendor || '4ThePeople',
      isVisible: product.is_visible,
      inventory: product.stock,
      allowOverselling: product.allow_overselling,
      imageUrls: product.image_urls || [],
      ingredients: product.ingredients_sv || '',
      certifications: (product.certifications || []).join(', '),
    });
    setIsEditOpen(true);
  };

  const handleDuplicate = async (product: DbProduct) => {
    try {
      await createDbProduct({
        title_sv: product.title_sv + (sv ? ' (kopia)' : ' (copy)'),
        title_en: product.title_en ? product.title_en + ' (copy)' : null,
        description_sv: product.description_sv || null,
        description_en: product.description_en || null,
        price: product.price,
        original_price: product.original_price || null,
        category: product.category || null,
        tags: product.tags || null,
        is_visible: false, // Start hidden
        stock: 0,
        allow_overselling: product.allow_overselling,
        image_urls: product.image_urls || null,
        badge: null,
        vendor: product.vendor || '4ThePeople',
        display_order: product.display_order,
        ingredients_sv: product.ingredients_sv || null,
        certifications: product.certifications || null,
      });
      toast.success(sv ? 'Produkt duplicerad!' : 'Product duplicated!');
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
    } catch (err: any) {
      toast.error(t.error + ': ' + (err?.message || ''));
    }
  };

  const handleSoftDelete = async (product: DbProduct) => {
    try {
      await updateDbProduct(product.id, { is_visible: false });
      toast.success(sv ? 'Produkt dold från butiken' : 'Product hidden from store');
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
    } catch (err: any) {
      toast.error(t.error + ': ' + (err?.message || ''));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createDbProduct({
        title_sv: formData.title,
        title_en: null,
        description_sv: formData.description || null,
        description_en: null,
        price: parseFloat(formData.price),
        original_price: null,
        category: formData.productType || null,
        tags: formData.tags ? formData.tags.split(',').map(s => s.trim()).filter(Boolean) : null,
        is_visible: formData.isVisible,
        stock: formData.inventory,
        allow_overselling: formData.allowOverselling,
        image_urls: formData.imageUrls && formData.imageUrls.length > 0 ? formData.imageUrls : null,
        badge: null,
        vendor: formData.vendor || '4ThePeople',
        display_order: 0,
        ingredients_sv: formData.ingredients || null,
        certifications: formData.certifications ? formData.certifications.split(',').map(s => s.trim()).filter(Boolean) : null,
      });
      toast.success(t.productAdded);
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
      setIsAddOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(t.error + ': ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setIsSubmitting(true);
    try {
      await updateDbProduct(selected.id, {
        title_sv: formData.title,
        description_sv: formData.description || null,
        price: parseFloat(formData.price) || selected.price,
        category: formData.productType || null,
        tags: formData.tags ? formData.tags.split(',').map(s => s.trim()).filter(Boolean) : null,
        is_visible: formData.isVisible,
        stock: formData.inventory,
        allow_overselling: formData.allowOverselling,
        vendor: formData.vendor || '4ThePeople',
        image_urls: formData.imageUrls && formData.imageUrls.length > 0 ? formData.imageUrls : null,
        ingredients_sv: formData.ingredients || null,
        certifications: formData.certifications ? formData.certifications.split(',').map(s => s.trim()).filter(Boolean) : null,
      });
      toast.success(t.productUpdated);
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
      setIsEditOpen(false);
      setSelected(null);
      resetForm();
    } catch (err: any) {
      toast.error(t.error + ': ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await deleteDbProduct(selected.id);
      toast.success(t.productDeleted);
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
      setIsDeleteOpen(false);
      setSelected(null);
    } catch (err: any) {
      toast.error(t.error + ': ' + (err?.message || ''));
    }
  };

  // Bulk operations
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    let deleted = 0;
    for (const id of selectedIds) {
      try {
        await deleteDbProduct(id);
        deleted++;
      } catch { /* skip */ }
    }
    toast.success(sv ? `${deleted} produkter borttagna` : `${deleted} products deleted`);
    setSelectedIds(new Set());
    setBulkMode(false);
    setIsBulkDeleteOpen(false);
    queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
  };

  const handleBulkVisibility = async (visible: boolean) => {
    let updated = 0;
    for (const id of selectedIds) {
      try {
        await updateDbProduct(id, { is_visible: visible });
        updated++;
      } catch { /* skip */ }
    }
    toast.success(sv ? `${updated} produkter uppdaterade` : `${updated} products updated`);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={bulkMode ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
          >
            <CheckSquare className="w-4 h-4 mr-1" />
            {sv ? 'Markera' : 'Select'}
          </Button>
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                {t.addProduct}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t.addProduct}</DialogTitle></DialogHeader>
              <AdminProductForm
                t={t} language={language}
                productCategories={productCategories} suggestedTags={suggestedTags}
                formData={formData} setFormData={setFormData}
                isEdit={false} isSubmitting={isSubmitting}
                onCancel={() => { setIsAddOpen(false); resetForm(); }}
                onSubmit={handleAdd}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20"
        >
          <span className="text-sm font-medium">
            {selectedIds.size} {sv ? 'valda' : 'selected'}
          </span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => handleBulkVisibility(true)} className="gap-1">
            <Eye className="w-3.5 h-3.5" />
            {sv ? 'Visa' : 'Show'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkVisibility(false)} className="gap-1">
            <EyeOff className="w-3.5 h-3.5" />
            {sv ? 'Dölj' : 'Hide'}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)} className="gap-1">
            <Trash className="w-3.5 h-3.5" />
            {sv ? 'Ta bort' : 'Delete'}
          </Button>
        </motion.div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Select all row */}
      {bulkMode && !isLoading && products.length > 0 && (
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-1"
        >
          {selectedIds.size === products.length
            ? <CheckSquare className="w-4 h-4 text-primary" />
            : <Square className="w-4 h-4" />
          }
          {sv ? 'Välj alla' : 'Select all'} ({products.length})
        </button>
      )}

      {/* Product list */}
      {!isLoading && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t.noProducts}</p>
              <p className="text-muted-foreground/70 text-xs mt-1">
                {sv ? 'Klicka "Lägg till produkt" för att börja' : 'Click "Add Product" to get started'}
              </p>
            </div>
          ) : (
            products.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors"
              >
                {/* Checkbox */}
                {bulkMode && (
                  <button onClick={() => toggleSelect(product.id)} className="shrink-0">
                    {selectedIds.has(product.id)
                      ? <CheckSquare className="w-5 h-5 text-primary" />
                      : <Square className="w-5 h-5 text-muted-foreground" />
                    }
                  </button>
                )}

                {/* Image thumbnail */}
                <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 overflow-hidden">
                  {product.image_urls?.[0] ? (
                    <img src={product.image_urls[0]} alt={product.title_sv} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{product.title_sv}</p>
                    {!product.is_visible && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Dold</Badge>
                    )}
                    {product.badge && (
                      <Badge variant={product.badge === 'sale' ? 'destructive' : 'secondary'} className="text-xs">
                        {product.badge}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-primary font-semibold">
                      {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(product.price)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.stock > 0 ? `${product.stock} i lager${(product as any).reserved_stock > 0 ? ` (${(product as any).reserved_stock} reserverade)` : ''}` : t.outOfStock}
                    </p>
                    {product.stock > 0 && product.stock < 5 && !product.allow_overselling && (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-400 gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {sv ? 'Lågt lager' : 'Low stock'}
                      </Badge>
                    )}
                    {product.stock === 0 && !product.allow_overselling && (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {sv ? 'Slutsåld' : 'Sold out'}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDuplicate(product)}>
                        <Copy className="w-4 h-4 mr-2" />
                        {sv ? 'Duplicera' : 'Duplicate'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSoftDelete(product)}>
                        <EyeOff className="w-4 h-4 mr-2" />
                        {sv ? 'Dölj (soft delete)' : 'Hide (soft delete)'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => { setSelected(product); setIsDeleteOpen(true); }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {sv ? 'Ta bort permanent' : 'Delete permanently'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setSelected(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t.editProduct}: {selected?.title_sv}</DialogTitle></DialogHeader>
          <AdminProductForm
            t={t} language={language}
            productCategories={productCategories} suggestedTags={suggestedTags}
            formData={formData} setFormData={setFormData}
            isEdit={true} isSubmitting={isSubmitting}
            onCancel={() => { setIsEditOpen(false); setSelected(null); resetForm(); }}
            onSubmit={handleEdit}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsDeleteOpen(false); setSelected(null); }}>
              {t.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {sv
                ? `${selectedIds.size} produkter tas bort permanent.`
                : `${selectedIds.size} products will be permanently deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
              {t.delete} ({selectedIds.size})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDbProductManager;
