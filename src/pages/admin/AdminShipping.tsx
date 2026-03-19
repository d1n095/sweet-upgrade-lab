import { useState, useEffect, useCallback } from 'react';
import {
  Truck, Package, Globe, MapPin, Home, Zap, Box, Gift, Scale,
  Plus, Save, Pencil, Trash2, RefreshCw, Eye, EyeOff, ArrowUp, ArrowDown, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ShippingCarriersSection from '@/components/admin/ShippingCarriersSection';
import { logShippingChange } from '@/utils/activityLogger';


// ─── Shipping Extras ───
interface ShippingExtra {
  id: string;
  title_sv: string;
  title_en: string | null;
  description_sv: string | null;
  description_en: string | null;
  icon: string | null;
  is_active: boolean;
  display_order: number;
}

const ICON_OPTIONS = [
  { value: 'gift', label: '🎁 Gåva' },
  { value: 'heart', label: '❤️ Hjärta' },
  { value: 'leaf', label: '🌿 Löv' },
  { value: 'star', label: '⭐ Stjärna' },
  { value: 'sparkles', label: '✨ Glitter' },
  { value: 'shield', label: '🛡️ Sköld' },
  { value: 'ribbon', label: '🎀 Rosett' },
  { value: 'box', label: '📦 Paket' },
  { value: 'card', label: '💌 Kort' },
  { value: 'sample', label: '🧪 Prov' },
];

interface ShippingCarrier {
  id: string;
  name: string;
  is_selected: boolean;
  is_international: boolean;
  supports_pickup_points: boolean;
  supports_home_delivery: boolean;
  supports_express: boolean;
  supports_parcel_lockers: boolean;
}

const AdminShipping = () => {
  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [extras, setExtras] = useState<ShippingExtra[]>([]);
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
    // Weight-based shipping
    shipping_weight_enabled: false,
    shipping_tier_1_max_grams: '1000',
    shipping_tier_1_price: '49',
    shipping_tier_2_max_grams: '5000',
    shipping_tier_2_price: '79',
    shipping_tier_3_price: '129',
    shipping_price_per_kg: '15',
    shipping_max_weight_grams: '30000',
    shipping_fallback_price: '99',
  });

  useEffect(() => {
    const load = async () => {
      const [{ data: c }, { data: e }, { data: s }] = await Promise.all([
        supabase.from('shipping_carriers').select('id, name, is_selected, is_international, supports_pickup_points, supports_home_delivery, supports_express, supports_parcel_lockers'),
        supabase.from('shipping_extras').select('*').order('display_order'),
        supabase.from('store_settings').select('key, text_value').in('key', [
          'shipping_cost', 'free_shipping_threshold',
          'shipping_weight_enabled', 'shipping_tier_1_max_grams', 'shipping_tier_1_price',
          'shipping_tier_2_max_grams', 'shipping_tier_2_price', 'shipping_tier_3_price',
          'shipping_price_per_kg', 'shipping_max_weight_grams', 'shipping_fallback_price',
        ]),
      ]);
      setCarriers((c || []) as ShippingCarrier[]);
      setExtras((e || []) as ShippingExtra[]);
      if (s) {
        const map = Object.fromEntries(s.map(r => [r.key, r.text_value]));
        setSettings(prev => ({
          ...prev,
          shipping_cost: map['shipping_cost'] || prev.shipping_cost,
          free_shipping_threshold: map['free_shipping_threshold'] || prev.free_shipping_threshold,
        }));
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    await Promise.all([
      supabase.from('store_settings').upsert(
        { key: 'shipping_cost', value: true, text_value: settings.shipping_cost, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      ),
      supabase.from('store_settings').upsert(
        { key: 'free_shipping_threshold', value: true, text_value: settings.free_shipping_threshold, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      ),
    ]);
    logShippingChange('Fraktinställningar uppdaterade', settings);
    toast.success('Fraktinställningar sparade!');
    setSaving(false);
  };

  const selectedCarriers = carriers.filter(c => c.is_selected);
  const internationalCarriers = carriers.filter(c => c.is_international && c.is_selected);
  const activeExtras = extras.filter(e => e.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Frakt & Leverans</h1>
        <p className="text-muted-foreground text-sm mt-1">Fraktbolag, leveransinställningar och extras</p>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Truck className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{loading ? '–' : selectedCarriers.length}</p>
            <p className="text-xs text-muted-foreground">Aktiva fraktbolag</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{loading ? '–' : internationalCarriers.length}</p>
            <p className="text-xs text-muted-foreground">Internationella</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-pink-500" />
            </div>
            <p className="text-2xl font-bold">{loading ? '–' : activeExtras.length}</p>
            <p className="text-xs text-muted-foreground">Aktiva extras</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{settings.shipping_cost} kr</p>
            <p className="text-xs text-muted-foreground">Fraktkostnad</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{settings.free_shipping_enabled ? `${settings.free_shipping_threshold} kr` : 'Av'}</p>
            <p className="text-xs text-muted-foreground">Fri frakt-gräns</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="carriers" className="space-y-4">
        <ScrollableTabs>
          <TabsList className="h-9 w-max">
            <TabsTrigger value="carriers" className="gap-1.5 text-xs">
              <Truck className="w-3.5 h-3.5" /> Fraktbolag
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-xs">
              <Package className="w-3.5 h-3.5" /> Inställningar
            </TabsTrigger>
            <TabsTrigger value="extras" className="gap-1.5 text-xs">
              <Gift className="w-3.5 h-3.5" /> Vi skickar med
            </TabsTrigger>
          </TabsList>
        </ScrollableTabs>

        <TabsContent value="carriers">
          <ShippingCarriersSection />
        </TabsContent>

        <TabsContent value="settings">
          <ShippingSettingsTab
            settings={settings}
            setSettings={setSettings}
            saving={saving}
            onSave={handleSaveSettings}
          />
        </TabsContent>

        <TabsContent value="extras">
          <ShippingExtrasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ─── Shipping Settings Tab ───
const ShippingSettingsTab = ({
  settings,
  setSettings,
  saving,
  onSave,
}: {
  settings: any;
  setSettings: (fn: (s: any) => any) => void;
  saving: boolean;
  onSave: () => void;
}) => (
  <Card>
    <CardContent className="pt-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fraktkostnad (SEK)</Label>
          <Input type="number" value={settings.shipping_cost} onChange={e => setSettings(s => ({ ...s, shipping_cost: e.target.value }))} placeholder="39" />
          <p className="text-xs text-muted-foreground">Standard fraktkostnad</p>
        </div>
        <div className="space-y-2">
          <Label>Gräns för fri frakt (SEK)</Label>
          <div className="flex items-center gap-3">
            <Input type="number" value={settings.free_shipping_threshold} onChange={e => setSettings(s => ({ ...s, free_shipping_threshold: e.target.value }))} disabled={!settings.free_shipping_enabled} className="flex-1" />
            <div className="flex items-center gap-2">
              <Switch checked={settings.free_shipping_enabled} onCheckedChange={v => setSettings(s => ({ ...s, free_shipping_enabled: v }))} />
              <span className="text-xs text-muted-foreground">{settings.free_shipping_enabled ? 'Aktiv' : 'Av'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <Label className="text-sm font-medium mb-3 block">Leveranstid</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Min dagar</Label>
            <Input type="number" value={settings.delivery_days_min} onChange={e => setSettings(s => ({ ...s, delivery_days_min: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Max dagar</Label>
            <Input type="number" value={settings.delivery_days_max} onChange={e => setSettings(s => ({ ...s, delivery_days_max: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-4">
        <Label className="text-sm font-medium block">Leveransinformation</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Svenska</Label>
            <Input value={settings.delivery_info_sv} onChange={e => setSettings(s => ({ ...s, delivery_info_sv: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">English</Label>
            <Input value={settings.delivery_info_en} onChange={e => setSettings(s => ({ ...s, delivery_info_en: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-4">
        <Label className="text-sm font-medium block">Leverantör / Fraktpartner</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Svenska</Label>
            <Input value={settings.provider_sv} onChange={e => setSettings(s => ({ ...s, provider_sv: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">English</Label>
            <Input value={settings.provider_en} onChange={e => setSettings(s => ({ ...s, provider_en: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="bg-secondary/40 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">Förhandsvisning</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>🚚 Frakt: <span className="text-foreground font-medium">{settings.shipping_cost} kr</span></p>
            {settings.free_shipping_enabled && <p>🎉 Fri frakt vid köp över <span className="text-foreground font-medium">{settings.free_shipping_threshold} kr</span></p>}
            <p>📦 Leverans: <span className="text-foreground font-medium">{settings.delivery_days_min}–{settings.delivery_days_max} dagar</span></p>
            <p>🏷️ {settings.provider_sv}</p>
          </div>
        </div>
      </div>

      <Button onClick={onSave} disabled={saving} className="gap-2">
        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Spara fraktinställningar
      </Button>
    </CardContent>
  </Card>
);

// ─── Shipping Extras Tab ───
const ShippingExtrasTab = () => {
  const [extras, setExtras] = useState<ShippingExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    title_sv: '', title_en: '', description_sv: '', description_en: '', icon: 'gift', is_active: true,
  });

  const fetchExtras = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('shipping_extras').select('*').order('display_order');
    if (data) setExtras(data as ShippingExtra[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchExtras(); }, [fetchExtras]);

  const resetForm = () => {
    setForm({ title_sv: '', title_en: '', description_sv: '', description_en: '', icon: 'gift', is_active: true });
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (item: ShippingExtra) => {
    setForm({
      title_sv: item.title_sv,
      title_en: item.title_en || '',
      description_sv: item.description_sv || '',
      description_en: item.description_en || '',
      icon: item.icon || 'gift',
      is_active: item.is_active,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title_sv.trim()) { toast.error('Ange en titel'); return; }
    if (editingId) {
      await supabase.from('shipping_extras').update({
        title_sv: form.title_sv.trim(),
        title_en: form.title_en.trim() || null,
        description_sv: form.description_sv.trim() || null,
        description_en: form.description_en.trim() || null,
        icon: form.icon,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      }).eq('id', editingId);
      logShippingChange(`Shipping extra uppdaterad: ${form.title_sv}`);
      toast.success('Uppdaterad!');
    } else {
      await supabase.from('shipping_extras').insert({
        title_sv: form.title_sv.trim(),
        title_en: form.title_en.trim() || null,
        description_sv: form.description_sv.trim() || null,
        description_en: form.description_en.trim() || null,
        icon: form.icon,
        is_active: form.is_active,
        display_order: extras.length,
      });
      logShippingChange(`Shipping extra tillagd: ${form.title_sv}`);
      toast.success('Tillagd!');
    }
    resetForm();
    fetchExtras();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Ta bort?')) return;
    const item = extras.find(e => e.id === id);
    await supabase.from('shipping_extras').delete().eq('id', id);
    if (editingId === id) resetForm();
    logShippingChange(`Shipping extra borttagen: ${item?.title_sv}`);
    toast.success('Borttagen');
    fetchExtras();
  };

  const toggleActive = async (item: ShippingExtra) => {
    await supabase.from('shipping_extras').update({ is_active: !item.is_active }).eq('id', item.id);
    fetchExtras();
  };

  const moveItem = async (id: string, dir: 'up' | 'down') => {
    const idx = extras.findIndex(e => e.id === id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= extras.length) return;
    const a = extras[idx], b = extras[swapIdx];
    await Promise.all([
      supabase.from('shipping_extras').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('shipping_extras').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    fetchExtras();
  };

  const iconEmoji = (icon: string) => ICON_OPTIONS.find(o => o.value === icon)?.label.split(' ')[0] || '🎁';
  const filtered = search.trim()
    ? extras.filter(e => e.title_sv.toLowerCase().includes(search.toLowerCase()))
    : extras;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />
          <div>
            <h4 className="font-semibold text-sm">Vi skickar med</h4>
            <p className="text-xs text-muted-foreground">Extras som ingår vid frakt</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(true); }} className="gap-1 h-7 text-xs">
          <Plus className="w-3 h-3" /> Lägg till
        </Button>
      </div>

      {extras.length > 3 && (
        <Input placeholder="Sök bland extras..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs" />
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-primary/20">
              <CardContent className="pt-4 space-y-3">
                <p className="text-xs font-medium text-primary">{editingId ? '✏️ Redigera' : '➕ Ny extra'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Titel (sv) *</Label><Input value={form.title_sv} onChange={e => setForm(f => ({ ...f, title_sv: e.target.value }))} className="h-8" /></div>
                  <div><Label className="text-xs">Title (en)</Label><Input value={form.title_en} onChange={e => setForm(f => ({ ...f, title_en: e.target.value }))} className="h-8" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Beskrivning (sv)</Label><Input value={form.description_sv} onChange={e => setForm(f => ({ ...f, description_sv: e.target.value }))} className="h-8" /></div>
                  <div><Label className="text-xs">Description (en)</Label><Input value={form.description_en} onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))} className="h-8" /></div>
                </div>
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <Label className="text-xs">Ikon</Label>
                    <Select value={form.icon} onValueChange={v => setForm(f => ({ ...f, icon: v }))}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{ICON_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 h-8">
                    <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                    <span className="text-xs text-muted-foreground">{form.is_active ? 'Aktiv' : 'Inaktiv'}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleSave} disabled={!form.title_sv.trim()} className="gap-1 h-7 text-xs"><Save className="w-3 h-3" /> {editingId ? 'Uppdatera' : 'Spara'}</Button>
                  <Button size="sm" variant="outline" onClick={resetForm} className="h-7 text-xs">Avbryt</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-6"><RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-xs">
          <Gift className="w-8 h-8 mx-auto mb-2 opacity-30" />
          {search ? 'Inga träffar' : 'Inga extras ännu'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((item, idx) => (
            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${editingId === item.id ? 'border-primary/40 bg-primary/5' : item.is_active ? 'border-border bg-card' : 'border-border bg-muted/30 opacity-60'}`}>
              <span className="text-lg shrink-0">{iconEmoji(item.icon || 'gift')}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.title_sv}</p>
                {item.description_sv && <p className="text-xs text-muted-foreground truncate">{item.description_sv}</p>}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(item.id, 'up')} disabled={idx === 0}><ArrowUp className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(item.id, 'down')} disabled={idx === filtered.length - 1}><ArrowDown className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(item)}>{item.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminShipping;
