import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Save, RefreshCw, Percent, Package, Tag,
  Eye, EyeOff, Pencil, X, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';


// ─── Types ───
interface VolumeDiscount {
  id: string;
  min_quantity: number;
  discount_percent: number;
  shopify_product_id: string | null;
  is_global: boolean;
}

interface Bundle {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  discount_percent: number;
  is_active: boolean;
  display_order: number;
  requirement_type: string;
  first_purchase_discount: number | null;
  repeat_discount: number | null;
  min_level: number | null;
  requires_account: boolean;
  max_uses_per_user: number | null;
}

interface BundleItem {
  id: string;
  bundle_id: string;
  shopify_product_id: string;
  quantity: number;
}

interface DbProduct {
  id: string;
  title_sv: string;
  price: number;
  original_price: number | null;
  is_visible: boolean;
}

// ─── Volume Discounts Tab ───
const VolumeDiscountsTab = () => {
  const [discounts, setDiscounts] = useState<VolumeDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ min_quantity: '', discount_percent: '', is_global: true });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('volume_discounts').select('*').order('min_quantity');
    if (data) setDiscounts(data as VolumeDiscount[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm({ min_quantity: '', discount_percent: '', is_global: true });
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (d: VolumeDiscount) => {
    setForm({
      min_quantity: String(d.min_quantity),
      discount_percent: String(d.discount_percent),
      is_global: d.is_global,
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const minQty = parseInt(form.min_quantity);
    const pct = parseFloat(form.discount_percent);
    if (!minQty || minQty < 1 || !pct || pct <= 0 || pct > 100) {
      toast.error('Ange giltiga värden'); return;
    }

    if (editingId) {
      const { error } = await supabase.from('volume_discounts').update({
        min_quantity: minQty,
        discount_percent: pct,
        is_global: form.is_global,
      }).eq('id', editingId);
      if (error) { toast.error('Kunde inte uppdatera'); return; }
      toast.success('Mängdrabatt uppdaterad');
    } else {
      const { error } = await supabase.from('volume_discounts').insert({
        min_quantity: minQty,
        discount_percent: pct,
        is_global: form.is_global,
        shopify_product_id: null,
      });
      if (error) { toast.error('Kunde inte skapa'); return; }
      toast.success('Mängdrabatt skapad');
    }
    resetForm();
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Ta bort denna mängdrabatt?')) return;
    await supabase.from('volume_discounts').delete().eq('id', id);
    toast.success('Borttagen');
    if (editingId === id) resetForm();
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Mängdrabatter</h3>
          <p className="text-xs text-muted-foreground">Automatisk rabatt baserat på antal produkter i varukorgen</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { if (showForm && !editingId) { resetForm(); } else { resetForm(); setShowForm(true); } }} className="gap-1 h-7 text-xs">
          <Plus className="w-3 h-3" /> Lägg till
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-primary/20">
              <CardContent className="pt-4 space-y-3">
                <p className="text-xs font-medium text-primary">
                  {editingId ? '✏️ Redigerar mängdrabatt' : '➕ Ny mängdrabatt'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Min. antal produkter *</Label>
                    <Input type="number" value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })} placeholder="3" className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Rabatt % *</Label>
                    <Input type="number" step="0.5" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} placeholder="10" className="h-8" />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center gap-2 h-8">
                      <Switch checked={form.is_global} onCheckedChange={v => setForm({ ...form, is_global: v })} />
                      <span className="text-xs text-muted-foreground">Global</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} className="gap-1 h-7 text-xs">
                    <Save className="w-3 h-3" /> {editingId ? 'Uppdatera' : 'Spara'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetForm} className="h-7 text-xs">Avbryt</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-1.5">
        {discounts.map(d => (
          <div key={d.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${editingId === d.id ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
              {d.discount_percent}%
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {d.min_quantity}+ produkter → {d.discount_percent}% rabatt
              </p>
              <p className="text-xs text-muted-foreground">
                {d.is_global ? 'Gäller hela varukorgen' : `Produktspecifik: ${d.shopify_product_id}`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(d.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {discounts.length === 0 && (
          <p className="text-center text-muted-foreground text-xs py-8">Inga mängdrabatter konfigurerade</p>
        )}
      </div>
    </div>
  );
};

// ─── Bundles Tab ───
const BundlesTab = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundleItems, setBundleItems] = useState<Record<string, BundleItem[]>>({});
  const [allProducts, setAllProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', name_en: '', description: '', description_en: '', discount_percent: '',
    requirement_type: 'none', first_purchase_discount: '', repeat_discount: '',
    min_level: '', requires_account: false, max_uses_per_user: '',
  });
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: string; quantity: number }>>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: bundlesData }, { data: productsData }, { data: itemsData }] = await Promise.all([
      supabase.from('bundles').select('*').order('display_order'),
      supabase.from('products').select('id, title_sv, price, original_price, is_visible').eq('is_visible', true).order('title_sv'),
      supabase.from('bundle_items').select('*'),
    ]);
    if (bundlesData) setBundles(bundlesData as Bundle[]);
    if (productsData) setAllProducts(productsData as DbProduct[]);
    if (itemsData) {
      const grouped: Record<string, BundleItem[]> = {};
      (itemsData as BundleItem[]).forEach(item => {
        if (!grouped[item.bundle_id]) grouped[item.bundle_id] = [];
        grouped[item.bundle_id].push(item);
      });
      setBundleItems(grouped);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const exists = prev.find(p => p.productId === productId);
      if (exists) return prev.filter(p => p.productId !== productId);
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, qty: number) => {
    setSelectedProducts(prev => prev.map(p => p.productId === productId ? { ...p, quantity: Math.max(1, qty) } : p));
  };

  const resetForm = () => setForm({
    name: '', name_en: '', description: '', description_en: '', discount_percent: '',
    requirement_type: 'none', first_purchase_discount: '', repeat_discount: '',
    min_level: '', requires_account: false, max_uses_per_user: '',
  });

  const handleAdd = async () => {
    if (!form.name || !form.discount_percent) { toast.error('Namn och rabatt krävs'); return; }
    if (selectedProducts.length === 0) { toast.error('Välj minst en produkt'); return; }
    const maxOrder = bundles.reduce((m, b) => Math.max(m, b.display_order), 0);
    const { data: newBundle, error } = await supabase.from('bundles').insert({
      name: form.name,
      name_en: form.name_en || null,
      description: form.description || null,
      description_en: form.description_en || null,
      discount_percent: parseFloat(form.discount_percent),
      is_active: false,
      display_order: maxOrder + 1,
      requirement_type: form.requirement_type,
      first_purchase_discount: form.first_purchase_discount ? parseFloat(form.first_purchase_discount) : null,
      repeat_discount: form.repeat_discount ? parseFloat(form.repeat_discount) : null,
      min_level: form.min_level ? parseInt(form.min_level) : null,
      requires_account: form.requires_account,
      max_uses_per_user: form.max_uses_per_user ? parseInt(form.max_uses_per_user) : null,
    }).select().single();
    if (error || !newBundle) { toast.error('Kunde inte skapa: ' + (error?.message || '')); return; }

    const items = selectedProducts.map(sp => ({
      bundle_id: newBundle.id,
      shopify_product_id: sp.productId,
      quantity: sp.quantity,
    }));
    await supabase.from('bundle_items').insert(items);

    toast.success('Paket skapat med produkter');
    resetForm();
    setSelectedProducts([]);
    setShowForm(false);
    fetchData();
  };

  const addProductToBundle = async (bundleId: string, productId: string) => {
    const existing = bundleItems[bundleId] || [];
    if (existing.find(i => i.shopify_product_id === productId)) {
      toast.error('Produkten finns redan i paketet');
      return;
    }
    await supabase.from('bundle_items').insert({ bundle_id: bundleId, shopify_product_id: productId, quantity: 1 });
    toast.success('Produkt tillagd');
    fetchData();
  };

  const removeItemFromBundle = async (itemId: string) => {
    await supabase.from('bundle_items').delete().eq('id', itemId);
    toast.success('Produkt borttagen');
    fetchData();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('bundles').update({ is_active: !current }).eq('id', id);
    setBundles(prev => prev.map(b => b.id === id ? { ...b, is_active: !current } : b));
    toast.success(!current ? 'Aktiverat' : 'Inaktiverat');
  };

  const deleteBundle = async (id: string) => {
    if (!confirm('Ta bort detta paket?')) return;
    await supabase.from('bundle_items').delete().eq('bundle_id', id);
    await supabase.from('bundles').delete().eq('id', id);
    toast.success('Borttaget');
    fetchData();
  };

  const getProductName = (productId: string) => {
    return allProducts.find(p => p.id === productId)?.title_sv || productId;
  };

  const getProductPrice = (productId: string) => {
    return allProducts.find(p => p.id === productId)?.price || 0;
  };

  const calcBundleTotal = (bundleId: string, discountPct: number) => {
    const items = bundleItems[bundleId] || [];
    const total = items.reduce((s, i) => s + getProductPrice(i.shopify_product_id) * i.quantity, 0);
    return { original: total, discounted: total * (1 - discountPct / 100) };
  };

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Produktpaket</h3>
          <p className="text-xs text-muted-foreground">Kombinera produkter till paket med automatisk rabatt</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setShowForm(!showForm); setSelectedProducts([]); }} className="gap-1 h-7 text-xs">
          <Plus className="w-3 h-3" /> Nytt paket
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-primary/20">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Namn (SV) *</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Välkomstpaket" className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Namn (EN)</Label>
                    <Input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} placeholder="Welcome Kit" className="h-8" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Beskrivning (SV)</Label>
                    <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Beskrivning (EN)</Label>
                    <Input value={form.description_en} onChange={e => setForm({ ...form, description_en: e.target.value })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Rabatt % *</Label>
                    <Input type="number" step="0.5" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} placeholder="40" className="h-8" />
                  </div>
                </div>

                {/* Product selection */}
                <div>
                  <Label className="text-xs font-medium">Välj produkter till paketet *</Label>
                  <div className="mt-2 max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                    {allProducts.map(p => {
                      const selected = selectedProducts.find(sp => sp.productId === p.id);
                      return (
                        <div key={p.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-secondary/50'}`} onClick={() => toggleProduct(p.id)}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                            {selected && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                          </div>
                          <span className="text-sm flex-1 truncate">{p.title_sv}</span>
                          <span className="text-xs text-muted-foreground">{p.price} kr</span>
                          {selected && (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(p.id, selected.quantity - 1)}>-</Button>
                              <span className="text-xs w-6 text-center font-medium">{selected.quantity}</span>
                              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(p.id, selected.quantity + 1)}>+</Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {selectedProducts.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{selectedProducts.length} produkt(er) valda</Badge>
                      {form.discount_percent && (
                        <span className="text-xs text-muted-foreground">
                          Totalt: <span className="line-through">{selectedProducts.reduce((s, sp) => s + getProductPrice(sp.productId) * sp.quantity, 0)} kr</span>
                          {' → '}
                          <span className="font-bold text-primary">
                            {Math.round(selectedProducts.reduce((s, sp) => s + getProductPrice(sp.productId) * sp.quantity, 0) * (1 - parseFloat(form.discount_percent || '0') / 100))} kr
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Conditions / Requirements */}
                <div className="border border-border rounded-lg p-3 space-y-3 bg-secondary/20">
                  <p className="text-xs font-semibold flex items-center gap-1.5">⚙️ Villkor & Krav</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Typ av krav</Label>
                      <Select value={form.requirement_type} onValueChange={v => setForm({ ...form, requirement_type: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">Inga krav</SelectItem>
                          <SelectItem value="first_purchase" className="text-xs">Första köpet</SelectItem>
                          <SelectItem value="level_required" className="text-xs">Kräver level</SelectItem>
                          <SelectItem value="account_required" className="text-xs">Kräver konto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.requirement_type === 'first_purchase' && (
                      <>
                        <div>
                          <Label className="text-xs">Rabatt första köpet %</Label>
                          <Input type="number" step="0.5" value={form.first_purchase_discount} onChange={e => setForm({ ...form, first_purchase_discount: e.target.value })} placeholder="40" className="h-8" />
                        </div>
                        <div>
                          <Label className="text-xs">Rabatt efterföljande köp %</Label>
                          <Input type="number" step="0.5" value={form.repeat_discount} onChange={e => setForm({ ...form, repeat_discount: e.target.value })} placeholder="20" className="h-8" />
                        </div>
                      </>
                    )}
                    {form.requirement_type === 'level_required' && (
                      <div>
                        <Label className="text-xs">Minsta level</Label>
                        <Input type="number" value={form.min_level} onChange={e => setForm({ ...form, min_level: e.target.value })} placeholder="5" className="h-8" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 h-8">
                      <Switch checked={form.requires_account} onCheckedChange={v => setForm({ ...form, requires_account: v })} />
                      <span className="text-xs text-muted-foreground">Kräver konto</span>
                    </div>
                    <div>
                      <Label className="text-xs">Max användningar per kund</Label>
                      <Input type="number" value={form.max_uses_per_user} onChange={e => setForm({ ...form, max_uses_per_user: e.target.value })} placeholder="∞ (lämna tomt)" className="h-8" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} className="gap-1 h-7 text-xs"><Save className="w-3 h-3" /> Spara paket</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setSelectedProducts([]); resetForm(); }} className="h-7 text-xs">Avbryt</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {bundles.map(b => {
          const items = bundleItems[b.id] || [];
          const prices = calcBundleTotal(b.id, b.discount_percent);
          const isExpanded = expandedId === b.id;

          return (
            <div key={b.id} className={`rounded-xl border transition-all ${!b.is_active ? 'opacity-60 border-border' : 'border-border'}`}>
              <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : b.id)}>
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center font-bold text-accent text-sm shrink-0">
                  {b.discount_percent}%
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{b.name}</p>
                    {!b.is_active && <Badge variant="outline" className="text-[9px]">Inaktiv</Badge>}
                    <Badge variant="secondary" className="text-[9px]">{items.length} produkter</Badge>
                  </div>
                  {items.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="line-through">{Math.round(prices.original)} kr</span> → <span className="font-semibold text-primary">{Math.round(prices.discounted)} kr</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b.id, b.is_active)} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteBundle(b.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                      <p className="text-xs font-medium">Produkter i paketet:</p>
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
                          <span className="text-sm flex-1 truncate">{getProductName(item.shopify_product_id)}</span>
                          <span className="text-xs text-muted-foreground">{item.quantity}x {getProductPrice(item.shopify_product_id)} kr</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItemFromBundle(item.id)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      {items.length === 0 && <p className="text-xs text-muted-foreground">Inga produkter tillagda ännu</p>}

                      {/* Add product to existing bundle */}
                      <div className="pt-1">
                        <Select onValueChange={val => addProductToBundle(b.id, val)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="+ Lägg till produkt..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allProducts.filter(p => !(items.find(i => i.shopify_product_id === p.id))).map(p => (
                              <SelectItem key={p.id} value={p.id} className="text-xs">{p.title_sv} — {p.price} kr</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {bundles.length === 0 && (
          <p className="text-center text-muted-foreground text-xs py-8">Inga paket konfigurerade</p>
        )}
      </div>
    </div>
  );
};

// ─── Sale Prices Tab ───
const SalePricesTab = () => {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editOriginal, setEditOriginal] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('id, title_sv, price, original_price, is_visible').order('title_sv');
    if (data) setProducts(data as DbProduct[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const startEdit = (p: DbProduct) => {
    setEditingId(p.id);
    setEditPrice(p.price.toString());
    setEditOriginal(p.original_price?.toString() || '');
  };

  const saveEdit = async (id: string) => {
    const price = parseFloat(editPrice);
    const original = editOriginal ? parseFloat(editOriginal) : null;
    if (!price || price <= 0) { toast.error('Ogiltigt pris'); return; }
    if (original !== null && original <= price) { toast.error('Ordinarie pris måste vara högre än kampanjpris'); return; }

    const { error } = await supabase.from('products').update({
      price,
      original_price: original,
    }).eq('id', id);

    if (error) { toast.error('Kunde inte spara'); return; }
    toast.success('Pris uppdaterat');
    setEditingId(null);
    fetch();
  };

  const clearSale = async (id: string) => {
    await supabase.from('products').update({ original_price: null }).eq('id', id);
    toast.success('Kampanjpris borttaget');
    fetch();
  };

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const onSale = products.filter(p => p.original_price && p.original_price > p.price);
  const notOnSale = products.filter(p => !p.original_price || p.original_price <= p.price);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm">Kampanjpriser</h3>
        <p className="text-xs text-muted-foreground">Sätt ordinarie pris och kampanjpris — kunden ser överstruket pris i butiken</p>
      </div>

      {onSale.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-primary flex items-center gap-1"><Sparkles className="w-3 h-3" /> Aktiva kampanjer ({onSale.length})</p>
          {onSale.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.title_sv}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs line-through text-muted-foreground">{p.original_price} kr</span>
                  <span className="text-xs font-bold text-primary">{p.price} kr</span>
                  <Badge variant="destructive" className="text-[9px]">
                    -{Math.round((1 - p.price / (p.original_price || p.price)) * 100)}%
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startEdit(p)}>
                  <Pencil className="w-3 h-3 mr-1" /> Ändra
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => clearSale(p.id)}>
                  <X className="w-3 h-3 mr-1" /> Ta bort rea
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Alla produkter ({notOnSale.length})</p>
        {notOnSale.map(p => (
          <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-card">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{p.title_sv}</p>
              <p className="text-xs text-muted-foreground">{p.price} kr</p>
            </div>
            {editingId === p.id ? (
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Ord:</Label>
                  <Input type="number" value={editOriginal} onChange={e => setEditOriginal(e.target.value)} className="h-7 w-20 text-xs" placeholder="Ord. pris" />
                </div>
                <div className="flex items-center gap-1">
                  <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Rea:</Label>
                  <Input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="h-7 w-20 text-xs" placeholder="Kampanjpris" />
                </div>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveEdit(p.id)}>
                  <Save className="w-3 h-3" /> Spara
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => startEdit(p)}>
                <Tag className="w-3 h-3 mr-1" /> Sätt kampanjpris
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ───
const AdminCampaignsManager = () => {
  return (
    <Tabs defaultValue="volume" className="space-y-4">
      <TabsList className="h-9">
        <TabsTrigger value="volume" className="gap-1.5 text-xs">
          <Percent className="w-3.5 h-3.5" /> Mängdrabatter
        </TabsTrigger>
        <TabsTrigger value="bundles" className="gap-1.5 text-xs">
          <Package className="w-3.5 h-3.5" /> Paket
        </TabsTrigger>
        <TabsTrigger value="sales" className="gap-1.5 text-xs">
          <Tag className="w-3.5 h-3.5" /> Kampanjpriser
        </TabsTrigger>
      </TabsList>

      <TabsContent value="volume"><VolumeDiscountsTab /></TabsContent>
      <TabsContent value="bundles"><BundlesTab /></TabsContent>
      <TabsContent value="sales"><SalePricesTab /></TabsContent>
    </Tabs>
  );
};

export default AdminCampaignsManager;
