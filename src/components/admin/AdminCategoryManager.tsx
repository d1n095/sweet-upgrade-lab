import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Grid, Plus, Eye, EyeOff, Trash2, Loader2, Save, ChevronRight, ChevronDown,
  Cpu, Shirt, Droplets, Flame, Sparkles, Gem, Bed, Tag, Leaf, GripVertical, Pencil,
  Wand2, CheckCircle, AlertTriangle, Info, XCircle, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
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
import { AI_ENABLED } from '@/config/ai';

const iconMap: Record<string, LucideIcon> = {
  Cpu, Shirt, Droplets, Flame, Sparkles, Gem, Bed, Grid, Tag, Leaf,
};

const iconOptions = Object.keys(iconMap);

const getIcon = (name: string | null): LucideIcon => iconMap[name || 'Tag'] || Tag;

const content: Record<string, {
  title: string;
  subtitle_categories: string;
  subtitle_subcategories: string;
  validate: string;
  validating: string;
  aiSync: string;
  analyzing: string;
  newCategory: string;
  nameSv: string;
  nameEn: string;
  slug: string;
  icon: string;
  parentCategory: string;
  noParent: string;
  cancel: string;
  create: string;
  update: string;
  visible: string;
  hidden: string;
  subcategories: string;
  noCategories: string;
  editCategory: string;
  deleteCategory: string;
  deleteDescription: string;
  categoryCreated: string;
  categoryUpdated: string;
  categoryDeleted: string;
  categoryHidden: string;
  categoryVisible: string;
  error: string;
  close: string;
  delete: string;
}> = {
  sv: {
    title: 'Kategorihantering',
    subtitle_categories: 'kategorier',
    subtitle_subcategories: 'underkategorier',
    validate: 'Validera',
    validating: 'Validerar...',
    aiSync: 'AI-synk',
    analyzing: 'Analyserar...',
    newCategory: 'Ny kategori',
    nameSv: 'Namn (svenska) *',
    nameEn: 'Namn (engelska)',
    slug: 'Slug',
    icon: 'Ikon',
    parentCategory: 'Förälder-kategori',
    noParent: 'Ingen (toppnivå)',
    cancel: 'Avbryt',
    create: 'Skapa',
    update: 'Uppdatera',
    visible: 'Synlig',
    hidden: 'Dold',
    subcategories: 'under',
    noCategories: 'Inga kategorier ännu',
    editCategory: 'Redigera kategori',
    deleteCategory: 'Ta bort kategori?',
    deleteDescription: 'tas bort. Underkategorier flyttas till toppnivå. Produktkopplingar tas bort.',
    categoryCreated: 'Kategori skapad!',
    categoryUpdated: 'Kategori uppdaterad!',
    categoryDeleted: 'Kategori borttagen!',
    categoryHidden: 'Kategori dold',
    categoryVisible: 'Kategori synlig',
    error: 'Fel',
    close: 'Stäng',
    delete: 'Ta bort',
  },
  en: {
    title: 'Category Management',
    subtitle_categories: 'categories',
    subtitle_subcategories: 'subcategories',
    validate: 'Validate',
    validating: 'Validating...',
    aiSync: 'AI Sync',
    analyzing: 'Analyzing...',
    newCategory: 'New category',
    nameSv: 'Name (Swedish) *',
    nameEn: 'Name (English)',
    slug: 'Slug',
    icon: 'Icon',
    parentCategory: 'Parent category',
    noParent: 'None (top level)',
    cancel: 'Cancel',
    create: 'Create',
    update: 'Update',
    visible: 'Visible',
    hidden: 'Hidden',
    subcategories: 'sub',
    noCategories: 'No categories yet',
    editCategory: 'Edit category',
    deleteCategory: 'Delete category?',
    deleteDescription: 'will be deleted. Subcategories are moved to top level. Product links are removed.',
    categoryCreated: 'Category created!',
    categoryUpdated: 'Category updated!',
    categoryDeleted: 'Category deleted!',
    categoryHidden: 'Category hidden',
    categoryVisible: 'Category visible',
    error: 'Error',
    close: 'Close',
    delete: 'Delete',
  },
  no: {
    title: 'Kategorihåndtering',
    subtitle_categories: 'kategorier',
    subtitle_subcategories: 'underkategorier',
    validate: 'Valider',
    validating: 'Validerer...',
    aiSync: 'AI-synk',
    analyzing: 'Analyserer...',
    newCategory: 'Ny kategori',
    nameSv: 'Navn (svensk) *',
    nameEn: 'Navn (engelsk)',
    slug: 'Slug',
    icon: 'Ikon',
    parentCategory: 'Foreldrekategori',
    noParent: 'Ingen (toppnivå)',
    cancel: 'Avbryt',
    create: 'Opprett',
    update: 'Oppdater',
    visible: 'Synlig',
    hidden: 'Skjult',
    subcategories: 'under',
    noCategories: 'Ingen kategorier ennå',
    editCategory: 'Rediger kategori',
    deleteCategory: 'Slett kategori?',
    deleteDescription: 'slettes. Underkategorier flyttes til toppnivå. Produktkoblinger fjernes.',
    categoryCreated: 'Kategori opprettet!',
    categoryUpdated: 'Kategori oppdatert!',
    categoryDeleted: 'Kategori slettet!',
    categoryHidden: 'Kategori skjult',
    categoryVisible: 'Kategori synlig',
    error: 'Feil',
    close: 'Lukk',
    delete: 'Slett',
  },
  da: {
    title: 'Kategorihåndtering',
    subtitle_categories: 'kategorier',
    subtitle_subcategories: 'underkategorier',
    validate: 'Validér',
    validating: 'Validerer...',
    aiSync: 'AI-synk',
    analyzing: 'Analyserer...',
    newCategory: 'Ny kategori',
    nameSv: 'Navn (svensk) *',
    nameEn: 'Navn (engelsk)',
    slug: 'Slug',
    icon: 'Ikon',
    parentCategory: 'Forældrekategori',
    noParent: 'Ingen (topniveau)',
    cancel: 'Annuller',
    create: 'Opret',
    update: 'Opdater',
    visible: 'Synlig',
    hidden: 'Skjult',
    subcategories: 'under',
    noCategories: 'Ingen kategorier endnu',
    editCategory: 'Rediger kategori',
    deleteCategory: 'Slet kategori?',
    deleteDescription: 'slettes. Underkategorier flyttes til topniveau. Produktlinks fjernes.',
    categoryCreated: 'Kategori oprettet!',
    categoryUpdated: 'Kategori opdateret!',
    categoryDeleted: 'Kategori slettet!',
    categoryHidden: 'Kategori skjult',
    categoryVisible: 'Kategori synlig',
    error: 'Fejl',
    close: 'Luk',
    delete: 'Slet',
  },
  de: {
    title: 'Kategorieverwaltung',
    subtitle_categories: 'Kategorien',
    subtitle_subcategories: 'Unterkategorien',
    validate: 'Validieren',
    validating: 'Validiert...',
    aiSync: 'KI-Sync',
    analyzing: 'Analysiert...',
    newCategory: 'Neue Kategorie',
    nameSv: 'Name (Schwedisch) *',
    nameEn: 'Name (Englisch)',
    slug: 'Slug',
    icon: 'Symbol',
    parentCategory: 'Übergeordnete Kategorie',
    noParent: 'Keine (oberste Ebene)',
    cancel: 'Abbrechen',
    create: 'Erstellen',
    update: 'Aktualisieren',
    visible: 'Sichtbar',
    hidden: 'Versteckt',
    subcategories: 'unter',
    noCategories: 'Noch keine Kategorien',
    editCategory: 'Kategorie bearbeiten',
    deleteCategory: 'Kategorie löschen?',
    deleteDescription: 'wird gelöscht. Unterkategorien werden auf die oberste Ebene verschoben. Produktverknüpfungen werden entfernt.',
    categoryCreated: 'Kategorie erstellt!',
    categoryUpdated: 'Kategorie aktualisiert!',
    categoryDeleted: 'Kategorie gelöscht!',
    categoryHidden: 'Kategorie versteckt',
    categoryVisible: 'Kategorie sichtbar',
    error: 'Fehler',
    close: 'Schließen',
    delete: 'Löschen',
  },
};

const AdminCategoryManager = () => {
  const { language } = useLanguage();
  const c = content[language] ?? content['sv'];
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<DbCategory | null>(null);
  const [deletingCat, setDeletingCat] = useState<DbCategory | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name_sv: '', name_en: '', slug: '', icon: 'Tag', parent_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiSyncing, setAiSyncing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiValidating, setAiValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

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
      toast.success(c.categoryCreated);
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setIsAddOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(c.error + ': ' + (err?.message || ''));
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
      toast.success(c.categoryUpdated);
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setEditingCat(null);
      resetForm();
    } catch (err: any) {
      toast.error(c.error + ': ' + (err?.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCat) return;
    try {
      await deleteCategory(deletingCat.id);
      toast.success(c.categoryDeleted);
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    } catch (err: any) {
      toast.error(c.error + ': ' + (err?.message || ''));
    } finally {
      setDeletingCat(null);
    }
  };

  const handleToggleVisibility = async (cat: DbCategory) => {
    try {
      await updateCategory(cat.id, { is_visible: !cat.is_visible });
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      toast.success(cat.is_visible ? c.categoryHidden : c.categoryVisible);
    } catch (err: any) {
      toast.error(c.error + ': ' + (err?.message || ''));
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
  const runAiSync = async () => {
    // AI permanently removed
    toast.info('AI-synk är borttagen');
  };

  const acceptPendingSuggestion = async (suggestion: any) => {
    try {
      const categories_list = categories;
      let parentId = null;
      if (suggestion.parent_slug && suggestion.parent_slug !== 'root') {
        const parent = categories_list.find(c => c.slug === suggestion.parent_slug);
        if (parent) parentId = parent.id;
      }
      const maxOrder = Math.max(0, ...categories_list.map(c => c.display_order || 0));
      await createCategory({
        name_sv: suggestion.name_sv,
        name_en: suggestion.name_en,
        slug: suggestion.slug,
        icon: suggestion.icon,
        parent_id: parentId,
        display_order: maxOrder + 1,
        is_visible: true,
      });
      toast.success(`"${suggestion.name_sv}" skapad!`);
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setAiResult((prev: any) => prev ? {
        ...prev,
        pending_review: (prev.pending_review || []).filter((s: any) => s.slug !== suggestion.slug),
      } : prev);
    } catch (err: any) {
      toast.error('Kunde inte skapa: ' + (err?.message || ''));
    }
  };

  const runAiValidate = async () => {
    // AI permanently removed
    toast.info('AI-validering är borttagen');
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
              {cat.children!.length} {c.subcategories}
            </Badge>
          )}

          <Badge variant={cat.is_visible ? 'default' : 'outline'} className="text-xs shrink-0">
            {cat.is_visible ? c.visible : c.hidden}
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
        <Label>{c.nameSv}</Label>
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
        <Label>{c.nameEn}</Label>
        <Input
          value={form.name_en}
          onChange={e => setForm(prev => ({ ...prev, name_en: e.target.value }))}
          placeholder="Sauna Scents"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{c.slug}</Label>
          <Input
            value={form.slug}
            onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
            placeholder="bastudofter"
          />
        </div>
        <div className="space-y-2">
          <Label>{c.icon}</Label>
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
        <Label>{c.parentCategory}</Label>
        <Select value={form.parent_id} onValueChange={v => setForm(prev => ({ ...prev, parent_id: v }))}>
          <SelectTrigger>
            <SelectValue placeholder={c.noParent} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{c.noParent}</SelectItem>
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
          {c.cancel}
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
            <h3 className="font-semibold">{c.title}</h3>
            <p className="text-sm text-muted-foreground">
              {categories.length} {c.subtitle_categories} · {categories.filter(cat => cat.parent_id).length} {c.subtitle_subcategories}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={runAiValidate} disabled={aiValidating}>
            {aiValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {aiValidating ? c.validating : c.validate}
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={runAiSync} disabled={aiSyncing}>
            {aiSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {aiSyncing ? c.analyzing : c.aiSync}
          </Button>

          <Dialog open={isAddOpen} onOpenChange={open => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> {c.newCategory}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Grid className="w-5 h-5 text-primary" /> {c.newCategory}
                </DialogTitle>
              </DialogHeader>
              <CategoryForm onSubmit={handleAdd} submitLabel={c.create} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* AI Sync Results */}
      {aiResult && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/20">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">AI Kategorianalys</h4>
          </div>
          
          {aiResult.analysis && (
            <p className="text-xs text-muted-foreground">{aiResult.analysis}</p>
          )}

          {aiResult.no_changes_needed && (
            <div className="flex items-center gap-2 text-accent text-xs">
              <CheckCircle className="w-4 h-4" />
              Alla produkter är korrekt kategoriserade
            </div>
          )}

          {aiResult.created?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Skapade automatiskt</p>
              {aiResult.created.map((c: any) => (
                <div key={c.id || c.slug} className="flex items-center gap-2 p-2 rounded-lg bg-accent/10 border border-accent/20">
                  <CheckCircle className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="text-xs font-medium">{c.name_sv}</span>
                  <span className="text-[10px] text-muted-foreground">({c.slug})</span>
                  {c.reason && <span className="text-[10px] text-muted-foreground ml-auto">{c.reason}</span>}
                </div>
              ))}
            </div>
          )}

          {aiResult.pending_review?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Behöver granskning</p>
              {aiResult.pending_review.map((s: any) => (
                <div key={s.slug} className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium">{s.name_sv}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">({s.name_en})</span>
                    <p className="text-[10px] text-muted-foreground truncate">{s.reason}</p>
                  </div>
                  <Badge variant="secondary" className="text-[9px] shrink-0">{s.confidence}</Badge>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 shrink-0" onClick={() => acceptPendingSuggestion(s)}>
                    <Plus className="w-3 h-3" /> Skapa
                  </Button>
                </div>
              ))}
            </div>
          )}

          {aiResult.already_exists?.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5" />
              {aiResult.already_exists.length} förslag redan existerande
            </div>
          )}

          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span>{aiResult.total_products_analyzed} produkter analyserade</span>
            <span>{aiResult.total_categories} befintliga kategorier</span>
          </div>

          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAiResult(null)}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> {c.close}
          </Button>
        </div>
      )}

      {/* Validation Results */}
      {validationResult && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">Kategorivalidering</h4>
          </div>

          {validationResult.issues_found === 0 && (
            <div className="flex items-center gap-2 text-accent text-xs">
              <CheckCircle className="w-4 h-4" />
              Inga problem hittades — kategoristrukturen är ren
            </div>
          )}

          {validationResult.auto_fixed?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Åtgärdat automatiskt</p>
              {validationResult.auto_fixed.map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-accent/10 border border-accent/20">
                  <CheckCircle className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="text-xs">
                    {f.action === 'hidden_empty' && `Dold tom kategori: ${f.category}`}
                    {f.action === 'cleared_broken_parent' && `Rensad trasig förälder: ${f.category}`}
                    {f.action === 'removed_orphan_links' && `${f.count} föräldralösa produktkopplingar borttagna`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {validationResult.issues?.filter((i: any) => i.type === 'duplicate_slug' || i.type === 'duplicate_name').length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Kräver manuell granskning</p>
              {validationResult.issues.filter((i: any) => i.type === 'duplicate_slug' || i.type === 'duplicate_name').map((issue: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <span className="text-xs">
                    {issue.type === 'duplicate_slug' ? `Duplicerad slug: "${issue.slug}" (${issue.count} st)` : `Duplicerat namn: "${issue.name}" (${issue.count} st)`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {validationResult.tasks_created?.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5" />
              {validationResult.tasks_created.length} uppgifter skapade i Workbench
            </div>
          )}

          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span>{validationResult.total_categories} kategorier</span>
            <span>{validationResult.total_product_links} produktkopplingar</span>
          </div>

          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setValidationResult(null)}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> {c.close}
          </Button>
        </div>
      )}

      {/* Tree */}
      <div className="border border-border rounded-lg divide-y divide-border/50">
        {tree.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">{c.noCategories}</p>
        ) : (
          tree.map(cat => renderCategoryRow(cat))
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingCat} onOpenChange={open => { if (!open) { setEditingCat(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" /> {c.editCategory}
            </DialogTitle>
          </DialogHeader>
          <CategoryForm onSubmit={handleUpdate} submitLabel={c.update} />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingCat} onOpenChange={open => { if (!open) setDeletingCat(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{c.deleteCategory}</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingCat?.name_sv}" {c.deleteDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{c.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {c.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCategoryManager;
