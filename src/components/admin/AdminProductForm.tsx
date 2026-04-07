import * as React from 'react';
import {
  Save, Eye, EyeOff, Boxes, Minus, Plus, Upload, X, Image,
  FlaskConical, Weight, Loader2, Check, ChevronDown, ChevronRight,
  Sparkles, Wand2, Package,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { safeInvoke } from '@/lib/safeInvoke';
import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '@/lib/categories';
import { fetchTags } from '@/lib/tags';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';

// ─── Types ───
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
  shelfLife: string;
  material: string;
  specialEffects: string;
  usageArea: string;
  usageStep1: string;
  usageStep2: string;
  usageStep3: string;
  seoMode: 'auto' | 'manual';
  hook: string;
  dosage: string;
  variants: string;
  storage: string;
  safety: string;
  specifications: string;
  isConcentrate: boolean;
}

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

// ─── Category Multi-Select (compact) ───
function CategorySelect({
  language, selectedIds, onChange,
}: {
  language: string; selectedIds: string[]; onChange: (ids: string[]) => void;
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
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };
  const selectedNames = categories.filter(c => selectedIds.includes(c.id)).map(c => c.name_sv);

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button type="button" className="w-full text-left border border-input rounded-md px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between">
          <span className={selectedNames.length ? 'text-foreground' : 'text-muted-foreground'}>
            {selectedNames.length ? selectedNames.join(', ') : (sv ? 'Välj kategori...' : 'Select category...')}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-border rounded-lg p-2 mt-1 bg-popover max-h-48 overflow-y-auto space-y-0.5">
          {parents.map(parent => {
            const children = getChildren(parent.id);
            return (
              <div key={parent.id}>
                <button type="button" onClick={() => toggle(parent.id)}
                  className={`flex items-center gap-2 w-full text-left text-sm px-2 py-1 rounded transition-colors ${
                    selectedIds.includes(parent.id) ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-accent'
                  }`}>
                  {selectedIds.includes(parent.id) ? <Check className="w-3.5 h-3.5" /> : <span className="w-3.5" />}
                  {parent.name_sv}
                </button>
                {children.length > 0 && (
                  <div className="ml-5 space-y-0.5">
                    {children.map(child => (
                      <button key={child.id} type="button" onClick={() => toggle(child.id)}
                        className={`flex items-center gap-2 w-full text-left text-xs px-2 py-0.5 rounded transition-colors ${
                          selectedIds.includes(child.id) ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-accent text-muted-foreground'
                        }`}>
                        {selectedIds.includes(child.id) ? <Check className="w-3 h-3" /> : <span className="w-3" />}
                        {child.name_sv}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Tag Multi-Select (compact chips) ───
function TagSelect({
  language, selectedIds, onChange,
}: {
  language: string; selectedIds: string[]; onChange: (ids: string[]) => void;
}) {
  const { data: tags = [] } = useQuery({
    queryKey: ['form-tags'],
    queryFn: fetchTags,
    staleTime: 30_000,
  });
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(tag => {
        const sel = selectedIds.includes(tag.id);
        return (
          <button key={tag.id} type="button" onClick={() => toggle(tag.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              sel ? 'bg-primary/15 border-primary/30 text-primary font-medium' : 'bg-background border-border hover:bg-accent hover:border-primary/20'
            }`}>
            {sel ? '✓ ' : '+ '}{tag.name_sv}
          </button>
        );
      })}
      {tags.length === 0 && (
        <p className="text-xs text-muted-foreground py-1">{language === 'sv' ? 'Inga taggar ännu' : 'No tags yet'}</p>
      )}
    </div>
  );
}

// ─── Image Upload Section ───
function ImageUploadSection({
  imageUrls, setFormData, language,
}: {
  imageUrls: string[];
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  language: string;
}) {
  const [isUploading, setIsUploading] = React.useState(false);
  const sv = language === 'sv';

  const handleUpload = async (files: FileList | null) => {
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
        setFormData(prev => ({ ...prev, imageUrls: [...(prev.imageUrls || []), ...newUrls] }));
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5 text-sm font-medium">
        <Image className="w-4 h-4" /> {sv ? 'Bilder' : 'Images'}
      </Label>
      <div className="flex flex-wrap gap-2">
        {imageUrls.map(url => (
          <div key={url} className="relative w-16 h-16 rounded-md overflow-hidden border border-border group">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button type="button"
              onClick={() => setFormData(prev => ({ ...prev, imageUrls: prev.imageUrls.filter(u => u !== url) }))}
              className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        <label className="w-16 h-16 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-accent transition-colors">
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="w-4 h-4 text-muted-foreground" />
          )}
          <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple className="hidden"
            onChange={e => handleUpload(e.target.files)} />
        </label>
      </div>
    </div>
  );
}

// ─── Live Product Card Preview ───
function ProductCardPreview({ formData }: { formData: ProductFormData }) {
  const price = parseFloat(formData.price) || 0;
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
      <div className="aspect-square bg-muted flex items-center justify-center">
        {formData.imageUrls?.[0] ? (
          <img src={formData.imageUrls[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <Package className="w-10 h-10 text-muted-foreground/20" />
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="font-medium text-sm truncate">{formData.title || 'Produktnamn'}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{formData.description || 'Beskrivning...'}</p>
        <p className="text-sm font-bold text-primary">
          {price > 0 ? `${price} ${formData.currency || 'SEK'}` : '– kr'}
        </p>
      </div>
    </div>
  );
}

// ─── Smart Assist (AI Suggestions) ───
function SmartAssistPanel({
  language, formData, setFormData,
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
      const { data, error } = await safeInvoke('suggest-product-metadata', {
        body: {
          productName: formData.title,
          description: formData.description || null,
          ingredients: formData.ingredients || null,
        },
      });
      if (error) throw error;
      const s = data?.suggestions;
      if (!s) throw new Error('No suggestions');

      setFormData(prev => ({
        ...prev,
        categoryIds: s.categoryIds?.length ? s.categoryIds : prev.categoryIds,
        tagIds: s.tagIds?.length ? s.tagIds : prev.tagIds,
      }));
      toast.success(sv ? 'Förslag tillagda!' : 'Suggestions applied!');
    } catch {
      toast.error(sv ? 'Kunde inte hämta förslag' : 'Failed to get suggestions');
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium">{sv ? 'Smart Assist' : 'Smart Assist'}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {sv ? 'Låt AI föreslå kategorier och taggar baserat på produktnamn och beskrivning.'
          : 'Let AI suggest categories and tags based on product name and description.'}
      </p>
      <Button type="button" variant="outline" size="sm" className="w-full gap-1.5 text-xs"
        onClick={handleSuggest} disabled={suggesting || !formData.title.trim()}>
        {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        {suggesting ? (sv ? 'Analyserar...' : 'Analyzing...') : (sv ? 'Föreslå kategorier & taggar' : 'Suggest categories & tags')}
      </Button>
    </div>
  );
}

// ─── Advanced Panel (collapsible) ───
function AdvancedPanel({
  language, formData, setFormData,
}: {
  language: string;
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}) {
  const [open, setOpen] = React.useState(false);
  const sv = language === 'sv';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg border border-border hover:bg-accent transition-colors">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="text-sm font-medium">{sv ? 'Avancerat' : 'Advanced'}</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {sv ? 'Lager, frakt, innehåll, SEO' : 'Inventory, shipping, content, SEO'}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 space-y-5 pl-1">
          {/* ── Inventory ── */}
          <InventorySection language={language} formData={formData} setFormData={setFormData} />

          {/* ── Weight ── */}
          <div className="space-y-2">
            <Label htmlFor="weightGrams" className="flex items-center gap-1.5 text-sm">
              <Weight className="w-4 h-4" /> {sv ? 'Vikt (gram)' : 'Weight (grams)'}
            </Label>
            <Input id="weightGrams" type="number" value={formData.weightGrams} min="0" className="w-40"
              onChange={e => setFormData(prev => ({ ...prev, weightGrams: e.target.value }))}
              placeholder={sv ? 'Ex: 250' : 'e.g. 250'} />
          </div>

          {/* ── Product Content (Hook, Usage, Effects etc) ── */}
          <ContentSection language={language} formData={formData} setFormData={setFormData} />

          {/* ── Ingredients ── */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <FlaskConical className="w-4 h-4" /> {sv ? 'Ingredienser' : 'Ingredients'}
            </Label>
            <Textarea value={formData.ingredients}
              onChange={e => setFormData(prev => ({ ...prev, ingredients: e.target.value }))}
              placeholder={sv ? 'Kokosolja, Sheasmör...' : 'Coconut Oil, Shea Butter...'}
              rows={2} className="text-xs" />
          </div>

          {/* ── Concentrate toggle ── */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <div>
              <p className="text-sm font-medium">{sv ? 'Koncentrat' : 'Concentrate'}</p>
              <p className="text-xs text-muted-foreground">{sv ? 'Ska spädas före användning' : 'Must be diluted before use'}</p>
            </div>
            <Switch checked={formData.isConcentrate}
              onCheckedChange={checked => setFormData(prev => ({ ...prev, isConcentrate: checked }))} />
          </div>

          {/* ── SEO ── */}
          <SEOSection language={language} formData={formData} setFormData={setFormData} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Inventory sub-section ───
function InventorySection({
  language, formData, setFormData,
}: {
  language: string;
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}) {
  const sv = language === 'sv';
  const [draft, setDraft] = React.useState(String(formData.inventory || 0));
  const focusRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusRef.current) setDraft(String(formData.inventory || 0));
  }, [formData.inventory]);

  const commit = () => {
    const n = parseInt(draft) || 0;
    setFormData(prev => ({ ...prev, inventory: Math.max(0, n) }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Boxes className="w-4 h-4 text-primary" />
        <Label className="text-sm font-medium">{sv ? 'Lager' : 'Inventory'}</Label>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8"
          onClick={() => { const n = Math.max(0, (parseInt(draft) || 0) - 1); setDraft(String(n)); setFormData(prev => ({ ...prev, inventory: n })); }}>
          <Minus className="w-4 h-4" />
        </Button>
        <Input type="text" inputMode="numeric" value={draft} className="w-20 text-center"
          onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onFocus={() => { focusRef.current = true; }}
          onBlur={() => { focusRef.current = false; commit(); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
        <Button type="button" variant="outline" size="icon" className="h-8 w-8"
          onClick={() => { const n = (parseInt(draft) || 0) + 1; setDraft(String(n)); setFormData(prev => ({ ...prev, inventory: n })); }}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">{sv ? 'Tillåt överkorsförsäljning' : 'Allow overselling'}</p>
          <p className="text-xs text-muted-foreground">{sv ? 'Kunder kan köpa även vid 0 st' : 'Customers can buy at 0 stock'}</p>
        </div>
        <Switch checked={formData.allowOverselling}
          onCheckedChange={checked => setFormData(prev => ({ ...prev, allowOverselling: checked }))} />
      </div>
    </div>
  );
}

// ─── Product content sub-section ───
function ContentSection({
  language, formData, setFormData,
}: {
  language: string;
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}) {
  const sv = language === 'sv';
  const fields: { key: keyof ProductFormData; label: string; placeholder: string; rows?: number }[] = [
    { key: 'hook', label: sv ? 'Hook (kort säljmening)' : 'Hook (selling line)', placeholder: sv ? 'Öppnar luftvägarna direkt' : 'Opens your airways instantly' },
    { key: 'extendedDescription', label: sv ? 'Full beskrivning' : 'Full description', placeholder: sv ? 'Detaljerad produktbeskrivning...' : 'Detailed product description...', rows: 3 },
    { key: 'usage', label: sv ? 'Användning' : 'Usage', placeholder: sv ? '1. Tillsätt\n2. Häll vatten\n3. Njut' : '1. Add\n2. Pour water\n3. Enjoy', rows: 3 },
    { key: 'dosage', label: sv ? 'Dosering' : 'Dosage', placeholder: sv ? '10ml = ca 200 droppar' : '10ml = ~200 drops', rows: 2 },
    { key: 'effects', label: sv ? 'Fördelar' : 'Benefits', placeholder: sv ? '✓ Öppnar luftvägarna\n✓ Uppfriskande' : '✓ Opens airways\n✓ Refreshing', rows: 2 },
    { key: 'feeling', label: sv ? 'Känsla' : 'Feeling', placeholder: sv ? 'En kylande känsla...' : 'A cooling sensation...', rows: 2 },
    { key: 'storage', label: sv ? 'Förvaring' : 'Storage', placeholder: sv ? 'Svalt och mörkt' : 'Cool and dark' },
    { key: 'safety', label: sv ? 'Säkerhet' : 'Safety', placeholder: sv ? 'Endast utvärtes bruk' : 'External use only', rows: 2 },
  ];

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
          {sv ? 'Produktinnehåll (hook, användning, effekter...)' : 'Product content (hook, usage, effects...)'}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 mt-3">
          {fields.map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs font-medium">{f.label}</Label>
              {f.rows ? (
                <Textarea value={formData[f.key] as string}
                  onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} rows={f.rows} className="text-xs" />
              ) : (
                <Input value={formData[f.key] as string}
                  onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} className="text-xs" />
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── SEO sub-section ───
function SEOSection({
  language, formData, setFormData,
}: {
  language: string;
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}) {
  const sv = language === 'sv';
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
          {sv ? 'SEO & marknadsföring' : 'SEO & marketing'}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 mt-3">
          {/* Preview */}
          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 space-y-0.5">
            <p className="text-xs text-muted-foreground mb-1">{sv ? 'Google-förhandsgranskning' : 'Google Preview'}</p>
            <p className="text-primary text-sm font-medium truncate">{formData.metaTitle || `${formData.title} | 4thepeople`}</p>
            <p className="text-xs text-muted-foreground truncate">
              4thepeople.se › produkt › {(formData.title || 'produkt').toLowerCase().replace(/\s+/g, '-').replace(/[^a-zåäö0-9-]/g, '')}
            </p>
            <p className="text-xs text-foreground/70 line-clamp-2">
              {formData.metaDescription || (sv ? 'Genereras automatiskt...' : 'Auto-generated...')}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">SEO-titel</Label>
            <Input value={formData.metaTitle}
              onChange={e => setFormData(prev => ({ ...prev, metaTitle: e.target.value }))}
              placeholder={sv ? 'Produktnamn | 4thepeople' : 'Product Name | 4thepeople'}
              className="text-xs" maxLength={70} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Meta-beskrivning</Label>
            <Textarea value={formData.metaDescription}
              onChange={e => setFormData(prev => ({ ...prev, metaDescription: e.target.value }))}
              placeholder={sv ? 'Köp [produkt] hos 4thepeople...' : 'Buy [product] at 4thepeople...'}
              rows={2} className="text-xs" maxLength={165} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{sv ? 'Nyckelord' : 'Keywords'}</Label>
            <Input value={formData.metaKeywords}
              onChange={e => setFormData(prev => ({ ...prev, metaKeywords: e.target.value }))}
              placeholder={sv ? 'bastudoft, naturlig, premium' : 'sauna, natural, premium'}
              className="text-xs" />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ═══════════════════════════════════════════════
// MAIN FORM — 3-Mode Layout
// ═══════════════════════════════════════════════
export function AdminProductForm({
  t, language, formData, setFormData,
  isEdit, isSubmitting, onCancel, onSubmit,
  // kept for backward compat but unused in new UI
  productCategories: _pc, suggestedTags: _st, onImageUpload: _oiu,
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
  const sv = language === 'sv';
  const [showAssist, setShowAssist] = React.useState(false);

  return (
    <form onSubmit={onSubmit} className="flex flex-col lg:flex-row gap-6 max-h-[85vh] overflow-y-auto pr-1 -mr-1">
      {/* ── LEFT: Form ── */}
      <div className="flex-1 space-y-5 min-w-0">
        {/* ══ QUICK CREATE — Primary inputs ══ */}
        <div className="space-y-4">
          {/* Product Name */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-sm font-semibold">{sv ? 'Produktnamn' : 'Product name'} *</Label>
            <Input id="title" value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder={sv ? 'Naturlig Deodorant' : 'Natural Deodorant'}
              className="text-base h-11" required autoFocus />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">{sv ? 'Pris' : 'Price'} *</Label>
            <div className="flex gap-2">
              <Select value={formData.currency || 'SEK'}
                onValueChange={v => setFormData(prev => ({ ...prev, currency: v }))}>
                <SelectTrigger className="w-[80px] h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['SEK', 'EUR', 'USD', 'NOK', 'DKK', 'GBP'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="text" inputMode="decimal" value={formData.price}
                onChange={e => {
                  const val = e.target.value.replace(',', '.');
                  if (val === '' || /^\d*\.?\d*$/.test(val)) setFormData(prev => ({ ...prev, price: val }));
                }}
                placeholder="159" className="text-lg font-bold h-11 flex-1" required />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="desc" className="text-sm font-semibold">{sv ? 'Beskrivning' : 'Description'}</Label>
            <Textarea id="desc" value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={sv ? 'Kort produktbeskrivning...' : 'Short product description...'}
              rows={3} />
          </div>

          {/* Images */}
          <ImageUploadSection imageUrls={formData.imageUrls} setFormData={setFormData} language={language} />

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{sv ? 'Kategori' : 'Category'}</Label>
            <CategorySelect language={language} selectedIds={formData.categoryIds}
              onChange={ids => setFormData(prev => ({ ...prev, categoryIds: ids }))} />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{sv ? 'Taggar' : 'Tags'}</Label>
            <TagSelect language={language} selectedIds={formData.tagIds}
              onChange={ids => setFormData(prev => ({ ...prev, tagIds: ids }))} />
          </div>

          {/* Visibility toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {formData.isVisible ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">{sv ? 'Synlig i butiken' : 'Visible in store'}</p>
                <p className="text-xs text-muted-foreground">
                  {formData.isVisible ? (sv ? 'Kunder kan se produkten' : 'Customers can see this') : (sv ? 'Dold från kunder' : 'Hidden from customers')}
                </p>
              </div>
            </div>
            <Switch checked={formData.isVisible}
              onCheckedChange={checked => setFormData(prev => ({ ...prev, isVisible: checked }))} />
          </div>
        </div>

        {/* ══ SMART ASSIST — Optional toggle ══ */}
        <div>
          <button type="button" onClick={() => setShowAssist(!showAssist)}
            className="text-xs text-primary hover:underline flex items-center gap-1">
            <Wand2 className="w-3 h-3" />
            {showAssist ? (sv ? 'Dölj AI-hjälp' : 'Hide AI assist') : (sv ? 'Visa AI-hjälp' : 'Show AI assist')}
          </button>
          {showAssist && (
            <div className="mt-2">
              <SmartAssistPanel language={language} formData={formData} setFormData={setFormData} />
            </div>
          )}
        </div>

        {/* ══ ADVANCED — Collapsible ══ */}
        <AdvancedPanel language={language} formData={formData} setFormData={setFormData} />

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            {t.cancel}
          </Button>
          <Button type="submit" className="flex-1"
            disabled={isSubmitting || !formData.title || (!isEdit && !formData.price)}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><Save className="w-4 h-4 mr-2" />{isEdit ? t.update : t.save}</>
            )}
          </Button>
        </div>
      </div>

      {/* ── RIGHT: Live Preview (desktop only) ── */}
      <div className="hidden lg:block w-52 shrink-0 sticky top-0 self-start">
        <p className="text-xs font-medium text-muted-foreground mb-2">{sv ? 'Förhandsgranskning' : 'Preview'}</p>
        <ProductCardPreview formData={formData} />
      </div>
    </form>
  );
}
