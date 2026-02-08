import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Package, FolderOpen, Zap, Plus, Edit, Trash2, Loader2, Eye, EyeOff, Save, Languages,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAutoTranslate } from '@/hooks/useAutoTranslate';

interface SiteUpdate {
  id: string;
  update_type: string;
  title_sv: string;
  title_en: string | null;
  description_sv: string | null;
  description_en: string | null;
  image_url: string | null;
  is_published: boolean;
  created_at: string;
}

const AdminSiteUpdatesManager = () => {
  const { language } = useLanguage();
  const { translate, isTranslating } = useAutoTranslate();
  const [updates, setUpdates] = useState<SiteUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<SiteUpdate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title_sv: '',
    description_sv: '',
    update_type: 'general',
    image_url: '',
    is_published: true,
  });

  const content: Record<string, {
    title: string;
    subtitle: string;
    addUpdate: string;
    editUpdate: string;
    titleLabel: string;
    descriptionLabel: string;
    typeLabel: string;
    imageUrl: string;
    published: string;
    save: string;
    cancel: string;
    translating: string;
    types: { general: string; product: string; category: string; feature: string };
    success: string;
    error: string;
    deleted: string;
    noUpdates: string;
  }> = {
    sv: {
      title: 'Nytt hos oss',
      subtitle: 'Skapa och hantera uppdateringar',
      addUpdate: 'Lägg till',
      editUpdate: 'Redigera',
      titleLabel: 'Titel (svenska)',
      descriptionLabel: 'Beskrivning (svenska)',
      typeLabel: 'Typ',
      imageUrl: 'Bild-URL (valfritt)',
      published: 'Publicerad',
      save: 'Spara',
      cancel: 'Avbryt',
      translating: 'Översätter...',
      types: { general: 'Allmänt', product: 'Ny produkt', category: 'Ny kategori', feature: 'Ny funktion' },
      success: 'Uppdatering sparad!',
      error: 'Något gick fel',
      deleted: 'Borttagen!',
      noUpdates: 'Inga uppdateringar ännu',
    },
    en: {
      title: "What's New",
      subtitle: 'Create and manage updates',
      addUpdate: 'Add',
      editUpdate: 'Edit',
      titleLabel: 'Title (Swedish)',
      descriptionLabel: 'Description (Swedish)',
      typeLabel: 'Type',
      imageUrl: 'Image URL (optional)',
      published: 'Published',
      save: 'Save',
      cancel: 'Cancel',
      translating: 'Translating...',
      types: { general: 'General', product: 'New product', category: 'New category', feature: 'New feature' },
      success: 'Update saved!',
      error: 'Something went wrong',
      deleted: 'Deleted!',
      noUpdates: 'No updates yet',
    },
    no: {
      title: 'Nytt hos oss',
      subtitle: 'Opprett og administrer oppdateringer',
      addUpdate: 'Legg til',
      editUpdate: 'Rediger',
      titleLabel: 'Tittel (svensk)',
      descriptionLabel: 'Beskrivelse (svensk)',
      typeLabel: 'Type',
      imageUrl: 'Bilde-URL (valgfritt)',
      published: 'Publisert',
      save: 'Lagre',
      cancel: 'Avbryt',
      translating: 'Oversetter...',
      types: { general: 'Generelt', product: 'Nytt produkt', category: 'Ny kategori', feature: 'Ny funksjon' },
      success: 'Oppdatering lagret!',
      error: 'Noe gikk galt',
      deleted: 'Slettet!',
      noUpdates: 'Ingen oppdateringer ennå',
    },
    da: {
      title: 'Nyt hos os',
      subtitle: 'Opret og administrer opdateringer',
      addUpdate: 'Tilføj',
      editUpdate: 'Rediger',
      titleLabel: 'Titel (svensk)',
      descriptionLabel: 'Beskrivelse (svensk)',
      typeLabel: 'Type',
      imageUrl: 'Billed-URL (valgfrit)',
      published: 'Udgivet',
      save: 'Gem',
      cancel: 'Annuller',
      translating: 'Oversætter...',
      types: { general: 'Generelt', product: 'Nyt produkt', category: 'Ny kategori', feature: 'Ny funktion' },
      success: 'Opdatering gemt!',
      error: 'Noget gik galt',
      deleted: 'Slettet!',
      noUpdates: 'Ingen opdateringer endnu',
    },
    de: {
      title: 'Neuigkeiten',
      subtitle: 'Aktualisierungen erstellen und verwalten',
      addUpdate: 'Hinzufügen',
      editUpdate: 'Bearbeiten',
      titleLabel: 'Titel (Schwedisch)',
      descriptionLabel: 'Beschreibung (Schwedisch)',
      typeLabel: 'Typ',
      imageUrl: 'Bild-URL (optional)',
      published: 'Veröffentlicht',
      save: 'Speichern',
      cancel: 'Abbrechen',
      translating: 'Übersetzen...',
      types: { general: 'Allgemein', product: 'Neues Produkt', category: 'Neue Kategorie', feature: 'Neue Funktion' },
      success: 'Aktualisierung gespeichert!',
      error: 'Etwas ist schief gelaufen',
      deleted: 'Gelöscht!',
      noUpdates: 'Noch keine Aktualisierungen',
    },
    fi: {
      title: 'Uutiset',
      subtitle: 'Luo ja hallinnoi päivityksiä',
      addUpdate: 'Lisää',
      editUpdate: 'Muokkaa',
      titleLabel: 'Otsikko (ruotsi)',
      descriptionLabel: 'Kuvaus (ruotsi)',
      typeLabel: 'Tyyppi',
      imageUrl: 'Kuva-URL (valinnainen)',
      published: 'Julkaistu',
      save: 'Tallenna',
      cancel: 'Peruuta',
      translating: 'Käännetään...',
      types: { general: 'Yleinen', product: 'Uusi tuote', category: 'Uusi kategoria', feature: 'Uusi ominaisuus' },
      success: 'Päivitys tallennettu!',
      error: 'Jotain meni pieleen',
      deleted: 'Poistettu!',
      noUpdates: 'Ei päivityksiä vielä',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    fetchUpdates();
    const channel = supabase
      .channel('admin-site-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_updates' }, () => fetchUpdates())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from('site_updates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUpdates(data || []);
    } catch (err) {
      console.error('Failed to fetch updates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ title_sv: '', description_sv: '', update_type: 'general', image_url: '', is_published: true });
    setEditingUpdate(null);
  };

  const handleEdit = (update: SiteUpdate) => {
    setEditingUpdate(update);
    setFormData({
      title_sv: update.title_sv,
      description_sv: update.description_sv || '',
      update_type: update.update_type,
      image_url: update.image_url || '',
      is_published: update.is_published,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title_sv.trim()) return;
    setIsSubmitting(true);
    try {
      // Auto-translate title and description
      const titleTranslations = await translate(formData.title_sv, 'sv', 'site update title');
      const descTranslations = formData.description_sv
        ? await translate(formData.description_sv, 'sv', 'site update description')
        : null;

      const payload = {
        title_sv: formData.title_sv,
        title_en: titleTranslations?.en || formData.title_sv,
        description_sv: formData.description_sv || null,
        description_en: descTranslations?.en || formData.description_sv || null,
        update_type: formData.update_type,
        image_url: formData.image_url || null,
        is_published: formData.is_published,
        updated_at: new Date().toISOString(),
      };

      if (editingUpdate) {
        const { error } = await supabase.from('site_updates').update(payload).eq('id', editingUpdate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('site_updates').insert(payload);
        if (error) throw error;
      }

      toast.success(t.success);
      resetForm();
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Failed to save update:', err);
      toast.error(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('site_updates').delete().eq('id', id);
      if (error) throw error;
      toast.success(t.deleted);
    } catch (err) {
      console.error('Failed to delete:', err);
      toast.error(t.error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'product': return Package;
      case 'category': return FolderOpen;
      case 'feature': return Zap;
      default: return Sparkles;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4" />
          {t.addUpdate}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : updates.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">{t.noUpdates}</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {updates.map((update) => {
            const Icon = getTypeIcon(update.update_type);
            return (
              <motion.div
                key={update.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${update.is_published ? 'bg-secondary/50' : 'bg-muted/30 opacity-60'}`}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{update.title_sv}</p>
                  <p className="text-xs text-muted-foreground">{t.types[update.update_type as keyof typeof t.types] || update.update_type}</p>
                </div>
                <Badge variant={update.is_published ? 'default' : 'secondary'} className="text-xs">
                  {update.is_published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(update)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(update.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {editingUpdate ? t.editUpdate : t.addUpdate}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.titleLabel}</Label>
              <div className="relative">
                <Input
                  value={formData.title_sv}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title_sv: e.target.value }))}
                  placeholder="Ny uppdatering..."
                />
                <Languages className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">Skrivs på svenska → översätts automatiskt</p>
            </div>

            <div className="space-y-2">
              <Label>{t.descriptionLabel}</Label>
              <Textarea
                value={formData.description_sv}
                onChange={(e) => setFormData((prev) => ({ ...prev, description_sv: e.target.value }))}
                placeholder="Beskrivning..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{t.typeLabel}</Label>
              <Select value={formData.update_type} onValueChange={(v) => setFormData((prev) => ({ ...prev, update_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">{t.types.general}</SelectItem>
                  <SelectItem value="product">{t.types.product}</SelectItem>
                  <SelectItem value="category">{t.types.category}</SelectItem>
                  <SelectItem value="feature">{t.types.feature}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.imageUrl}</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{t.published}</Label>
              <Switch
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_published: checked }))}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { resetForm(); setIsDialogOpen(false); }} className="flex-1">
                {t.cancel}
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || isTranslating || !formData.title_sv.trim()} className="flex-1">
                {isSubmitting || isTranslating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isTranslating ? t.translating : ''}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {t.save}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSiteUpdatesManager;
