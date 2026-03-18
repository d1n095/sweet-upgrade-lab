import { useState, useMemo } from 'react';
import { Search, AlertTriangle, CheckCircle2, Edit2, Save, X, ExternalLink, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDbProducts, updateDbProduct, DbProduct } from '@/lib/products';

// Auto-generate SEO description from product data
function autoDescription(p: DbProduct): string {
  const parts: string[] = [];
  if (p.description_sv) parts.push(p.description_sv.substring(0, 80));
  if (p.ingredients_sv) {
    const ingList = p.ingredients_sv.split(',').slice(0, 3).map(s => s.trim()).join(', ');
    parts.push(`Innehåller ${ingList}`);
  }
  if (p.certifications?.length) parts.push(p.certifications.join(', '));
  const result = parts.join('. ').substring(0, 155);
  return result || `Köp ${p.title_sv} hos 4ThePeople — noggrant utvalt, giftfritt och hållbart.`;
}

// Auto-generate SEO keywords from product data
function autoKeywords(p: DbProduct): string {
  const kw: string[] = [p.title_sv];
  if (p.category) kw.push(p.category);
  if (p.tags?.length) kw.push(...p.tags.slice(0, 5));
  if (p.vendor) kw.push(p.vendor);
  if (p.certifications?.length) kw.push(...p.certifications.slice(0, 3));
  if (p.ingredients_sv) kw.push(...p.ingredients_sv.split(',').slice(0, 3).map(s => s.trim()));
  kw.push('4thepeople', 'köp online');
  return [...new Set(kw)].join(', ');
}

function autoTitle(p: DbProduct): string {
  return `${p.title_sv} — Köp online | 4thepeople`;
}

type SeoStatus = 'complete' | 'auto' | 'missing';

function getSeoStatus(p: DbProduct): SeoStatus {
  const hasManual = !!(p as any).meta_title || !!(p as any).meta_description;
  if (hasManual) return 'complete';
  if (p.description_sv || p.ingredients_sv) return 'auto';
  return 'missing';
}

const AdminSEO = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ metaTitle: '', metaDescription: '', metaKeywords: '' });
  const [saving, setSaving] = useState(false);

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
    const complete = activeProducts.filter(p => getSeoStatus(p) === 'complete').length;
    const auto = activeProducts.filter(p => getSeoStatus(p) === 'auto').length;
    const missing = activeProducts.filter(p => getSeoStatus(p) === 'missing').length;
    return { complete, auto, missing, total: activeProducts.length };
  }, [activeProducts]);

  const startEdit = (p: DbProduct) => {
    setEditingId(p.id);
    setEditData({
      metaTitle: (p as any).meta_title || '',
      metaDescription: (p as any).meta_description || '',
      metaKeywords: (p as any).meta_keywords || '',
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
      } as any);
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
      metaTitle: autoTitle(p),
      metaDescription: autoDescription(p),
      metaKeywords: autoKeywords(p),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary" />
          SEO-hantering
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Hantera meta-titlar, beskrivningar och nyckelord för alla produkter
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Totalt aktiva', value: stats.total, icon: Globe, color: 'text-primary' },
          { label: 'Manuell SEO', value: stats.complete, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Auto-genererad', value: stats.auto, icon: Globe, color: 'text-blue-600' },
          { label: 'Saknar data', value: stats.missing, icon: AlertTriangle, color: 'text-orange-600' },
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
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Sök produkt..."
          className="pl-9"
        />
      </div>

      {/* Product SEO list */}
      <div className="space-y-3">
        {filtered.map(p => {
          const status = getSeoStatus(p);
          const isEditing = editingId === p.id;
          const currentTitle = (p as any).meta_title || autoTitle(p);
          const currentDesc = (p as any).meta_description || autoDescription(p);
          const currentKeywords = (p as any).meta_keywords || autoKeywords(p);
          const isManual = !!(p as any).meta_title || !!(p as any).meta_description;

          return (
            <Card key={p.id} className="border-border">
              <CardContent className="pt-4 pb-4">
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
                    <Badge variant={status === 'complete' ? 'default' : status === 'auto' ? 'secondary' : 'destructive'} className="text-xs">
                      {status === 'complete' ? 'Manuell' : status === 'auto' ? 'Auto' : 'Saknas'}
                    </Badge>
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
                        <Globe className="w-3 h-3" /> Auto-fyll
                      </Button>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs">SEO-titel (max 60 tecken)</Label>
                      <Input
                        value={editData.metaTitle}
                        onChange={e => setEditData(prev => ({ ...prev, metaTitle: e.target.value }))}
                        placeholder={autoTitle(p)}
                        className="text-xs"
                        maxLength={70}
                      />
                      <p className="text-xs text-muted-foreground">{editData.metaTitle.length}/60</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">SEO-beskrivning (max 160 tecken)</Label>
                      <Textarea
                        value={editData.metaDescription}
                        onChange={e => setEditData(prev => ({ ...prev, metaDescription: e.target.value }))}
                        placeholder={autoDescription(p)}
                        rows={2}
                        className="text-xs"
                        maxLength={170}
                      />
                      <p className="text-xs text-muted-foreground">{editData.metaDescription.length}/160</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Nyckelord (kommaseparerade)</Label>
                      <Input
                        value={editData.metaKeywords}
                        onChange={e => setEditData(prev => ({ ...prev, metaKeywords: e.target.value }))}
                        placeholder={autoKeywords(p)}
                        className="text-xs"
                      />
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
                      <span className="text-muted-foreground shrink-0 w-12">Titel:</span>
                      <span className={`truncate ${isManual ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                        {currentTitle}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-muted-foreground shrink-0 w-12">Beskr:</span>
                      <span className={`line-clamp-2 ${isManual ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                        {currentDesc}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-muted-foreground shrink-0 w-12">Nyckelo:</span>
                      <span className={`line-clamp-1 ${isManual ? 'text-foreground' : 'text-muted-foreground italic'}`}>
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
