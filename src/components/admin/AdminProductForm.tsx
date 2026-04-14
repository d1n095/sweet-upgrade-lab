import * as React from 'react';
import {
  Save, Eye, EyeOff, Boxes, Minus, Plus, Upload, X, Image,
  FlaskConical, Weight, Loader2, Check, ChevronDown, ChevronRight,
  Package, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
import { Progress } from '@/components/ui/progress';
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
  packageWeightGrams: string;
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
  weightGrams: '', packageWeightGrams: '', ingredientIds: [],
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

// ─── Keyword auto-suggest (rule-based, NO AI) ───
const KEYWORD_RULES: { keywords: string[]; suggestTagNames: string[] }[] = [
  { keywords: ['menthol', 'kristall', 'mentol'], suggestTagNames: ['Bastu', 'Andning', 'Kylande', 'Uppfriskande'] },
  { keywords: ['eukalyptus', 'eucalyptus'], suggestTagNames: ['Andning', 'Uppfriskande', 'Bastu'] },
  { keywords: ['lavendel', 'lavender'], suggestTagNames: ['Avslappning', 'Aromaterapi'] },
  { keywords: ['cbd', 'hampa', 'hemp'], suggestTagNames: ['CBD', 'Naturlig'] },
  { keywords: ['olja', 'oil'], suggestTagNames: ['Olja', 'Hudvård'] },
  { keywords: ['tvål', 'soap', 'schampo', 'shampoo'], suggestTagNames: ['Kroppsvård', 'Naturlig'] },
  { keywords: ['ljus', 'candle', 'doftljus'], suggestTagNames: ['Doftljus', 'Hemma'] },
  { keywords: ['bastu', 'sauna'], suggestTagNames: ['Bastu', 'Aromaterapi'] },
];

function getAutoSuggestedTagIds(title: string, tags: { id: string; name_sv: string }[]): string[] {
  const lower = title.toLowerCase();
  const suggestedNames = new Set<string>();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      rule.suggestTagNames.forEach(n => suggestedNames.add(n.toLowerCase()));
    }
  }
  return tags
    .filter(t => suggestedNames.has(t.name_sv.toLowerCase()))
    .map(t => t.id);
}

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
            {selectedNames.length ? selectedNames.join(', ') : 'Välj kategori...'}
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

// ─── Tag Multi-Select (structured chips) ───
function TagSelect({
  selectedIds, onChange, suggestedIds,
}: {
  selectedIds: string[]; onChange: (ids: string[]) => void; suggestedIds: string[];
}) {
  const { data: tags = [] } = useQuery({
    queryKey: ['form-tags'],
    queryFn: fetchTags,
    staleTime: 30_000,
  });
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const suggested = tags.filter(t => suggestedIds.includes(t.id) && !selectedIds.includes(t.id));

  return (
    <div className="space-y-2">
      {suggested.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Föreslagna (baserat på produktnamn):</p>
          <div className="flex flex-wrap gap-1.5">
            {suggested.map(tag => (
              <button key={tag.id} type="button" onClick={() => toggle(tag.id)}
                className="text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors">
                + {tag.name_sv}
              </button>
            ))}
          </div>
        </div>
      )}
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
          <p className="text-xs text-muted-foreground py-1">Inga taggar ännu</p>
        )}
      </div>
    </div>
  );
}

// ─── Image Upload Section ───
function ImageUploadSection({
  imageUrls, setFormData,
}: {
  imageUrls: string[];
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}) {
  const [isUploading, setIsUploading] = React.useState(false);

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
        <Image className="w-4 h-4" /> Bilder
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
  const weightG = parseInt(formData.weightGrams) || 0;
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
        {weightG > 0 && <p className="text-[10px] text-muted-foreground">{weightG >= 1000 ? `${(weightG / 1000).toFixed(1)} kg` : `${weightG} g`}</p>}
      </div>
    </div>
  );
}

// ─── Advanced Panel (collapsible, for extra fields) ───
function AdvancedPanel({
  formData, setFormData,
}: {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg border border-border hover:bg-accent transition-colors">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="text-sm font-medium">Avancerat</span>
          <span className="text-xs text-muted-foreground ml-auto">
            Lager, innehåll, ingredienser
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 space-y-5 pl-1">
          {/* ── Inventory ── */}
          <InventorySection formData={formData} setFormData={setFormData} />

          {/* ── Product Content (Hook, Usage, Effects etc) ── */}
          <ContentSection formData={formData} setFormData={setFormData} />

          {/* ── Ingredients ── */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <FlaskConical className="w-4 h-4" /> Ingredienser
            </Label>
            <Textarea value={formData.ingredients}
              onChange={e => setFormData(prev => ({ ...prev, ingredients: e.target.value }))}
              placeholder="Kokosolja, Sheasmör..."
              rows={2} className="text-xs" />
          </div>

          {/* ── Concentrate toggle ── */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <div>
              <p className="text-sm font-medium">Koncentrat</p>
              <p className="text-xs text-muted-foreground">Ska spädas före användning</p>
            </div>
            <Switch checked={formData.isConcentrate}
              onCheckedChange={checked => setFormData(prev => ({ ...prev, isConcentrate: checked }))} />
          </div>

          {/* ── Visibility toggle ── */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {formData.isVisible ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">Synlig i butiken</p>
                <p className="text-xs text-muted-foreground">
                  {formData.isVisible ? 'Kunder kan se produkten' : 'Dold från kunder'}
                </p>
              </div>
            </div>
            <Switch checked={formData.isVisible}
              onCheckedChange={checked => setFormData(prev => ({ ...prev, isVisible: checked }))} />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Inventory sub-section ───
function InventorySection({
  formData, setFormData,
}: {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}) {
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
        <Label className="text-sm font-medium">Lager</Label>
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
          <p className="text-sm">Tillåt överförsäljning</p>
          <p className="text-xs text-muted-foreground">Kunder kan köpa även vid 0 st</p>
        </div>
        <Switch checked={formData.allowOverselling}
          onCheckedChange={checked => setFormData(prev => ({ ...prev, allowOverselling: checked }))} />
      </div>
    </div>
  );
}

// ─── Product content sub-section ───
function ContentSection({
  formData, setFormData,
}: {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
}) {
  const fields: { key: keyof ProductFormData; label: string; placeholder: string; rows?: number }[] = [
    { key: 'hook', label: 'Hook (kort säljmening)', placeholder: 'Öppnar luftvägarna direkt' },
    { key: 'extendedDescription', label: 'Full beskrivning', placeholder: 'Detaljerad produktbeskrivning...', rows: 3 },
    { key: 'usage', label: 'Användning', placeholder: '1. Tillsätt\n2. Häll vatten\n3. Njut', rows: 3 },
    { key: 'dosage', label: 'Dosering', placeholder: '10ml = ca 200 droppar', rows: 2 },
    { key: 'effects', label: 'Fördelar', placeholder: '✓ Öppnar luftvägarna\n✓ Uppfriskande', rows: 2 },
    { key: 'feeling', label: 'Känsla', placeholder: 'En kylande känsla...', rows: 2 },
    { key: 'storage', label: 'Förvaring', placeholder: 'Svalt och mörkt' },
    { key: 'safety', label: 'Säkerhet', placeholder: 'Endast utvärtes bruk', rows: 2 },
  ];

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
          Produktinnehåll (hook, användning, effekter...)
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

// ═══════════════════════════════════════════════
// AUTO SEO — generates meta fields from product data (no UI)
// ═══════════════════════════════════════════════
export function generateAutoSEO(formData: ProductFormData): { metaTitle: string; metaDescription: string; metaKeywords: string } {
  const title = formData.title.trim();
  const metaTitle = `${title} | 4ThePeople`;
  const desc = (formData.description || '').trim();
  const metaDescription = desc.length > 120 ? desc.slice(0, 117) + '...' : desc;
  // Keywords from title words
  const metaKeywords = title.toLowerCase()
    .replace(/[^a-zåäö0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .join(', ');
  return { metaTitle, metaDescription, metaKeywords };
}

export function generateSlug(title: string): string {
  return title.toLowerCase()
    .replace(/[åÅ]/g, 'a').replace(/[äÄ]/g, 'a').replace(/[öÖ]/g, 'o')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ═══════════════════════════════════════════════
// MAIN FORM — 4-Step Wizard
// ═══════════════════════════════════════════════
const STEP_LABELS = ['Namn & Kategori', 'Pris & Vikt', 'Beskrivning & Bilder', 'Taggar & Egenskaper'];

export function AdminProductForm({
  t, language, formData, setFormData,
  isEdit, isSubmitting, onCancel, onSubmit,
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
  const [step, setStep] = React.useState(0);
  const { data: allTags = [] } = useQuery({ queryKey: ['form-tags'], queryFn: fetchTags, staleTime: 30_000 });

  const suggestedTagIds = React.useMemo(
    () => getAutoSuggestedTagIds(formData.title, allTags),
    [formData.title, allTags]
  );

  const canProceed = (s: number): boolean => {
    switch (s) {
      case 0: return !!formData.title.trim();
      case 1: return !!formData.price && !!formData.weightGrams;
      case 2: return true; // description/images optional
      case 3: return true;
      default: return true;
    }
  };

  const progress = ((step + 1) / STEP_LABELS.length) * 100;

  const handleSubmitWrapper = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate weight
    if (!formData.weightGrams || parseInt(formData.weightGrams) <= 0) {
      toast.error('Produktvikt krävs');
      setStep(1);
      return;
    }
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmitWrapper} className="flex flex-col lg:flex-row gap-6 max-h-[85vh] overflow-y-auto pr-1 -mr-1">
      {/* ── LEFT: Form ── */}
      <div className="flex-1 space-y-5 min-w-0">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Steg {step + 1} av {STEP_LABELS.length}: {STEP_LABELS[step]}
            </p>
            <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
          </div>
          <Progress value={progress} className="h-1.5" />
          <div className="flex gap-1">
            {STEP_LABELS.map((label, i) => (
              <button key={i} type="button"
                onClick={() => setStep(i)}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-border'
                }`}
                title={label}
              />
            ))}
          </div>
        </div>

        {/* ── STEP 1: Name + Category ── */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-sm font-semibold">Produktnamn *</Label>
              <Input id="title" value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Naturlig Deodorant"
                className="text-base h-11" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Kategori</Label>
              <CategorySelect language={language} selectedIds={formData.categoryIds}
                onChange={ids => setFormData(prev => ({ ...prev, categoryIds: ids }))} />
            </div>
          </div>
        )}

        {/* ── STEP 2: Price + Weight ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Pris *</Label>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="weightGrams" className="flex items-center gap-1.5 text-sm font-semibold">
                  <Weight className="w-4 h-4" /> Vikt per produkt (g) *
                </Label>
                <Input id="weightGrams" type="number" value={formData.weightGrams} min="1"
                  onChange={e => setFormData(prev => ({ ...prev, weightGrams: e.target.value }))}
                  placeholder="250" className="h-11" required />
                <p className="text-[10px] text-muted-foreground">Nettovikt utan emballage</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="packageWeight" className="flex items-center gap-1.5 text-sm font-medium">
                  <Package className="w-4 h-4" /> Total vikt inkl emballage (g)
                </Label>
                <Input id="packageWeight" type="number" value={formData.packageWeightGrams} min="0"
                  onChange={e => setFormData(prev => ({ ...prev, packageWeightGrams: e.target.value }))}
                  placeholder="300" className="h-11" />
                <p className="text-[10px] text-muted-foreground">Används för fraktberäkning</p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Description + Images ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="desc" className="text-sm font-semibold">Beskrivning</Label>
              <Textarea id="desc" value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Kort produktbeskrivning..."
                rows={4} />
            </div>
            <ImageUploadSection imageUrls={formData.imageUrls} setFormData={setFormData} />
          </div>
        )}

        {/* ── STEP 4: Tags + Properties ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Taggar (användningsområde, effekt, typ)</Label>
              <TagSelect
                selectedIds={formData.tagIds}
                onChange={ids => setFormData(prev => ({ ...prev, tagIds: ids }))}
                suggestedIds={suggestedTagIds}
              />
            </div>

            {/* Advanced (collapsed) */}
            <AdvancedPanel formData={formData} setFormData={setFormData} />
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex gap-2 pt-3 border-t border-border">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Tillbaka
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onCancel}>
              {t.cancel}
            </Button>
          )}
          <div className="flex-1" />
          {step < STEP_LABELS.length - 1 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)}
              disabled={!canProceed(step)} className="gap-1.5">
              Nästa <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button type="submit"
              disabled={isSubmitting || !formData.title || !formData.price}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Save className="w-4 h-4 mr-2" />{isEdit ? t.update : t.save}</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* ── RIGHT: Live Preview (desktop only) ── */}
      <div className="hidden lg:block w-52 shrink-0 sticky top-0 self-start">
        <p className="text-xs font-medium text-muted-foreground mb-2">Förhandsgranskning</p>
        <ProductCardPreview formData={formData} />
      </div>
    </form>
  );
}
