import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Trash2, Save, Truck, ExternalLink, Globe, Home, Zap,
  MapPin, Box, Check, X, Pencil, ChevronDown, ChevronUp, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logShippingChange } from '@/utils/activityLogger';

interface ShippingCarrier {
  id: string;
  name: string;
  website_url: string | null;
  pricing_url: string | null;
  tracking_url_template: string | null;
  is_selected: boolean;
  is_international: boolean;
  supports_pickup_points: boolean;
  supports_home_delivery: boolean;
  supports_express: boolean;
  supports_parcel_lockers: boolean;
  notes: string | null;
  display_order: number;
}

type FilterMode = 'all' | 'selected' | 'unselected' | 'international' | 'domestic';

const FEATURE_ICONS = [
  { key: 'supports_home_delivery', icon: Home, label: 'Hemleverans' },
  { key: 'supports_pickup_points', icon: MapPin, label: 'Ombud' },
  { key: 'supports_express', icon: Zap, label: 'Express' },
  { key: 'supports_parcel_lockers', icon: Box, label: 'Paketskåp' },
  { key: 'is_international', icon: Globe, label: 'Internationellt' },
] as const;

const CARRIER_PRESETS: Record<string, Omit<typeof EMPTY_FORM, 'notes'>> = {
  'PostNord': { name: 'PostNord', website_url: 'https://www.postnord.se', pricing_url: 'https://www.postnord.se/skicka-paket/priser', tracking_url_template: 'https://tracking.postnord.com/tracking.html?id={tracking_number}', is_international: true, supports_pickup_points: true, supports_home_delivery: true, supports_express: true, supports_parcel_lockers: true },
  'DHL': { name: 'DHL', website_url: 'https://www.dhl.se', pricing_url: 'https://www.dhl.se/sv/express/priser.html', tracking_url_template: 'https://www.dhl.com/se-sv/home/tracking.html?tracking-id={tracking_number}', is_international: true, supports_pickup_points: true, supports_home_delivery: true, supports_express: true, supports_parcel_lockers: false },
  'Bring': { name: 'Bring', website_url: 'https://www.bring.se', pricing_url: 'https://www.bring.se/skicka/priser', tracking_url_template: 'https://tracking.bring.se/tracking/{tracking_number}', is_international: true, supports_pickup_points: true, supports_home_delivery: true, supports_express: true, supports_parcel_lockers: false },
  'Schenker': { name: 'DB Schenker', website_url: 'https://www.dbschenker.com/se-sv', pricing_url: 'https://www.dbschenker.com/se-sv', tracking_url_template: 'https://eschenker.dbschenker.com/app/tracking?refNumber={tracking_number}', is_international: true, supports_pickup_points: true, supports_home_delivery: true, supports_express: false, supports_parcel_lockers: false },
  'Budbee': { name: 'Budbee', website_url: 'https://www.budbee.com', pricing_url: 'https://www.budbee.com', tracking_url_template: 'https://tracking.budbee.com/{tracking_number}', is_international: false, supports_pickup_points: false, supports_home_delivery: true, supports_express: true, supports_parcel_lockers: true },
  'Instabox': { name: 'Instabox', website_url: 'https://www.instabox.se', pricing_url: 'https://www.instabox.se', tracking_url_template: 'https://www.instabox.se/tracking/{tracking_number}', is_international: false, supports_pickup_points: false, supports_home_delivery: true, supports_express: true, supports_parcel_lockers: true },
  'UPS': { name: 'UPS', website_url: 'https://www.ups.com/se', pricing_url: 'https://www.ups.com/se/sv/shipping/rates.page', tracking_url_template: 'https://www.ups.com/track?tracknum={tracking_number}', is_international: true, supports_pickup_points: true, supports_home_delivery: true, supports_express: true, supports_parcel_lockers: false },
  'FedEx': { name: 'FedEx', website_url: 'https://www.fedex.com/sv-se', pricing_url: 'https://www.fedex.com/sv-se/shipping/rates.html', tracking_url_template: 'https://www.fedex.com/fedextrack/?trknbr={tracking_number}', is_international: true, supports_pickup_points: false, supports_home_delivery: true, supports_express: true, supports_parcel_lockers: false },
  'Best Transport': { name: 'Best Transport', website_url: 'https://www.besttransport.se', pricing_url: 'https://www.besttransport.se', tracking_url_template: '', is_international: false, supports_pickup_points: false, supports_home_delivery: true, supports_express: true, supports_parcel_lockers: false },
  'Early Bird': { name: 'Early Bird', website_url: 'https://www.earlybirddelivery.se', pricing_url: 'https://www.earlybirddelivery.se', tracking_url_template: '', is_international: false, supports_pickup_points: false, supports_home_delivery: true, supports_express: true, supports_parcel_lockers: false },
};

const EMPTY_FORM = { name: '', website_url: '', pricing_url: '', tracking_url_template: '', is_international: false, supports_pickup_points: false, supports_home_delivery: true, supports_express: false, supports_parcel_lockers: false, notes: '' };

const ShippingCarriersSection = () => {
  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShippingCarrier | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const [form, setForm] = useState({ ...EMPTY_FORM });

  const fetchCarriers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shipping_carriers')
      .select('*')
      .order('is_selected', { ascending: false })
      .order('display_order');
    if (data) setCarriers(data as ShippingCarrier[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCarriers(); }, [fetchCarriers]);

  const filtered = useMemo(() => {
    let result = carriers;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }
    switch (filter) {
      case 'selected': result = result.filter(c => c.is_selected); break;
      case 'unselected': result = result.filter(c => !c.is_selected); break;
      case 'international': result = result.filter(c => c.is_international); break;
      case 'domestic': result = result.filter(c => !c.is_international); break;
    }
    return result;
  }, [carriers, search, filter]);

  const selectedCount = carriers.filter(c => c.is_selected).length;

  const toggleSelected = async (carrier: ShippingCarrier) => {
    // Optimistic update
    setCarriers(prev => prev.map(c => c.id === carrier.id ? { ...c, is_selected: !c.is_selected } : c));
    const { error } = await supabase.from('shipping_carriers').update({ is_selected: !carrier.is_selected, updated_at: new Date().toISOString() }).eq('id', carrier.id);
    if (error) {
      // Revert on error
      setCarriers(prev => prev.map(c => c.id === carrier.id ? { ...c, is_selected: carrier.is_selected } : c));
      toast.error('Kunde inte uppdatera');
    }
    logShippingChange(`Fraktbolag ${!carrier.is_selected ? 'valt' : 'avvalt'}: ${carrier.name}`);
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setShowPresets(false);
  };

  const openAdd = () => { resetForm(); setShowPresets(true); setIsFormOpen(true); };

  const selectPreset = (key: string) => {
    const preset = CARRIER_PRESETS[key];
    if (preset) setForm({ ...preset, notes: '' });
    setShowPresets(false);
  };

  const openEdit = (c: ShippingCarrier) => {
    setEditing(c);
    setForm({
      name: c.name, website_url: c.website_url || '', pricing_url: c.pricing_url || '',
      tracking_url_template: c.tracking_url_template || '', is_international: c.is_international,
      supports_pickup_points: c.supports_pickup_points, supports_home_delivery: c.supports_home_delivery,
      supports_express: c.supports_express, supports_parcel_lockers: c.supports_parcel_lockers,
      notes: '',
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Ange ett namn'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        website_url: form.website_url.trim() || null,
        pricing_url: form.pricing_url.trim() || null,
        tracking_url_template: form.tracking_url_template.trim() || null,
        is_international: form.is_international,
        supports_pickup_points: form.supports_pickup_points,
        supports_home_delivery: form.supports_home_delivery,
        supports_express: form.supports_express,
        supports_parcel_lockers: form.supports_parcel_lockers,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await supabase.from('shipping_carriers').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
        toast.success('Fraktbolag uppdaterat!');
        logShippingChange(`Fraktbolag uppdaterat: ${form.name}`);
      } else {
        await supabase.from('shipping_carriers').insert({ ...payload, display_order: carriers.length });
        toast.success('Fraktbolag tillagt!');
        logShippingChange(`Fraktbolag tillagt: ${form.name}`);
      }
      setIsFormOpen(false);
      resetForm();
      fetchCarriers();
    } catch { toast.error('Något gick fel'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const carrier = carriers.find(c => c.id === id);
    await supabase.from('shipping_carriers').delete().eq('id', id);
    toast.success('Fraktbolag borttaget');
    if (carrier) logShippingChange(`Fraktbolag borttaget: ${carrier.name}`);
    fetchCarriers();
  };

  const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
    { value: 'all', label: 'Alla' },
    { value: 'selected', label: 'Valda' },
    { value: 'unselected', label: 'Ej valda' },
    { value: 'international', label: 'Internationella' },
    { value: 'domestic', label: 'Inrikes' },
  ];

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Truck className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Fraktbolag</h3>
              <p className="text-xs text-muted-foreground">
                {selectedCount} av {carriers.length} valda
              </p>
            </div>
          </div>
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="w-4 h-4" /> Lägg till
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Sök fraktbolag..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  filter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Carrier List */}
        {loading ? (
          <div className="flex justify-center py-6">
            <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Inga fraktbolag matchar sökningen</p>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
            <AnimatePresence>
              {filtered.map(carrier => {
                const isExpanded = expandedId === carrier.id;
                return (
                  <motion.div
                    key={carrier.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`rounded-lg border transition-all ${
                      carrier.is_selected
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2 p-2.5">
                      <Checkbox
                        checked={carrier.is_selected}
                        onCheckedChange={() => toggleSelected(carrier)}
                        className="shrink-0"
                      />
                      <button
                        type="button"
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        onClick={() => setExpandedId(isExpanded ? null : carrier.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-medium truncate ${carrier.is_selected ? 'text-primary' : ''}`}>
                              {carrier.name}
                            </p>
                            {carrier.is_international && (
                              <Globe className="w-3 h-3 text-primary shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {FEATURE_ICONS.filter(f => carrier[f.key as keyof ShippingCarrier] === true && f.key !== 'is_international').map(f => (
                              <span key={f.key} className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <f.icon className="w-2.5 h-2.5" /> {f.label}
                              </span>
                            ))}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      </button>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {carrier.pricing_url && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                            <a href={carrier.pricing_url} target="_blank" rel="noopener noreferrer" title="Se priser">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(carrier)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-2.5 pb-2.5 border-t border-border/50 pt-2 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {FEATURE_ICONS.map(f => (
                            <div key={f.key} className="flex items-center gap-1.5">
                              <f.icon className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{f.label}:</span>
                          {carrier[f.key as keyof ShippingCarrier] ? (
                                <Check className="w-3 h-3 text-primary" />
                              ) : (
                                <X className="w-3 h-3 text-destructive" />
                              )}
                            </div>
                          ))}
                        </div>
                        {carrier.notes && (
                          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">{carrier.notes}</p>
                        )}
                        <div className="flex items-center gap-2">
                          {carrier.website_url && (
                            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" asChild>
                              <a href={carrier.website_url} target="_blank" rel="noopener noreferrer">
                                <Globe className="w-3 h-3" /> Hemsida
                              </a>
                            </Button>
                          )}
                          {carrier.pricing_url && (
                            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" asChild>
                              <a href={carrier.pricing_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-3 h-3" /> Priser
                              </a>
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-destructive ml-auto" onClick={() => handleDelete(carrier.id)}>
                            <Trash2 className="w-3 h-3" /> Ta bort
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={o => { setIsFormOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Redigera fraktbolag' : 'Lägg till fraktbolag'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Namn *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="PostNord" />
            </div>
            <div className="space-y-2">
              <Label>Hemsida</Label>
              <Input value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} placeholder="https://www.postnord.se" />
            </div>
            <div className="space-y-2">
              <Label>Prissida</Label>
              <Input value={form.pricing_url} onChange={e => setForm(f => ({ ...f, pricing_url: e.target.value }))} placeholder="https://www.postnord.se/priser" />
            </div>
            <div className="space-y-2">
              <Label>Spårnings-URL mall</Label>
              <Input value={form.tracking_url_template} onChange={e => setForm(f => ({ ...f, tracking_url_template: e.target.value }))} placeholder="https://tracking.postnord.com/?id={tracking_number}" />
              <p className="text-xs text-muted-foreground">Använd {'{tracking_number}'} som platshållare</p>
            </div>

            <div className="border-t border-border pt-3 space-y-3">
              <Label className="text-sm font-medium">Tjänster</Label>
              {([
                { key: 'is_international', label: 'Internationell frakt' },
                { key: 'supports_home_delivery', label: 'Hemleverans' },
                { key: 'supports_pickup_points', label: 'Ombudsutlämning' },
                { key: 'supports_express', label: 'Expressfrakt' },
                { key: 'supports_parcel_lockers', label: 'Paketskåp / Boxar' },
              ] as const).map(service => (
                <div key={service.key} className="flex items-center justify-between">
                  <Label className="text-sm">{service.label}</Label>
                  <Switch
                    checked={form[service.key]}
                    onCheckedChange={v => setForm(f => ({ ...f, [service.key]: v }))}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Anteckningar</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Särskilda villkor, kontaktperson..." rows={2} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setIsFormOpen(false); resetForm(); }}>Avbryt</Button>
              <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={saving || !form.name.trim()}>
                <Save className="w-4 h-4" /> {editing ? 'Uppdatera' : 'Spara'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ShippingCarriersSection;
