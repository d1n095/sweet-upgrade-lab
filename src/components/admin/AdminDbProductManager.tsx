import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { setProductCategories } from '@/lib/categories';
import { setProductTags, fetchProductTagIds } from '@/lib/tags';
import { setProductIngredients, fetchProductIngredients } from '@/lib/products';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Package, Edit, Trash2, Loader2, AlertTriangle,
  Copy, EyeOff, Eye, CheckSquare, Square, Trash, MoreHorizontal,
  Archive, FileText, RotateCcw, Search, X, SlidersHorizontal,
  ArrowUpDown, LayoutGrid, LayoutList, ChevronDown, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdminProductForm, ProductFormData, DEFAULT_PRODUCT_FORM_DATA
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

type SortKey = 'updated' | 'name' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc';
type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type ViewMode = 'table' | 'grid';

const emptyForm = (): ProductFormData => ({
  ...DEFAULT_PRODUCT_FORM_DATA,
  vendor: '4ThePeople',
});

const AdminDbProductManager = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const sv = language === 'sv';

  // State
  const [activeTab, setActiveTab] = useState<ProductStatus>('active');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<DbProduct | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search, filter, sort
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Inline editing
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlinePrice, setInlinePrice] = useState('');
  const [inlineStock, setInlineStock] = useState('');

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery]);

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ['admin-db-products'],
    queryFn: () => fetchDbProducts(true),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  const t = sv ? {
    title: 'Produkthantering', subtitle: `${allProducts.length} produkter totalt`,
    addProduct: 'Lägg till', editProduct: 'Redigera produkt',
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
    search: 'Sök produkter...', allCategories: 'Alla kategorier',
    allStock: 'Alla', lowStock: 'Lågt lager', outStock: 'Slut i lager',
  } : {
    title: 'Product Management', subtitle: `${allProducts.length} products total`,
    addProduct: 'Add', editProduct: 'Edit Product',
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
    search: 'Search products...', allCategories: 'All categories',
    allStock: 'All', lowStock: 'Low stock', outStock: 'Out of stock',
  };

  // Filter + sort pipeline
  const filteredProducts = useMemo(() => {
    let items = allProducts.filter(p => {
      const status = p.status || 'active';
      return status === activeTab;
    });

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(p =>
        p.title_sv.toLowerCase().includes(q) ||
        (p.title_en && p.title_en.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(q))) ||
        (p.ingredients_sv && p.ingredients_sv.toLowerCase().includes(q)) ||
        (p.handle && p.handle.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      items = items.filter(p => p.category === categoryFilter);
    }

    // Stock filter
    if (stockFilter === 'in_stock') items = items.filter(p => p.stock > 5);
    else if (stockFilter === 'low_stock') items = items.filter(p => p.stock > 0 && p.stock <= 5);
    else if (stockFilter === 'out_of_stock') items = items.filter(p => p.stock <= 0);

    // Sort
    items = [...items].sort((a, b) => {
      switch (sortKey) {
        case 'name': return a.title_sv.localeCompare(b.title_sv, 'sv');
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'stock_asc': return a.stock - b.stock;
        case 'stock_desc': return b.stock - a.stock;
        case 'updated': default: return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return items;
  }, [allProducts, activeTab, debouncedSearch, categoryFilter, stockFilter, sortKey]);

  // Active filter chips
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (debouncedSearch) chips.push({ key: 'search', label: `"${debouncedSearch}"` });
    if (categoryFilter !== 'all') chips.push({ key: 'category', label: categoryFilter });
    if (stockFilter !== 'all') {
      const labels = { in_stock: sv ? 'I lager' : 'In stock', low_stock: sv ? 'Lågt' : 'Low', out_of_stock: sv ? 'Slut' : 'Out' };
      chips.push({ key: 'stock', label: labels[stockFilter] });
    }
    return chips;
  }, [debouncedSearch, categoryFilter, stockFilter, sv]);

  const removeFilter = (key: string) => {
    if (key === 'search') { setSearchQuery(''); setDebouncedSearch(''); }
    if (key === 'category') setCategoryFilter('all');
    if (key === 'stock') setStockFilter('all');
  };

  // Counts per tab
  const counts = useMemo(() => ({
    active: allProducts.filter(p => (p.status || 'active') === 'active').length,
    draft: allProducts.filter(p => p.status === 'draft').length,
    archived: allProducts.filter(p => p.status === 'archived').length,
  }), [allProducts]);

  // Categories present in data
  const usedCategories = useMemo(() =>
    [...new Set(allProducts.map(p => p.category).filter(Boolean))] as string[],
    [allProducts]
  );

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
      categoryIds: [], tagIds: [],
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
      hook: (product as any).hook_sv || '',
      dosage: (product as any).dosage_sv || '',
      variants: (product as any).variants_sv || '',
      storage: (product as any).storage_sv || '',
      safety: (product as any).safety_sv || '',
      specifications: (product as any).specifications ? JSON.stringify((product as any).specifications) : '',
      isConcentrate: (product as any).is_concentrate || false,
    });
    import('@/lib/categories').then(({ fetchProductCategoryIds }) => {
      fetchProductCategoryIds(product.id).then(ids => setFormData(prev => ({ ...prev, categoryIds: ids })));
    });
    fetchProductTagIds(product.id).then(ids => setFormData(prev => ({ ...prev, tagIds: ids })));
    fetchProductIngredients(product.id).then(rows => {
      const ids = rows.map((r: any) => r.ingredient_id);
      setFormData(prev => ({ ...prev, ingredientIds: ids }));
    });
    setIsEditOpen(true);
  };

  // Inline save
  const saveInlineEdit = async (product: DbProduct) => {
    try {
      const updates: Record<string, any> = {};
      const newPrice = parseFloat(inlinePrice);
      const newStock = parseInt(inlineStock);
      if (!isNaN(newPrice) && newPrice !== product.price) updates.price = newPrice;
      if (!isNaN(newStock) && newStock !== product.stock) updates.stock = newStock;
      if (Object.keys(updates).length > 0) {
        await updateDbProduct(product.id, updates);
        toast.success(sv ? 'Uppdaterad' : 'Updated');
        queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
      }
    } catch (err: any) {
      toast.error(t.error);
    }
    setInlineEditId(null);
  };

  const handleStatusChange = async (product: DbProduct, newStatus: ProductStatus) => {
    try {
      const updates: Record<string, any> = { status: newStatus };
      if (newStatus !== 'active') updates.is_visible = false;
      await updateDbProduct(product.id, updates);
      toast.success(sv ? 'Status ändrad' : 'Status changed');
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
    } catch (err: any) {
      toast.error(t.error);
    }
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
      toast.success(sv ? 'Duplicerad' : 'Duplicated');
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
    } catch (err: any) {
      toast.error(t.error);
    }
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
        image_urls: formData.imageUrls?.length ? formData.imageUrls : null,
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
        meta_title: formData.metaTitle?.trim() ? formData.metaTitle : null,
        meta_description: formData.metaDescription?.trim() ? formData.metaDescription : null,
        meta_keywords: formData.metaKeywords?.trim() ? formData.metaKeywords : null,
      } as any);
      if (formData.categoryIds.length > 0) await setProductCategories(newProduct.id, formData.categoryIds);
      await setProductTags(newProduct.id, formData.tagIds);
      if (formData.ingredientIds?.length) await setProductIngredients(newProduct.id, formData.ingredientIds);
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
        image_urls: formData.imageUrls?.length ? formData.imageUrls : null,
        ingredients_sv: formData.ingredients || null,
        certifications: formData.certifications ? formData.certifications.split(',').map(s => s.trim()).filter(Boolean) : null,
        currency: formData.currency || 'SEK',
        recipe_sv: formData.recipe || null,
        feeling_sv: formData.feeling || null,
        effects_sv: formData.effects || null,
        usage_sv: formData.usage || null,
        extended_description_sv: formData.extendedDescription || null,
        meta_title: formData.metaTitle?.trim() ? formData.metaTitle : null,
        meta_description: formData.metaDescription?.trim() ? formData.metaDescription : null,
        meta_keywords: formData.metaKeywords?.trim() ? formData.metaKeywords : null,
        weight_grams: formData.weightGrams ? parseInt(formData.weightGrams) : null,
        hook_sv: formData.hook || null,
        dosage_sv: formData.dosage || null,
        variants_sv: formData.variants || null,
        storage_sv: formData.storage || null,
        safety_sv: formData.safety || null,
        specifications: formData.specifications ? JSON.parse(formData.specifications || '{}') : {},
        is_concentrate: formData.isConcentrate,
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
      toast.error(t.error);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredProducts.map(p => p.id)));
  };

  const handleBulkDelete = async () => {
    let deleted = 0;
    for (const id of selectedIds) {
      try { await deleteDbProduct(id); deleted++; } catch { /* skip */ }
    }
    toast.success(`${deleted} ${sv ? 'borttagna' : 'deleted'}`);
    setSelectedIds(new Set());
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
    toast.success(`${updated} ${sv ? 'uppdaterade' : 'updated'}`);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
  };

  const formatPrice = (price: number, currency = 'SEK') =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency, minimumFractionDigits: 0 }).format(price);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  };

  const stockBadge = (product: DbProduct) => {
    const threshold = product.low_stock_threshold || 5;
    if (product.stock <= 0) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">{t.outOfStock}</Badge>;
    if (product.stock <= threshold) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-orange-600 border-orange-300">{product.stock} st</Badge>;
    return <span className="text-xs text-muted-foreground">{product.stock}</span>;
  };

  const statusBadge = (product: DbProduct) => {
    const s = product.status || 'active';
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      archived: 'bg-muted text-muted-foreground',
    };
    return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[s] || colors.active}`}>{s}</span>;
  };

  // ─── TABLE VIEW ───
  const renderTableView = () => (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
              <th className="p-3 w-10">
                <button onClick={toggleSelectAll} className="flex items-center">
                  {selectedIds.size === filteredProducts.length && filteredProducts.length > 0
                    ? <CheckSquare className="w-4 h-4 text-primary" />
                    : <Square className="w-4 h-4" />
                  }
                </button>
              </th>
              <th className="p-3">{sv ? 'Produkt' : 'Product'}</th>
              <th className="p-3 hidden sm:table-cell">{sv ? 'Status' : 'Status'}</th>
              <th className="p-3 w-16">{sv ? 'Aktiv' : 'Active'}</th>
              <th className="p-3">{sv ? 'Pris' : 'Price'}</th>
              <th className="p-3">{sv ? 'Lager' : 'Stock'}</th>
              <th className="p-3 hidden md:table-cell">{sv ? 'Kategori' : 'Category'}</th>
              <th className="p-3 hidden lg:table-cell">{sv ? 'Uppdaterad' : 'Updated'}</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredProducts.map(product => {
              const isEditing = inlineEditId === product.id;
              return (
                <tr
                  key={product.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => {
                    if (!isEditing) openEdit(product);
                  }}
                >
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => toggleSelect(product.id)}>
                      {selectedIds.has(product.id)
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4 text-muted-foreground" />
                      }
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-muted flex-shrink-0 overflow-hidden">
                        {product.image_urls?.[0]
                          ? <img src={product.image_urls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                          : <div className="w-full h-full flex items-center justify-center"><Package className="w-3.5 h-3.5 text-muted-foreground" /></div>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate max-w-[180px] sm:max-w-[240px]">{product.title_sv}</p>
                        {!product.is_visible && product.status === 'active' && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><EyeOff className="w-3 h-3" /> {sv ? 'Dold' : 'Hidden'}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 hidden sm:table-cell">{statusBadge(product)}</td>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <Switch
                      checked={product.is_visible}
                      onCheckedChange={async (checked) => {
                        await updateDbProduct(product.id, { is_visible: checked });
                        queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
                        toast.success(checked ? (sv ? 'Produkt aktiverad' : 'Product activated') : (sv ? 'Produkt inaktiverad' : 'Product deactivated'));
                      }}
                      className="data-[state=checked]:bg-green-600"
                    />
                  </td>
                  <td className="p-3" onClick={e => { if (!isEditing) { e.stopPropagation(); setInlineEditId(product.id); setInlinePrice(product.price.toString()); setInlineStock(product.stock.toString()); } }}>
                    {isEditing ? (
                      <Input
                        value={inlinePrice}
                        onChange={e => setInlinePrice(e.target.value)}
                        className="h-7 w-20 text-xs"
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); saveInlineEdit(product); } if (e.key === 'Escape') setInlineEditId(null); }}
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm font-medium">{formatPrice(product.price, product.currency)}</span>
                    )}
                  </td>
                  <td className="p-3" onClick={e => { if (!isEditing) { e.stopPropagation(); setInlineEditId(product.id); setInlinePrice(product.price.toString()); setInlineStock(product.stock.toString()); } }}>
                    {isEditing ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Input
                          value={inlineStock}
                          onChange={e => setInlineStock(e.target.value)}
                          className="h-7 w-16 text-xs"
                          onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(product); if (e.key === 'Escape') setInlineEditId(null); }}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveInlineEdit(product)}>
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setInlineEditId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      stockBadge(product)
                    )}
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">{product.category || '–'}</span>
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">{formatDate(product.updated_at)}</span>
                  </td>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(product)}>
                          <Edit className="w-4 h-4 mr-2" /> {sv ? 'Redigera' : 'Edit'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(product)}>
                          <Copy className="w-4 h-4 mr-2" /> {sv ? 'Duplicera' : 'Duplicate'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          await updateDbProduct(product.id, { is_visible: !product.is_visible });
                          queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
                        }}>
                          {product.is_visible ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                          {product.is_visible ? (sv ? 'Dölj' : 'Hide') : (sv ? 'Visa' : 'Show')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {activeTab === 'active' && (
                          <>
                            <DropdownMenuItem onClick={() => handleStatusChange(product, 'draft')}>
                              <FileText className="w-4 h-4 mr-2" /> {sv ? 'Utkast' : 'Draft'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(product, 'archived')}>
                              <Archive className="w-4 h-4 mr-2" /> {sv ? 'Arkivera' : 'Archive'}
                            </DropdownMenuItem>
                          </>
                        )}
                        {activeTab !== 'active' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(product, 'active')}>
                            <RotateCcw className="w-4 h-4 mr-2" /> {sv ? 'Aktivera' : 'Activate'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => { setSelected(product); setIsDeleteOpen(true); }}>
                          <Trash2 className="w-4 h-4 mr-2" /> {t.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── GRID VIEW ───
  const renderGridView = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {filteredProducts.map(product => (
        <div
          key={product.id}
          className="border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-colors cursor-pointer group relative"
          onClick={() => openEdit(product)}
        >
          <button
            className="absolute top-2 left-2 z-10"
            onClick={e => { e.stopPropagation(); toggleSelect(product.id); }}
          >
            {selectedIds.has(product.id)
              ? <CheckSquare className="w-4 h-4 text-primary bg-background rounded" />
              : <Square className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity bg-background rounded" />
            }
          </button>
          <div className="aspect-square bg-muted">
            {product.image_urls?.[0]
              ? <img src={product.image_urls[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
              : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-muted-foreground/30" /></div>
            }
          </div>
          <div className="p-2.5">
            <p className="font-medium text-xs truncate">{product.title_sv}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-semibold text-primary">{formatPrice(product.price, product.currency)}</span>
              {stockBadge(product)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // ─── MOBILE COMPACT LIST ───
  const renderMobileList = () => (
    <div className="space-y-1">
      {filteredProducts.map(product => (
        <div
          key={product.id}
          className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 active:bg-muted/70 transition-colors cursor-pointer"
          onClick={() => openEdit(product)}
        >
          <button onClick={e => { e.stopPropagation(); toggleSelect(product.id); }} className="shrink-0">
            {selectedIds.has(product.id)
              ? <CheckSquare className="w-4 h-4 text-primary" />
              : <Square className="w-4 h-4 text-muted-foreground" />
            }
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{product.title_sv}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-semibold text-primary">{formatPrice(product.price, product.currency)}</span>
              {stockBadge(product)}
              {statusBadge(product)}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
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
                  <Copy className="w-4 h-4 mr-2" /> {sv ? 'Duplicera' : 'Duplicate'}
                </DropdownMenuItem>
                {activeTab === 'active' && (
                  <DropdownMenuItem onClick={() => handleStatusChange(product, 'archived')}>
                    <Archive className="w-4 h-4 mr-2" /> {sv ? 'Arkivera' : 'Archive'}
                  </DropdownMenuItem>
                )}
                {activeTab !== 'active' && (
                  <DropdownMenuItem onClick={() => handleStatusChange(product, 'active')}>
                    <RotateCcw className="w-4 h-4 mr-2" /> {sv ? 'Aktivera' : 'Activate'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => { setSelected(product); setIsDeleteOpen(true); }}>
                  <Trash2 className="w-4 h-4 mr-2" /> {t.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">{t.title}</h3>
            <p className="text-xs text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <Dialog open={isAddOpen} onOpenChange={open => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 shrink-0">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t.addProduct}</span>
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

      {/* ── SEARCH + FILTERS ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="pl-8 h-9 text-sm"
            />
            {searchQuery && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => { setSearchQuery(''); setDebouncedSearch(''); }}>
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allCategories}</SelectItem>
                {usedCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={v => setStockFilter(v as StockFilter)}>
              <SelectTrigger className="h-9 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allStock}</SelectItem>
                <SelectItem value="in_stock">{t.inStock}</SelectItem>
                <SelectItem value="low_stock">{t.lowStock}</SelectItem>
                <SelectItem value="out_of_stock">{t.outStock}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                <ArrowUpDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {[
                { key: 'updated', label: sv ? 'Senast uppdaterad' : 'Latest updated' },
                { key: 'name', label: sv ? 'Namn A–Ö' : 'Name A–Z' },
                { key: 'price_asc', label: sv ? 'Pris (lågt)' : 'Price (low)' },
                { key: 'price_desc', label: sv ? 'Pris (högt)' : 'Price (high)' },
                { key: 'stock_asc', label: sv ? 'Lager (lågt)' : 'Stock (low)' },
                { key: 'stock_desc', label: sv ? 'Lager (högt)' : 'Stock (high)' },
              ].map(opt => (
                <DropdownMenuItem key={opt.key} onClick={() => setSortKey(opt.key as SortKey)}>
                  {sortKey === opt.key && <Check className="w-3.5 h-3.5 mr-2" />}
                  <span className={sortKey !== opt.key ? 'ml-5.5' : ''}>{opt.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View toggle */}
          <div className="hidden sm:flex items-center border border-border rounded-md">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setViewMode('table')}
            >
              <LayoutList className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile filters row */}
        <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-1">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allCategories}</SelectItem>
              {usedCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={v => setStockFilter(v as StockFilter)}>
            <SelectTrigger className="h-8 w-auto min-w-[90px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allStock}</SelectItem>
              <SelectItem value="in_stock">{t.inStock}</SelectItem>
              <SelectItem value="low_stock">{t.lowStock}</SelectItem>
              <SelectItem value="out_of_stock">{t.outStock}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeFilters.map(chip => (
              <Badge
                key={chip.key}
                variant="secondary"
                className="gap-1 text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={() => removeFilter(chip.key)}
              >
                {chip.label}
                <X className="w-3 h-3" />
              </Badge>
            ))}
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setSearchQuery(''); setDebouncedSearch(''); setCategoryFilter('all'); setStockFilter('all'); }}
            >
              {sv ? 'Rensa alla' : 'Clear all'}
            </button>
          </div>
        )}
      </div>

      {/* ── STATUS TABS ── */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          { key: 'active' as const, label: sv ? 'Aktiva' : 'Active', count: counts.active, icon: Package },
          { key: 'draft' as const, label: sv ? 'Utkast' : 'Drafts', count: counts.draft, icon: FileText },
          { key: 'archived' as const, label: sv ? 'Arkiv' : 'Archived', count: counts.archived, icon: Archive },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count > 0 && <span className="text-[10px] bg-muted px-1.5 py-0 rounded-full">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* ── BULK ACTION BAR ── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20"
          >
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedIds.size} {sv ? 'valda' : 'selected'}
            </span>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeTab === 'active' && (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkStatusChange('draft')}>
                    <FileText className="w-3 h-3" /> {sv ? 'Utkast' : 'Draft'}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkStatusChange('archived')}>
                    <Archive className="w-3 h-3" /> {sv ? 'Arkivera' : 'Archive'}
                  </Button>
                </>
              )}
              {activeTab !== 'active' && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleBulkStatusChange('active')}>
                  <RotateCcw className="w-3 h-3" /> {sv ? 'Aktivera' : 'Activate'}
                </Button>
              )}
              <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => setIsBulkDeleteOpen(true)}>
                <Trash className="w-3 h-3" /> {t.delete}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                {sv ? 'Avmarkera' : 'Deselect'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PRODUCT LIST ── */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {debouncedSearch || categoryFilter !== 'all' || stockFilter !== 'all'
              ? (sv ? 'Inga produkter matchar filtren' : 'No products match filters')
              : t.noProducts
            }
          </p>
        </div>
      ) : (
        <div className="max-h-[600px] overflow-y-auto">
          {/* Mobile always uses compact list */}
          <div className="sm:hidden">{renderMobileList()}</div>
          {/* Desktop: table or grid */}
          <div className="hidden sm:block">
            {viewMode === 'table' ? renderTableView() : renderGridView()}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <span>{filteredProducts.length} {sv ? 'produkter visas' : 'products shown'}</span>
        {filteredProducts.length !== allProducts.filter(p => (p.status || 'active') === activeTab).length && (
          <span>{sv ? '(filtrerat)' : '(filtered)'}</span>
        )}
      </div>

      {/* ── DIALOGS ── */}
      <Dialog open={isEditOpen} onOpenChange={open => { setIsEditOpen(open); if (!open) { setSelected(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[95vh]">
          <DialogHeader><DialogTitle className="truncate">{t.editProduct}: {selected?.title_sv}</DialogTitle></DialogHeader>
          <AdminProductForm
            t={t} language={language}
            productCategories={productCategories} suggestedTags={suggestedTags}
            formData={formData} setFormData={setFormData}
            isEdit isSubmitting={isSubmitting}
            onCancel={() => { setIsEditOpen(false); setSelected(null); resetForm(); }}
            onSubmit={handleEdit}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelected(null)}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
            <AlertDialogDescription>
              {sv ? `${selectedIds.size} produkter tas bort permanent.` : `${selectedIds.size} products will be permanently deleted.`}
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
