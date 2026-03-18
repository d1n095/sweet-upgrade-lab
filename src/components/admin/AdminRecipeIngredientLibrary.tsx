import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Save, Beaker, X, Eye, EyeOff, Pencil, FlaskConical,
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

interface RecipeIngredient {
  id: string;
  name_sv: string;
  name_en: string | null;
  category: string;
  description_sv: string | null;
  description_en: string | null;
  is_active: boolean;
  display_order: number;
}

const DEFAULT_CATEGORIES = [
  'Eteriska oljor',
  'Basoljor & Smör',
  'Lösningsmedel',
  'Naturliga baser',
  'Tillsatser & Konserveringsmedel',
  'Övrigt',
];

const AdminRecipeIngredientLibrary = () => {
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecipeIngredient | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [form, setForm] = useState({
    name_sv: '',
    name_en: '',
    category: 'Övrigt',
    description_sv: '',
    description_en: '',
    is_active: true,
  });

  const categories = [...new Set([...DEFAULT_CATEGORIES, ...ingredients.map(i => i.category)])].sort();

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('recipe_ingredients')
      .select('*')
      .order('category')
      .order('display_order');
    if (data) setIngredients(data as RecipeIngredient[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

  const resetForm = () => {
    setForm({ name_sv: '', name_en: '', category: 'Övrigt', description_sv: '', description_en: '', is_active: true });
    setEditing(null);
  };

  const openAdd = () => { resetForm(); setIsFormOpen(true); };

  const openEdit = (item: RecipeIngredient) => {
    setEditing(item);
    setForm({
      name_sv: item.name_sv,
      name_en: item.name_en || '',
      category: item.category,
      description_sv: item.description_sv || '',
      description_en: item.description_en || '',
      is_active: item.is_active,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name_sv.trim()) { toast.error('Ange ett namn'); return; }
    setSaving(true);
    try {
      if (editing) {
        await supabase.from('recipe_ingredients').update({
          name_sv: form.name_sv.trim(),
          name_en: form.name_en.trim() || null,
          category: form.category,
          description_sv: form.description_sv.trim() || null,
          description_en: form.description_en.trim() || null,
          is_active: form.is_active,
          updated_at: new Date().toISOString(),
        }).eq('id', editing.id);
        toast.success('Ingrediens uppdaterad!');
      } else {
        await supabase.from('recipe_ingredients').insert({
          name_sv: form.name_sv.trim(),
          name_en: form.name_en.trim() || null,
          category: form.category,
          description_sv: form.description_sv.trim() || null,
          description_en: form.description_en.trim() || null,
          is_active: form.is_active,
          display_order: ingredients.length,
        });
        toast.success('Ingrediens tillagd!');
      }
      setIsFormOpen(false);
      resetForm();
      fetchIngredients();
    } catch {
      toast.error('Något gick fel');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('recipe_ingredients').delete().eq('id', id);
    toast.success('Ingrediens borttagen');
    fetchIngredients();
  };

  const toggleActive = async (item: RecipeIngredient) => {
    await supabase.from('recipe_ingredients').update({ is_active: !item.is_active }).eq('id', item.id);
    fetchIngredients();
  };

  const grouped = ingredients.reduce<Record<string, RecipeIngredient[]>>((acc, item) => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return acc;
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Ingrediensbibliotek</h3>
            <p className="text-sm text-muted-foreground">
              Hantera ingredienser som kan väljas vid produktredigering
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Filtrera kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla kategorier</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="w-4 h-4" /> Lägg till
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            <Beaker className="w-10 h-10 mx-auto mb-2 opacity-30" />
            Inga ingredienser ännu. Klicka "Lägg till" för att börja.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'sv')).map(([category, items]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs font-medium">{category}</Badge>
                <span className="text-xs text-muted-foreground">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <AnimatePresence>
                  {items.map(item => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`flex items-center justify-between p-2.5 rounded-lg border border-border transition-colors ${
                        item.is_active ? 'bg-secondary/30' : 'bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Beaker className="w-3.5 h-3.5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.name_sv}</p>
                          {item.name_en && (
                            <p className="text-xs text-muted-foreground truncate">{item.name_en}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(item)}>
                          {item.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Redigera ingrediens' : 'Lägg till ingrediens'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Namn (svenska) *</Label>
              <Input
                value={form.name_sv}
                onChange={e => setForm(f => ({ ...f, name_sv: e.target.value }))}
                placeholder="Eterisk olja - Lavendel"
              />
            </div>
            <div className="space-y-2">
              <Label>Name (English)</Label>
              <Input
                value={form.name_en}
                onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
                placeholder="Essential Oil - Lavender"
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Beskrivning (svenska)</Label>
              <Textarea
                value={form.description_sv}
                onChange={e => setForm(f => ({ ...f, description_sv: e.target.value }))}
                placeholder="Används ofta i kroppsvård..."
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Aktiv</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setIsFormOpen(false); resetForm(); }}>
                Avbryt
              </Button>
              <Button className="flex-1 gap-1.5" onClick={handleSave} disabled={saving || !form.name_sv.trim()}>
                <Save className="w-4 h-4" />
                {editing ? 'Uppdatera' : 'Spara'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRecipeIngredientLibrary;
