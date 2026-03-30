import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Grid, Plus, Eye, EyeOff, Trash2, Loader2, Save, ChevronRight, ChevronDown,
  Cpu, Shirt, Droplets, Flame, Sparkles, Gem, Bed, Tag, Leaf, GripVertical, Pencil,
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCategories, buildCategoryTree, createCategory, updateCategory, deleteCategory,
  DbCategory,
} from '@/lib/categories';
import { useLanguage } from '@/context/LanguageContext';
import type { LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Cpu, Shirt, Droplets, Flame, Sparkles, Gem, Bed, Grid, Tag, Leaf,
};

const iconOptions = Object.keys(iconMap);

const getIcon = (name: string | null): LucideIcon => iconMap[name || 'Tag'] || Tag;

const categoryContent = {
  sv: {
    title: 'Kategorihantering',
    newCategory: 'Ny kategori',
    nameSv: 'Namn (svenska) *',
    nameEn: 'Namn (engelska)',
    slug: 'Slug',
    icon: 'Ikon',
    parent: 'Förälder-kategori',
    noParent: 'Ingen (toppnivå)',
    cancel: 'Avbryt',
    save: 'Spara',
    create: 'Skapa',
    created: 'Kategori skapad!',
    updated: 'Kategori uppdaterad!',
    deleted: 'Kategori borttagen!',
    hidden: 'Kategori dold',
    visible: 'Kategori synlig',
    validate: 'Validera',
    validating: 'Validerar...',
    aiSync: 'AI-synk',
    aiAnalyzing: 'Analyserar...',
    editTitle: 'Redigera kategori',
    deleteConfirmTitle: 'Radera kategori',
    deleteConfirmDesc: 'Är du säker? Underkategorier och produkter påverkas.',
    deleteConfirm: 'Radera',
  },
  en: {
    title: 'Category Management',
    newCategory: 'New category',
    nameSv: 'Name (Swedish) *',
    nameEn: 'Name (English)',
    slug: 'Slug',
    icon: 'Icon',
    parent: 'Parent category',
    noParent: 'None (top level)',
    cancel: 'Cancel',
    save: 'Save',
    create: 'Create',
    created: 'Category created!',
    updated: 'Category updated!',
    deleted: 'Category deleted!',
    hidden: 'Category hidden',
    visible: 'Category visible',
    validate: 'Validate',
    validating: 'Validating...',
    aiSync: 'AI sync',
    aiAnalyzing: 'Analyzing...',
    editTitle: 'Edit category',
    deleteConfirmTitle: 'Delete category',
    deleteConfirmDesc: 'Are you sure? Sub-categories and products will be affected.',
    deleteConfirm: 'Delete',
  },
  no: {
    title: 'Kategorihåndtering',
    newCategory: 'Ny kategori',
    nameSv: 'Navn (svensk) *',
    nameEn: 'Navn (engelsk)',
    slug: 'Slug',
    icon: 'Ikon',
    parent: 'Overordnet kategori',
    noParent: 'Ingen (toppnivå)',
    cancel: 'Avbryt',
    save: 'Lagre',
    create: 'Opprett',
    created: 'Kategori opprettet!',
    updated: 'Kategori oppdatert!',
    deleted: 'Kategori slettet!',
    hidden: 'Kategori skjult',
    visible: 'Kategori synlig',
    validate: 'Valider',
    validating: 'Validerer...',
    aiSync: 'AI-synk',
    aiAnalyzing: 'Analyserer...',
    editTitle: 'Rediger kategori',
    deleteConfirmTitle: 'Slett kategori',
    deleteConfirmDesc: 'Er du sikker? Underkategorier og produkter påvirkes.',
    deleteConfirm: 'Slett',
  },
  da: {
    title: 'Kategoristyring',
    newCategory: 'Ny kategori',
    nameSv: 'Navn (svensk) *',
    nameEn: 'Navn (engelsk)',
    slug: 'Slug',
    icon: 'Ikon',
    parent: 'Overordnet kategori',
    noParent: 'Ingen (topniveau)',
    cancel: 'Annuller',
    save: 'Gem',
    create: 'Opret',
    created: 'Kategori oprettet!',
    updated: 'Kategori opdateret!',
    deleted: 'Kategori slettet!',
    hidden: 'Kategori skjult',
    visible: 'Kategori synlig',
    validate: 'Valider',
    validating: 'Validerer...',
    aiSync: 'AI-synk',
    aiAnalyzing: 'Analyserer...',
    editTitle: 'Rediger kategori',
    deleteConfirmTitle: 'Slet kategori',
    deleteConfirmDesc: 'Er du sikker? Underkategorier og produkter påvirkes.',
    deleteConfirm: 'Slet',
  },
  de: {
    title: 'Kategorieverwaltung',
    newCategory: 'Neue Kategorie',
    nameSv: 'Name (Schwedisch) *',
    nameEn: 'Name (Englisch)',
    slug: 'Slug',
    icon: 'Symbol',
    parent: 'Übergeordnete Kategorie',
    noParent: 'Keine (oberste Ebene)',
    cancel: 'Abbrechen',
    save: 'Speichern',
    create: 'Erstellen',
    created: 'Kategorie erstellt!',
    updated: 'Kategorie aktualisiert!',
    deleted: 'Kategorie gelöscht!',
    hidden: 'Kategorie ausgeblendet',
    visible: 'Kategorie sichtbar',
    validate: 'Validieren',
    validating: 'Validiert...',
    aiSync: 'KI-Sync',
    aiAnalyzing: 'Analysiert...',
    editTitle: 'Kategorie bearbeiten',
    deleteConfirmTitle: 'Kategorie löschen',
    deleteConfirmDesc: 'Sind Sie sicher? Unterkategorien und Produkte werden beeinflusst.',
    deleteConfirm: 'Löschen',
  },
  fi: {
    title: 'Kategoriahallinta',
    newCategory: 'Uusi kategoria',
    nameSv: 'Nimi (ruotsi) *',
    nameEn: 'Nimi (englanti)',
    slug: 'Slug',
    icon: 'Kuvake',
    parent: 'Yläkategoria',
    noParent: 'Ei (ylätaso)',
    cancel: 'Peruuta',
    save: 'Tallenna',
    create: 'Luo',
    created: 'Kategoria luotu!',
    updated: 'Kategoria päivitetty!',
    deleted: 'Kategoria poistettu!',
    hidden: 'Kategoria piilotettu',
    visible: 'Kategoria näkyvissä',
    validate: 'Validoi',
    validating: 'Validoidaan...',
    aiSync: 'AI-synk',
    aiAnalyzing: 'Analysoidaan...',
    editTitle: 'Muokkaa kategoriaa',
    deleteConfirmTitle: 'Poista kategoria',
    deleteConfirmDesc: 'Oletko varma? Alakategoriat ja tuotteet vaikuttuvat.',
    deleteConfirm: 'Poista',
  },
  nl: {
    title: 'Categoriebeheer',
    newCategory: 'Nieuwe categorie',
    nameSv: 'Naam (Zweeds) *',
    nameEn: 'Naam (Engels)',
    slug: 'Slug',
    icon: 'Pictogram',
    parent: 'Bovenliggende categorie',
    noParent: 'Geen (topniveau)',
    cancel: 'Annuleren',
    save: 'Opslaan',
    create: 'Aanmaken',
    created: 'Categorie aangemaakt!',
    updated: 'Categorie bijgewerkt!',
    deleted: 'Categorie verwijderd!',
    hidden: 'Categorie verborgen',
    visible: 'Categorie zichtbaar',
    validate: 'Valideren',
    validating: 'Valideren...',
    aiSync: 'AI-sync',
    aiAnalyzing: 'Analyseren...',
    editTitle: 'Categorie bewerken',
    deleteConfirmTitle: 'Categorie verwijderen',
    deleteConfirmDesc: 'Weet je het zeker? Subcategorieën en producten worden beïnvloed.',
    deleteConfirm: 'Verwijderen',
  },
  fr: {
    title: 'Gestion des catégories',
    newCategory: 'Nouvelle catégorie',
    nameSv: 'Nom (suédois) *',
    nameEn: 'Nom (anglais)',
    slug: 'Slug',
    icon: 'Icône',
    parent: 'Catégorie parente',
    noParent: 'Aucune (niveau supérieur)',
    cancel: 'Annuler',
    save: 'Enregistrer',
    create: 'Créer',
    created: 'Catégorie créée !',
    updated: 'Catégorie mise à jour !',
    deleted: 'Catégorie supprimée !',
    hidden: 'Catégorie masquée',
    visible: 'Catégorie visible',
    validate: 'Valider',
    validating: 'Validation...',
    aiSync: 'Sync IA',
    aiAnalyzing: 'Analyse...',
    editTitle: 'Modifier la catégorie',
    deleteConfirmTitle: 'Supprimer la catégorie',
    deleteConfirmDesc: 'Êtes-vous sûr ? Les sous-catégories et les produits seront affectés.',
    deleteConfirm: 'Supprimer',
  },
  es: {
    title: 'Gestión de categorías',
    newCategory: 'Nueva categoría',
    nameSv: 'Nombre (sueco) *',
    nameEn: 'Nombre (inglés)',
    slug: 'Slug',
    icon: 'Icono',
    parent: 'Categoría principal',
    noParent: 'Ninguna (nivel superior)',
    cancel: 'Cancelar',
    save: 'Guardar',
    create: 'Crear',
    created: '¡Categoría creada!',
    updated: '¡Categoría actualizada!',
    deleted: '¡Categoría eliminada!',
    hidden: 'Categoría oculta',
    visible: 'Categoría visible',
    validate: 'Validar',
    validating: 'Validando...',
    aiSync: 'Sincronizar IA',
    aiAnalyzing: 'Analizando...',
    editTitle: 'Editar categoría',
    deleteConfirmTitle: 'Eliminar categoría',
    deleteConfirmDesc: '¿Estás seguro? Las subcategorías y productos se verán afectados.',
    deleteConfirm: 'Eliminar',
  },
  pl: {
    title: 'Zarządzanie kategoriami',
    newCategory: 'Nowa kategoria',
    nameSv: 'Nazwa (szwedzki) *',
    nameEn: 'Nazwa (angielski)',
    slug: 'Slug',
    icon: 'Ikona',
    parent: 'Kategoria nadrzędna',
    noParent: 'Brak (poziom główny)',
    cancel: 'Anuluj',
    save: 'Zapisz',
    create: 'Utwórz',
    created: 'Kategoria utworzona!',
    updated: 'Kategoria zaktualizowana!',
    deleted: 'Kategoria usunięta!',
    hidden: 'Kategoria ukryta',
    visible: 'Kategoria widoczna',
    validate: 'Waliduj',
    validating: 'Walidowanie...',
    aiSync: 'Synchronizacja AI',
    aiAnalyzing: 'Analizowanie...',
    editTitle: 'Edytuj kategorię',
    deleteConfirmTitle: 'Usuń kategorię',
    deleteConfirmDesc: 'Czy na pewno? Podkategorie i produkty zostaną zmienione.',
    deleteConfirm: 'Usuń',
  },
};

const AdminCategoryManager = () => {
  const { language } = useLanguage();
  const t = categoryContent[language as keyof typeof categoryContent] || categoryContent.en;
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
      toast.success(t.updated);
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
      toast.success(t.deleted);
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
      toast.success(cat.is_visible ? t.hidden : t.visible);
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
  const runAiSync = async () => {
    setAiSyncing(true);
    setAiResult(null);
    try {
      // Deterministic scanner: find products with no category assignment
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, name');
      const { data: productCats } = await supabase
        .from('product_categories')
        .select('product_id');
      const assignedIds = new Set((productCats || []).map((pc: any) => pc.product_id));
      const uncategorized = (allProducts || []).filter((p: any) => !assignedIds.has(p.id));

      // Find orphan categories (parent_id set but parent doesn't exist)
      const catIds = new Set(categories.map(c => c.id));
      const orphans = categories.filter(c => c.parent_id && !catIds.has(c.parent_id));

      setAiResult({
        no_changes_needed: uncategorized.length === 0 && orphans.length === 0,
        uncategorized_products: uncategorized,
        orphan_categories: orphans,
        created: [],
        pending_review: [],
        analysis: `Skanning klar: ${uncategorized.length} produkter utan kategori, ${orphans.length} föräldralösa kategorier`,
      });

      if (uncategorized.length === 0 && orphans.length === 0) {
        toast.info('Alla produkter är korrekt kategoriserade');
      } else {
        toast.info(`Skanning: ${uncategorized.length} okategoriserade, ${orphans.length} föräldralösa`);
      }
    } catch (err: any) {
      toast.error('Skanning misslyckades: ' + (err?.message || ''));
    } finally {
      setAiSyncing(false);
    }
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
    setAiValidating(true);
    setValidationResult(null);
    try {
      const issues: { type: string; message: string; category?: string }[] = [];

      // 1. Find categories with broken parent links
      const catIds = new Set(categories.map(c => c.id));
      for (const cat of categories) {
        if (cat.parent_id && !catIds.has(cat.parent_id)) {
          issues.push({ type: 'broken_parent', message: `Kategori "${cat.name_sv}" har ogiltig förälder-id`, category: cat.name_sv });
        }
      }

      // 2. Find hidden parent categories that have visible children
      for (const cat of categories) {
        if (!cat.is_visible && cat.children && cat.children.length > 0) {
          const visibleChildren = cat.children.filter((c: any) => c.is_visible);
          if (visibleChildren.length > 0) {
            issues.push({ type: 'hidden_parent_visible_children', message: `"${cat.name_sv}" är dold men har ${visibleChildren.length} synliga underkategorier`, category: cat.name_sv });
          }
        }
      }

      // 3. Find categories with duplicate slugs
      const slugCount: Record<string, number> = {};
      for (const cat of categories) { slugCount[cat.slug] = (slugCount[cat.slug] || 0) + 1; }
      for (const [slug, count] of Object.entries(slugCount)) {
        if (count > 1) issues.push({ type: 'duplicate_slug', message: `Slug "${slug}" används av ${count} kategorier` });
      }

      setValidationResult({ issues_found: issues.length, issues, auto_fixed: [] });
      if (issues.length === 0) toast.success(t.validate + ': Inga problem hittades!');
      else toast.info(`${issues.length} problem hittade`);
    } catch (err: any) {
      toast.error('Validering misslyckades: ' + (err?.message || ''));
    } finally {
      setAiValidating(false);
    }
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
        <Label>{t.parent}</Label>
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
              {categories.length} kategorier · {categories.filter(c => c.parent_id).length} underkategorier
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
            {aiSyncing ? t.aiAnalyzing : t.aiSync}
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

      {/* Scanner Sync Results */}
      {aiResult && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/20">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">Kategori-skanning</h4>
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

          {aiResult.uncategorized_products?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Produkter utan kategori ({aiResult.uncategorized_products.length})</p>
              {aiResult.uncategorized_products.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                  <span className="text-xs font-medium">{p.name}</span>
                </div>
              ))}
            </div>
          )}

          {aiResult.orphan_categories?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Föräldralösa kategorier ({aiResult.orphan_categories.length})</p>
              {aiResult.orphan_categories.map((c: any) => (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <span className="text-xs font-medium">{c.name_sv}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">ogiltig förälder</span>
                </div>
              ))}
            </div>
          )}

          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setAiResult(null)}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> Stäng
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

          {validationResult.issues?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Problem hittade</p>
              {validationResult.issues.map((issue: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <span className="text-xs">{issue.message}</span>
                </div>
              ))}
            </div>
          )}

          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setValidationResult(null)}>
            <XCircle className="w-3.5 h-3.5 mr-1" /> Stäng
          </Button>
        </div>
      )}

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
              <Pencil className="w-5 h-5 text-primary" /> {t.editTitle}
            </DialogTitle>
          </DialogHeader>
          <CategoryForm onSubmit={handleUpdate} submitLabel={t.save} />
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
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {t.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCategoryManager;
