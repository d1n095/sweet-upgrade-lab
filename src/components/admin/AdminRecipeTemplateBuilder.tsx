import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Save, ChefHat, Pencil, GripVertical, ArrowUp, ArrowDown,
  Eye, EyeOff, Layers, X, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logRecipeChange } from '@/utils/activityLogger';

interface RecipeTemplate {
  id: string;
  name_sv: string;
  name_en: string | null;
  description_sv: string | null;
  description_en: string | null;
  is_active: boolean;
  display_order: number;
}

interface RecipeSlot {
  id: string;
  template_id: string;
  label_sv: string;
  label_en: string | null;
  slot_type: 'choice' | 'fixed';
  ingredient_category: string | null;
  fixed_ingredient_id: string | null;
  is_required: boolean;
  allow_multiple: boolean;
  display_order: number;
}

interface IngredientOption {
  id: string;
  name_sv: string;
  category: string;
}

const AdminRecipeTemplateBuilder = () => {
  const [templates, setTemplates] = useState<RecipeTemplate[]>([]);
  const [slots, setSlots] = useState<Record<string, RecipeSlot[]>>({});
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Template form
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecipeTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name_sv: '', name_en: '', description_sv: '', description_en: '', is_active: true,
  });

  // Slot form
  const [isSlotFormOpen, setIsSlotFormOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<RecipeSlot | null>(null);
  const [slotForm, setSlotForm] = useState({
    label_sv: '', label_en: '', slot_type: 'choice' as 'choice' | 'fixed',
    ingredient_category: '', fixed_ingredient_id: '', is_required: true, allow_multiple: false,
  });

  const [saving, setSaving] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [tRes, sRes, iRes] = await Promise.all([
      supabase.from('recipe_templates').select('*').order('display_order'),
      supabase.from('recipe_template_slots').select('*').order('display_order'),
      supabase.from('recipe_ingredients').select('id, name_sv, category').eq('is_active', true).order('category').order('display_order'),
    ]);

    if (tRes.data) setTemplates(tRes.data as RecipeTemplate[]);
    if (sRes.data) {
      const grouped: Record<string, RecipeSlot[]> = {};
      (sRes.data as RecipeSlot[]).forEach(s => {
        (grouped[s.template_id] = grouped[s.template_id] || []).push(s);
      });
      setSlots(grouped);
    }
    if (iRes.data) {
      setIngredients(iRes.data as IngredientOption[]);
      setCategories([...new Set((iRes.data as IngredientOption[]).map(i => i.category))].sort());
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Template CRUD ──
  const resetTemplateForm = () => {
    setTemplateForm({ name_sv: '', name_en: '', description_sv: '', description_en: '', is_active: true });
    setEditingTemplate(null);
  };

  const openAddTemplate = () => { resetTemplateForm(); setIsTemplateFormOpen(true); };

  const openEditTemplate = (t: RecipeTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({
      name_sv: t.name_sv, name_en: t.name_en || '', description_sv: t.description_sv || '',
      description_en: t.description_en || '', is_active: t.is_active,
    });
    setIsTemplateFormOpen(true);
  };

  const saveTemplate = async () => {
    if (!templateForm.name_sv.trim()) { toast.error('Ange ett namn'); return; }
    setSaving(true);
    try {
      const payload = {
        name_sv: templateForm.name_sv.trim(),
        name_en: templateForm.name_en.trim() || null,
        description_sv: templateForm.description_sv.trim() || null,
        description_en: templateForm.description_en.trim() || null,
        is_active: templateForm.is_active,
      };
      if (editingTemplate) {
        await supabase.from('recipe_templates').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingTemplate.id);
        toast.success('Receptmall uppdaterad!');
        logRecipeChange('updated', templateForm.name_sv);
      } else {
        await supabase.from('recipe_templates').insert({ ...payload, display_order: templates.length });
        toast.success('Receptmall skapad!');
        logRecipeChange('created', templateForm.name_sv);
      }
      }
      setIsTemplateFormOpen(false);
      resetTemplateForm();
      fetchAll();
    } catch { toast.error('Något gick fel'); }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    const tmpl = templates.find(t => t.id === id);
    await supabase.from('recipe_templates').delete().eq('id', id);
    toast.success('Receptmall borttagen');
    if (tmpl) logRecipeChange('deleted', tmpl.name_sv);
    fetchAll();
  };

  // ── Slot CRUD ──
  const resetSlotForm = () => {
    setSlotForm({ label_sv: '', label_en: '', slot_type: 'choice', ingredient_category: '', fixed_ingredient_id: '', is_required: true, allow_multiple: false });
    setEditingSlot(null);
  };

  const openAddSlot = (templateId: string) => {
    resetSlotForm();
    setActiveTemplateId(templateId);
    setIsSlotFormOpen(true);
  };

  const openEditSlot = (slot: RecipeSlot) => {
    setEditingSlot(slot);
    setActiveTemplateId(slot.template_id);
    setSlotForm({
      label_sv: slot.label_sv, label_en: slot.label_en || '',
      slot_type: slot.slot_type,
      ingredient_category: slot.ingredient_category || '',
      fixed_ingredient_id: slot.fixed_ingredient_id || '',
      is_required: slot.is_required, allow_multiple: slot.allow_multiple,
    });
    setIsSlotFormOpen(true);
  };

  const saveSlot = async () => {
    if (!slotForm.label_sv.trim() || !activeTemplateId) { toast.error('Ange ett namn'); return; }
    setSaving(true);
    try {
      const payload = {
        template_id: activeTemplateId,
        label_sv: slotForm.label_sv.trim(),
        label_en: slotForm.label_en.trim() || null,
        slot_type: slotForm.slot_type,
        ingredient_category: slotForm.slot_type === 'choice' ? (slotForm.ingredient_category || null) : null,
        fixed_ingredient_id: slotForm.slot_type === 'fixed' ? (slotForm.fixed_ingredient_id || null) : null,
        is_required: slotForm.is_required,
        allow_multiple: slotForm.slot_type === 'choice' ? slotForm.allow_multiple : false,
      };
      if (editingSlot) {
        await supabase.from('recipe_template_slots').update(payload).eq('id', editingSlot.id);
        toast.success('Slot uppdaterad!');
      } else {
        const currentSlots = slots[activeTemplateId] || [];
        await supabase.from('recipe_template_slots').insert({ ...payload, display_order: currentSlots.length });
        toast.success('Slot tillagd!');
      }
      setIsSlotFormOpen(false);
      resetSlotForm();
      fetchAll();
    } catch { toast.error('Något gick fel'); }
    setSaving(false);
  };

  const deleteSlot = async (id: string) => {
    await supabase.from('recipe_template_slots').delete().eq('id', id);
    toast.success('Slot borttagen');
    fetchAll();
  };

  const moveSlot = async (templateId: string, index: number, dir: -1 | 1) => {
    const arr = [...(slots[templateId] || [])];
    const ni = index + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[index], arr[ni]] = [arr[ni], arr[index]];
    await Promise.all(arr.map((s, i) =>
      supabase.from('recipe_template_slots').update({ display_order: i }).eq('id', s.id)
    ));
    fetchAll();
  };

  const getIngredientName = (id: string) => ingredients.find(i => i.id === id)?.name_sv || '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Receptmallar</h3>
            <p className="text-sm text-muted-foreground">
              Bygg receptstrukturer som kan väljas vid produktredigering
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openAddTemplate} className="gap-1.5">
          <Plus className="w-4 h-4" /> Ny receptmall
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            <ChefHat className="w-10 h-10 mx-auto mb-2 opacity-30" />
            Inga receptmallar ännu. Klicka "Ny receptmall" för att börja.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          <AnimatePresence>
            {templates.map(tmpl => {
              const tmplSlots = slots[tmpl.id] || [];
              const isExpanded = expandedTemplate === tmpl.id;
              return (
                <motion.div
                  key={tmpl.id}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  <Card className={`transition-colors ${!tmpl.is_active ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="flex items-center gap-2 flex-1 text-left"
                          onClick={() => setExpandedTemplate(isExpanded ? null : tmpl.id)}
                        >
                          <Layers className="w-4 h-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{tmpl.name_sv}</p>
                            {tmpl.description_sv && (
                              <p className="text-xs text-muted-foreground truncate">{tmpl.description_sv}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0 ml-1">
                            {tmplSlots.length} steg
                          </Badge>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTemplate(tmpl)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTemplate(tmpl.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded slots */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          {tmplSlots.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">Inga steg ännu</p>
                          ) : (
                            tmplSlots.map((slot, idx) => (
                              <div
                                key={slot.id}
                                className="flex items-center gap-2 p-2 rounded-md bg-secondary/30 border border-border/50"
                              >
                                <div className="flex flex-col gap-0.5 shrink-0">
                                  <button type="button" onClick={() => moveSlot(tmpl.id, idx, -1)} disabled={idx === 0}
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button type="button" onClick={() => moveSlot(tmpl.id, idx, 1)} disabled={idx === tmplSlots.length - 1}
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium truncate">{slot.label_sv}</p>
                                    <Badge variant={slot.slot_type === 'fixed' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                      {slot.slot_type === 'fixed' ? 'Fast' : 'Välj'}
                                    </Badge>
                                    {slot.allow_multiple && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">Flera</Badge>
                                    )}
                                    {!slot.is_required && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">Valfri</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {slot.slot_type === 'fixed'
                                      ? `Alltid: ${slot.fixed_ingredient_id ? getIngredientName(slot.fixed_ingredient_id) : '—'}`
                                      : `Kategori: ${slot.ingredient_category || '—'}`
                                    }
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditSlot(slot)}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteSlot(slot.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                          <Button variant="outline" size="sm" className="w-full gap-1.5 mt-1" onClick={() => openAddSlot(tmpl.id)}>
                            <Plus className="w-3.5 h-3.5" /> Lägg till steg
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Template Form Dialog */}
      <Dialog open={isTemplateFormOpen} onOpenChange={o => { setIsTemplateFormOpen(o); if (!o) resetTemplateForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Redigera receptmall' : 'Ny receptmall'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Namn (svenska) *</Label>
              <Input value={templateForm.name_sv} onChange={e => setTemplateForm(f => ({ ...f, name_sv: e.target.value }))} placeholder="Bastudoft" />
            </div>
            <div className="space-y-2">
              <Label>Name (English)</Label>
              <Input value={templateForm.name_en} onChange={e => setTemplateForm(f => ({ ...f, name_en: e.target.value }))} placeholder="Sauna Scent" />
            </div>
            <div className="space-y-2">
              <Label>Beskrivning</Label>
              <Textarea value={templateForm.description_sv} onChange={e => setTemplateForm(f => ({ ...f, description_sv: e.target.value }))} placeholder="Grund för bastudofter..." rows={2} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Aktiv</Label>
              <Switch checked={templateForm.is_active} onCheckedChange={v => setTemplateForm(f => ({ ...f, is_active: v }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setIsTemplateFormOpen(false); resetTemplateForm(); }}>Avbryt</Button>
              <Button className="flex-1 gap-1.5" onClick={saveTemplate} disabled={saving || !templateForm.name_sv.trim()}>
                <Save className="w-4 h-4" /> {editingTemplate ? 'Uppdatera' : 'Spara'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Slot Form Dialog */}
      <Dialog open={isSlotFormOpen} onOpenChange={o => { setIsSlotFormOpen(o); if (!o) resetSlotForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSlot ? 'Redigera steg' : 'Lägg till steg'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Stegets namn (svenska) *</Label>
              <Input value={slotForm.label_sv} onChange={e => setSlotForm(f => ({ ...f, label_sv: e.target.value }))} placeholder="Eterisk olja" />
            </div>
            <div className="space-y-2">
              <Label>Step name (English)</Label>
              <Input value={slotForm.label_en} onChange={e => setSlotForm(f => ({ ...f, label_en: e.target.value }))} placeholder="Essential Oil" />
            </div>

            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={slotForm.slot_type} onValueChange={(v: 'choice' | 'fixed') => setSlotForm(f => ({ ...f, slot_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="choice">Välj från kategori</SelectItem>
                  <SelectItem value="fixed">Fast ingrediens (alltid med)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {slotForm.slot_type === 'choice' ? (
              <>
                <div className="space-y-2">
                  <Label>Ingredienskategori</Label>
                  <Select value={slotForm.ingredient_category} onValueChange={v => setSlotForm(f => ({ ...f, ingredient_category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Välj kategori" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Tillåt flera val</Label>
                  <Switch checked={slotForm.allow_multiple} onCheckedChange={v => setSlotForm(f => ({ ...f, allow_multiple: v }))} />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Fast ingrediens</Label>
                <Select value={slotForm.fixed_ingredient_id} onValueChange={v => setSlotForm(f => ({ ...f, fixed_ingredient_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Välj ingrediens" /></SelectTrigger>
                  <SelectContent>
                    {ingredients.map(i => <SelectItem key={i.id} value={i.id}>{i.name_sv} ({i.category})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Obligatoriskt steg</Label>
              <Switch checked={slotForm.is_required} onCheckedChange={v => setSlotForm(f => ({ ...f, is_required: v }))} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setIsSlotFormOpen(false); resetSlotForm(); }}>Avbryt</Button>
              <Button className="flex-1 gap-1.5" onClick={saveSlot} disabled={saving || !slotForm.label_sv.trim()}>
                <Save className="w-4 h-4" /> {editingSlot ? 'Uppdatera' : 'Spara'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRecipeTemplateBuilder;
