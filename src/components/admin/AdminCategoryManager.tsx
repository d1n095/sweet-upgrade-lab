import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Grid, Plus, Eye, EyeOff, Trash2, Loader2, Save, ChevronRight, ChevronDown,
  Cpu, Shirt, Droplets, Flame, Sparkles, Gem, Bed, Tag, Leaf, GripVertical, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCategories, buildCategoryTree, createCategory, updateCategory, deleteCategory,
  DbCategory,
} from '@/lib/categories';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Cpu, Shirt, Droplets, Flame, Sparkles, Gem, Bed, Grid, Tag, Leaf,
};

const iconOptions = Object.keys(iconMap);

const getIcon = (name: string | null): LucideIcon => iconMap[name || 'Tag'] || Tag;

const AdminCategoryManager = () => {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<DbCategory | null>(null);
  const [deletingCat, setDeletingCat] = useState<DbCategory | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name_sv: '', name_en: '', slug: '', icon: 'Tag', parent_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => fetchCategories(true),
    staleTime: 10_000,
  });

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const parentOptions = useMemo(() => categories.filter(c => !c.parent_id), [categories]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const resetForm = () => setForm({ name_sv: '', name_en: '', slug: '', icon: 'Tag', parent_id: '' });

  const generateSlug = (name: string) =>
    name.toLowerCase()
      .replace(/[åÅ]/g, 'a').replace(/[äÄ]/g, 'a').replace(/[öÖ]/g, 'o')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleAdd = async () => {
    if (!form.name_sv.trim()) return;
    setIsSubmitting(true);
    try {
      await createCategory({
        name_sv: form.name_sv.trim(),
        name_en: form.name_en.trim() || null,
        slug: form.slug.trim() || generateSlug(form.name_sv),
        icon: form.icon || 'Tag',
        parent_id: form.parent_id || null,
        display_order: categories.length,
        is_visible: true,
      });
      toast.success('Kategori skapad!');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setIsAddOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error('Fel: ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingCat || !form.name_sv.trim()) return;
    setIsSubmitting(true);
    try {
      await updateCategory(editingCat.id, {
        name_sv: form.name_sv.trim(),
        name_en: form.name_en.trim() || null,
        slug: form.slug.trim() || editingCat.slug,
        icon: form.icon || editingCat.icon,
        parent_id: form.parent_id || null,
      });
      toast.success('Kategori uppdaterad!');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setEditingCat(null);
      resetForm();
    } catch (err: any) {
      toast.error('Fel: ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCat) return;
    try {
      await deleteCategory(deletingCat.id);
      toast.success('Kategori borttagen!');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err: any) {
      toast.error('Fel: ' + (err?.message || ''));
    } finally {
      setDeletingCat(null);
    }
  };

  const handleToggleVisibility = async (cat: DbCategory) => {
    try {
      await updateCategory(cat.id, { is_visible: !cat.is_visible });
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      toast.success(cat.is_visible ? 'Kategori dold' : 'Kategori synlig');
    } catch (err: any) {
      toast.error('Fel: ' + (err?.message || ''));
    }
  };

  const openEdit = (cat: DbCategory) => {
    setForm({
      name_sv: cat.name_sv,
      name_en: cat.name_en || '',
      slug: cat.slug,
      icon: cat.icon || 'Tag',
      parent_id: cat.parent_id || '',
    });
    setEditingCat(cat);
  };

  const renderCategoryRow = (cat: DbCategory, depth = 0) => {
    const Icon = getIcon(cat.icon);
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = expandedIds.has(cat.id);

    return (
      <div key={cat.id}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors hover:bg-secondary/60 ${
            !cat.is_visible ? 'opacity-50' : ''
          }`}
          style={{ paddingLeft: `${12 + depth * 24}px` }}
        >
          {hasChildren ? (
            <button onClick={() => toggleExpand(cat.id)} className="shrink-0 p-0.5">
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground" />
              }
            </button>
          ) : (
            <span className="w-5" />
          )}

          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{cat.name_sv}</p>
            <p className="text-xs text-muted-foreground truncate">/{cat.slug}</p>
          </div>

          {hasChildren && (
            <Badge variant="secondary" className="text-xs">
              {cat.children!.length} under
            </Badge>
          )}

          <Badge variant={cat.is_visible ? 'default' : 'outline'} className="text-xs shrink-0">
            {cat.is_visible ? 'Synlig' : 'Dold'}
          </Badge>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleVisibility(cat)}>
              {cat.is_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingCat(cat)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </motion.div>

        {hasChildren && isExpanded && cat.children!.map(child => renderCategoryRow(child, depth + 1))}
      </div>
    );
  };

  const CategoryForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Namn (svenska) *</Label>
        <Input
          value={form.name_sv}
          onChange={e => {
            setForm(prev => ({
              ...prev,
              name_sv: e.target.value,
              slug: prev.slug || generateSlug(e.target.value),
            }));
          }}
          placeholder="T.ex. Bastudofter"
        />
      </div>
      <div className="space-y-2">
        <Label>Namn (engelska)</Label>
        <Input
          value={form.name_en}
          onChange={e => setForm(prev => ({ ...prev, name_en: e.target.value }))}
          placeholder="Sauna Scents"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input
            value={form.slug}
            onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
            placeholder="bastudofter"
          />
        </div>
        <div className="space-y-2">
          <Label>Ikon</Label>
          <Select value={form.icon} onValueChange={v => setForm(prev => ({ ...prev, icon: v }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {iconOptions.map(name => {
                const I = iconMap[name];
                return (
                  <SelectItem key={name} value={name}>
                    <div className="flex items-center gap-2">
                      <I className="w-4 h-4" />
                      <span>{name}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Förälder-kategori</Label>
        <Select value={form.parent_id} onValueChange={v => setForm(prev => ({ ...prev, parent_id: v }))}>
          <SelectTrigger>
            <SelectValue placeholder="Ingen (toppnivå)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Ingen (toppnivå)</SelectItem>
            {parentOptions
              .filter(p => p.id !== editingCat?.id)
              .map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name_sv}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => { setIsAddOpen(false); setEditingCat(null); resetForm(); }}
        >
          Avbryt
        </Button>
        <Button className="flex-1 gap-2" onClick={onSubmit} disabled={isSubmitting || !form.name_sv.trim()}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Grid className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Kategorihantering</h3>
            <p className="text-sm text-muted-foreground">
              {categories.length} kategorier · {categories.filter(c => c.parent_id).length} underkategorier
            </p>
          </div>
        </div>

        <Dialog open={isAddOpen} onOpenChange={open => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" /> Ny kategori
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Grid className="w-5 h-5 text-primary" /> Ny kategori
              </DialogTitle>
            </DialogHeader>
            <CategoryForm onSubmit={handleAdd} submitLabel="Skapa" />
          </DialogContent>
        </Dialog>
      </div>

      {/* Tree */}
      <div className="border border-border rounded-lg divide-y divide-border/50">
        {tree.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">Inga kategorier ännu</p>
        ) : (
          tree.map(cat => renderCategoryRow(cat))
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingCat} onOpenChange={open => { if (!open) { setEditingCat(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" /> Redigera kategori
            </DialogTitle>
          </DialogHeader>
          <CategoryForm onSubmit={handleUpdate} submitLabel="Uppdatera" />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingCat} onOpenChange={open => { if (!open) setDeletingCat(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingCat?.name_sv}" tas bort. Underkategorier flyttas till toppnivå. Produktkopplingar tas bort.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCategoryManager;
