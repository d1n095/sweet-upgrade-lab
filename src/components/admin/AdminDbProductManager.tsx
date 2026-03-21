import { useState, useMemo, useCallback } from 'react';
import { setProductCategories } from '@/lib/categories';
import { setProductTags, fetchProductTagIds } from '@/lib/tags';
import { setProductIngredients, fetchProductIngredients } from '@/lib/products';
import { motion } from 'framer-motion';
import {
  Plus, Package, Edit, Trash2, Loader2, AlertTriangle,
  Copy, EyeOff, Eye, CheckSquare, Square, Trash, MoreHorizontal,
  Archive, FileText, RotateCcw, Image, Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
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
  AdminProductForm, ProductFormData, AdminProductFormStrings, DEFAULT_PRODUCT_FORM_DATA
} from '@/components/admin/AdminProductForm';
import { fetchDbProducts, createDbProduct, updateDbProduct, deleteDbProduct, DbProduct, ProductStatus } from '@/lib/products';

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
  ...DEFAULT_PRODUCT_FORM_DATA,
  vendor: '4ThePeople',
});

const AdminDbProductManager = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ProductStatus>('active');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<DbProduct | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ['admin-db-products'],
    queryFn: () => fetchDbProducts(true),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  const sv = language === 'sv';

  const activeProducts = useMemo(() => allProducts.filter(p => (p.status || 'active') === 'active'), [allProducts]);
  const draftProducts = useMemo(() => allProducts.filter(p => p.status === 'draft'), [allProducts]);
  const archivedProducts = useMemo(() => allProducts.filter(p => p.status === 'archived'), [allProducts]);

  const currentProducts = activeTab === 'active' ? activeProducts : activeTab === 'draft' ? draftProducts : archivedProducts;

  const t = sv ? {
    title: 'Produkthantering', subtitle: 'Lägg till, redigera och hantera produkter',
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
  } : {
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
  };

  const resetForm = () => setFormData(emptyForm());

  const openEdit = (product: DbProduct) => {
    setSelected(product);
    setFormData({
      ...DEFAULT_PRODUCT_FORM_DATA,
      title: product.title_sv,
      description: product.description_sv || '',
      price: product.price.toString(),
      currency: product.currency || 'SEK',
      productType: product.category || '',
      categoryIds: [],
      tagIds: [],
      tags: (product.tags || []).join(', '),
      vendor: product.vendor || '4ThePeople',
      isVisible: product.is_visible,
      inventory: product.stock,
      allowOverselling: product.allow_overselling,
      imageUrls: product.image_urls || [],
      ingredients: product.ingredients_sv || '',
      certifications: (product.certifications || []).join(', '),
      recipe: product.recipe_sv || '',
      feeling: (product as any).feeling_sv || '',
      effects: (product as any).effects_sv || '',
      usage: (product as any).usage_sv || '',
      extendedDescription: (product as any).extended_description_sv || '',
      metaTitle: (product as any).meta_title || '',
      metaDescription: (product as any).meta_description || '',
      metaKeywords: (product as any).meta_keywords || '',
      weightGrams: (product as any).weight_grams?.toString() || '',
    });
    // Load category IDs and tag IDs async
    import('@/lib/categories').then(({ fetchProductCategoryIds }) => {
      fetchProductCategoryIds(product.id).then(ids => {
        setFormData(prev => ({ ...prev, categoryIds: ids }));
      });
    });
    fetchProductTagIds(product.id).then(ids => {
      setFormData(prev => ({ ...prev, tagIds: ids }));
    });
    fetchProductIngredients(product.id).then(rows => {
      const ids = rows.map((r: any) => r.ingredient_id);
      setFormData(prev => ({ ...prev, ingredientIds: ids }));
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
        is_visible: false,
        stock: 0,
        allow_overselling: product.allow_overselling,
        image_urls: product.image_urls || null,
        badge: null,
        vendor: product.vendor || '4ThePeople',
        display_order: product.display_order,
        ingredients_sv: product.ingredients_sv || null,
        certifications: product.certifications || null,
        currency: product.currency || 'SEK',
        recipe_sv: product.recipe_sv || null,
        recipe_en: product.recipe_en || null,
        status: 'draft',
      });
      toast.success(sv ? 'Produkt duplicerad till utkast!' : 'Product duplicated to drafts!');
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
    } catch (err: any) {
      toast.error(t.error + ': ' + (err?.message || ''));
    }
  };

  const handleStatusChange = async (product: DbProduct, newStatus: ProductStatus) => {
    try {
      const updates: Record<string, any> = { status: newStatus };
      if (newStatus !== 'active') updates.is_visible = false;
      await updateDbProduct(product.id, updates);
      const labels: Partial<Record<ProductStatus, string>> = sv
        ? { active: 'Aktiverad', draft: 'Flyttad till utkast', archived: 'Arkiverad', coming_soon: 'Kommer snart', info: 'Infosida', hidden: 'Dold' }
        : { active: 'Activated', draft: 'Moved to drafts', archived: 'Archived', coming_soon: 'Coming soon', info: 'Info page', hidden: 'Hidden' };
      toast.success(labels[newStatus]);
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
    } catch (err: any) {
      toast.error(t.error + ': ' + (err?.message || ''));
    }
  };

  const handleCopyFrom = async (source: DbProduct) => {
    setFormData({
      ...DEFAULT_PRODUCT_FORM_DATA,
      title: source.title_sv,
      description: source.description_sv || '',
      price: source.price.toString(),
      currency: source.currency || 'SEK',
      productType: source.category || '',
      categoryIds: [],
      tagIds: [],
      tags: (source.tags || []).join(', '),
      vendor: source.vendor || '4ThePeople',
      isVisible: false,
      inventory: 0,
      allowOverselling: source.allow_overselling,
      imageUrls: source.image_urls || [],
      ingredients: source.ingredients_sv || '',
      certifications: (source.certifications || []).join(', '),
      recipe: source.recipe_sv || '',
      feeling: (source as any).feeling_sv || '',
      effects: (source as any).effects_sv || '',
      usage: (source as any).usage_sv || '',
      extendedDescription: (source as any).extended_description_sv || '',
      metaTitle: (source as any).meta_title || '',
      metaDescription: (source as any).meta_description || '',
      metaKeywords: (source as any).meta_keywords || '',
      weightGrams: (source as any).weight_grams?.toString() || '',
    });
    setIsAddOpen(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newProduct = await createDbProduct({
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
        currency: formData.currency || 'SEK',
        recipe_sv: formData.recipe || null,
        feeling_sv: formData.feeling || null,
        effects_sv: formData.effects || null,
        usage_sv: formData.usage || null,
        extended_description_sv: formData.extendedDescription || null,
        meta_title: formData.metaTitle || null,
        meta_description: formData.metaDescription || null,
        meta_keywords: formData.metaKeywords || null,
        weight_grams: formData.weightGrams ? parseInt(formData.weightGrams) : null,
        status: 'active',
      } as any);
      if (formData.categoryIds.length > 0) {
        await setProductCategories(newProduct.id, formData.categoryIds);
      }
      await setProductTags(newProduct.id, formData.tagIds);
      if (formData.ingredientIds && formData.ingredientIds.length > 0) {
        await setProductIngredients(newProduct.id, formData.ingredientIds);
      }
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
        currency: formData.currency || 'SEK',
        recipe_sv: formData.recipe || null,
        feeling_sv: formData.feeling || null,
        effects_sv: formData.effects || null,
        usage_sv: formData.usage || null,
        extended_description_sv: formData.extendedDescription || null,
        meta_title: formData.metaTitle || null,
        meta_description: formData.metaDescription || null,
        meta_keywords: formData.metaKeywords || null,
        weight_grams: formData.weightGrams ? parseInt(formData.weightGrams) : null,
      } as any);
      await setProductCategories(selected.id, formData.categoryIds);
      await setProductTags(selected.id, formData.tagIds);
      await setProductIngredients(selected.id, formData.ingredientIds || []);
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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === currentProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentProducts.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    let deleted = 0;
    for (const id of selectedIds) {
      try { await deleteDbProduct(id); deleted++; } catch { /* skip */ }
    }
    toast.success(sv ? `${deleted} produkter borttagna` : `${deleted} products deleted`);
    setSelectedIds(new Set());
    setBulkMode(false);
    setIsBulkDeleteOpen(false);
    queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
  };

  const handleBulkStatusChange = async (status: ProductStatus) => {
    let updated = 0;
    const updates: Record<string, any> = { status };
    if (status !== 'active') updates.is_visible = false;
    for (const id of selectedIds) {
      try { await updateDbProduct(id, updates); updated++; } catch { /* skip */ }
    }
    const labels: Partial<Record<ProductStatus, string>> = sv
      ? { active: 'aktiverade', draft: 'flyttade till utkast', archived: 'arkiverade', coming_soon: 'satta som kommer snart', info: 'satta som info', hidden: 'dolda' }
      : { active: 'activated', draft: 'moved to drafts', archived: 'archived', coming_soon: 'set as coming soon', info: 'set as info', hidden: 'hidden' };
    toast.success(`${updated} ${sv ? 'produkter' : 'products'} ${labels[status]}`);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
  };

  const renderProductRow = (product: DbProduct) => (
    <motion.div
      key={product.id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 active:bg-secondary/80 transition-colors cursor-pointer"
      onClick={() => {
        if (!bulkMode) openEdit(product);
      }}
      role="button"
      tabIndex={0}
    >
      {bulkMode && (
        <button onClick={(e) => { e.stopPropagation(); toggleSelect(product.id); }} className="shrink-0">
          {selectedIds.has(product.id)
            ? <CheckSquare className="w-5 h-5 text-primary" />
            : <Square className="w-5 h-5 text-muted-foreground" />
          }
        </button>
      )}

      <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 overflow-hidden">
        {product.image_urls?.[0] ? (
          <img src={product.image_urls[0]} alt={product.title_sv} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate">{product.title_sv}</p>
          {!product.is_visible && product.status === 'active' && (
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
            {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: product.currency || 'SEK', minimumFractionDigits: 0 }).format(product.price)}
          </p>
          {activeTab === 'active' && (
            <>
              <p className="text-xs text-muted-foreground">
                {product.stock > 0 ? `${product.stock} i lager` : t.outOfStock}
              </p>
              {product.stock > 0 && product.stock < 5 && !product.allow_overselling && (
                <Badge variant="outline" className="text-xs text-orange-600 border-orange-400 gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {sv ? 'Lågt lager' : 'Low stock'}
                </Badge>
              )}
            </>
          )}
          {activeTab === 'draft' && (
            <p className="text-xs text-muted-foreground">{sv ? 'Utkast' : 'Draft'}</p>
          )}
          {activeTab === 'archived' && (
            <p className="text-xs text-muted-foreground">
              {product.image_urls?.length || 0} {sv ? 'bilder' : 'images'}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {activeTab === 'active' && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={product.is_visible ? (sv ? 'Dölj produkt' : 'Hide product') : (sv ? 'Visa produkt' : 'Show product')}
              onClick={async () => {
                try {
                  await updateDbProduct(product.id, { is_visible: !product.is_visible });
                  toast.success(product.is_visible ? (sv ? 'Produkt dold' : 'Product hidden') : (sv ? 'Produkt synlig' : 'Product visible'));
                  queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
                } catch (err: any) {
                  toast.error(t.error + ': ' + (err?.message || ''));
                }
              }}
            >
              {product.is_visible ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)}>
              <Edit className="w-4 h-4" />
            </Button>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Active tab actions */}
            {activeTab === 'active' && (
              <>
                <DropdownMenuItem onClick={() => handleDuplicate(product)}>
                  <Copy className="w-4 h-4 mr-2" />
                  {sv ? 'Duplicera' : 'Duplicate'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange(product, 'draft')}>
                  <FileText className="w-4 h-4 mr-2" />
                  {sv ? 'Flytta till utkast' : 'Move to drafts'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange(product, 'archived')}>
                  <Archive className="w-4 h-4 mr-2" />
                  {sv ? 'Arkivera' : 'Archive'}
                </DropdownMenuItem>
              </>
            )}

            {/* Draft tab actions */}
            {activeTab === 'draft' && (
              <>
                <DropdownMenuItem onClick={() => handleStatusChange(product, 'active')}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {sv ? 'Återställ till aktiva' : 'Restore to active'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEdit(product)}>
                  <Edit className="w-4 h-4 mr-2" />
                  {sv ? 'Redigera' : 'Edit'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopyFrom(product)}>
                  <Copy className="w-4 h-4 mr-2" />
                  {sv ? 'Kopiera till ny produkt' : 'Copy to new product'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange(product, 'archived')}>
                  <Archive className="w-4 h-4 mr-2" />
                  {sv ? 'Arkivera' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => { setSelected(product); setIsDeleteOpen(true); }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {sv ? 'Ta bort permanent' : 'Delete permanently'}
                </DropdownMenuItem>
              </>
            )}

            {/* Archived tab actions */}
            {activeTab === 'archived' && (
              <>
                <DropdownMenuItem onClick={() => handleStatusChange(product, 'active')}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {sv ? 'Återställ till aktiva' : 'Restore to active'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange(product, 'draft')}>
                  <FileText className="w-4 h-4 mr-2" />
                  {sv ? 'Flytta till utkast' : 'Move to drafts'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopyFrom(product)}>
                  <Copy className="w-4 h-4 mr-2" />
                  {sv ? 'Kopiera text & bilder till ny' : 'Copy text & images to new'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => { setSelected(product); setIsDeleteOpen(true); }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {sv ? 'Ta bort permanent' : 'Delete permanently'}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );

  const renderEmptyState = (tab: ProductStatus) => {
    const config = {
      active: { icon: Package, text: sv ? 'Inga aktiva produkter' : 'No active products', sub: sv ? 'Klicka "Lägg till produkt" för att börja' : 'Click "Add Product" to get started' },
      draft: { icon: FileText, text: sv ? 'Inga utkast' : 'No drafts', sub: sv ? 'Produkter du flyttar hit hamnar här' : 'Products you move here will appear' },
      archived: { icon: Archive, text: sv ? 'Inga arkiverade produkter' : 'No archived products', sub: sv ? 'Spara produkter här för att bevara bilder och information' : 'Save products here to preserve images and info' },
    };
    const c = config[tab];
    return (
      <div className="text-center py-8">
        <c.icon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">{c.text}</p>
        <p className="text-muted-foreground/70 text-xs mt-1">{c.sub}</p>
      </div>
    );
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
            <DialogContent className="max-w-2xl max-h-[95vh]">
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

      {/* Status tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as ProductStatus); setSelectedIds(new Set()); setBulkMode(false); }}>
        <ScrollableTabs>
          <TabsList className="h-9 w-max">
            <TabsTrigger value="active" className="gap-1.5 text-xs">
              <Package className="w-3.5 h-3.5" />
              {sv ? 'Aktiva' : 'Active'}
              {activeProducts.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{activeProducts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="draft" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" />
              {sv ? 'Utkast' : 'Drafts'}
              {draftProducts.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{draftProducts.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-1.5 text-xs">
              <Archive className="w-3.5 h-3.5" />
              {sv ? 'Arkiverade' : 'Archived'}
              {archivedProducts.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{archivedProducts.length}</Badge>}
            </TabsTrigger>
          </TabsList>
        </ScrollableTabs>

        {/* Bulk action bar */}
        {bulkMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 mt-3"
          >
            <span className="text-sm font-medium">
              {selectedIds.size} {sv ? 'valda' : 'selected'}
            </span>
            <div className="flex-1" />
            {activeTab !== 'active' && (
              <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('active')} className="gap-1">
                <RotateCcw className="w-3.5 h-3.5" />
                {sv ? 'Återställ' : 'Restore'}
              </Button>
            )}
            {activeTab === 'active' && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('draft')} className="gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  {sv ? 'Till utkast' : 'To drafts'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkStatusChange('archived')} className="gap-1">
                  <Archive className="w-3.5 h-3.5" />
                  {sv ? 'Arkivera' : 'Archive'}
                </Button>
              </>
            )}
            {activeTab !== 'active' && (
              <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)} className="gap-1">
                <Trash className="w-3.5 h-3.5" />
                {sv ? 'Ta bort' : 'Delete'}
              </Button>
            )}
          </motion.div>
        )}

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {bulkMode && !isLoading && currentProducts.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-1 mt-2"
          >
            {selectedIds.size === currentProducts.length
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4" />
            }
            {sv ? 'Välj alla' : 'Select all'} ({currentProducts.length})
          </button>
        )}

        {!isLoading && (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 mt-2">
            {currentProducts.length === 0
              ? renderEmptyState(activeTab)
              : currentProducts.map(renderProductRow)
            }
          </div>
        )}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setSelected(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[95vh]">
          <DialogHeader><DialogTitle className="truncate">{t.editProduct}: {selected?.title_sv}</DialogTitle></DialogHeader>
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
