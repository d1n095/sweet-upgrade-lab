import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Zap } from 'lucide-react';
import {
  ProductFormData,
  ImageUploadSection,
} from '@/components/admin/AdminProductForm';

/**
 * Quick mode — minimal product creation.
 * Bara namn + pris + bild. Allt annat får defaults och kan redigeras senare.
 */
interface QuickProductFormProps {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const QuickProductForm: React.FC<QuickProductFormProps> = ({
  formData, setFormData, isSubmitting, onCancel, onSubmit,
}) => {
  const canSubmit = formData.title.trim().length > 0 && parseFloat(formData.price || '0') > 0;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/10">
        <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Snabbläge skapar produkten med standardvärden (synlig, 0 i lager).
          Du kan redigera detaljer, kategori och taggar efteråt.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quick-title" className="text-sm font-medium">Produktnamn *</Label>
        <Input
          id="quick-title"
          autoFocus
          value={formData.title}
          onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
          placeholder="t.ex. Lavendel CBD-olja 10%"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quick-price" className="text-sm font-medium">Pris (SEK) *</Label>
        <Input
          id="quick-price"
          type="number" step="0.01" min="0"
          value={formData.price}
          onChange={e => setFormData(p => ({ ...p, price: e.target.value }))}
          placeholder="299"
          required
        />
      </div>

      <ImageUploadSection imageUrls={formData.imageUrls} setFormData={setFormData} />

      <div className="flex items-center justify-between p-3 rounded-lg border border-border">
        <div>
          <Label className="text-sm font-medium">Synlig i butiken</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Stäng av för utkast</p>
        </div>
        <Switch
          checked={formData.isVisible}
          onCheckedChange={v => setFormData(p => ({ ...p, isVisible: v }))}
        />
      </div>

      <div className="p-3 rounded-lg border border-gold/30 bg-gold/5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-gold" /> Förköp (prebuy)
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">Testa marknaden — kunder reserverar plats gratis</p>
          </div>
          <Switch
            checked={!!formData.isPrebuy}
            onCheckedChange={v => setFormData(p => ({ ...p, isPrebuy: v }))}
          />
        </div>
        {formData.isPrebuy && (
          <div className="space-y-1.5">
            <Label htmlFor="quick-release" className="text-xs">Planerat släppdatum (valfritt)</Label>
            <Input
              id="quick-release"
              type="date"
              value={formData.prebuyReleaseDate || ''}
              onChange={e => setFormData(p => ({ ...p, prebuyReleaseDate: e.target.value }))}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Avbryt
        </Button>
        <Button type="submit" size="sm" disabled={!canSubmit || isSubmitting} className="gap-1.5">
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Skapa produkt
        </Button>
      </div>
    </form>
  );
};

export default QuickProductForm;
