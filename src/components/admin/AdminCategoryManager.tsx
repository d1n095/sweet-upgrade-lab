import { useState, useMemo } from 'react';
import { useLanguage } from '@/context/LanguageContext';
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
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const content: Record<string, {
    title: string;
    subtitle: string;
    newCategory: string;
    editCategory: string;
    nameSv: string;
    nameEn: string;
    slug: string;
    icon: string;
    parentCategory: string;
    noParent: string;
    cancel: string;
    create: string;
    update: string;
    noCategories: string;
    visible: string;
    hidden: string;
    deleteTitle: string;
    deleteConfirm: string;
    deleteButton: string;
    created: string;
    updated: string;
    deleted: string;
    error: string;
    subcategories: string;
  }> = {
    sv: {
      title: 'Kategorihantering',
      subtitle: 'kategorier',
      newCategory: 'Ny kategori',
      editCategory: 'Redigera kategori',
      nameSv: 'Namn (svenska) *',
      nameEn: 'Namn (engelska)',
      slug: 'Slug',
      icon: 'Ikon',
      parentCategory: 'Förälder-kategori',
      noParent: 'Ingen (toppnivå)',
      cancel: 'Avbryt',
      create: 'Skapa',
      update: 'Uppdatera',
      noCategories: 'Inga kategorier ännu',
      visible: 'Synlig',
      hidden: 'Dold',
      deleteTitle: 'Ta bort kategori?',
      deleteConfirm: 'tas bort. Underkategorier flyttas till toppnivå. Produktkopplingar tas bort.',
      deleteButton: 'Ta bort',
      created: 'Kategori skapad!',
      updated: 'Kategori uppdaterad!',
      deleted: 'Kategori borttagen!',
      error: 'Fel: ',
      subcategories: 'under',
    },
    en: {
      title: 'Category Management',
      subtitle: 'categories',
      newCategory: 'New category',
      editCategory: 'Edit category',
      nameSv: 'Name (Swedish) *',
      nameEn: 'Name (English)',
      slug: 'Slug',
      icon: 'Icon',
      parentCategory: 'Parent category',
      noParent: 'None (top level)',
      cancel: 'Cancel',
      create: 'Create',
      update: 'Update',
      noCategories: 'No categories yet',
      visible: 'Visible',
      hidden: 'Hidden',
      deleteTitle: 'Delete category?',
      deleteConfirm: 'will be deleted. Subcategories are moved to top level. Product links are removed.',
      deleteButton: 'Delete',
      created: 'Category created!',
      updated: 'Category updated!',
      deleted: 'Category deleted!',
      error: 'Error: ',
      subcategories: 'sub',
    },
    no: {
      title: 'Kategorihåndtering',
      subtitle: 'kategorier',
      newCategory: 'Ny kategori',
      editCategory: 'Rediger kategori',
      nameSv: 'Navn (svensk) *',
      nameEn: 'Navn (engelsk)',
      slug: 'Slug',
      icon: 'Ikon',
      parentCategory: 'Overordnet kategori',
      noParent: 'Ingen (toppnivå)',
      cancel: 'Avbryt',
      create: 'Opprett',
      update: 'Oppdater',
      noCategories: 'Ingen kategorier ennå',
      visible: 'Synlig',
      hidden: 'Skjult',
      deleteTitle: 'Slett kategori?',
      deleteConfirm: 'slettes. Underkategorier flyttes til toppnivå. Produktkoblinger fjernes.',
      deleteButton: 'Slett',
      created: 'Kategori opprettet!',
      updated: 'Kategori oppdatert!',
      deleted: 'Kategori slettet!',
      error: 'Feil: ',
      subcategories: 'under',
    },
    da: {
      title: 'Kategoristyring',
      subtitle: 'kategorier',
      newCategory: 'Ny kategori',
      editCategory: 'Rediger kategori',
      nameSv: 'Navn (svensk) *',
      nameEn: 'Navn (engelsk)',
      slug: 'Slug',
      icon: 'Ikon',
      parentCategory: 'Overordnet kategori',
      noParent: 'Ingen (topniveau)',
      cancel: 'Annuller',
      create: 'Opret',
      update: 'Opdater',
      noCategories: 'Ingen kategorier endnu',
      visible: 'Synlig',
      hidden: 'Skjult',
      deleteTitle: 'Slet kategori?',
      deleteConfirm: 'slettes. Underkategorier flyttes til topniveau. Produktlinks fjernes.',
      deleteButton: 'Slet',
      created: 'Kategori oprettet!',
      updated: 'Kategori opdateret!',
      deleted: 'Kategori slettet!',
      error: 'Fejl: ',
      subcategories: 'under',
    },
    de: {
      title: 'Kategorieverwaltung',
      subtitle: 'Kategorien',
      newCategory: 'Neue Kategorie',
      editCategory: 'Kategorie bearbeiten',
      nameSv: 'Name (Schwedisch) *',
      nameEn: 'Name (Englisch)',
      slug: 'Slug',
      icon: 'Symbol',
      parentCategory: 'Übergeordnete Kategorie',
      noParent: 'Keine (oberste Ebene)',
      cancel: 'Abbrechen',
      create: 'Erstellen',
      update: 'Aktualisieren',
      noCategories: 'Noch keine Kategorien',
      visible: 'Sichtbar',
      hidden: 'Ausgeblendet',
      deleteTitle: 'Kategorie löschen?',
      deleteConfirm: 'wird gelöscht. Unterkategorien werden auf oberste Ebene verschoben. Produktverknüpfungen werden entfernt.',
      deleteButton: 'Löschen',
      created: 'Kategorie erstellt!',
      updated: 'Kategorie aktualisiert!',
      deleted: 'Kategorie gelöscht!',
      error: 'Fehler: ',
      subcategories: 'unter',
    },
  };

  const t = content[language as keyof typeof content] || content.en;
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
      toast.success(t.created);
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setIsAddOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(t.error + (err?.message || ''));
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
      toast.success(t.updated);
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setEditingCat(null);
      resetForm();
    } catch (err: any) {
      toast.error(t.error + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCat) return;
    try {
      await deleteCategory(deletingCat.id);
      toast.success(t.deleted);
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err: any) {
      toast.error(t.error + (err?.message || ''));
    } finally {
      setDeletingCat(null);
    }
  };

  const handleToggleVisibility = async (cat: DbCategory) => {
    try {
      await updateCategory(cat.id, { is_visible: !cat.is_visible });
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      toast.success(cat.is_visible ? t.hidden : t.visible);
    } catch (err: any) {
      toast.error(t.error + (err?.message || ''));
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
              {cat.children!.length} {t.subcategories}
            </Badge>
          )}

          <Badge variant={cat.is_visible ? 'default' : 'outline'} className="text-xs shrink-0">
            {cat.is_visible ? t.visible : t.hidden}
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
        <Label>{t.nameSv}</Label>
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
        <Label>{t.nameEn}</Label>
        <Input
          value={form.name_en}
          onChange={e => setForm(prev => ({ ...prev, name_en: e.target.value }))}
          placeholder="Sauna Scents"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t.slug}</Label>
          <Input
            value={form.slug}
            onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
            placeholder="bastudofter"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.icon}</Label>
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
        <Label>{t.parentCategory}</Label>
        <Select value={form.parent_id} onValueChange={v => setForm(prev => ({ ...prev, parent_id: v }))}>
          <SelectTrigger>
            <SelectValue placeholder={t.noParent} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t.noParent}</SelectItem>
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
          {t.cancel}
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
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">
              {categories.length} {t.subtitle} · {categories.filter(c => c.parent_id).length} {t.subcategories}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog open={isAddOpen} onOpenChange={open => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> {t.newCategory}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Grid className="w-5 h-5 text-primary" /> {t.newCategory}
                </DialogTitle>
              </DialogHeader>
              <CategoryForm onSubmit={handleAdd} submitLabel={t.create} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tree */}
      <div className="border border-border rounded-lg divide-y divide-border/50">
        {tree.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">{t.noCategories}</p>
        ) : (
          tree.map(cat => renderCategoryRow(cat))
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingCat} onOpenChange={open => { if (!open) { setEditingCat(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" /> {t.editCategory}
            </DialogTitle>
          </DialogHeader>
          <CategoryForm onSubmit={handleUpdate} submitLabel={t.update} />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingCat} onOpenChange={open => { if (!open) setDeletingCat(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingCat?.name_sv}" {t.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t.deleteButton}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCategoryManager;
