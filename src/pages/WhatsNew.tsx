import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, Package, FolderOpen, Zap, CalendarDays, 
  Plus, Edit, Trash2, Loader2, Eye, EyeOff, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';
import { useLanguage } from '@/context/LanguageContext';
import { useAdminRole } from '@/hooks/useAdminRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SiteUpdate {
  id: string;
  update_type: string;
  title_sv: string;
  title_en: string | null;
  description_sv: string | null;
  description_en: string | null;
  related_product_id: string | null;
  related_category: string | null;
  image_url: string | null;
  is_published: boolean;
  created_at: string;
}

const WhatsNew = () => {
  const { language } = useLanguage();
  const { isAdmin } = useAdminRole();
  const [updates, setUpdates] = useState<SiteUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<SiteUpdate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title_sv: '',
    title_en: '',
    description_sv: '',
    description_en: '',
    update_type: 'general',
    image_url: '',
    is_published: true,
  });

  const content: Record<string, {
    title: string;
    subtitle: string;
    noUpdates: string;
    addUpdate: string;
    editUpdate: string;
    titleLabel: string;
    descriptionLabel: string;
    typeLabel: string;
    imageUrl: string;
    published: string;
    save: string;
    cancel: string;
    delete: string;
    types: {
      general: string;
      product: string;
      category: string;
      feature: string;
    };
    success: string;
    error: string;
    deleted: string;
  }> = {
    sv: {
      title: 'Nytt hos oss',
      subtitle: 'Senaste uppdateringar, nya produkter och funktioner',
      noUpdates: 'Inga uppdateringar ännu',
      addUpdate: 'Lägg till uppdatering',
      editUpdate: 'Redigera uppdatering',
      titleLabel: 'Titel',
      descriptionLabel: 'Beskrivning',
      typeLabel: 'Typ',
      imageUrl: 'Bild-URL (valfritt)',
      published: 'Publicerad',
      save: 'Spara',
      cancel: 'Avbryt',
      delete: 'Ta bort',
      types: {
        general: 'Allmänt',
        product: 'Ny produkt',
        category: 'Ny kategori',
        feature: 'Ny funktion',
      },
      success: 'Uppdatering sparad!',
      error: 'Något gick fel',
      deleted: 'Uppdatering borttagen!',
    },
    en: {
      title: "What's New",
      subtitle: 'Latest updates, new products and features',
      noUpdates: 'No updates yet',
      addUpdate: 'Add update',
      editUpdate: 'Edit update',
      titleLabel: 'Title',
      descriptionLabel: 'Description',
      typeLabel: 'Type',
      imageUrl: 'Image URL (optional)',
      published: 'Published',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      types: {
        general: 'General',
        product: 'New product',
        category: 'New category',
        feature: 'New feature',
      },
      success: 'Update saved!',
      error: 'Something went wrong',
      deleted: 'Update deleted!',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    fetchUpdates();

    const channel = supabase
      .channel('site-updates-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_updates' },
        () => fetchUpdates()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from('site_updates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUpdates(data || []);
    } catch (error) {
      console.error('Failed to fetch updates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title_sv: '',
      title_en: '',
      description_sv: '',
      description_en: '',
      update_type: 'general',
      image_url: '',
      is_published: true,
    });
    setEditingUpdate(null);
  };

  const handleEdit = (update: SiteUpdate) => {
    setEditingUpdate(update);
    setFormData({
      title_sv: update.title_sv,
      title_en: update.title_en || '',
      description_sv: update.description_sv || '',
      description_en: update.description_en || '',
      update_type: update.update_type,
      image_url: update.image_url || '',
      is_published: update.is_published,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Auto-translate title if only Swedish is provided
      const title_en = formData.title_en || formData.title_sv;
      const description_en = formData.description_en || formData.description_sv;

      if (editingUpdate) {
        const { error } = await supabase
          .from('site_updates')
          .update({
            title_sv: formData.title_sv,
            title_en,
            description_sv: formData.description_sv,
            description_en,
            update_type: formData.update_type,
            image_url: formData.image_url || null,
            is_published: formData.is_published,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingUpdate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('site_updates')
          .insert({
            title_sv: formData.title_sv,
            title_en,
            description_sv: formData.description_sv,
            description_en,
            update_type: formData.update_type,
            image_url: formData.image_url || null,
            is_published: formData.is_published,
          });

        if (error) throw error;
      }

      toast.success(t.success);
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save update:', error);
      toast.error(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('site_updates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success(t.deleted);
    } catch (error) {
      console.error('Failed to delete update:', error);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const visibleUpdates = isAdmin ? updates : updates.filter(u => u.is_published);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t.title}
        description={t.subtitle}
      />
      <Header />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              {language === 'sv' ? 'Senaste nytt' : 'Latest news'}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {t.title}
            </h1>
            <p className="text-lg text-muted-foreground">{t.subtitle}</p>

            {isAdmin && (
              <Button 
                className="mt-6 gap-2"
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                {t.addUpdate}
              </Button>
            )}
          </motion.div>

          {/* Updates List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : visibleUpdates.length === 0 ? (
            <div className="text-center py-12 bg-secondary/30 rounded-2xl max-w-md mx-auto">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">{t.noUpdates}</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {visibleUpdates.map((update, index) => {
                const Icon = getTypeIcon(update.update_type);
                const title = language === 'sv' ? update.title_sv : (update.title_en || update.title_sv);
                const description = language === 'sv' ? update.description_sv : (update.description_en || update.description_sv);

                return (
                  <motion.div
                    key={update.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-card border border-border rounded-xl p-6 ${!update.is_published ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                {t.types[update.update_type as keyof typeof t.types] || update.update_type}
                              </Badge>
                              {!update.is_published && (
                                <Badge variant="outline" className="text-xs">
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  {language === 'sv' ? 'Gömd' : 'Hidden'}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold text-lg">{title}</h3>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(update)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDelete(update.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {description && (
                          <p className="text-muted-foreground mt-2">{description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                          <CalendarDays className="w-4 h-4" />
                          {formatDate(update.created_at)}
                        </div>
                      </div>
                    </div>
                    {update.image_url && (
                      <img 
                        src={update.image_url} 
                        alt={title}
                        className="w-full h-48 object-cover rounded-lg mt-4"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Edit/Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUpdate ? t.editUpdate : t.addUpdate}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.titleLabel} (SV)</Label>
              <Input
                value={formData.title_sv}
                onChange={(e) => setFormData(prev => ({ ...prev, title_sv: e.target.value }))}
                placeholder="Ny uppdatering..."
              />
            </div>

            <div className="space-y-2">
              <Label>{t.descriptionLabel} (SV)</Label>
              <Textarea
                value={formData.description_sv}
                onChange={(e) => setFormData(prev => ({ ...prev, description_sv: e.target.value }))}
                placeholder="Beskrivning..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{t.typeLabel}</Label>
              <Select
                value={formData.update_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, update_type: value }))}
              >
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
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{t.published}</Label>
              <Switch
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(false);
                }}
                className="flex-1"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.title_sv}
                className="flex-1"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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

export default WhatsNew;
