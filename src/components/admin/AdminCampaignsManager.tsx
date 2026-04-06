import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Save, RefreshCw, Percent, Package, Tag,
  Pencil, X, Sparkles, Loader2, ShoppingBag, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAutoTranslate } from '@/hooks/useAutoTranslate';
import { toast } from 'sonner';

// ─── Types ───
interface VolumeDiscount {
  id: string;
  min_quantity: number;
  discount_percent: number;
  product_id: string | null;
  is_global: boolean;
  excluded_product_ids: string[];
  stackable: boolean;
  label: string | null;
  created_at: string;
  requires_account: boolean;
  requirement_type: string;
  first_purchase_discount: number | null;
  repeat_discount: number | null;
  min_level: number | null;
  max_uses_per_user: number | null;
}

const fmtDate = (d: string) => {
  try { return format(new Date(d), 'd MMM yyyy', { locale: sv }); } catch { return ''; }
};

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
  created_at: string;
  updated_at: string;
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
  badge: string | null;
  tags: string[] | null;
}

// ─── Auto-translate helper ───
const autoTranslateFields = async (
  translate: (text: string, src?: string, ctx?: string) => Promise<Record<string, string> | null>,
  name: string,
  description: string | null,
) => {
  let name_en: string | null = null;
  let description_en: string | null = null;

  if (name) {
    const nameTranslations = await translate(name, 'sv', 'e-commerce bundle/campaign name');
    if (nameTranslations?.en) name_en = nameTranslations.en;
  }
  if (description) {
    const descTranslations = await translate(description, 'sv', 'e-commerce bundle/campaign description');
    if (descTranslations?.en) description_en = descTranslations.en;
  }

  return { name_en, description_en };
};

// ─── Volume Discounts Tab ───
const VolumeDiscountsTab = () => {
  const [discounts, setDiscounts] = useState<VolumeDiscount[]>([]);
  const [allProducts, setAllProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<'global' | 'product'>('global');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<Array<{ min_quantity: string; discount_percent: string }>>([
    { min_quantity: '', discount_percent: '' },
  ]);
  const [form, setForm] = useState({
    label: '', stackable: true, excluded_product_ids: [] as string[],
    requires_account: false, requirement_type: 'none',
    first_purchase_discount: '', repeat_discount: '',
    min_level: '', max_uses_per_user: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: dData }, { data: pData }] = await Promise.all([
      supabase.from('volume_discounts').select('*').order('min_quantity'),
      supabase.from('products').select('id, title_sv, price, original_price, is_visible, badge, tags').eq('is_visible', true).order('title_sv'),
    ]);
    if (dData) setDiscounts(dData.map((d: any) => ({ ...d, excluded_product_ids: d.excluded_product_ids || [], stackable: d.stackable ?? true })));
    if (pData) setAllProducts(pData as DbProduct[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm({ label: '', stackable: true, excluded_product_ids: [],
      requires_account: false, requirement_type: 'none',
      first_purchase_discount: '', repeat_discount: '',
      min_level: '', max_uses_per_user: '',
    });
    setTiers([{ min_quantity: '', discount_percent: '' }]);
    setMode('global');
    setSelectedProductId(null);
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (d: VolumeDiscount) => {
    const isProduct = !d.is_global && !!d.product_id;
    setMode(isProduct ? 'product' : 'global');
    setSelectedProductId(d.product_id);
    setForm({
      label: d.label || '', stackable: d.stackable, excluded_product_ids: d.excluded_product_ids || [],
      requires_account: d.requires_account || false,
      requirement_type: d.requirement_type || 'none',
      first_purchase_discount: d.first_purchase_discount ? String(d.first_purchase_discount) : '',
      repeat_discount: d.repeat_discount ? String(d.repeat_discount) : '',
      min_level: d.min_level ? String(d.min_level) : '',
      max_uses_per_user: d.max_uses_per_user ? String(d.max_uses_per_user) : '',
    });

    if (isProduct && d.product_id) {
      // Load all tiers for this product
      const productTiers = discounts
        .filter(dd => dd.product_id === d.product_id)
        .sort((a, b) => a.min_quantity - b.min_quantity)
        .map(dd => ({ min_quantity: String(dd.min_quantity), discount_percent: String(dd.discount_percent) }));
      setTiers(productTiers.length > 0 ? productTiers : [{ min_quantity: String(d.min_quantity), discount_percent: String(d.discount_percent) }]);
    } else {
      setTiers([{ min_quantity: String(d.min_quantity), discount_percent: String(d.discount_percent) }]);
    }
    setEditingId(d.id);
    setShowForm(true);
  };

  const toggleExcludedProduct = (pid: string) => {
    setForm(prev => ({
      ...prev,
      excluded_product_ids: prev.excluded_product_ids.includes(pid)
        ? prev.excluded_product_ids.filter(id => id !== pid)
        : [...prev.excluded_product_ids, pid],
    }));
  };

  const addTier = () => setTiers(prev => [...prev, { min_quantity: '', discount_percent: '' }]);
  const removeTier = (idx: number) => setTiers(prev => prev.filter((_, i) => i !== idx));
  const updateTier = (idx: number, field: 'min_quantity' | 'discount_percent', value: string) => {
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const handleSave = async () => {
    const validTiers = tiers.filter(t => t.min_quantity && t.discount_percent);
    if (validTiers.length === 0) { toast.error('Lägg till minst en nivå'); return; }
    for (const t of validTiers) {
      const qty = parseInt(t.min_quantity);
      const pct = parseFloat(t.discount_percent);
      if (!qty || qty < 1 || !pct || pct <= 0 || pct > 100) { toast.error('Ogiltiga värden i en nivå'); return; }
    }

    if (mode === 'product' && !selectedProductId) { toast.error('Välj en produkt'); return; }

    const isGlobal = mode === 'global';
    const productId = isGlobal ? null : selectedProductId;

    // For product-specific: delete all existing tiers for this product, then insert new ones
    if (mode === 'product' && productId) {
      await supabase.from('volume_discounts').delete().eq('product_id', productId);
    } else if (editingId) {
      // For global edits: update or delete+recreate
      // If single tier, just update
      if (validTiers.length === 1) {
        const { error } = await supabase.from('volume_discounts').update({
          min_quantity: parseInt(validTiers[0].min_quantity),
          discount_percent: parseFloat(validTiers[0].discount_percent),
          is_global: true,
          product_id: null,
          label: form.label || null,
          stackable: form.stackable,
          excluded_product_ids: form.excluded_product_ids,
          requires_account: form.requires_account,
          requirement_type: form.requirement_type,
          first_purchase_discount: form.first_purchase_discount ? parseFloat(form.first_purchase_discount) : null,
          repeat_discount: form.repeat_discount ? parseFloat(form.repeat_discount) : null,
          min_level: form.min_level ? parseInt(form.min_level) : null,
          max_uses_per_user: form.max_uses_per_user ? parseInt(form.max_uses_per_user) : null,
        }).eq('id', editingId);
        if (error) { toast.error('Kunde inte uppdatera'); return; }
        toast.success('Mängdrabatt uppdaterad');
        resetForm();
        fetchData();
        return;
      }
    }

    // Insert all tiers
    const requirementFields = {
      requires_account: form.requires_account,
      requirement_type: form.requirement_type,
      first_purchase_discount: form.first_purchase_discount ? parseFloat(form.first_purchase_discount) : null,
      repeat_discount: form.repeat_discount ? parseFloat(form.repeat_discount) : null,
      min_level: form.min_level ? parseInt(form.min_level) : null,
      max_uses_per_user: form.max_uses_per_user ? parseInt(form.max_uses_per_user) : null,
    };

    const rows = validTiers.map(t => ({
      min_quantity: parseInt(t.min_quantity),
      discount_percent: parseFloat(t.discount_percent),
      is_global: isGlobal,
      product_id: productId,
      label: form.label || null,
      stackable: form.stackable,
      excluded_product_ids: isGlobal ? form.excluded_product_ids : [],
      ...requirementFields,
    }));

    const { error } = await supabase.from('volume_discounts').insert(rows);
    if (error) { toast.error('Kunde inte spara: ' + error.message); return; }

    toast.success(mode === 'product'
      ? `${validTiers.length} nivåer sparade för produkten`
      : 'Mängdrabatt skapad');
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

  const deleteAllProductTiers = async (productId: string) => {
    if (!confirm('Ta bort alla nivåer för denna produkt?')) return;
    await supabase.from('volume_discounts').delete().eq('product_id', productId);
    toast.success('Alla nivåer borttagna');
    resetForm();
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  // Group product-specific discounts
  const globalDiscounts = discounts.filter(d => d.is_global || !d.product_id);
  const productDiscountsMap = new Map<string, VolumeDiscount[]>();
  discounts.filter(d => !d.is_global && d.product_id).forEach(d => {
    const list = productDiscountsMap.get(d.product_id!) || [];
    list.push(d);
    productDiscountsMap.set(d.product_id!, list);
  });

  const getProductName = (pid: string) => allProducts.find(p => p.id === pid)?.title_sv || pid;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Mängdrabatter</h3>
          <p className="text-xs text-muted-foreground">Global eller per produkt — stöd för trappsteg (2=10%, 3=15%…)</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { if (showForm && !editingId) resetForm(); else { resetForm(); setShowForm(true); } }} className="gap-1 h-7 text-xs">
          <Plus className="w-3 h-3" /> Lägg till
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-primary/20">
              <CardContent className="pt-4 space-y-3">
                <p className="text-xs font-medium text-primary">{editingId ? '✏️ Redigerar' : '➕ Ny mängdrabatt'}</p>

                {/* Mode selector */}
                <div className="flex gap-2">
                  <Button size="sm" variant={mode === 'global' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setMode('global')}>
                    🌐 Global (hela korgen)
                  </Button>
                  <Button size="sm" variant={mode === 'product' ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setMode('product')}>
                    📦 Enskild produkt
                  </Button>
                </div>

                {/* Product selector for product mode */}
                {mode === 'product' && (
                  <div>
                    <Label className="text-xs">Välj produkt *</Label>
                    <Select value={selectedProductId || ''} onValueChange={v => setSelectedProductId(v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Välj produkt..." /></SelectTrigger>
                      <SelectContent>
                        {allProducts.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">{p.title_sv} — {p.price} kr</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Label */}
                <div>
                  <Label className="text-xs">Etikett (valfri)</Label>
                  <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Sommarkampanj" className="h-8" />
                </div>

                {/* Tiers */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-medium">Rabattnivåer *</Label>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={addTier}><Plus className="w-3 h-3" /> Lägg till nivå</Button>
                  </div>
                  <div className="space-y-1.5">
                    {tiers.map((tier, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <Input
                            type="number" value={tier.min_quantity}
                            onChange={e => updateTier(idx, 'min_quantity', e.target.value)}
                            placeholder="Antal" className="h-8 w-20 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">st →</span>
                          <Input
                            type="number" step="0.5" value={tier.discount_percent}
                            onChange={e => updateTier(idx, 'discount_percent', e.target.value)}
                            placeholder="%" className="h-8 w-20 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">% rabatt</span>
                        </div>
                        {tiers.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeTier(idx)}>
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {mode === 'product' && selectedProductId && tiers.filter(t => t.min_quantity && t.discount_percent).length > 0 && (
                    <div className="mt-2 p-2 rounded-lg bg-secondary/30 space-y-0.5">
                      <p className="text-[10px] font-medium text-muted-foreground">Förhandsvisning:</p>
                      {tiers.filter(t => t.min_quantity && t.discount_percent).sort((a, b) => parseInt(a.min_quantity) - parseInt(b.min_quantity)).map((t, i) => {
                        const product = allProducts.find(p => p.id === selectedProductId);
                        const unitPrice = product?.price || 0;
                        const discounted = Math.round(unitPrice * (1 - parseFloat(t.discount_percent) / 100));
                        return (
                          <p key={i} className="text-xs">
                            <span className="font-medium">{t.min_quantity}+ st</span>: {t.discount_percent}% rabatt
                            {unitPrice > 0 && <span className="text-muted-foreground"> ({discounted} kr/st ist.f. {unitPrice} kr)</span>}
                          </p>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Stacking control */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-secondary/20">
                  <Switch checked={form.stackable} onCheckedChange={v => setForm({ ...form, stackable: v })} />
                  <div>
                    <p className="text-xs font-medium">Kombinerbar med andra rabatter</p>
                    <p className="text-[10px] text-muted-foreground">
                      {form.stackable ? 'Kan kombineras med paket, rea & andra kampanjer' : 'Gäller ensam — kombineras EJ med andra prisevent'}
                    </p>
                  </div>
                </div>

                {/* Excluded products (only for global) */}
                {mode === 'global' && (
                  <div>
                    <Label className="text-xs font-medium">Uteslutna produkter</Label>
                    <p className="text-[10px] text-muted-foreground mb-1.5">Dessa produkter räknas inte med / får inte rabatten</p>
                    <div className="max-h-36 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                      {allProducts.map(p => {
                        const excluded = form.excluded_product_ids.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center gap-3 px-3 py-1.5 cursor-pointer transition-colors ${excluded ? 'bg-destructive/5' : 'hover:bg-secondary/50'}`}
                            onClick={() => toggleExcludedProduct(p.id)}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${excluded ? 'border-destructive bg-destructive' : 'border-muted-foreground/30'}`}>
                              {excluded && <span className="text-destructive-foreground text-[10px] font-bold">✕</span>}
                            </div>
                            <span className="text-xs flex-1 truncate">{p.title_sv}</span>
                            <span className="text-[10px] text-muted-foreground">{p.price} kr</span>
                          </div>
                        );
                      })}
                    </div>
                    {form.excluded_product_ids.length > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="destructive" className="text-[9px]">{form.excluded_product_ids.length} uteslutna</Badge>
                        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => setForm({ ...form, excluded_product_ids: [] })}>Rensa</Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Conditions */}
                <div className="border border-border rounded-lg p-3 space-y-3 bg-secondary/20">
                  <p className="text-xs font-semibold">⚙️ Villkor & Krav</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Aktiva villkor (välj ett eller flera)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[
                        { key: 'requires_account', label: 'Kräver konto', desc: 'Kunden måste vara inloggad' },
                        { key: 'first_purchase', label: 'Första köpet-rabatt', desc: 'Högre rabatt vid första köp, lägre sedan' },
                        { key: 'level_required', label: 'Kräver level', desc: 'Kunden måste nå en viss level' },
                        { key: 'max_uses', label: 'Max antal per kund', desc: 'Begränsa hur många gånger kunden kan köpa' },
                      ].map(opt => {
                        const isActive = opt.key === 'requires_account' ? form.requires_account
                          : opt.key === 'first_purchase' ? form.requirement_type === 'first_purchase'
                          : opt.key === 'level_required' ? form.requirement_type === 'level_required'
                          : !!form.max_uses_per_user;
                        
                        const toggle = () => {
                          if (opt.key === 'requires_account') {
                            setForm(f => ({ ...f, requires_account: !f.requires_account }));
                          } else if (opt.key === 'first_purchase') {
                            setForm(f => ({ ...f, requirement_type: f.requirement_type === 'first_purchase' ? 'none' : 'first_purchase' }));
                          } else if (opt.key === 'level_required') {
                            setForm(f => ({ ...f, requirement_type: f.requirement_type === 'level_required' ? 'none' : 'level_required' }));
                          } else if (opt.key === 'max_uses') {
                            setForm(f => ({ ...f, max_uses_per_user: f.max_uses_per_user ? '' : '1' }));
                          }
                        };

                        return (
                          <div
                            key={opt.key}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${isActive ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-secondary/50'}`}
                            onClick={toggle}
                          >
                            <Switch checked={isActive} onCheckedChange={toggle} onClick={e => e.stopPropagation()} />
                            <div>
                              <p className="text-xs font-medium">{opt.label}</p>
                              <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <AnimatePresence>
                    {form.requirement_type === 'first_purchase' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Första köpet %</Label>
                          <Input type="number" step="0.5" value={form.first_purchase_discount} onChange={e => setForm({ ...form, first_purchase_discount: e.target.value })} placeholder="40" className="h-8" />
                        </div>
                        <div>
                          <Label className="text-xs">Efterföljande %</Label>
                          <Input type="number" step="0.5" value={form.repeat_discount} onChange={e => setForm({ ...form, repeat_discount: e.target.value })} placeholder="20" className="h-8" />
                        </div>
                      </motion.div>
                    )}
                    {form.requirement_type === 'level_required' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <div className="w-32">
                          <Label className="text-xs">Minsta level</Label>
                          <Input type="number" value={form.min_level} onChange={e => setForm({ ...form, min_level: e.target.value })} placeholder="5" className="h-8" />
                        </div>
                      </motion.div>
                    )}
                    {form.max_uses_per_user && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <div className="w-32">
                          <Label className="text-xs">Max köp per kund</Label>
                          <Input type="number" value={form.max_uses_per_user} onChange={e => setForm({ ...form, max_uses_per_user: e.target.value })} placeholder="1" className="h-8" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} className="gap-1 h-7 text-xs"><Save className="w-3 h-3" /> {editingId ? 'Uppdatera' : 'Spara'}</Button>
                  <Button size="sm" variant="outline" onClick={resetForm} className="h-7 text-xs">Avbryt</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global discounts */}
      {globalDiscounts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">🌐 Globala mängdrabatter</p>
          {globalDiscounts.map(d => (
            <div key={d.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${editingId === d.id ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">{d.discount_percent}%</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{d.label || `${d.min_quantity}+ produkter`} → {d.discount_percent}%</p>
                  {!d.stackable && <Badge variant="outline" className="text-[9px]">Ej kombinerbar</Badge>}
                  {(d.excluded_product_ids?.length || 0) > 0 && (
                    <Badge variant="secondary" className="text-[9px]">{d.excluded_product_ids.length} uteslutna</Badge>
                  )}
                  {d.requires_account && <Badge variant="outline" className="text-[9px]">Kräver konto</Badge>}
                  {d.requirement_type === 'first_purchase' && <Badge variant="outline" className="text-[9px]">Första köpet</Badge>}
                  {d.requirement_type === 'level_required' && <Badge variant="outline" className="text-[9px]">Level {d.min_level}+</Badge>}
                  {d.max_uses_per_user && <Badge variant="outline" className="text-[9px]">Max {d.max_uses_per_user}x</Badge>}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Gäller hela varukorgen
                  <span className="inline-flex items-center gap-0.5 ml-1 text-[10px]"><Calendar className="w-3 h-3" />{fmtDate(d.created_at)}</span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(d.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product-specific discounts grouped */}
      {productDiscountsMap.size > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">📦 Produktspecifika mängdrabatter</p>
          {Array.from(productDiscountsMap.entries()).map(([productId, tierList]) => {
            const sorted = tierList.sort((a, b) => a.min_quantity - b.min_quantity);
            const first = sorted[0];
            return (
              <div key={productId} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{getProductName(productId)}</p>
                      {!first.stackable && <Badge variant="outline" className="text-[9px]">Ej kombinerbar</Badge>}
                      {first.label && <Badge variant="secondary" className="text-[9px]">{first.label}</Badge>}
                      {first.requires_account && <Badge variant="outline" className="text-[9px]">Kräver konto</Badge>}
                      {first.requirement_type === 'first_purchase' && <Badge variant="outline" className="text-[9px]">Första köpet</Badge>}
                      {first.requirement_type === 'level_required' && <Badge variant="outline" className="text-[9px]">Level {first.min_level}+</Badge>}
                      {first.max_uses_per_user && <Badge variant="outline" className="text-[9px]">Max {first.max_uses_per_user}x</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {sorted.map((t, i) => (
                        <span key={t.id} className="text-xs">
                          <span className="font-medium">{t.min_quantity}+</span>={t.discount_percent}%
                          {i < sorted.length - 1 && <span className="text-muted-foreground ml-1">·</span>}
                        </span>
                      ))}
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground ml-1"><Calendar className="w-3 h-3" />{fmtDate(first.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(first)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteAllProductTiers(productId)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {globalDiscounts.length === 0 && productDiscountsMap.size === 0 && (
        <p className="text-center text-muted-foreground text-xs py-8">Inga mängdrabatter konfigurerade</p>
      )}
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
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { translate, isTranslating } = useAutoTranslate();

  const emptyForm = {
    name: '', description: '', discount_percent: '',
    requirement_type: 'none', first_purchase_discount: '', repeat_discount: '',
    min_level: '', requires_account: false, max_uses_per_user: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: string; quantity: number }>>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: bundlesData }, { data: productsData }, { data: itemsData }] = await Promise.all([
      supabase.from('bundles').select('*').order('display_order'),
      supabase.from('products').select('id, title_sv, price, original_price, is_visible, badge, tags').eq('is_visible', true).order('title_sv'),
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

  const openNewForm = () => {
    setEditingBundle(null);
    setForm(emptyForm);
    setSelectedProducts([]);
    setShowForm(true);
  };

  const openEditForm = (b: Bundle) => {
    setEditingBundle(b);
    setForm({
      name: b.name,
      description: b.description || '',
      discount_percent: String(b.discount_percent),
      requirement_type: b.requirement_type || 'none',
      first_purchase_discount: b.first_purchase_discount ? String(b.first_purchase_discount) : '',
      repeat_discount: b.repeat_discount ? String(b.repeat_discount) : '',
      min_level: b.min_level ? String(b.min_level) : '',
      requires_account: b.requires_account,
      max_uses_per_user: b.max_uses_per_user ? String(b.max_uses_per_user) : '',
    });
    const items = bundleItems[b.id] || [];
    setSelectedProducts(items.map(i => ({ productId: i.shopify_product_id, quantity: i.quantity })));
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingBundle(null);
    setForm(emptyForm);
    setSelectedProducts([]);
  };

  const handleSave = async () => {
    if (!form.name || !form.discount_percent) { toast.error('Namn och rabatt krävs'); return; }
    if (!editingBundle && selectedProducts.length === 0) { toast.error('Välj minst en produkt'); return; }

    setSaving(true);
    // Auto-translate name and description
    const { name_en, description_en } = await autoTranslateFields(translate, form.name, form.description || null);

    const bundleData = {
      name: form.name,
      name_en,
      description: form.description || null,
      description_en,
      discount_percent: parseFloat(form.discount_percent),
      requirement_type: form.requirement_type,
      first_purchase_discount: form.first_purchase_discount ? parseFloat(form.first_purchase_discount) : null,
      repeat_discount: form.repeat_discount ? parseFloat(form.repeat_discount) : null,
      min_level: form.min_level ? parseInt(form.min_level) : null,
      requires_account: form.requires_account,
      max_uses_per_user: form.max_uses_per_user ? parseInt(form.max_uses_per_user) : null,
    };

    if (editingBundle) {
      // Update existing bundle
      const { error } = await supabase.from('bundles').update(bundleData).eq('id', editingBundle.id);
      if (error) { toast.error('Kunde inte uppdatera: ' + error.message); setSaving(false); return; }

      // Update items: delete old, insert new
      await supabase.from('bundle_items').delete().eq('bundle_id', editingBundle.id);
      if (selectedProducts.length > 0) {
        await supabase.from('bundle_items').insert(
          selectedProducts.map(sp => ({ bundle_id: editingBundle.id, shopify_product_id: sp.productId, quantity: sp.quantity }))
        );
      }
      toast.success('Paket uppdaterat');
    } else {
      // Create new bundle
      const maxOrder = bundles.reduce((m, b) => Math.max(m, b.display_order), 0);
      const { data: newBundle, error } = await supabase.from('bundles').insert({
        ...bundleData,
        is_active: false,
        display_order: maxOrder + 1,
      }).select().single();
      if (error || !newBundle) { toast.error('Kunde inte skapa: ' + (error?.message || '')); setSaving(false); return; }

      await supabase.from('bundle_items').insert(
        selectedProducts.map(sp => ({ bundle_id: newBundle.id, shopify_product_id: sp.productId, quantity: sp.quantity }))
      );
      toast.success('Paket skapat');
    }

    setSaving(false);
    closeForm();
    fetchData();
  };

  const addProductToBundle = async (bundleId: string, productId: string) => {
    const existing = bundleItems[bundleId] || [];
    if (existing.find(i => i.shopify_product_id === productId)) { toast.error('Finns redan'); return; }
    await supabase.from('bundle_items').insert({ bundle_id: bundleId, shopify_product_id: productId, quantity: 1 });
    toast.success('Tillagd');
    fetchData();
  };

  const removeItemFromBundle = async (itemId: string) => {
    await supabase.from('bundle_items').delete().eq('id', itemId);
    toast.success('Borttagen');
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

  const getProductName = (productId: string) => allProducts.find(p => p.id === productId)?.title_sv || productId;
  const getProductPrice = (productId: string) => allProducts.find(p => p.id === productId)?.price || 0;

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
          <p className="text-xs text-muted-foreground">Kombinera produkter — namn översätts automatiskt</p>
        </div>
        <Button size="sm" variant="outline" onClick={openNewForm} className="gap-1 h-7 text-xs">
          <Plus className="w-3 h-3" /> Nytt paket
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-primary/20">
              <CardContent className="pt-4 space-y-3">
                <p className="text-xs font-medium text-primary">{editingBundle ? '✏️ Redigera paket' : '➕ Nytt paket'}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Namn *</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Välkomstpaket" className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Rabatt % *</Label>
                    <Input type="number" step="0.5" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} placeholder="40" className="h-8" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Beskrivning</Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Perfekt startpaket för nya kunder" className="h-8" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Skriv på svenska — översätts automatiskt</p>
                </div>

                {/* Product selection */}
                <div>
                  <Label className="text-xs font-medium">Välj produkter *</Label>
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
                  {selectedProducts.length > 0 && form.discount_percent && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{selectedProducts.length} valda</Badge>
                      <span className="text-xs text-muted-foreground">
                        <span className="line-through">{selectedProducts.reduce((s, sp) => s + getProductPrice(sp.productId) * sp.quantity, 0)} kr</span>
                        {' → '}
                        <span className="font-bold text-primary">
                          {Math.round(selectedProducts.reduce((s, sp) => s + getProductPrice(sp.productId) * sp.quantity, 0) * (1 - parseFloat(form.discount_percent || '0') / 100))} kr
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Conditions */}
                <div className="border border-border rounded-lg p-3 space-y-3 bg-secondary/20">
                  <p className="text-xs font-semibold">⚙️ Villkor & Krav</p>
                  
                  {/* Requirement checkboxes - pick multiple */}
                  <div className="space-y-2">
                    <Label className="text-xs">Aktiva villkor (välj ett eller flera)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[
                        { key: 'requires_account', label: 'Kräver konto', desc: 'Kunden måste vara inloggad' },
                        { key: 'first_purchase', label: 'Första köpet-rabatt', desc: 'Högre rabatt vid första köp, lägre sedan' },
                        { key: 'level_required', label: 'Kräver level', desc: 'Kunden måste nå en viss level' },
                        { key: 'max_uses', label: 'Max antal per kund', desc: 'Begränsa hur många gånger kunden kan köpa' },
                      ].map(opt => {
                        const isActive = opt.key === 'requires_account' ? form.requires_account
                          : opt.key === 'first_purchase' ? form.requirement_type === 'first_purchase'
                          : opt.key === 'level_required' ? form.requirement_type === 'level_required'
                          : !!form.max_uses_per_user;
                        
                        const toggle = () => {
                          if (opt.key === 'requires_account') {
                            setForm(f => ({ ...f, requires_account: !f.requires_account }));
                          } else if (opt.key === 'first_purchase') {
                            setForm(f => ({ ...f, requirement_type: f.requirement_type === 'first_purchase' ? 'none' : 'first_purchase' }));
                          } else if (opt.key === 'level_required') {
                            setForm(f => ({ ...f, requirement_type: f.requirement_type === 'level_required' ? 'none' : 'level_required' }));
                          } else if (opt.key === 'max_uses') {
                            setForm(f => ({ ...f, max_uses_per_user: f.max_uses_per_user ? '' : '1' }));
                          }
                        };

                        return (
                          <div
                            key={opt.key}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${isActive ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-secondary/50'}`}
                            onClick={toggle}
                          >
                            <Switch checked={isActive} onCheckedChange={toggle} onClick={e => e.stopPropagation()} />
                            <div>
                              <p className="text-xs font-medium">{opt.label}</p>
                              <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Conditional fields */}
                  <AnimatePresence>
                    {form.requirement_type === 'first_purchase' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Första köpet %</Label>
                          <Input type="number" step="0.5" value={form.first_purchase_discount} onChange={e => setForm({ ...form, first_purchase_discount: e.target.value })} placeholder="40" className="h-8" />
                        </div>
                        <div>
                          <Label className="text-xs">Efterföljande %</Label>
                          <Input type="number" step="0.5" value={form.repeat_discount} onChange={e => setForm({ ...form, repeat_discount: e.target.value })} placeholder="20" className="h-8" />
                        </div>
                      </motion.div>
                    )}
                    {form.requirement_type === 'level_required' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <div className="w-32">
                          <Label className="text-xs">Minsta level</Label>
                          <Input type="number" value={form.min_level} onChange={e => setForm({ ...form, min_level: e.target.value })} placeholder="5" className="h-8" />
                        </div>
                      </motion.div>
                    )}
                    {form.max_uses_per_user && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        <div className="w-32">
                          <Label className="text-xs">Max köp per kund</Label>
                          <Input type="number" value={form.max_uses_per_user} onChange={e => setForm({ ...form, max_uses_per_user: e.target.value })} placeholder="1" className="h-8" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={saving || isTranslating} className="gap-1 h-7 text-xs">
                    {(saving || isTranslating) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {editingBundle ? 'Uppdatera' : 'Spara paket'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={closeForm} className="h-7 text-xs">Avbryt</Button>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{b.name}</p>
                    {!b.is_active && <Badge variant="outline" className="text-[9px]">Inaktiv</Badge>}
                    <Badge variant="secondary" className="text-[9px]">{items.length} produkter</Badge>
                    {b.requirement_type === 'first_purchase' && <Badge variant="outline" className="text-[9px]">Första köpet</Badge>}
                    {b.requirement_type === 'level_required' && <Badge variant="outline" className="text-[9px]">Level {b.min_level}+</Badge>}
                    {b.requires_account && <Badge variant="outline" className="text-[9px]">Kräver konto</Badge>}
                    {b.max_uses_per_user && <Badge variant="outline" className="text-[9px]">Max {b.max_uses_per_user}x</Badge>}
                  </div>
                  {items.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="line-through">{Math.round(prices.original)} kr</span> → <span className="font-semibold text-primary">{Math.round(prices.discounted)} kr</span>
                      {b.first_purchase_discount != null && <span className="ml-2">| 1:a: {b.first_purchase_discount}%</span>}
                      {b.repeat_discount != null && <span className="ml-1">| Sedan: {b.repeat_discount}%</span>}
                      <span className="inline-flex items-center gap-0.5 ml-2 text-[10px]"><Calendar className="w-3 h-3" />{fmtDate(b.created_at)}</span>
                    </p>
                  )}
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />{fmtDate(b.created_at)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(b)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
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
                          <span className="text-sm flex-1 truncate">{getProductName(item.product_id)}</span>
                          <span className="text-xs text-muted-foreground">{item.quantity}x {getProductPrice(item.product_id)} kr</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItemFromBundle(item.id)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      {items.length === 0 && <p className="text-xs text-muted-foreground">Inga produkter</p>}
                      <Select onValueChange={val => addProductToBundle(b.id, val)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Lägg till produkt..." /></SelectTrigger>
                        <SelectContent>
                          {allProducts.filter(p => !items.find(i => i.product_id === p.id)).map(p => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">{p.title_sv} — {p.price} kr</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {bundles.length === 0 && <p className="text-center text-muted-foreground text-xs py-8">Inga paket</p>}
      </div>
    </div>
  );
};

// ─── Sale / Rea Tab ───
const SalePricesTab = () => {
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [salePercent, setSalePercent] = useState(20);
  const [editPrice, setEditPrice] = useState('');
  const [editOriginal, setEditOriginal] = useState('');
  const [editExcludeFromCampaigns, setEditExcludeFromCampaigns] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('id, title_sv, price, original_price, is_visible, badge, tags').order('title_sv');
    if (data) setProducts(data as DbProduct[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const startQuickSale = (p: DbProduct) => {
    setEditingId(p.id);
    const origPrice = p.original_price || p.price;
    setEditOriginal(origPrice.toString());
    const newPrice = Math.round(origPrice * (1 - salePercent / 100));
    setEditPrice(newPrice.toString());
    setEditExcludeFromCampaigns(p.tags?.includes('exclude_campaigns') || false);
  };

  const updateSaleSlider = (pct: number, origPrice: number) => {
    setSalePercent(pct);
    setEditPrice(Math.round(origPrice * (1 - pct / 100)).toString());
  };

  const saveSale = async (id: string) => {
    const price = parseFloat(editPrice);
    const original = parseFloat(editOriginal);
    if (!price || price <= 0) { toast.error('Ogiltigt pris'); return; }
    if (original <= price) { toast.error('Ordinarie pris måste vara högre'); return; }

    const currentProduct = products.find(p => p.id === id);
    const currentTags = currentProduct?.tags || [];
    let newTags = currentTags.filter(t => t !== 'exclude_campaigns');
    if (editExcludeFromCampaigns) newTags.push('exclude_campaigns');

    const { error } = await supabase.from('products').update({
      price,
      original_price: original,
      badge: 'REA',
      tags: newTags,
    }).eq('id', id);

    if (error) { toast.error('Kunde inte spara'); return; }
    toast.success(`Rea satt: ${Math.round((1 - price / original) * 100)}% rabatt`);
    setEditingId(null);
    fetchProducts();
  };

  const clearSale = async (id: string) => {
    const product = products.find(p => p.id === id);
    const origPrice = product?.original_price || product?.price || 0;
    const currentTags = (product?.tags || []).filter(t => t !== 'exclude_campaigns');
    
    await supabase.from('products').update({
      price: origPrice,
      original_price: null,
      badge: null,
      tags: currentTags,
    }).eq('id', id);
    toast.success('Rea borttagen');
    fetchProducts();
  };

  const bulkSale = async (pct: number) => {
    if (!confirm(`Sätt ${pct}% rea på ALLA synliga produkter?`)) return;
    const visibleProducts = products.filter(p => p.is_visible && (!p.original_price || p.original_price <= p.price));
    for (const p of visibleProducts) {
      const newPrice = Math.round(p.price * (1 - pct / 100));
      await supabase.from('products').update({
        original_price: p.price,
        price: newPrice,
        badge: 'REA',
      }).eq('id', p.id);
    }
    toast.success(`${visibleProducts.length} produkter satta på ${pct}% rea`);
    fetchProducts();
  };

  const clearAllSales = async () => {
    if (!confirm('Ta bort rea från ALLA produkter?')) return;
    const onSaleProducts = products.filter(p => p.original_price && p.original_price > p.price);
    for (const p of onSaleProducts) {
      await supabase.from('products').update({
        price: p.original_price,
        original_price: null,
        badge: null,
      }).eq('id', p.id);
    }
    toast.success(`Rea borttagen från ${onSaleProducts.length} produkter`);
    fetchProducts();
  };

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const onSale = products.filter(p => p.original_price && p.original_price > p.price);
  const notOnSale = products.filter(p => !p.original_price || p.original_price <= p.price);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Rea & Kampanjpriser</h3>
          <p className="text-xs text-muted-foreground">Sätt rea med % — välj om produkten ingår i paket/kampanjer</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => bulkSale(20)} className="h-7 text-xs">Alla 20% rea</Button>
          {onSale.length > 0 && (
            <Button size="sm" variant="outline" onClick={clearAllSales} className="h-7 text-xs text-destructive hover:text-destructive">
              Rensa alla
            </Button>
          )}
        </div>
      </div>

      {/* Active sales */}
      {onSale.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-primary flex items-center gap-1"><Sparkles className="w-3 h-3" /> Aktiva rea ({onSale.length})</p>
          {onSale.map(p => {
            const pct = Math.round((1 - p.price / (p.original_price || p.price)) * 100);
            const excludedFromCampaigns = p.tags?.includes('exclude_campaigns');
            return (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-primary/20 bg-primary/5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{p.title_sv}</p>
                    {excludedFromCampaigns && <Badge variant="outline" className="text-[9px]">Ej i kampanjer</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs line-through text-muted-foreground">{p.original_price} kr</span>
                    <span className="text-xs font-bold text-primary">{p.price} kr</span>
                    <Badge variant="destructive" className="text-[9px]">-{pct}%</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startQuickSale(p)}>
                    <Pencil className="w-3 h-3 mr-1" /> Ändra
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => clearSale(p.id)}>
                    <X className="w-3 h-3 mr-1" /> Ta bort
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All products */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Alla produkter ({notOnSale.length})</p>
        {notOnSale.map(p => (
          <div key={p.id} className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 p-2.5">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.title_sv}</p>
                <p className="text-xs text-muted-foreground">{p.price} kr</p>
              </div>
              {editingId === p.id ? null : (
                <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => startQuickSale(p)}>
                  <Tag className="w-3 h-3 mr-1" /> Sätt rea
                </Button>
              )}
            </div>

            {/* Inline sale editor */}
            <AnimatePresence>
              {editingId === p.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="px-3 pb-3 space-y-3 border-t border-border pt-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Rabatt: {salePercent}%</Label>
                        <span className="text-xs font-bold text-primary">{editPrice} kr</span>
                      </div>
                      <Slider
                        value={[salePercent]}
                        onValueChange={([v]) => updateSaleSlider(v, parseFloat(editOriginal))}
                        min={5}
                        max={80}
                        step={5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>5%</span><span>25%</span><span>50%</span><span>80%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">Ordinarie</Label>
                        <Input type="number" value={editOriginal} onChange={e => { setEditOriginal(e.target.value); if (e.target.value) setEditPrice(Math.round(parseFloat(e.target.value) * (1 - salePercent / 100)).toString()); }} className="h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">Reapris</Label>
                        <Input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="h-7 text-xs" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch checked={!editExcludeFromCampaigns} onCheckedChange={v => setEditExcludeFromCampaigns(!v)} />
                      <span className="text-xs text-muted-foreground">Ingår i paket & kampanjer</span>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveSale(p.id)}><Save className="w-3 h-3" /> Spara</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
          <Sparkles className="w-3.5 h-3.5" /> Rea
        </TabsTrigger>
      </TabsList>

      <TabsContent value="volume"><VolumeDiscountsTab /></TabsContent>
      <TabsContent value="bundles"><BundlesTab /></TabsContent>
      <TabsContent value="sales"><SalePricesTab /></TabsContent>
    </Tabs>
  );
};

export default AdminCampaignsManager;
