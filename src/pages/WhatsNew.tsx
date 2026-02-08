import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Package, FolderOpen, Zap, CalendarDays, Loader2, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

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

const WhatsNew = () => {
  const { language } = useLanguage();
  const [updates, setUpdates] = useState<SiteUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const content: Record<string, {
    title: string;
    subtitle: string;
    noUpdates: string;
    types: { general: string; product: string; category: string; feature: string };
  }> = {
    sv: {
      title: 'Nytt hos oss',
      subtitle: 'Senaste uppdateringar, nya produkter och funktioner',
      noUpdates: 'Inga uppdateringar ännu',
      types: { general: 'Allmänt', product: 'Ny produkt', category: 'Ny kategori', feature: 'Ny funktion' },
    },
    en: {
      title: "What's New",
      subtitle: 'Latest updates, new products and features',
      noUpdates: 'No updates yet',
      types: { general: 'General', product: 'New product', category: 'New category', feature: 'New feature' },
    },
    no: {
      title: 'Nytt hos oss',
      subtitle: 'Siste oppdateringer, nye produkter og funksjoner',
      noUpdates: 'Ingen oppdateringer ennå',
      types: { general: 'Generelt', product: 'Nytt produkt', category: 'Ny kategori', feature: 'Ny funksjon' },
    },
    da: {
      title: 'Nyt hos os',
      subtitle: 'Seneste opdateringer, nye produkter og funktioner',
      noUpdates: 'Ingen opdateringer endnu',
      types: { general: 'Generelt', product: 'Nyt produkt', category: 'Ny kategori', feature: 'Ny funktion' },
    },
    de: {
      title: 'Neuigkeiten',
      subtitle: 'Neueste Updates, neue Produkte und Funktionen',
      noUpdates: 'Noch keine Updates',
      types: { general: 'Allgemein', product: 'Neues Produkt', category: 'Neue Kategorie', feature: 'Neue Funktion' },
    },
    fi: {
      title: 'Uutiset',
      subtitle: 'Viimeisimmät päivitykset, uudet tuotteet ja ominaisuudet',
      noUpdates: 'Ei päivityksiä vielä',
      types: { general: 'Yleinen', product: 'Uusi tuote', category: 'Uusi kategoria', feature: 'Uusi ominaisuus' },
    },
    nl: {
      title: 'Nieuws',
      subtitle: 'Laatste updates, nieuwe producten en functies',
      noUpdates: 'Nog geen updates',
      types: { general: 'Algemeen', product: 'Nieuw product', category: 'Nieuwe categorie', feature: 'Nieuwe functie' },
    },
    fr: {
      title: 'Nouveautés',
      subtitle: 'Dernières mises à jour, nouveaux produits et fonctionnalités',
      noUpdates: 'Aucune mise à jour pour le moment',
      types: { general: 'Général', product: 'Nouveau produit', category: 'Nouvelle catégorie', feature: 'Nouvelle fonctionnalité' },
    },
    es: {
      title: 'Novedades',
      subtitle: 'Últimas actualizaciones, nuevos productos y funciones',
      noUpdates: 'Sin actualizaciones aún',
      types: { general: 'General', product: 'Nuevo producto', category: 'Nueva categoría', feature: 'Nueva función' },
    },
    pl: {
      title: 'Nowości',
      subtitle: 'Najnowsze aktualizacje, nowe produkty i funkcje',
      noUpdates: 'Brak aktualizacji',
      types: { general: 'Ogólne', product: 'Nowy produkt', category: 'Nowa kategoria', feature: 'Nowa funkcja' },
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    fetchUpdates();
    const channel = supabase
      .channel('site-updates-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_updates' }, () => fetchUpdates())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from('site_updates')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUpdates(data || []);
    } catch (err) {
      console.error('Failed to fetch updates:', err);
    } finally {
      setIsLoading(false);
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

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={t.title} description={t.subtitle} />
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
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">{t.title}</h1>
            <p className="text-lg text-muted-foreground">{t.subtitle}</p>
          </motion.div>

          {/* Updates List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : updates.length === 0 ? (
            <div className="text-center py-12 bg-secondary/30 rounded-2xl max-w-md mx-auto">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">{t.noUpdates}</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {updates.map((update, index) => {
                const Icon = getTypeIcon(update.update_type);
                const title = language === 'sv' ? update.title_sv : (update.title_en || update.title_sv);
                const description = language === 'sv' ? update.description_sv : (update.description_en || update.description_sv);

                return (
                  <motion.div
                    key={update.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-card border border-border rounded-xl p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {t.types[update.update_type as keyof typeof t.types] || update.update_type}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-lg">{title}</h3>
                        {description && <p className="text-muted-foreground mt-2">{description}</p>}
                        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                          <CalendarDays className="w-4 h-4" />
                          {formatDate(update.created_at)}
                        </div>
                      </div>
                    </div>
                    {update.image_url && (
                      <img src={update.image_url} alt={title} className="w-full h-48 object-cover rounded-lg mt-4" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default WhatsNew;
