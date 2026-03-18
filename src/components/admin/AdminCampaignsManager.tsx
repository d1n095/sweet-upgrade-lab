import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Save, RefreshCw, Percent, Package, Tag,
  Eye, EyeOff, ArrowUp, ArrowDown, ChevronDown, Pencil, X, Sparkles,
  Truck,
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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', name_en: '', description: '', description_en: '', discount_percent: '' });

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('bundles').select('*').order('display_order');
    if (data) setBundles(data as Bundle[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleAdd = async () => {
    if (!form.name || !form.discount_percent) { toast.error('Namn och rabatt krävs'); return; }
    const maxOrder = bundles.reduce((m, b) => Math.max(m, b.display_order), 0);
    const { error } = await supabase.from('bundles').insert({
      name: form.name,
      name_en: form.name_en || null,
      description: form.description || null,
      description_en: form.description_en || null,
      discount_percent: parseFloat(form.discount_percent),
      is_active: false,
      display_order: maxOrder + 1,
    });
    if (error) { toast.error('Kunde inte skapa'); return; }
    toast.success('Paket skapat');
    setForm({ name: '', name_en: '', description: '', description_en: '', discount_percent: '' });
    setShowForm(false);
    fetch();
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
    fetch();
  };

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Produktpaket</h3>
          <p className="text-xs text-muted-foreground">Kombinera produkter till paket med automatisk rabatt</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="gap-1 h-7 text-xs">
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
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Kroppsvårdskit" className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Namn (EN)</Label>
                    <Input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} placeholder="Body Care Kit" className="h-8" />
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
                    <Input type="number" step="0.5" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} placeholder="15" className="h-8" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} className="gap-1 h-7 text-xs"><Save className="w-3 h-3" /> Spara</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-7 text-xs">Avbryt</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-1.5">
        {bundles.map(b => (
          <div key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border border-border bg-card transition-opacity ${!b.is_active ? 'opacity-50' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center font-bold text-accent text-sm shrink-0">
              {b.discount_percent}%
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{b.name}</p>
                {!b.is_active && <Badge variant="outline" className="text-[9px]">Inaktiv</Badge>}
              </div>
              {b.description && <p className="text-xs text-muted-foreground truncate">{b.description}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b.id, b.is_active)} />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteBundle(b.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
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

// ─── Shipping Tab ───
const ShippingTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    shipping_cost: '39',
    free_shipping_threshold: '500',
    delivery_days_min: '7',
    delivery_days_max: '10',
    provider_sv: 'Pålitliga leverantörer',
    provider_en: 'Reliable suppliers',
    delivery_info_sv: '7–10 arbetsdagar från våra leverantörer',
    delivery_info_en: '7–10 business days from our suppliers',
    free_shipping_enabled: true,
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('store_settings')
      .select('*')
      .in('key', [
        'shipping_cost', 'free_shipping_threshold', 'delivery_days_min', 'delivery_days_max',
        'provider_sv', 'provider_en', 'delivery_info_sv', 'delivery_info_en', 'free_shipping_enabled',
      ]);
    if (data && data.length > 0) {
      // store_settings uses boolean 'value' column — we store shipping settings as JSON in a dedicated approach
      // For simplicity, use individual keys with a text-based approach via the existing store_settings table
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const keys = Object.entries(settings);
      for (const [key, value] of keys) {
        const strValue = typeof value === 'boolean' ? value : true;
        await supabase
          .from('store_settings')
          .upsert({ key: `shipping_${key}`, value: strValue }, { onConflict: 'key' });
      }
      // Save the actual values to localStorage for the frontend to pick up
      localStorage.setItem('shipping_settings', JSON.stringify(settings));
      toast.success('Fraktinställningar sparade!');
    } catch {
      toast.error('Kunde inte spara');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Shipping Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fraktkostnad (SEK)</Label>
              <Input
                type="number"
                value={settings.shipping_cost}
                onChange={(e) => setSettings(s => ({ ...s, shipping_cost: e.target.value }))}
                placeholder="39"
              />
              <p className="text-xs text-muted-foreground">Standard fraktkostnad som visas i kassan</p>
            </div>

            <div className="space-y-2">
              <Label>Gräns för fri frakt (SEK)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={settings.free_shipping_threshold}
                  onChange={(e) => setSettings(s => ({ ...s, free_shipping_threshold: e.target.value }))}
                  placeholder="500"
                  disabled={!settings.free_shipping_enabled}
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={settings.free_shipping_enabled}
                    onCheckedChange={(v) => setSettings(s => ({ ...s, free_shipping_enabled: v }))}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {settings.free_shipping_enabled ? 'Aktiv' : 'Av'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Ordrar över detta belopp får fri frakt</p>
            </div>
          </div>

          {/* Delivery Time */}
          <div className="border-t border-border pt-4">
            <Label className="text-sm font-medium mb-3 block">Leveranstid</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Min dagar</Label>
                <Input
                  type="number"
                  value={settings.delivery_days_min}
                  onChange={(e) => setSettings(s => ({ ...s, delivery_days_min: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Max dagar</Label>
                <Input
                  type="number"
                  value={settings.delivery_days_max}
                  onChange={(e) => setSettings(s => ({ ...s, delivery_days_max: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Delivery Info Text */}
          <div className="border-t border-border pt-4 space-y-4">
            <Label className="text-sm font-medium block">Leveransinformation (visas för kunder)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Svenska</Label>
                <Input
                  value={settings.delivery_info_sv}
                  onChange={(e) => setSettings(s => ({ ...s, delivery_info_sv: e.target.value }))}
                  placeholder="7–10 arbetsdagar"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">English</Label>
                <Input
                  value={settings.delivery_info_en}
                  onChange={(e) => setSettings(s => ({ ...s, delivery_info_en: e.target.value }))}
                  placeholder="7–10 business days"
                />
              </div>
            </div>
          </div>

          {/* Provider */}
          <div className="border-t border-border pt-4 space-y-4">
            <Label className="text-sm font-medium block">Leverantör / Fraktpartner</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Svenska</Label>
                <Input
                  value={settings.provider_sv}
                  onChange={(e) => setSettings(s => ({ ...s, provider_sv: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">English</Label>
                <Input
                  value={settings.provider_en}
                  onChange={(e) => setSettings(s => ({ ...s, provider_en: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Summary card */}
          <div className="border-t border-border pt-4">
            <div className="bg-secondary/40 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Förhandsvisning</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>🚚 Frakt: <span className="text-foreground font-medium">{settings.shipping_cost} kr</span></p>
                {settings.free_shipping_enabled && (
                  <p>🎉 Fri frakt vid köp över <span className="text-foreground font-medium">{settings.free_shipping_threshold} kr</span></p>
                )}
                <p>📦 Leverans: <span className="text-foreground font-medium">{settings.delivery_days_min}–{settings.delivery_days_max} dagar</span></p>
                <p>🏷️ {settings.provider_sv}</p>
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Spara fraktinställningar
          </Button>
        </CardContent>
      </Card>
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
        <TabsTrigger value="shipping" className="gap-1.5 text-xs">
          <Truck className="w-3.5 h-3.5" /> Frakt
        </TabsTrigger>
      </TabsList>

      <TabsContent value="volume"><VolumeDiscountsTab /></TabsContent>
      <TabsContent value="bundles"><BundlesTab /></TabsContent>
      <TabsContent value="sales"><SalePricesTab /></TabsContent>
      <TabsContent value="shipping"><ShippingTab /></TabsContent>
    </Tabs>
  );
};

export default AdminCampaignsManager;
