import { useState, useMemo, useCallback } from 'react';
import { Search, AlertTriangle, CheckCircle2, Edit2, Save, X, Globe, ToggleLeft, ToggleRight, Wand2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDbProducts, updateDbProduct, DbProduct } from '@/lib/products';

// --- SEO Generation Engine ---

const MODIFIERS = ['naturlig', 'premium', 'stark', 'fräsch', 'ren', 'handgjord', 'ekologisk', 'hållbar', 'giftfri', 'mild'];
const INTENTS = ['köpa', 'bästa', 'hög kvalitet', 'online', 'pris', 'snabb leverans'];

function pickModifiers(p: DbProduct): string[] {
  const text = `${p.title_sv} ${p.description_sv || ''} ${p.ingredients_sv || ''}`.toLowerCase();
  const matched = MODIFIERS.filter(m => text.includes(m));
  if (matched.length === 0) matched.push('naturlig');
  return matched.slice(0, 2);
}

function pickIntent(): string[] {
  return ['köpa', 'bästa'];
}

function generateKeywords(p: DbProduct): string {
  const kw: string[] = [];

  // 1. Product name
  kw.push(p.title_sv);

  // 2. Category
  if (p.category) kw.push(p.category);

  // 3. Modifiers
  const mods = pickModifiers(p);
  mods.forEach(m => {
    kw.push(`${m} ${p.category || p.title_sv}`);
  });

  // 4. Intent keywords
  const intents = pickIntent();
  intents.forEach(i => {
    kw.push(`${i} ${p.category || p.title_sv}`);
  });

  // 5. Tags (max 2)
  if (p.tags?.length) {
    kw.push(...p.tags.slice(0, 2));
  }

  // 6. Certifications
  if (p.certifications?.length) {
    kw.push(p.certifications[0]);
  }

  // Deduplicate and limit to 6-8
  const unique = [...new Set(kw.map(k => k.toLowerCase().trim()))].filter(Boolean);
  return unique.slice(0, 8).join(', ');
}

function generateDescription(p: DbProduct): string {
  const parts: string[] = [];
  const mods = pickModifiers(p);
  const modStr = mods.join(' & ');

  if (p.description_sv) {
    // Use first sentence or first 80 chars
    const firstSentence = p.description_sv.split(/[.!?]/)[0]?.trim();
    if (firstSentence && firstSentence.length <= 80) {
      parts.push(firstSentence);
    } else {
      parts.push(p.description_sv.substring(0, 80).trim());
    }
  } else {
    parts.push(`${modStr.charAt(0).toUpperCase() + modStr.slice(1)} ${p.title_sv}`);
  }

  if (p.ingredients_sv) {
    const ingList = p.ingredients_sv.split(',').slice(0, 3).map(s => s.trim()).join(', ');
    parts.push(`Innehåller ${ingList}`);
  }

  if (p.certifications?.length) {
    parts.push(p.certifications.slice(0, 2).join(' & '));
  }

  parts.push('Köp online hos 4ThePeople');

  const result = parts.join('. ').substring(0, 155);
  return result + (result.length >= 155 ? '' : '.');
}

function generateTitle(p: DbProduct): string {
  const mods = pickModifiers(p);
  const mod = mods[0] ? `${mods[0].charAt(0).toUpperCase() + mods[0].slice(1)} ` : '';
  const cat = p.category ? ` | ${p.category}` : '';
  const base = `${mod}${p.title_sv}${cat} — Köp online | 4ThePeople`;
  return base.substring(0, 60);
}

// --- Types ---

type SeoMode = 'auto' | 'manual';

function getProductSeoMode(p: DbProduct): SeoMode {
  return (p.meta_title || p.meta_description || p.meta_keywords) ? 'manual' : 'auto';
}

// --- Component ---

const AdminSEO = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ metaTitle: '', metaDescription: '', metaKeywords: '' });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-db-products'],
    queryFn: () => fetchDbProducts(true),
    staleTime: 5_000,
  });

  const activeProducts = useMemo(
    () => products.filter(p => (p.status || 'active') === 'active'),
    [products]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return activeProducts;
    const q = search.toLowerCase();
    return activeProducts.filter(p =>
      p.title_sv.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  }, [activeProducts, search]);

  const stats = useMemo(() => {
    const manual = activeProducts.filter(p => getProductSeoMode(p) === 'manual').length;
    const auto = activeProducts.filter(p => getProductSeoMode(p) === 'auto').length;
    return { manual, auto, total: activeProducts.length };
  }, [activeProducts]);

  const startEdit = (p: DbProduct) => {
    setEditingId(p.id);
    setEditData({
      metaTitle: p.meta_title || '',
      metaDescription: p.meta_description || '',
      metaKeywords: p.meta_keywords || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ metaTitle: '', metaDescription: '', metaKeywords: '' });
  };

  const handleSave = async (productId: string) => {
    setSaving(true);
    try {
      await updateDbProduct(productId, {
        meta_title: editData.metaTitle || null,
        meta_description: editData.metaDescription || null,
        meta_keywords: editData.metaKeywords || null,
      });
      toast.success('SEO uppdaterat!');
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
      cancelEdit();
    } catch (err: any) {
      toast.error('Fel: ' + (err?.message || 'Okänt fel'));
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFill = (p: DbProduct) => {
    setEditData({
      metaTitle: generateTitle(p),
      metaDescription: generateDescription(p),
      metaKeywords: generateKeywords(p),
    });
  };

  // Toggle between auto and manual
  const toggleMode = async (p: DbProduct) => {
    const currentMode = getProductSeoMode(p);
    setTogglingId(p.id);
    try {
      if (currentMode === 'manual') {
        // Switch to auto: clear manual fields
        await updateDbProduct(p.id, {
          meta_title: null,
          meta_description: null,
          meta_keywords: null,
        });
        toast.success(`${p.title_sv}: Växlat till Auto-SEO`);
      } else {
        // Switch to manual: populate with generated values
        await updateDbProduct(p.id, {
          meta_title: generateTitle(p),
          meta_description: generateDescription(p),
          meta_keywords: generateKeywords(p),
        });
        toast.success(`${p.title_sv}: Växlat till Manuell SEO`);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
    } catch (err: any) {
      toast.error('Kunde inte växla: ' + (err?.message || 'Okänt fel'));
    } finally {
      setTogglingId(null);
    }
  };

  // Bulk auto-generate for all products in auto mode
  const bulkAutoGenerate = async () => {
    const autoProducts = activeProducts.filter(p => getProductSeoMode(p) === 'auto');
    if (autoProducts.length === 0) {
      toast.info('Alla produkter har redan manuell SEO');
      return;
    }
    setSaving(true);
    let count = 0;
    for (const p of autoProducts) {
      try {
        await updateDbProduct(p.id, {
          meta_title: generateTitle(p),
          meta_description: generateDescription(p),
          meta_keywords: generateKeywords(p),
        });
        count++;
      } catch { /* skip */ }
    }
    queryClient.invalidateQueries({ queryKey: ['admin-db-products'] });
    toast.success(`Auto-genererade SEO för ${count} produkter!`);
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            SEO-hantering
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Växla mellan auto och manuell SEO per produkt. Auto genererar baserat på namn, kategori, ingredienser och beskrivning.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={bulkAutoGenerate} disabled={saving}>
          <Wand2 className="w-4 h-4" />
          Auto-generera alla
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Totalt aktiva', value: stats.total, icon: Globe, color: 'text-primary' },
          { label: 'Manuell SEO', value: stats.manual, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Auto-SEO', value: stats.auto, icon: Wand2, color: 'text-blue-600' },
        ].map(s => (
          <Card key={s.label} className="border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold">{isLoading ? '–' : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök produkt..." className="pl-9" />
      </div>

      {/* SEO Rules Reference */}
      <Card className="border-border bg-secondary/20">
        <CardContent className="pt-3 pb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Auto-genereringsregler</p>
          <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
            <li>Produktnamn (alltid)</li>
            <li>Kategori (bastudoft, menthol, etc.)</li>
            <li>1–2 modifierare (naturlig, premium, stark, fräsch)</li>
            <li>Köp-intent (köpa, bästa, hög kvalitet)</li>
            <li>Max 6–8 nyckelord per produkt</li>
          </ol>
        </CardContent>
      </Card>

      {/* Product SEO list */}
      <div className="space-y-3">
        {filtered.map(p => {
          const mode = getProductSeoMode(p);
          const isEditing = editingId === p.id;
          const isToggling = togglingId === p.id;
          const currentTitle = p.meta_title || generateTitle(p);
          const currentDesc = p.meta_description || generateDescription(p);
          const currentKeywords = p.meta_keywords || generateKeywords(p);

          return (
            <Card key={p.id} className="border-border">
              <CardContent className="pt-4 pb-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.image_urls?.[0] && (
                      <img src={p.image_urls[0]} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{p.title_sv}</h3>
                      <p className="text-xs text-muted-foreground">{p.category || 'Okategoriserad'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Mode toggle */}
                    <button
                      onClick={() => toggleMode(p)}
                      disabled={isToggling}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                      style={{
                        background: mode === 'manual' ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--secondary))',
                        color: mode === 'manual' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {mode === 'manual' ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      {mode === 'manual' ? 'Manuell' : 'Auto'}
                    </button>
                    {!isEditing && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-3 bg-secondary/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Redigera SEO</p>
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => handleAutoFill(p)}>
                        <Wand2 className="w-3 h-3" /> Auto-fyll
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">SEO-titel (max 60 tecken)</Label>
                      <Input
                        value={editData.metaTitle}
                        onChange={e => setEditData(prev => ({ ...prev, metaTitle: e.target.value }))}
                        placeholder={generateTitle(p)}
                        className="text-xs"
                        maxLength={70}
                      />
                      <p className={`text-xs ${editData.metaTitle.length > 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {editData.metaTitle.length}/60
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">SEO-beskrivning (max 160 tecken)</Label>
                      <Textarea
                        value={editData.metaDescription}
                        onChange={e => setEditData(prev => ({ ...prev, metaDescription: e.target.value }))}
                        placeholder={generateDescription(p)}
                        rows={2}
                        className="text-xs"
                        maxLength={170}
                      />
                      <p className={`text-xs ${editData.metaDescription.length > 160 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {editData.metaDescription.length}/160
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Nyckelord (6–8, kommaseparerade)</Label>
                      <Input
                        value={editData.metaKeywords}
                        onChange={e => setEditData(prev => ({ ...prev, metaKeywords: e.target.value }))}
                        placeholder={generateKeywords(p)}
                        className="text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        {editData.metaKeywords ? editData.metaKeywords.split(',').filter(k => k.trim()).length : 0} nyckelord
                      </p>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="text-xs gap-1" onClick={() => handleSave(p.id)} disabled={saving}>
                        <Save className="w-3 h-3" /> Spara
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={cancelEdit}>
                        <X className="w-3 h-3" /> Avbryt
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-xs">
                    <div className="flex items-start gap-1.5">
                      <span className="text-muted-foreground shrink-0 w-14">Titel:</span>
                      <span className={`truncate ${mode === 'manual' ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                        {currentTitle}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-muted-foreground shrink-0 w-14">Beskr:</span>
                      <span className={`line-clamp-2 ${mode === 'manual' ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                        {currentDesc}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-muted-foreground shrink-0 w-14">Nyckelord:</span>
                      <span className={`line-clamp-1 ${mode === 'manual' ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                        {currentKeywords}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && !isLoading && (
          <p className="text-center text-muted-foreground py-8">Inga produkter hittades</p>
        )}
      </div>
    </div>
  );
};

export default AdminSEO;
