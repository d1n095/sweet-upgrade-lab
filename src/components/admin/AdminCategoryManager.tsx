import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Grid, Plus, Eye, EyeOff, Trash2, Loader2, Save, ChevronRight, ChevronDown,
  Cpu, Shirt, Droplets, Flame, Sparkles, Gem, Bed, Tag, Leaf, Pencil,
  Wand2, CheckCircle, AlertTriangle, Info, XCircle, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
import { useLanguage, getContentLang } from '@/context/LanguageContext';
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
  const { language } = useLanguage();
  const lang = getContentLang(language);

  const content: Record<string, {
    title: string;
    subcategories: string;
    visible: string;
    hidden: string;
    validate: string;
    validating: string;
    aiSync: string;
    analyzing: string;
    newCategory: string;
    editCategory: string;
    deleteCategory: string;
    deleteDescription: string;
    nameSv: string;
    nameEn: string;
    slug: string;
    icon: string;
    parentCategory: string;
    noParent: string;
    cancel: string;
    create: string;
    update: string;
    created: string;
    updated: string;
    deleted: string;
    error: string;
    categoryHidden: string;
    categoryVisible: string;
    couldNotCreate: string;
    noCategories: string;
    children: string;
    aiDisabledSync: string;
    aiDisabledValidate: string;
    categoriesWord: string;
    deleteButton: string;
    close: string;
    aiAnalysisTitle: string;
    allCategorized: string;
    createdAutomatically: string;
    needsReview: string;
    alreadySuggested: string;
    productsAnalyzed: string;
    existingCategories: string;
    validationTitle: string;
    noIssues: string;
    autoFixed: string;
    requiresManualReview: string;
    tasksCreated: string;
    productLinks: string;
    hiddenEmptyPrefix: string;
    clearedBrokenParentPrefix: string;
    removedOrphanLinks: string;
    duplicateSlugPrefix: string;
    duplicateNamePrefix: string;
    nameSvPlaceholder: string;
    nameEnPlaceholder: string;
    slugPlaceholder: string;
  }> = {
    sv: {
      title: 'Kategorihantering',
      subcategories: 'underkategorier',
      categoriesWord: 'kategorier',
      visible: 'Synlig',
      hidden: 'Dold',
      validate: 'Validera',
      validating: 'Validerar...',
      aiSync: 'AI-synk',
      analyzing: 'Analyserar...',
      newCategory: 'Ny kategori',
      editCategory: 'Redigera kategori',
      deleteCategory: 'Ta bort kategori?',
      deleteDescription: 'tas bort. Underkategorier flyttas till toppnivå. Produktkopplingar tas bort.',
      deleteButton: 'Ta bort',
      nameSv: 'Namn (svenska) *',
      nameEn: 'Namn (engelska)',
      slug: 'Slug',
      icon: 'Ikon',
      parentCategory: 'Förälder-kategori',
      noParent: 'Ingen (toppnivå)',
      cancel: 'Avbryt',
      create: 'Skapa',
      update: 'Uppdatera',
      created: 'Kategori skapad!',
      updated: 'Kategori uppdaterad!',
      deleted: 'Kategori borttagen!',
      error: 'Fel: ',
      categoryHidden: 'Kategori dold',
      categoryVisible: 'Kategori synlig',
      couldNotCreate: 'Kunde inte skapa: ',
      noCategories: 'Inga kategorier ännu',
      children: 'under',
      aiDisabledSync: 'AI är avaktiverad — hantera kategorier manuellt',
      aiDisabledValidate: 'AI är avaktiverad — validera kategorier manuellt',
      close: 'Stäng',
      aiAnalysisTitle: 'AI Kategorianalys',
      allCategorized: 'Alla produkter är korrekt kategoriserade',
      createdAutomatically: 'Skapade automatiskt',
      needsReview: 'Behöver granskning',
      alreadySuggested: 'förslag redan existerande',
      productsAnalyzed: 'produkter analyserade',
      existingCategories: 'befintliga kategorier',
      validationTitle: 'Kategorivalidering',
      noIssues: 'Inga problem hittades — kategoristrukturen är ren',
      autoFixed: 'Åtgärdat automatiskt',
      requiresManualReview: 'Kräver manuell granskning',
      tasksCreated: 'uppgifter skapade i Workbench',
      productLinks: 'produktkopplingar',
      hiddenEmptyPrefix: 'Dold tom kategori:',
      clearedBrokenParentPrefix: 'Rensad trasig förälder:',
      removedOrphanLinks: 'föräldralösa produktkopplingar borttagna',
      duplicateSlugPrefix: 'Duplicerad slug:',
      duplicateNamePrefix: 'Duplicerat namn:',
      nameSvPlaceholder: 'T.ex. Bastudofter',
      nameEnPlaceholder: 'Sauna Scents',
      slugPlaceholder: 'bastudofter',
      title: 'Category Management',
      subcategories: 'subcategories',
      categoriesWord: 'categories',
      visible: 'Visible',
      hidden: 'Hidden',
      validate: 'Validate',
      validating: 'Validating...',
      aiSync: 'AI Sync',
      analyzing: 'Analyzing...',
      newCategory: 'New Category',
      editCategory: 'Edit Category',
      deleteCategory: 'Delete category?',
      deleteDescription: 'will be deleted. Subcategories will be moved to top level. Product links will be removed.',
      deleteButton: 'Delete',
      nameSv: 'Name (Swedish) *',
      nameEn: 'Name (English)',
      slug: 'Slug',
      icon: 'Icon',
      parentCategory: 'Parent category',
      noParent: 'None (top level)',
      cancel: 'Cancel',
      create: 'Create',
      update: 'Update',
      created: 'Category created!',
      updated: 'Category updated!',
      deleted: 'Category deleted!',
      error: 'Error: ',
      categoryHidden: 'Category hidden',
      categoryVisible: 'Category visible',
      couldNotCreate: 'Could not create: ',
      noCategories: 'No categories yet',
      children: 'sub',
      aiDisabledSync: 'AI is disabled — manage categories manually',
      aiDisabledValidate: 'AI is disabled — validate categories manually',
      close: 'Close',
      aiAnalysisTitle: 'AI Category Analysis',
      allCategorized: 'All products are correctly categorized',
      createdAutomatically: 'Created automatically',
      needsReview: 'Needs review',
      alreadySuggested: 'suggestions already exist',
      productsAnalyzed: 'products analyzed',
      existingCategories: 'existing categories',
      validationTitle: 'Category Validation',
      noIssues: 'No issues found — category structure is clean',
      autoFixed: 'Auto-fixed',
      requiresManualReview: 'Requires manual review',
      tasksCreated: 'tasks created in Workbench',
      productLinks: 'product links',
      hiddenEmptyPrefix: 'Hidden empty category:',
      clearedBrokenParentPrefix: 'Cleared broken parent:',
      removedOrphanLinks: 'orphaned product links removed',
      duplicateSlugPrefix: 'Duplicate slug:',
      duplicateNamePrefix: 'Duplicate name:',
      nameSvPlaceholder: 'E.g. Sauna Scents (Swedish)',
      nameEnPlaceholder: 'E.g. Sauna Scents',
      slugPlaceholder: 'sauna-scents',
      title: 'Kategorihåndtering',
      subcategories: 'underkategorier',
      categoriesWord: 'kategorier',
      visible: 'Synlig',
      hidden: 'Skjult',
      validate: 'Valider',
      validating: 'Validerer...',
      aiSync: 'AI-synk',
      analyzing: 'Analyserer...',
      newCategory: 'Ny kategori',
      editCategory: 'Rediger kategori',
      deleteCategory: 'Slett kategori?',
      deleteDescription: 'slettes. Underkategorier flyttes til toppnivå. Produktkoblinger fjernes.',
      deleteButton: 'Slett',
      nameSv: 'Navn (svensk) *',
      nameEn: 'Navn (engelsk)',
      slug: 'Slug',
      icon: 'Ikon',
      parentCategory: 'Overordnet kategori',
      noParent: 'Ingen (toppnivå)',
      cancel: 'Avbryt',
      create: 'Opprett',
      update: 'Oppdater',
      created: 'Kategori opprettet!',
      updated: 'Kategori oppdatert!',
      deleted: 'Kategori slettet!',
      error: 'Feil: ',
      categoryHidden: 'Kategori skjult',
      categoryVisible: 'Kategori synlig',
      couldNotCreate: 'Kunne ikke opprette: ',
      noCategories: 'Ingen kategorier ennå',
      children: 'under',
      aiDisabledSync: 'AI er deaktivert — håndter kategorier manuelt',
      aiDisabledValidate: 'AI er deaktivert — valider kategorier manuelt',
      close: 'Lukk',
      aiAnalysisTitle: 'AI Kategorianalyse',
      allCategorized: 'Alle produkter er korrekt kategorisert',
      createdAutomatically: 'Opprettet automatisk',
      needsReview: 'Trenger gjennomgang',
      alreadySuggested: 'forslag allerede eksisterer',
      productsAnalyzed: 'produkter analysert',
      existingCategories: 'eksisterende kategorier',
      validationTitle: 'Kategorivalidering',
      noIssues: 'Ingen problemer funnet — kategoristrukturen er ren',
      autoFixed: 'Automatisk fikset',
      requiresManualReview: 'Krever manuell gjennomgang',
      tasksCreated: 'oppgaver opprettet i Workbench',
      productLinks: 'produktkoblinger',
      hiddenEmptyPrefix: 'Skjult tom kategori:',
      clearedBrokenParentPrefix: 'Ryddet ødelagt overordnet:',
      removedOrphanLinks: 'foreldreløse produktkoblinger fjernet',
      duplicateSlugPrefix: 'Duplikat slug:',
      duplicateNamePrefix: 'Duplikat navn:',
      nameSvPlaceholder: 'F.eks. Bastudufter',
      nameEnPlaceholder: 'Sauna Scents',
      slugPlaceholder: 'bastudufter',
      title: 'Kategorihåndtering',
      subcategories: 'underkategorier',
      categoriesWord: 'kategorier',
      visible: 'Synlig',
      hidden: 'Skjult',
      validate: 'Validér',
      validating: 'Validerer...',
      aiSync: 'AI-synk',
      analyzing: 'Analyserer...',
      newCategory: 'Ny kategori',
      editCategory: 'Rediger kategori',
      deleteCategory: 'Slet kategori?',
      deleteDescription: 'slettes. Underkategorier flyttes til topniveau. Produktforbindelser fjernes.',
      deleteButton: 'Slet',
      nameSv: 'Navn (svensk) *',
      nameEn: 'Navn (engelsk)',
      slug: 'Slug',
      icon: 'Ikon',
      parentCategory: 'Overordnet kategori',
      noParent: 'Ingen (topniveau)',
      cancel: 'Annuller',
      create: 'Opret',
      update: 'Opdater',
      created: 'Kategori oprettet!',
      updated: 'Kategori opdateret!',
      deleted: 'Kategori slettet!',
      error: 'Fejl: ',
      categoryHidden: 'Kategori skjult',
      categoryVisible: 'Kategori synlig',
      couldNotCreate: 'Kunne ikke oprette: ',
      noCategories: 'Ingen kategorier endnu',
      children: 'under',
      aiDisabledSync: 'AI er deaktiveret — håndter kategorier manuelt',
      aiDisabledValidate: 'AI er deaktiveret — validér kategorier manuelt',
      close: 'Luk',
      aiAnalysisTitle: 'AI Kategorianalyse',
      allCategorized: 'Alle produkter er korrekt kategoriseret',
      createdAutomatically: 'Oprettet automatisk',
      needsReview: 'Skal gennemgås',
      alreadySuggested: 'forslag eksisterer allerede',
      productsAnalyzed: 'produkter analyseret',
      existingCategories: 'eksisterende kategorier',
      validationTitle: 'Kategorivalidering',
      noIssues: 'Ingen problemer fundet — kategoristrukturen er ren',
      autoFixed: 'Automatisk rettet',
      requiresManualReview: 'Kræver manuel gennemgang',
      tasksCreated: 'opgaver oprettet i Workbench',
      productLinks: 'produktforbindelser',
      hiddenEmptyPrefix: 'Skjult tom kategori:',
      clearedBrokenParentPrefix: 'Ryddet ødelagt overordnet:',
      removedOrphanLinks: 'forældreløse produktforbindelser fjernet',
      duplicateSlugPrefix: 'Duplikat slug:',
      duplicateNamePrefix: 'Duplikat navn:',
      nameSvPlaceholder: 'F.eks. Bastudufter',
      nameEnPlaceholder: 'Sauna Scents',
      slugPlaceholder: 'bastudufter',
      title: 'Kategorieverwaltung',
      subcategories: 'Unterkategorien',
      categoriesWord: 'Kategorien',
      visible: 'Sichtbar',
      hidden: 'Verborgen',
      validate: 'Validieren',
      validating: 'Validierung...',
      aiSync: 'KI-Sync',
      analyzing: 'Analysiert...',
      newCategory: 'Neue Kategorie',
      editCategory: 'Kategorie bearbeiten',
      deleteCategory: 'Kategorie löschen?',
      deleteDescription: 'wird gelöscht. Unterkategorien werden auf die oberste Ebene verschoben. Produktverknüpfungen werden entfernt.',
      deleteButton: 'Löschen',
      nameSv: 'Name (Schwedisch) *',
      nameEn: 'Name (Englisch)',
      slug: 'Slug',
      icon: 'Symbol',
      parentCategory: 'Übergeordnete Kategorie',
      noParent: 'Keine (oberste Ebene)',
      cancel: 'Abbrechen',
      create: 'Erstellen',
      update: 'Aktualisieren',
      created: 'Kategorie erstellt!',
      updated: 'Kategorie aktualisiert!',
      deleted: 'Kategorie gelöscht!',
      error: 'Fehler: ',
      categoryHidden: 'Kategorie ausgeblendet',
      categoryVisible: 'Kategorie sichtbar',
      couldNotCreate: 'Konnte nicht erstellt werden: ',
      noCategories: 'Noch keine Kategorien',
      children: 'unter',
      aiDisabledSync: 'KI ist deaktiviert — Kategorien manuell verwalten',
      aiDisabledValidate: 'KI ist deaktiviert — Kategorien manuell validieren',
      close: 'Schließen',
      aiAnalysisTitle: 'KI-Kategorieanalyse',
      allCategorized: 'Alle Produkte sind korrekt kategorisiert',
      createdAutomatically: 'Automatisch erstellt',
      needsReview: 'Überprüfung erforderlich',
      alreadySuggested: 'Vorschläge bereits vorhanden',
      productsAnalyzed: 'Produkte analysiert',
      existingCategories: 'vorhandene Kategorien',
      validationTitle: 'Kategorievalidierung',
      noIssues: 'Keine Probleme gefunden — Kategoriestruktur ist sauber',
      autoFixed: 'Automatisch behoben',
      requiresManualReview: 'Manuelle Überprüfung erforderlich',
      tasksCreated: 'Aufgaben in Workbench erstellt',
      productLinks: 'Produktverknüpfungen',
      hiddenEmptyPrefix: 'Leere Kategorie ausgeblendet:',
      clearedBrokenParentPrefix: 'Defekte übergeordnete Kategorie bereinigt:',
      removedOrphanLinks: 'verwaiste Produktverknüpfungen entfernt',
      duplicateSlugPrefix: 'Doppelter Slug:',
      duplicateNamePrefix: 'Doppelter Name:',
      nameSvPlaceholder: 'Z.B. Saunadüfte',
      nameEnPlaceholder: 'Sauna Scents',
      slugPlaceholder: 'saunadufte',

  const t = content[lang] || content.en;
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
      toast.success(cat.is_visible ? t.categoryHidden : t.categoryVisible);
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
  const runAiSync = async () => {
    toast.info(t.aiDisabledSync);
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
      toast.success(t.created);
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setAiResult((prev: any) => prev ? {
        ...prev,
        pending_review: (prev.pending_review || []).filter((s: any) => s.slug !== suggestion.slug),
      } : prev);
    } catch (err: any) {
      toast.error(t.couldNotCreate + (err?.message || ''));
    }
  };

  const runAiValidate = async () => {
    toast.info(t.aiDisabledValidate);
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
              {cat.children!.length} {t.children}
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
          placeholder={t.nameSvPlaceholder}
        />
      </div>
      <div className="space-y-2">
        <Label>{t.nameEn}</Label>
        <Input
          value={form.name_en}
          onChange={e => setForm(prev => ({ ...prev, name_en: e.target.value }))}
          placeholder={t.nameEnPlaceholder}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t.slug}</Label>
          <Input
            value={form.slug}
            onChange={e => setForm(prev => ({ ...prev, slug: e.target.value }))}
            placeholder={t.slugPlaceholder}
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
              {categories.length} {t.categoriesWord} · {categories.filter(c => c.parent_id).length} {t.subcategories}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={runAiValidate} disabled={aiValidating}>
            {aiValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {aiValidating ? t.validating : t.validate}
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={runAiSync} disabled={aiSyncing}>
            {aiSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {aiSyncing ? t.analyzing : t.aiSync}
          </Button>

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

      {/* AI Sync Results */}
      {aiResult && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/20">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">{t.aiAnalysisTitle}</h4>
          </div>
          
          {aiResult.analysis && (
            <p className="text-xs text-muted-foreground">{aiResult.analysis}</p>
          )}

          {aiResult.no_changes_needed && (
            <div className="flex items-center gap-2 text-accent text-xs">
              <CheckCircle className="w-4 h-4" />
              {t.allCategorized}
            </div>
          )}

          {aiResult.created?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t.createdAutomatically}</p>
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
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t.needsReview}</p>
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
                    <Plus className="w-3 h-3" /> {t.create}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {aiResult.already_exists?.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5" />
              {aiResult.already_exists.length} {t.alreadySuggested}
            </div>
          )}

          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span>{aiResult.total_products_analyzed} {t.productsAnalyzed}</span>
            <span>{aiResult.total_categories} {t.existingCategories}</span>
          </div>

          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAiResult(null)}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> {t.close}
          </Button>
        </div>
      )}

      {/* Validation Results */}
      {validationResult && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">{t.validationTitle}</h4>
          </div>

          {validationResult.issues_found === 0 && (
            <div className="flex items-center gap-2 text-accent text-xs">
              <CheckCircle className="w-4 h-4" />
              {t.noIssues}
            </div>
          )}

          {validationResult.auto_fixed?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t.autoFixed}</p>
              {validationResult.auto_fixed.map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-accent/10 border border-accent/20">
                  <CheckCircle className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="text-xs">
                    {f.action === 'hidden_empty' && `${t.hiddenEmptyPrefix} ${f.category}`}
                    {f.action === 'cleared_broken_parent' && `${t.clearedBrokenParentPrefix} ${f.category}`}
                    {f.action === 'removed_orphan_links' && `${f.count} ${t.removedOrphanLinks}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {validationResult.issues?.filter((i: any) => i.type === 'duplicate_slug' || i.type === 'duplicate_name').length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t.requiresManualReview}</p>
              {validationResult.issues.filter((i: any) => i.type === 'duplicate_slug' || i.type === 'duplicate_name').map((issue: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <span className="text-xs">
                    {issue.type === 'duplicate_slug' ? `${t.duplicateSlugPrefix} "${issue.slug}" (${issue.count})` : `${t.duplicateNamePrefix} "${issue.name}" (${issue.count})`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {validationResult.tasks_created?.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5" />
              {validationResult.tasks_created.length} {t.tasksCreated}
            </div>
          )}

          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span>{validationResult.total_categories} {t.categoriesWord}</span>
            <span>{validationResult.total_product_links} {t.productLinks}</span>
          </div>

          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setValidationResult(null)}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> {t.close}
          </Button>
        </div>
      )}

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
            <AlertDialogTitle>{t.deleteCategory}</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingCat?.name_sv}" {t.deleteDescription}
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
