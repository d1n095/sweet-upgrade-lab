import * as React from 'react';
import { DollarSign, Tag, Save, Eye, EyeOff, Boxes, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  productType: string;
  tags: string;
  vendor: string;
  isVisible: boolean;
  inventory: number;
  allowOverselling: boolean;
}

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

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
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
}) {
  const currentTags = React.useMemo(() => parseTags(formData.tags), [formData.tags]);

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
    <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">{t.price}</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
              placeholder="159"
              className="pl-9"
              required
              disabled={isEdit}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="productType">{t.category}</Label>
          <Select
            value={formData.productType}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, productType: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={t.selectCategory} />
            </SelectTrigger>
            <SelectContent>
              {productCategories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label[language as keyof typeof cat.label] ?? cat.label.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>{t.tags}</Label>
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={formData.tags}
            onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder={t.tagsPlaceholder}
            className="pl-9"
          />
        </div>

        {currentTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {currentTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive/20"
                onClick={() => removeTag(tag)}
              >
                {tag} ×
              </Badge>
            ))}
          </div>
        )}

        <div>
          <p className="text-xs text-muted-foreground mb-1.5">{t.suggestedTags}</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedTags
              .filter((tag) => !currentTags.includes(tag))
              .map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => addTag(tag)}
                >
                  + {tag}
                </Badge>
              ))}
          </div>
        </div>
      </div>

      {/* Visibility & Inventory */}
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
                  setInventory((Number.isFinite(current) ? current : 0) - 1);
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

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          {t.cancel}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !formData.title || (!isEdit && !formData.price)}
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
