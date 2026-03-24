import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { DollarSign, Tag, Save, Eye, EyeOff, Boxes, Minus, Plus, Upload, X, Image, FlaskConical, ChefHat, Weight, Wand2, Loader2, Check } from 'lucide-react';
import { RecipeTemplatePicker } from './RecipeTemplatePicker';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { fetchCategories, DbCategory } from '@/lib/categories';
import { fetchTags, DbTag } from '@/lib/tags';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ProductFormData {
  title: string;
  description: string;
  price: string;
  currency: string;
  productType: string;
  categoryIds: string[];
  tagIds: string[];
  tags: string;
  vendor: string;
  isVisible: boolean;
  inventory: number;
  allowOverselling: boolean;
  imageUrls: string[];
  ingredients: string;
  certifications: string;
  recipe: string;
  feeling: string;
  effects: string;
  usage: string;
  extendedDescription: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  weightGrams: string;
  ingredientIds?: string[];
  // PIM light fields
  shelfLife: string;
  material: string;
  specialEffects: string;
  usageArea: string;
  usageStep1: string;
  usageStep2: string;
  usageStep3: string;
  seoMode: 'auto' | 'manual';
  // Standardized product fields
  hook: string;
  dosage: string;
  variants: string;
  storage: string;
  safety: string;
  specifications: string;
  isConcentrate: boolean;
}

const CURRENCY_OPTIONS = [
  { value: 'SEK', symbol: 'kr' },
  { value: 'EUR', symbol: '€' },
  { value: 'USD', symbol: '$' },
  { value: 'NOK', symbol: 'kr' },
  { value: 'DKK', symbol: 'kr' },
  { value: 'GBP', symbol: '£' },
];

export const DEFAULT_PRODUCT_FORM_DATA: ProductFormData = {
  title: '', description: '', price: '', currency: 'SEK', productType: '',
  categoryIds: [], tagIds: [], tags: '', vendor: '', isVisible: true,
  inventory: 0, allowOverselling: false, imageUrls: [], ingredients: '',
  certifications: '', recipe: '', feeling: '', effects: '', usage: '',
  extendedDescription: '', metaTitle: '', metaDescription: '', metaKeywords: '',
  weightGrams: '', ingredientIds: [],
  shelfLife: '', material: '', specialEffects: '', usageArea: '',
  usageStep1: '', usageStep2: '', usageStep3: '', seoMode: 'auto',
  hook: '', dosage: '', variants: '', storage: '', safety: '',
  specifications: '', isConcentrate: false,
};
export type ProductCategoryOption = {
  value: string;
  label: { sv: string; en: string };
};

export type AdminProductFormStrings = {
  productName: string;
  description: string;
  price: string;
  category: string;
  selectCategory: string;
  tags: string;
  tagsPlaceholder: string;
  suggestedTags: string;
  // Kept for backward compatibility with existing translation objects in AdminProductManager
  vendor: string;
  visibility: string;
  visibleInStore: string;
  hiddenFromStore: string;
  inventory: string;
  currentStock: string;
  allowOverselling: string;
  oversellHint: string;
  cancel: string;
  save: string;
  update: string;
};

// ─── Ingredient Library Picker ───
interface LibraryIngredient {
  id: string;
  name_sv: string;
  name_en: string | null;
  category: string;
}

function IngredientPickerSection({
  language,
  formData,
  setFormData,
}: {
  language: string;
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}) {
  const [libraryItems, setLibraryItems] = React.useState<LibraryIngredient[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);
  const [filterCat, setFilterCat] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [addingNew, setAddingNew] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newCategory, setNewCategory] = React.useState('Övrigt');
  const [savingNew, setSavingNew] = React.useState(false);

  const fetchIngredients = React.useCallback(() => {
    supabase
      .from('recipe_ingredients')
      .select('id, name_sv, name_en, category')
      .eq('is_active', true)
      .order('category')
      .order('display_order')
      .then(({ data }) => {
        if (data) setLibraryItems(data as LibraryIngredient[]);
        setLoaded(true);
      });
  }, []);

  React.useEffect(() => {
    if (!loaded) fetchIngredients();
  }, [loaded, fetchIngredients]);

  const currentIngredients = React.useMemo(
    () => formData.ingredients.split(',').map(s => s.trim()).filter(Boolean),
    [formData.ingredients]
  );

  const addIngredient = React.useCallback((name: string, id?: string) => {
    if (!currentIngredients.includes(name)) {
      const next = [...currentIngredients, name].join(', ');
      setFormData(prev => ({
        ...prev,
        ingredients: next,
        ingredientIds: id ? [...(prev.ingredientIds || []), id] : prev.ingredientIds,
      }));
    }
  }, [currentIngredients, setFormData]);

  const removeIngredient = React.useCallback((name: string) => {
    const idx = currentIngredients.indexOf(name);
    const next = currentIngredients.filter(i => i !== name).join(', ');
    // Also remove corresponding ingredient ID
    const matchingLib = libraryItems.find(li => li.name_sv === name);
    setFormData(prev => ({
      ...prev,
      ingredients: next,
      ingredientIds: matchingLib ? (prev.ingredientIds || []).filter(id => id !== matchingLib.id) : prev.ingredientIds,
    }));
  }, [currentIngredients, setFormData, libraryItems]);

  const categories = React.useMemo(
    () => [...new Set(libraryItems.map(i => i.category))].sort(),
    [libraryItems]
  );

  const filteredItems = React.useMemo(() => {
    let items = filterCat === 'all' ? libraryItems : libraryItems.filter(i => i.category === filterCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name_sv.toLowerCase().includes(q) || (i.name_en && i.name_en.toLowerCase().includes(q)));
    }
    return items;
  }, [libraryItems, filterCat, search]);

  const handleAddNew = async () => {
    if (!newName.trim()) return;
    setSavingNew(true);
    const { data: inserted, error } = await supabase.from('recipe_ingredients').insert({
      name_sv: newName.trim(),
      category: newCategory,
      display_order: libraryItems.length,
    }).select('id').single();
    if (!error && inserted) {
      addIngredient(newName.trim(), inserted.id);
      setNewName('');
      setAddingNew(false);
      fetchIngredients();
    }
    setSavingNew(false);
  };

  const sv = language === 'sv';
  const searchHasNoResults = search.trim() && filteredItems.length === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <FlaskConical className="w-4 h-4" />
          {sv ? 'Ingredienser' : 'Ingredients'}
        </Label>
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <FlaskConical className="w-3 h-3" />
          {showPicker ? (sv ? 'Dölj bibliotek' : 'Hide library') : (sv ? 'Välj från bibliotek' : 'Pick from library')}
        </button>
      </div>

      {/* Current ingredients as removable chips */}
      {currentIngredients.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {currentIngredients.map(ing => (
            <span
              key={ing}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors"
              onClick={() => removeIngredient(ing)}
            >
              {ing} <X className="w-3 h-3" />
            </span>
          ))}
        </div>
      )}

      {/* Library picker */}
      {showPicker && (
        <div className="border border-border rounded-lg p-3 bg-secondary/20 space-y-3">
          {/* Search */}
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={sv ? 'Sök ingrediens...' : 'Search ingredient...'}
            className="h-8 text-xs"
          />

          {/* Category filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">{sv ? 'Kategori:' : 'Category:'}</span>
            <button
              type="button"
              onClick={() => setFilterCat('all')}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                filterCat === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {sv ? 'Alla' : 'All'}
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCat(cat)}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                  filterCat === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {filteredItems.map(item => {
              const isSelected = currentIngredients.includes(item.name_sv);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => isSelected ? removeIngredient(item.name_sv) : addIngredient(item.name_sv, item.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    isSelected
                      ? 'bg-primary/15 border-primary/30 text-primary font-medium'
                      : 'bg-background border-border text-foreground hover:bg-primary/5 hover:border-primary/20'
                  }`}
                >
                  {isSelected ? '✓ ' : '+ '}{item.name_sv}
                </button>
              );
            })}
            {filteredItems.length === 0 && !searchHasNoResults && (
              <p className="text-xs text-muted-foreground py-2">{sv ? 'Inga ingredienser i denna kategori' : 'No ingredients in this category'}</p>
            )}
          </div>

          {/* No results → offer to add new */}
          {searchHasNoResults && (
            <div className="bg-background rounded-md p-2.5 border border-dashed border-primary/30 space-y-2">
              <p className="text-xs text-muted-foreground">
                {sv ? `Ingen match för "${search}". Lägg till som ny?` : `No match for "${search}". Add as new?`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1"
                  onClick={() => { setNewName(search); setAddingNew(true); }}
                >
                  <Plus className="w-3 h-3" />
                  {sv ? 'Lägg till' : 'Add'}
                </Button>
              </div>
            </div>
          )}

          {/* Inline add new */}
          {!searchHasNoResults && (
            <button
              type="button"
              onClick={() => setAddingNew(!addingNew)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              {sv ? 'Lägg till ny ingrediens' : 'Add new ingredient'}
            </button>
          )}

          {addingNew && (
            <div className="bg-background rounded-md p-2.5 border border-primary/20 space-y-2">
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={sv ? 'Ingrediensnamn' : 'Ingredient name'}
                className="h-7 text-xs"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="h-7 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Eteriska oljor', 'Basoljor & Smör', 'Lösningsmedel', 'Naturliga baser', 'Tillsatser & Konserveringsmedel', 'Övrigt'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={handleAddNew} disabled={savingNew || !newName.trim()}>
                  <Save className="w-3 h-3" /> {sv ? 'Spara' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual input fallback */}
      <Textarea
        id="ingredients"
        value={formData.ingredients}
        onChange={(e) => setFormData((prev) => ({ ...prev, ingredients: e.target.value }))}
        placeholder={sv ? 'Kokosolja, Sheasmör, Bivax... (eller välj från biblioteket)' : 'Coconut Oil, Shea Butter... (or pick from library)'}
        rows={2}
        className="text-xs"
      />
    </div>
  );
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// ─── AI Content Generator ───
function AiContentGenerator({
  language,
  formData,
  setFormData,
}: {
  language: string;
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}) {
  const [generating, setGenerating] = React.useState(false);
  const sv = language === 'sv';

  const handleGenerate = async () => {
    if (!formData.title.trim()) {
      toast.error(sv ? 'Ange ett produktnamn först' : 'Enter a product name first');
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-content', {
        body: {
          productName: formData.title,
          category: formData.productType || null,
          ingredients: formData.ingredients || null,
          existingData: {
            description: formData.description,
            feeling: formData.feeling,
            effects: formData.effects,
            usage: formData.usage,
            shelfLife: formData.shelfLife,
            material: formData.material,
            specialEffects: formData.specialEffects,
            usageArea: formData.usageArea,
            usageSteps: [formData.usageStep1, formData.usageStep2, formData.usageStep3].filter(Boolean),
            isConcentrate: formData.isConcentrate,
          },
          language: sv ? 'sv' : 'en',
        },
      });

      if (error) throw error;
      const content = data?.content;
      if (!content) throw new Error('No content returned');

      // Build hook + description combo
      const hookLine = content.hook ? content.hook : '';
      const descWithHook = hookLine
        ? `${hookLine}\n\n${content.description || ''}`
        : (content.description || '');

      // Build extended description with trust + upsell
      let extDesc = content.extended_description || '';
      if (content.trust_badges) {
        extDesc += `\n\n🛡️ ${content.trust_badges}`;
      }
      if (content.upsell_text) {
        extDesc += `\n\n💡 ${content.upsell_text}`;
      }

      setFormData(prev => ({
        ...prev,
        description: prev.description || descWithHook,
        extendedDescription: prev.extendedDescription || extDesc,
        effects: prev.effects || content.effects || '',
        feeling: prev.feeling || content.feeling || '',
        usage: prev.usage || content.usage || '',
        metaTitle: prev.metaTitle || content.seo_title || '',
        metaDescription: prev.metaDescription || content.meta_description || '',
        metaKeywords: prev.metaKeywords || content.meta_keywords || '',
      }));

      toast.success(sv ? 'Innehåll genererat! Redigera efter behov.' : 'Content generated! Edit as needed.');
    } catch (err: any) {
      console.error('AI generation failed:', err);
      toast.error(sv ? 'Kunde inte generera innehåll' : 'Failed to generate content');
    } finally {
      setGenerating(false);
    }
  };

  const hasEmptyFields = !formData.description || !formData.extendedDescription || !formData.effects || !formData.feeling || !formData.usage;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {sv ? '🤖 AI-assistent' : '🤖 AI Assistant'}
        </p>
        {hasEmptyFields && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={handleGenerate}
            disabled={generating || !formData.title.trim()}
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            {generating
              ? (sv ? 'Genererar...' : 'Generating...')
              : (sv ? 'Generera innehåll med AI' : 'Generate content with AI')}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {sv
          ? 'Fyll tomma fält automatiskt baserat på produktnamn, kategori och ingredienser.'
          : 'Auto-fill empty fields based on product name, category and ingredients.'}
      </p>
    </div>
  );
}

// ─── AI Metadata Suggestor (auto-categorize) ───
function AiMetadataSuggestor({
  language,
  formData,
  setFormData,
}: {
  language: string;
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}) {
  const [suggesting, setSuggesting] = React.useState(false);
  const sv = language === 'sv';

  const handleSuggest = async () => {
    if (!formData.title.trim()) {
      toast.error(sv ? 'Ange ett produktnamn först' : 'Enter a product name first');
      return;
    }
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-product-metadata', {
        body: {
          productName: formData.title,
          description: formData.description || null,
          ingredients: formData.ingredients || null,
        },
      });

      if (error) throw error;
      const s = data?.suggestions;
      if (!s) throw new Error('No suggestions returned');

      setFormData(prev => ({
        ...prev,
        categoryIds: s.categoryIds?.length ? s.categoryIds : prev.categoryIds,
        tagIds: s.tagIds?.length ? s.tagIds : prev.tagIds,
      }));

      const newTagNames = s.suggestedNewTags || [];
      if (newTagNames.length > 0) {
        toast.info(
          sv
            ? `AI föreslår nya taggar: ${newTagNames.join(', ')}`
            : `AI suggests new tags: ${newTagNames.join(', ')}`
        );
      }

      toast.success(sv ? 'Kategorier & taggar föreslagna!' : 'Categories & tags suggested!');
    } catch (err: any) {
      console.error('AI suggest failed:', err);
      toast.error(sv ? 'Kunde inte hämta förslag' : 'Failed to get suggestions');
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs h-7 w-full"
      onClick={handleSuggest}
      disabled={suggesting || !formData.title.trim()}
    >
      {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      {suggesting
        ? (sv ? 'Analyserar...' : 'Analyzing...')
        : (sv ? '🤖 Föreslå kategorier & taggar med AI' : '🤖 Suggest categories & tags with AI')}
    </Button>
  );
}

// ─── Category Multi-Select ───
function CategoryMultiSelect({
  language,
  selectedIds,
  onChange,
}: {
  language: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: categories = [] } = useQuery({
    queryKey: ['form-categories'],
    queryFn: () => fetchCategories(true),
    staleTime: 30_000,
  });

  const sv = language === 'sv';
  const parents = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-secondary/20 space-y-2 max-h-48 overflow-y-auto">
      {parents.map(parent => {
        const children = getChildren(parent.id);
        const isSelected = selectedIds.includes(parent.id);
        return (
          <div key={parent.id}>
            <button
              type="button"
              onClick={() => toggle(parent.id)}
              className={`flex items-center gap-2 w-full text-left text-sm px-2 py-1 rounded transition-colors ${
                isSelected ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-secondary/60'
              }`}
            >
              {isSelected ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5" />}
              {parent.name_sv}
            </button>
            {children.length > 0 && (
              <div className="ml-5 space-y-0.5">
                {children.map(child => {
                  const childSelected = selectedIds.includes(child.id);
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => toggle(child.id)}
                      className={`flex items-center gap-2 w-full text-left text-xs px-2 py-0.5 rounded transition-colors ${
                        childSelected ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-secondary/60 text-muted-foreground'
                      }`}
                    >
                      {childSelected ? <Check className="w-3 h-3" /> : <span className="w-3" />}
                      {child.name_sv}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {categories.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          {sv ? 'Inga kategorier skapade ännu' : 'No categories created yet'}
        </p>
      )}
    </div>
  );
}

// ─── Tag Multi-Select (DB-driven) ───
function TagMultiSelect({
  language,
  selectedIds,
  onChange,
}: {
  language: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data: tags = [] } = useQuery({
    queryKey: ['form-tags'],
    queryFn: fetchTags,
    staleTime: 30_000,
  });

  const sv = language === 'sv';

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div className="flex flex-wrap gap-1.5 border border-border rounded-lg p-3 bg-secondary/20">
      {tags.map(tag => {
        const isSelected = selectedIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              isSelected
                ? 'bg-primary/15 border-primary/30 text-primary font-medium'
                : 'bg-background border-border text-foreground hover:bg-primary/5 hover:border-primary/20'
            }`}
          >
            {isSelected ? '✓ ' : '+ '}{tag.name_sv}
          </button>
        );
      })}
      {tags.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2 w-full">
          {sv ? 'Inga taggar skapade ännu' : 'No tags created yet'}
        </p>
      )}
    </div>
  );
}

export function AdminProductForm({
  t,
  language,
  productCategories,
  suggestedTags,
  formData,
  setFormData,
  isEdit,
  isSubmitting,
  onCancel,
  onSubmit,
  onImageUpload,
}: {
  t: AdminProductFormStrings;
  language: string;
  productCategories: ProductCategoryOption[];
  suggestedTags: string[];
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  isEdit: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onImageUpload?: (urls: string[]) => void;
}) {
  const currentTags = React.useMemo(() => parseTags(formData.tags), [formData.tags]);
  const [isUploading, setIsUploading] = React.useState(false);

  const handleImageUpload = React.useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const newUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: false });
        if (!error) {
          const { data } = supabase.storage.from('product-images').getPublicUrl(path);
          newUrls.push(data.publicUrl);
        }
      }
      if (newUrls.length > 0) {
        const updated = [...(formData.imageUrls || []), ...newUrls];
        setFormData(prev => ({ ...prev, imageUrls: updated }));
        onImageUpload?.(updated);
      }
    } finally {
      setIsUploading(false);
    }
  }, [formData.imageUrls, setFormData, onImageUpload]);

  const removeImage = React.useCallback((url: string) => {
    const updated = (formData.imageUrls || []).filter(u => u !== url);
    setFormData(prev => ({ ...prev, imageUrls: updated }));
  }, [formData.imageUrls, setFormData]);

  // Keep inventory typing local so the dialog/form doesn't re-render on every keypress
  // (this was causing focus-loss/scroll-jumps in some browsers)
  const inventoryFocusedRef = React.useRef(false);
  const [inventoryDraft, setInventoryDraft] = React.useState<string>(
    String(Number.isFinite(formData.inventory) ? formData.inventory : 0)
  );

  React.useEffect(() => {
    if (!inventoryFocusedRef.current) {
      setInventoryDraft(String(Number.isFinite(formData.inventory) ? formData.inventory : 0));
    }
  }, [formData.inventory]);

  const commitInventoryDraft = React.useCallback(() => {
    const next = inventoryDraft.trim() === '' ? 0 : Number(inventoryDraft);
    const safe = Number.isFinite(next) ? Math.max(0, Math.trunc(next)) : 0;
    setFormData((prev) => ({ ...prev, inventory: safe }));
  }, [inventoryDraft, setFormData]);

  const setInventory = React.useCallback(
    (next: number) => {
      const safe = Number.isFinite(next) ? Math.max(0, Math.trunc(next)) : 0;
      setInventoryDraft(String(safe));
      setFormData((prev) => ({ ...prev, inventory: safe }));
    },
    [setFormData]
  );

  const addTag = React.useCallback(
    (tag: string) => {
      const tags = parseTags(formData.tags);
      if (!tags.includes(tag)) {
        const next = [...tags, tag].join(', ');
        setFormData((prev) => ({ ...prev, tags: next }));
      }
    },
    [formData.tags, setFormData]
  );

  const removeTag = React.useCallback(
    (tagToRemove: string) => {
      const tags = parseTags(formData.tags);
      const next = tags.filter((t) => t !== tagToRemove).join(', ');
      setFormData((prev) => ({ ...prev, tags: next }));
    },
    [formData.tags, setFormData]
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-h-[85vh] overflow-y-auto pr-2 -mr-2">
      {/* ── Step 1: Grundinfo ── */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {language === 'sv' ? '📦 Grundinfo' : '📦 Basic Info'}
      </p>
      <div className="space-y-2">
        <Label htmlFor="title">{t.productName}</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Naturlig Deodorant"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t.description}</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Aluminiumfri, naturlig doft..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price" className="text-base font-medium">{t.price}</Label>
          <div className="flex gap-2 items-center">
            <Select
              value={formData.currency || 'SEK'}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, currency: value }))}
            >
              <SelectTrigger className="w-[72px] shrink-0 h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.value} ({c.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id="price"
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              value={formData.price}
              onChange={(e) => {
                const val = e.target.value.replace(',', '.');
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setFormData((prev) => ({ ...prev, price: val }));
                }
              }}
              placeholder="159"
              className="text-xl font-bold h-12 min-w-0 flex-1"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t.category}</Label>
          <CategoryMultiSelect
            language={language}
            selectedIds={formData.categoryIds}
            onChange={(ids) => setFormData(prev => ({ ...prev, categoryIds: ids }))}
          />
        </div>
      </div>

      {/* Tags (DB-driven) */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Tag className="w-4 h-4" />
          {language === 'sv' ? 'Taggar' : 'Tags'}
        </Label>
        <TagMultiSelect
          language={language}
          selectedIds={formData.tagIds}
          onChange={(ids) => setFormData(prev => ({ ...prev, tagIds: ids }))}
        />
      </div>

      {/* AI Auto-categorize */}
      <AiMetadataSuggestor
        language={language}
        formData={formData}
        setFormData={setFormData}
      />

      {/* Free-text tags (legacy/custom) */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{language === 'sv' ? 'Egna taggar (fritext)' : 'Custom tags (free text)'}</Label>
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={formData.tags}
            onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder={t.tagsPlaceholder}
            className="pl-9 text-xs h-8"
          />
        </div>

        {currentTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {currentTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive/20 text-xs"
                onClick={() => removeTag(tag)}
              >
                {tag} ×
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Visibility & Inventory */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">
        {language === 'sv' ? '💰 Pris & lager' : '💰 Price & Inventory'}
      </p>
      <div className="bg-secondary/30 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {formData.isVisible ? (
              <Eye className="w-4 h-4 text-primary" />
            ) : (
              <EyeOff className="w-4 h-4 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium text-sm">{t.visibility}</p>
              <p className="text-xs text-muted-foreground">
                {formData.isVisible ? t.visibleInStore : t.hiddenFromStore}
              </p>
            </div>
          </div>
          <Switch
            checked={formData.isVisible}
            onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isVisible: checked }))}
          />
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Boxes className="w-4 h-4 text-primary" />
            <p className="font-medium text-sm">{t.inventory}</p>
          </div>

          <div className="flex items-center gap-3 mb-3" onClick={(e) => e.stopPropagation()}>
            <Label className="text-sm">{t.currentStock}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                   const current = inventoryDraft.trim() === '' ? 0 : Number(inventoryDraft);
                   setInventory(Math.max(0, (Number.isFinite(current) ? current : 0) - 1));
                }}
              >
                <Minus className="w-4 h-4" />
              </Button>

              <Input
                type="text"
                value={inventoryDraft}
                onChange={(e) => {
                  e.stopPropagation();
                  const cleaned = e.target.value.replace(/[^0-9]/g, '');
                  setInventoryDraft(cleaned);
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => {
                  e.stopPropagation();
                  inventoryFocusedRef.current = true;
                  e.target.select();
                }}
                onBlur={() => {
                  inventoryFocusedRef.current = false;
                  commitInventoryDraft();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitInventoryDraft();
                  }
                }}
                className="w-24 text-center"
                autoComplete="off"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={t.currentStock}
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const current = inventoryDraft.trim() === '' ? 0 : Number(inventoryDraft);
                  setInventory((Number.isFinite(current) ? current : 0) + 1);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">{t.allowOverselling}</p>
              <p className="text-xs text-muted-foreground">{t.oversellHint}</p>
            </div>
            <Switch
              checked={formData.allowOverselling}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, allowOverselling: checked }))
              }
            />
          </div>
        </div>
      </div>

      {/* Image upload section */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">
        {language === 'sv' ? '🖼️ Media & innehåll' : '🖼️ Media & Content'}
      </p>
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Image className="w-4 h-4" /> Produktbilder</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {(formData.imageUrls || []).map((url) => (
            <div key={url} className="relative w-20 h-20 rounded-md overflow-hidden border border-border group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <label className="w-20 h-20 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/50 transition-colors">
            {isUploading ? (
              <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <>
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mt-1">Ladda upp</span>
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      {/* Recipe Template Picker */}
      <RecipeTemplatePicker
        formData={formData}
        setFormData={setFormData}
        language={language}
      />

      {/* Ingredients with library picker */}
      <IngredientPickerSection
        language={language}
        formData={formData}
        setFormData={setFormData}
      />

      {/* ── PIM: Produktdata ── */}
      <div className="border-t border-border pt-4 mt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {language === 'sv' ? '🧪 Produktdata' : '🧪 Product Data'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="shelfLife" className="text-xs">
              {language === 'sv' ? 'Hållbarhet' : 'Shelf Life'}
            </Label>
            <Input
              id="shelfLife"
              value={formData.shelfLife}
              onChange={(e) => setFormData(prev => ({ ...prev, shelfLife: e.target.value }))}
              placeholder={language === 'sv' ? 'Ex: 12 månader' : 'e.g. 12 months'}
              className="text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="material" className="text-xs">
              {language === 'sv' ? 'Material' : 'Material'}
            </Label>
            <Input
              id="material"
              value={formData.material}
              onChange={(e) => setFormData(prev => ({ ...prev, material: e.target.value }))}
              placeholder={language === 'sv' ? 'Ex: Naturlig mentol, kristallform' : 'e.g. Natural menthol, crystal form'}
              className="text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="specialEffects" className="text-xs">
              {language === 'sv' ? 'Specialeffekter' : 'Special Effects'}
            </Label>
            <Input
              id="specialEffects"
              value={formData.specialEffects}
              onChange={(e) => setFormData(prev => ({ ...prev, specialEffects: e.target.value }))}
              placeholder={language === 'sv' ? 'Ex: Kylande, uppfriskande' : 'e.g. Cooling, refreshing'}
              className="text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="usageArea" className="text-xs">
              {language === 'sv' ? 'Användningsområde' : 'Usage Area'}
            </Label>
            <Input
              id="usageArea"
              value={formData.usageArea}
              onChange={(e) => setFormData(prev => ({ ...prev, usageArea: e.target.value }))}
              placeholder={language === 'sv' ? 'Ex: Bastu, andning, aromaterapi' : 'e.g. Sauna, breathing, aromatherapy'}
              className="text-xs"
            />
          </div>
        </div>

        {/* Certifications */}
        <div className="space-y-1.5 mt-3">
          <Label htmlFor="certifications" className="text-xs">
            {language === 'sv' ? 'Certifieringar' : 'Certifications'}
          </Label>
          <Input
            id="certifications"
            value={formData.certifications}
            onChange={(e) => setFormData(prev => ({ ...prev, certifications: e.target.value }))}
            placeholder="Cruelty-Free, Vegan, Organic..."
            className="text-xs"
          />
        </div>
      </div>

      {/* ── Structured Usage Steps ── */}
      <div className="border-t border-border pt-4 mt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {language === 'sv' ? '📋 Användning (3 steg)' : '📋 Usage (3 steps)'}
        </p>
        <div className="space-y-2">
          {[
            { key: 'usageStep1' as const, num: '1' },
            { key: 'usageStep2' as const, num: '2' },
            { key: 'usageStep3' as const, num: '3' },
          ].map(({ key, num }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">{num}</span>
              <Input
                value={formData[key]}
                onChange={(e) => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={language === 'sv'
                  ? num === '1' ? 'Ex: Tillsätt en nypa kristaller' : num === '2' ? 'Ex: Häll på varmt vatten' : 'Ex: Njut av doften'
                  : num === '1' ? 'e.g. Add a pinch of crystals' : num === '2' ? 'e.g. Pour hot water' : 'e.g. Enjoy the scent'
                }
                className="text-xs"
              />
            </div>
          ))}
        </div>
        {/* Legacy usage field */}
        <div className="space-y-1.5 mt-3">
          <Label htmlFor="recipe" className="text-xs text-muted-foreground">
            {language === 'sv' ? 'Recept / Extra instruktioner' : 'Recipe / Extra instructions'}
          </Label>
          <Textarea
            id="recipe"
            value={formData.recipe}
            onChange={(e) => setFormData(prev => ({ ...prev, recipe: e.target.value }))}
            placeholder={language === 'sv' ? 'Fritext...' : 'Freeform...'}
            rows={2}
            className="text-xs"
          />
        </div>
      </div>

      {/* ── Weight Field ── */}
      <div className="border-t border-border pt-4 mt-2">
        <div className="space-y-2">
          <Label htmlFor="weightGrams" className="flex items-center gap-1.5">
            <Weight className="w-4 h-4" />
            {language === 'sv' ? 'Vikt (gram)' : 'Weight (grams)'}
          </Label>
          <Input
            id="weightGrams"
            type="number"
            value={formData.weightGrams}
            onChange={(e) => setFormData(prev => ({ ...prev, weightGrams: e.target.value }))}
            placeholder={language === 'sv' ? 'Ex: 250' : 'e.g. 250'}
            className="w-40"
            min="0"
          />
          {!formData.weightGrams && formData.title && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              ⚠️ {language === 'sv' ? 'Vikt saknas — fraktberäkning använder standardpris' : 'Weight missing — shipping uses default price'}
            </p>
          )}
        </div>
      </div>

      {/* ── JSON Import ── */}
      <div className="border-t border-border pt-4 mt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          {language === 'sv' ? '📥 Importera produktdata' : '📥 Import Product Data'}
        </p>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs h-7" asChild>
              <span>
                <Upload className="w-3 h-3" />
                {language === 'sv' ? 'Importera JSON' : 'Import JSON'}
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const data = JSON.parse(text);
                  setFormData(prev => ({
                    ...prev,
                    title: data.title || prev.title,
                    description: data.description || prev.description,
                    price: data.price?.toString() || prev.price,
                    ingredients: data.ingredients || prev.ingredients,
                    shelfLife: data.shelfLife || data.shelf_life || prev.shelfLife,
                    material: data.material || prev.material,
                    specialEffects: data.specialEffects || data.special_effects || prev.specialEffects,
                    usageArea: data.usageArea || data.usage_area || prev.usageArea,
                    usageStep1: data.usageStep1 || data.step1 || prev.usageStep1,
                    usageStep2: data.usageStep2 || data.step2 || prev.usageStep2,
                    usageStep3: data.usageStep3 || data.step3 || prev.usageStep3,
                    weightGrams: data.weightGrams?.toString() || data.weight?.toString() || prev.weightGrams,
                    certifications: Array.isArray(data.certifications) ? data.certifications.join(', ') : (data.certifications || prev.certifications),
                  }));
                  toast.success(language === 'sv' ? 'Produktdata importerad!' : 'Product data imported!');
                } catch {
                  toast.error(language === 'sv' ? 'Ogiltig JSON-fil' : 'Invalid JSON file');
                }
                e.target.value = '';
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {language === 'sv' ? 'Ladda upp en JSON-fil med produktdata' : 'Upload a JSON file with product data'}
          </p>
        </div>
      </div>

      {/* ── AI Content Generation ── */}
      <div className="border-t border-border pt-4 mt-2">
        <AiContentGenerator
          language={language}
          formData={formData}
          setFormData={setFormData}
        />
      </div>

      {/* ── Storytelling Fields (AI output) ── */}
      <div className="border-t border-border pt-4 mt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {language === 'sv' ? '✨ Storytelling (AI-genererat)' : '✨ Storytelling (AI-generated)'}
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="feeling" className="text-xs">
              {language === 'sv' ? 'Känsla / Upplevelse' : 'Feeling / Experience'}
            </Label>
            <Textarea
              id="feeling"
              value={formData.feeling}
              onChange={(e) => setFormData(prev => ({ ...prev, feeling: e.target.value }))}
              placeholder={language === 'sv' ? 'Tänk dig att öppna bastudörren...' : 'Imagine opening the sauna door...'}
              rows={2}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="effects" className="text-xs">
              {language === 'sv' ? 'Effekt / Fördelar (en per rad)' : 'Effects / Benefits (one per line)'}
            </Label>
            <Textarea
              id="effects"
              value={formData.effects}
              onChange={(e) => setFormData(prev => ({ ...prev, effects: e.target.value }))}
              placeholder={language === 'sv' ? 'Uppiggande & kylande\nFräsch mentholton' : 'Invigorating & cooling\nFresh menthol tone'}
              rows={3}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="usage" className="text-xs">
              {language === 'sv' ? 'Användning (fritext)' : 'How to use (freeform)'}
            </Label>
            <Input
              id="usage"
              value={formData.usage}
              onChange={(e) => setFormData(prev => ({ ...prev, usage: e.target.value }))}
              placeholder={language === 'sv' ? '5 droppar per skopa vatten' : '5 drops per scoop of water'}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="extendedDescription" className="text-xs">
              {language === 'sv' ? 'Utökad beskrivning' : 'Extended description'}
            </Label>
            <Textarea
              id="extendedDescription"
              value={formData.extendedDescription}
              onChange={(e) => setFormData(prev => ({ ...prev, extendedDescription: e.target.value }))}
              placeholder={language === 'sv' ? 'Historia, filosofi, säljargument...' : 'Story, philosophy, selling points...'}
              rows={4}
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {/* ── SEO Section with Auto/Manual Toggle ── */}
      <div className="border-t border-border pt-4 mt-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            🔍 SEO
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formData.seoMode === 'auto'
                ? (language === 'sv' ? '🤖 Automatisk SEO' : '🤖 Auto SEO')
                : (language === 'sv' ? '✏️ Manuell SEO' : '✏️ Manual SEO')
              }
            </span>
            <Switch
              checked={formData.seoMode === 'manual'}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, seoMode: checked ? 'manual' : 'auto' }))}
            />
          </div>
        </div>

        {/* Google Preview */}
        <div className="mb-4 p-3 rounded-lg bg-secondary/30 border border-border/50">
          <p className="text-xs text-muted-foreground mb-2">{language === 'sv' ? 'Google-förhandsgranskning' : 'Google Preview'}</p>
          <div className="space-y-0.5">
            <p className="text-primary text-sm font-medium truncate">
              {formData.metaTitle || `${formData.title} | 4thepeople`}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              4thepeople.se › produkt › {(formData.title || 'produkt').toLowerCase().replace(/\s+/g, '-').replace(/[^a-zåäö0-9-]/g, '')}
            </p>
            <p className="text-xs text-foreground/70 line-clamp-2">
              {formData.metaDescription || (language === 'sv' ? 'Meta-beskrivning genereras automatiskt...' : 'Meta description will be auto-generated...')}
            </p>
          </div>
        </div>

        {formData.seoMode === 'auto' ? (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs text-muted-foreground">
              {language === 'sv'
                ? '🔒 SEO genereras automatiskt av AI när du sparar. Byt till manuellt läge för att redigera.'
                : '🔒 SEO is auto-generated by AI when you save. Switch to manual mode to edit.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="metaTitle" className="text-xs">SEO-titel</Label>
                <span className={`text-xs ${(formData.metaTitle?.length || 0) > 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {formData.metaTitle?.length || 0}/60
                </span>
              </div>
              <Input
                id="metaTitle"
                value={formData.metaTitle}
                onChange={(e) => setFormData(prev => ({ ...prev, metaTitle: e.target.value }))}
                placeholder={language === 'sv' ? 'Produktnamn — Köp online | 4thepeople' : 'Product Name — Buy online | 4thepeople'}
                className="text-xs"
                maxLength={70}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="metaDescription" className="text-xs">Meta-beskrivning</Label>
                <span className={`text-xs ${(formData.metaDescription?.length || 0) > 155 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {formData.metaDescription?.length || 0}/155
                </span>
              </div>
              <Textarea
                id="metaDescription"
                value={formData.metaDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, metaDescription: e.target.value }))}
                placeholder={language === 'sv' ? 'Köp [produkt] hos 4thepeople. Naturligt, hållbart.' : 'Buy [product] at 4thepeople. Natural, sustainable.'}
                rows={2}
                className="text-xs"
                maxLength={165}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="metaKeywords" className="text-xs">{language === 'sv' ? 'Nyckelord' : 'Keywords'}</Label>
              <Input
                id="metaKeywords"
                value={formData.metaKeywords}
                onChange={(e) => setFormData(prev => ({ ...prev, metaKeywords: e.target.value }))}
                placeholder={language === 'sv' ? 'bastudoft, naturlig, premium' : 'sauna scent, natural, premium'}
                className="text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Required fields check ── */}
      {formData.title && (!formData.weightGrams || !formData.price) && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-700 font-medium">
            {language === 'sv' ? '⚠️ Obligatoriska fält saknas innan publicering:' : '⚠️ Required fields missing before publishing:'}
          </p>
          <ul className="text-xs text-amber-600 mt-1 list-disc list-inside">
            {!formData.price && <li>{language === 'sv' ? 'Pris' : 'Price'}</li>}
            {!formData.weightGrams && <li>{language === 'sv' ? 'Vikt' : 'Weight'}</li>}
          </ul>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          {t.cancel}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || isUploading || !formData.title || (!isEdit && !formData.price)}
          className="flex-1"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center justify-center">
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            </span>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {isEdit ? t.update : t.save}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
