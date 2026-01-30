import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Grid, Plus, Eye, EyeOff, Trash2, Loader2, Save, X,
  Cpu, Shirt, Droplets, Flame, Sparkles, Gem, Bed
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

// Icons available for categories
const availableIcons = [
  { id: 'cpu', icon: Cpu, name: 'Elektronik' },
  { id: 'shirt', icon: Shirt, name: 'Kläder' },
  { id: 'droplets', icon: Droplets, name: 'Kroppsvård' },
  { id: 'flame', icon: Flame, name: 'Populärt' },
  { id: 'sparkles', icon: Sparkles, name: 'Ljus' },
  { id: 'gem', icon: Gem, name: 'Smycken' },
  { id: 'bed', icon: Bed, name: 'Hemtextil' },
  { id: 'grid', icon: Grid, name: 'Standard' },
];

interface Category {
  id: string;
  name: { [key: string]: string };
  iconId: string;
  query?: string;
  isVisible: boolean;
  isBestsellerFilter?: boolean;
}

// Local storage key for categories
const CATEGORIES_STORAGE_KEY = 'admin_categories';

// Default categories matching src/data/categories.ts
const defaultCategories: Category[] = [
  { id: 'all', name: { sv: 'Alla', en: 'All' }, iconId: 'grid', isVisible: true },
  { id: 'bestsaljare', name: { sv: 'Bästsäljare', en: 'Bestsellers' }, iconId: 'flame', isVisible: true, isBestsellerFilter: true },
  { id: 'elektronik', name: { sv: 'Elektronik', en: 'Electronics' }, iconId: 'cpu', query: 'product_type:Elektronik', isVisible: true },
  { id: 'klader', name: { sv: 'Mode', en: 'Fashion' }, iconId: 'shirt', query: 'product_type:"Hampa-kläder" OR product_type:Kläder', isVisible: true },
  { id: 'kroppsvard', name: { sv: 'Kroppsvård', en: 'Body Care' }, iconId: 'droplets', query: 'product_type:Kroppsvård', isVisible: true },
  { id: 'ljus', name: { sv: 'Ljus', en: 'Candles' }, iconId: 'sparkles', query: 'product_type:Ljus', isVisible: true },
  { id: 'smycken', name: { sv: 'Smycken & Silver', en: 'Jewelry & Silver' }, iconId: 'gem', query: 'product_type:Smycken', isVisible: true },
  { id: 'bastudofter', name: { sv: 'Bastudofter', en: 'Sauna Scents' }, iconId: 'flame', query: 'product_type:Bastudofter', isVisible: true },
  { id: 'hem-textil', name: { sv: 'Hemtextil', en: 'Home Textiles' }, iconId: 'bed', query: 'product_type:Hemtextil OR product_type:Sängkläder OR product_type:Handdukar OR product_type:Filtar', isVisible: true },
];

const AdminCategoryManager = () => {
  const { language } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newCategory, setNewCategory] = useState({
    id: '',
    nameSv: '',
    nameEn: '',
    iconId: 'grid',
    query: '',
  });

  const content: Record<string, {
    title: string;
    subtitle: string;
    addCategory: string;
    categoryId: string;
    nameSv: string;
    nameEn: string;
    icon: string;
    query: string;
    visible: string;
    hidden: string;
    save: string;
    cancel: string;
    delete: string;
    categoryAdded: string;
    categoryDeleted: string;
    visibilityChanged: string;
    error: string;
    noCategories: string;
  }> = {
    sv: {
      title: 'Kategorihantering',
      subtitle: 'Lägg till, dölj och ta bort kategorier',
      addCategory: 'Lägg till kategori',
      categoryId: 'Kategori-ID (unikt)',
      nameSv: 'Namn (Svenska)',
      nameEn: 'Namn (Engelska)',
      icon: 'Ikon',
      query: 'Shopify-query (product_type:...)',
      visible: 'Synlig',
      hidden: 'Dold',
      save: 'Spara',
      cancel: 'Avbryt',
      delete: 'Ta bort',
      categoryAdded: 'Kategori tillagd!',
      categoryDeleted: 'Kategori borttagen!',
      visibilityChanged: 'Synlighet ändrad!',
      error: 'Något gick fel',
      noCategories: 'Inga kategorier',
    },
    en: {
      title: 'Category Management',
      subtitle: 'Add, hide and remove categories',
      addCategory: 'Add Category',
      categoryId: 'Category ID (unique)',
      nameSv: 'Name (Swedish)',
      nameEn: 'Name (English)',
      icon: 'Icon',
      query: 'Shopify query (product_type:...)',
      visible: 'Visible',
      hidden: 'Hidden',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      categoryAdded: 'Category added!',
      categoryDeleted: 'Category deleted!',
      visibilityChanged: 'Visibility changed!',
      error: 'Something went wrong',
      noCategories: 'No categories',
    },
    no: {
      title: 'Kategorihåndtering',
      subtitle: 'Legg til, skjul og fjern kategorier',
      addCategory: 'Legg til kategori',
      categoryId: 'Kategori-ID (unik)',
      nameSv: 'Navn (Svensk)',
      nameEn: 'Navn (Engelsk)',
      icon: 'Ikon',
      query: 'Shopify-query (product_type:...)',
      visible: 'Synlig',
      hidden: 'Skjult',
      save: 'Lagre',
      cancel: 'Avbryt',
      delete: 'Slett',
      categoryAdded: 'Kategori lagt til!',
      categoryDeleted: 'Kategori fjernet!',
      visibilityChanged: 'Synlighet endret!',
      error: 'Noe gikk galt',
      noCategories: 'Ingen kategorier',
    },
    da: {
      title: 'Kategorihåndtering',
      subtitle: 'Tilføj, skjul og fjern kategorier',
      addCategory: 'Tilføj kategori',
      categoryId: 'Kategori-ID (unik)',
      nameSv: 'Navn (Svensk)',
      nameEn: 'Navn (Engelsk)',
      icon: 'Ikon',
      query: 'Shopify-query (product_type:...)',
      visible: 'Synlig',
      hidden: 'Skjult',
      save: 'Gem',
      cancel: 'Annuller',
      delete: 'Slet',
      categoryAdded: 'Kategori tilføjet!',
      categoryDeleted: 'Kategori fjernet!',
      visibilityChanged: 'Synlighed ændret!',
      error: 'Noget gik galt',
      noCategories: 'Ingen kategorier',
    },
    de: {
      title: 'Kategorieverwaltung',
      subtitle: 'Kategorien hinzufügen, ausblenden und entfernen',
      addCategory: 'Kategorie hinzufügen',
      categoryId: 'Kategorie-ID (eindeutig)',
      nameSv: 'Name (Schwedisch)',
      nameEn: 'Name (Englisch)',
      icon: 'Symbol',
      query: 'Shopify-Query (product_type:...)',
      visible: 'Sichtbar',
      hidden: 'Versteckt',
      save: 'Speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      categoryAdded: 'Kategorie hinzugefügt!',
      categoryDeleted: 'Kategorie entfernt!',
      visibilityChanged: 'Sichtbarkeit geändert!',
      error: 'Etwas ist schief gelaufen',
      noCategories: 'Keine Kategorien',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  // Load categories from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (stored) {
      try {
        setCategories(JSON.parse(stored));
      } catch {
        setCategories(defaultCategories);
      }
    } else {
      setCategories(defaultCategories);
    }
    setIsLoading(false);
  }, []);

  // Save categories to localStorage
  const saveCategories = (newCategories: Category[]) => {
    setCategories(newCategories);
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(newCategories));
    // Dispatch custom event so Header can update
    window.dispatchEvent(new CustomEvent('categories-updated', { detail: newCategories }));
  };

  const toggleVisibility = (categoryId: string) => {
    const updated = categories.map(cat => 
      cat.id === categoryId ? { ...cat, isVisible: !cat.isVisible } : cat
    );
    saveCategories(updated);
    toast.success(t.visibilityChanged);
  };

  const deleteCategory = (categoryId: string) => {
    // Prevent deleting 'all' and 'bestsaljare'
    if (categoryId === 'all' || categoryId === 'bestsaljare') {
      toast.error('Denna kategori kan inte tas bort');
      return;
    }
    const updated = categories.filter(cat => cat.id !== categoryId);
    saveCategories(updated);
    toast.success(t.categoryDeleted);
  };

  const addCategory = () => {
    if (!newCategory.id || !newCategory.nameSv) {
      toast.error(t.error);
      return;
    }

    // Check if ID already exists
    if (categories.some(cat => cat.id === newCategory.id)) {
      toast.error('ID finns redan');
      return;
    }

    const category: Category = {
      id: newCategory.id.toLowerCase().replace(/\s+/g, '-'),
      name: {
        sv: newCategory.nameSv,
        en: newCategory.nameEn || newCategory.nameSv,
      },
      iconId: newCategory.iconId,
      query: newCategory.query || `product_type:${newCategory.nameSv}`,
      isVisible: true,
    };

    saveCategories([...categories, category]);
    setNewCategory({ id: '', nameSv: '', nameEn: '', iconId: 'grid', query: '' });
    setIsAddDialogOpen(false);
    toast.success(t.categoryAdded);
  };

  const getIconComponent = (iconId: string) => {
    const found = availableIcons.find(i => i.id === iconId);
    return found ? found.icon : Grid;
  };

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
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Grid className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              {t.addCategory}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Grid className="w-5 h-5 text-primary" />
                {t.addCategory}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.categoryId}</Label>
                <Input
                  value={newCategory.id}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="ny-kategori"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.nameSv}</Label>
                  <Input
                    value={newCategory.nameSv}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, nameSv: e.target.value }))}
                    placeholder="Ny Kategori"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.nameEn}</Label>
                  <Input
                    value={newCategory.nameEn}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, nameEn: e.target.value }))}
                    placeholder="New Category"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.icon}</Label>
                <Select
                  value={newCategory.iconId}
                  onValueChange={(value) => setNewCategory(prev => ({ ...prev, iconId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border border-border z-50">
                    {availableIcons.map((iconOption) => {
                      const IconComp = iconOption.icon;
                      return (
                        <SelectItem key={iconOption.id} value={iconOption.id}>
                          <div className="flex items-center gap-2">
                            <IconComp className="w-4 h-4" />
                            <span>{iconOption.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.query}</Label>
                <Input
                  value={newCategory.query}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, query: e.target.value }))}
                  placeholder="product_type:NyKategori"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  className="flex-1"
                >
                  {t.cancel}
                </Button>
                <Button onClick={addCategory} className="flex-1 gap-2">
                  <Save className="w-4 h-4" />
                  {t.save}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {categories.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{t.noCategories}</p>
        ) : (
          categories.map((category) => {
            const IconComp = getIconComponent(category.iconId);
            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  category.isVisible ? 'bg-secondary/50' : 'bg-muted/30 opacity-60'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <IconComp className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {category.name[language] || category.name.sv}
                  </p>
                  {category.query && (
                    <p className="text-xs text-muted-foreground truncate">
                      {category.query}
                    </p>
                  )}
                </div>
                <Badge variant={category.isVisible ? 'default' : 'secondary'} className="text-xs">
                  {category.isVisible ? t.visible : t.hidden}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleVisibility(category.id)}
                  >
                    {category.isVisible ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  {category.id !== 'all' && category.id !== 'bestsaljare' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteCategory(category.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminCategoryManager;

// Export function to get visible categories for use in Header
export const getVisibleCategories = (): Category[] => {
  const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
  if (stored) {
    try {
      const categories = JSON.parse(stored) as Category[];
      return categories.filter(cat => cat.isVisible);
    } catch {
      return defaultCategories.filter(cat => cat.isVisible);
    }
  }
  return defaultCategories.filter(cat => cat.isVisible);
};
