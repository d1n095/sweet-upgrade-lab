import * as React from 'react';
import { ChefHat, Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { ProductFormData } from './AdminProductForm';

interface Template {
  id: string;
  name_sv: string;
  description_sv: string | null;
}

interface Slot {
  id: string;
  template_id: string;
  label_sv: string;
  slot_type: 'choice' | 'fixed';
  ingredient_category: string | null;
  fixed_ingredient_id: string | null;
  is_required: boolean;
  allow_multiple: boolean;
  display_order: number;
}

interface Ingredient {
  id: string;
  name_sv: string;
  category: string;
}

export function RecipeTemplatePicker({
  formData,
  setFormData,
  language,
}: {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  language: string;
}) {
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [ingredients, setIngredients] = React.useState<Ingredient[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');
  const [slotSelections, setSlotSelections] = React.useState<Record<string, string[]>>({});
  const [showPicker, setShowPicker] = React.useState(false);

  const sv = language === 'sv';

  React.useEffect(() => {
    if (!loaded) {
      Promise.all([
        supabase.from('recipe_templates').select('id, name_sv, description_sv').eq('is_active', true).order('display_order'),
        supabase.from('recipe_template_slots').select('*').order('display_order'),
        supabase.from('recipe_ingredients').select('id, name_sv, category').eq('is_active', true).order('category').order('display_order'),
      ]).then(([tRes, sRes, iRes]) => {
        if (tRes.data) setTemplates(tRes.data as Template[]);
        if (sRes.data) setSlots(sRes.data as Slot[]);
        if (iRes.data) setIngredients(iRes.data as Ingredient[]);
        setLoaded(true);
      });
    }
  }, [loaded]);

  const activeSlots = React.useMemo(
    () => slots.filter(s => s.template_id === selectedTemplateId).sort((a, b) => a.display_order - b.display_order),
    [slots, selectedTemplateId]
  );

  const getIngredientName = (id: string) => ingredients.find(i => i.id === id)?.name_sv || '';
  const getIngredientsByCategory = (cat: string) => ingredients.filter(i => i.category === cat);

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    setSlotSelections({});
  };

  const toggleSlotIngredient = (slotId: string, ingredientId: string, allowMultiple: boolean) => {
    setSlotSelections(prev => {
      const current = prev[slotId] || [];
      if (current.includes(ingredientId)) {
        return { ...prev, [slotId]: current.filter(x => x !== ingredientId) };
      }
      if (allowMultiple) {
        return { ...prev, [slotId]: [...current, ingredientId] };
      }
      return { ...prev, [slotId]: [ingredientId] };
    });
  };

  const applyRecipe = () => {
    const allIngredients: string[] = [];

    activeSlots.forEach(slot => {
      if (slot.slot_type === 'fixed' && slot.fixed_ingredient_id) {
        const name = getIngredientName(slot.fixed_ingredient_id);
        if (name) allIngredients.push(name);
      } else if (slot.slot_type === 'choice') {
        const selected = slotSelections[slot.id] || [];
        selected.forEach(id => {
          const name = getIngredientName(id);
          if (name) allIngredients.push(name);
        });
      }
    });

    const unique = [...new Set(allIngredients)];
    setFormData(prev => ({ ...prev, ingredients: unique.join(', ') }));
    setShowPicker(false);
  };

  const isComplete = activeSlots.every(slot => {
    if (slot.slot_type === 'fixed') return true;
    if (!slot.is_required) return true;
    return (slotSelections[slot.id] || []).length > 0;
  });

  if (templates.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <ChefHat className="w-4 h-4" />
          {sv ? 'Receptmall' : 'Recipe Template'}
        </Label>
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <ChefHat className="w-3 h-3" />
          {showPicker ? (sv ? 'Dölj' : 'Hide') : (sv ? 'Välj receptmall' : 'Pick template')}
        </button>
      </div>

      {showPicker && (
        <div className="border border-border rounded-lg p-3 bg-secondary/20 space-y-3">
          {/* Template selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{sv ? 'Välj en grund:' : 'Select a base:'}</p>
            <div className="flex flex-wrap gap-1.5">
              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTemplateSelect(t.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedTemplateId === t.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-primary/5 hover:border-primary/20'
                  }`}
                >
                  {t.name_sv}
                </button>
              ))}
            </div>
          </div>

          {/* Slot-by-slot selection */}
          {selectedTemplateId && activeSlots.length > 0 && (
            <div className="space-y-3 border-t border-border pt-3">
              {activeSlots.map((slot, idx) => {
                if (slot.slot_type === 'fixed') {
                  const name = slot.fixed_ingredient_id ? getIngredientName(slot.fixed_ingredient_id) : '—';
                  return (
                    <div key={slot.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{idx + 1}</span>
                        <p className="text-xs font-medium">{slot.label_sv}</p>
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">Fast</Badge>
                      </div>
                      <div className="ml-7">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          <Check className="w-3 h-3" /> {name}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Choice slot
                const categoryIngredients = getIngredientsByCategory(slot.ingredient_category || '');
                const selected = slotSelections[slot.id] || [];

                return (
                  <div key={slot.id} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{idx + 1}</span>
                      <p className="text-xs font-medium">{slot.label_sv}</p>
                      {slot.allow_multiple && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Flera</Badge>}
                      {!slot.is_required && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Valfri</Badge>}
                    </div>
                    <div className="ml-7 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {categoryIngredients.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{sv ? 'Inga ingredienser i denna kategori' : 'No ingredients'}</p>
                      ) : (
                        categoryIngredients.map(ing => {
                          const isSelected = selected.includes(ing.id);
                          return (
                            <button
                              key={ing.id}
                              type="button"
                              onClick={() => toggleSlotIngredient(slot.id, ing.id, slot.allow_multiple)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                isSelected
                                  ? 'bg-primary/15 border-primary/30 text-primary font-medium'
                                  : 'bg-background border-border hover:bg-primary/5 hover:border-primary/20'
                              }`}
                            >
                              {isSelected ? '✓ ' : '+ '}{ing.name_sv}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                size="sm"
                className="w-full gap-1.5 mt-2"
                disabled={!isComplete}
                onClick={applyRecipe}
              >
                <Check className="w-4 h-4" />
                {sv ? 'Applicera recept' : 'Apply recipe'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
