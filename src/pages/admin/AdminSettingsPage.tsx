import { useEffect, useState } from 'react';
import { Settings, ShoppingCart, Wrench, Home, AlertTriangle, Eye, EyeOff, Globe, Shield, Database, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { usePageVisibility, ToggleablePage } from '@/stores/pageVisibilityStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const homepageSections = [
  { key: 'homepage_philosophy', label: 'Filosofi-sektion', desc: '"Hur vi väljer produkter" med tre kort' },
  { key: 'homepage_bestsellers', label: 'Populära produkter', desc: 'Visar 4 topprodukter från databasen' },
  { key: 'homepage_reviews', label: 'Kundrecensioner', desc: 'Visar senaste godkända recensioner' },
  { key: 'homepage_about', label: 'Om 4thepeople', desc: 'Kort om-sektion med filosofi' },
];

const pageToggles: { id: ToggleablePage; label: string; desc: string }[] = [
  { id: 'affiliate', label: 'Samarbete / Affiliate', desc: 'Sidan för att bli affiliate-partner' },
  { id: 'business', label: 'Företag', desc: 'B2B-sidan för företagskunder' },
  { id: 'suggest-product', label: 'Önska produkt', desc: 'Formulär för produktförslag' },
  { id: 'donations', label: 'Donationer', desc: 'Donationssidan och informationen' },
  { id: 'whats-new', label: 'Nytt hos oss', desc: 'Nyheter och uppdateringar' },
];

const AdminSettingsPage = () => {
  const {
    siteActive, checkoutEnabled, isLoaded, fetchSettings,
    setSiteActive, setCheckoutEnabled, setHomepageSetting,
    homepageBestsellers, homepageReviews, homepagePhilosophy, homepageAbout,
  } = useStoreSettings();
  const { isVisible, setVisibility } = usePageVisibility();
  const [dbStats, setDbStats] = useState<{ tables: number; totalRows: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!isLoaded) fetchSettings();
  }, [isLoaded, fetchSettings]);

  const getHomepageValue = (key: string) => {
    switch (key) {
      case 'homepage_bestsellers': return homepageBestsellers;
      case 'homepage_reviews': return homepageReviews;
      case 'homepage_philosophy': return homepagePhilosophy;
      case 'homepage_about': return homepageAbout;
      default: return false;
    }
  };

  const fetchDbStats = async () => {
    setLoadingStats(true);
    try {
      const tables = ['orders', 'products', 'profiles', 'reviews', 'affiliates', 'donations'] as const;
      let totalRows = 0;
      for (const table of tables) {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        totalRows += count || 0;
      }
      setDbStats({ tables: tables.length, totalRows });
    } catch {
      toast.error('Kunde inte hämta databasstatistik');
    } finally {
      setLoadingStats(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inställningar</h1>
        <p className="text-muted-foreground text-sm mt-1">Alla admin-inställningar och kontroller</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="general">Generellt</TabsTrigger>
          <TabsTrigger value="pages">Sidor</TabsTrigger>
          <TabsTrigger value="homepage">Startsida</TabsTrigger>
          <TabsTrigger value="advanced">Avancerat</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-4">
          <div className="grid gap-4 max-w-xl">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="w-4 h-4" />
                  Sajtstatus
                  {!siteActive && <Badge variant="destructive" className="text-xs">Inaktiv</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Sajten aktiv</Label>
                    <p className="text-xs text-muted-foreground mt-1">Stäng av för att visa underhållssida för alla besökare</p>
                  </div>
                  <Switch checked={siteActive} onCheckedChange={setSiteActive} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="w-4 h-4" />
                  Kassa
                  {!checkoutEnabled && <Badge variant="secondary" className="text-xs">Avstängd</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Tillåt beställningar</Label>
                    <p className="text-xs text-muted-foreground mt-1">Stäng av för att tillfälligt stoppa nya beställningar</p>
                  </div>
                  <Switch checked={checkoutEnabled} onCheckedChange={setCheckoutEnabled} />
                </div>
              </CardContent>
            </Card>
          </div>

          {(!siteActive || !checkoutEnabled) && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-warning/30 bg-warning/5 max-w-xl">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
              <p className="text-sm text-foreground">
                {!siteActive && 'Sajten är inaktiv — besökare ser underhållssidan. '}
                {!checkoutEnabled && 'Kassan är avstängd — kunder kan inte slutföra köp.'}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Pages */}
        <TabsContent value="pages" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4" />
              Sidsynlighet
            </h2>
            <p className="text-muted-foreground text-sm mb-4">Styr vilka sidor som visas för besökare. Dolda sidor kan fortfarande förhandsgranskas av admin.</p>
          </div>
          <div className="grid gap-3 max-w-xl">
            {pageToggles.map((page) => (
              <div key={page.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3">
                  {isVisible(page.id) ? (
                    <Eye className="w-4 h-4 text-primary" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div>
                    <Label className="text-sm font-medium">{page.label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{page.desc}</p>
                  </div>
                </div>
                <Switch checked={isVisible(page.id)} onCheckedChange={(checked) => setVisibility(page.id, checked)} />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Homepage */}
        <TabsContent value="homepage" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <Home className="w-4 h-4" />
              Startsidans sektioner
            </h2>
            <p className="text-muted-foreground text-sm mb-4">Visa eller dölj sektioner på startsidan</p>
          </div>
          <div className="grid gap-3 max-w-xl">
            {homepageSections.map((section) => (
              <div key={section.key} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                <div>
                  <Label className="text-sm font-medium">{section.label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{section.desc}</p>
                </div>
                <Switch
                  checked={getHomepageValue(section.key)}
                  onCheckedChange={(checked) => setHomepageSetting(section.key, checked)}
                />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Advanced */}
        <TabsContent value="advanced" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4" />
              Avancerade inställningar
            </h2>
            <p className="text-muted-foreground text-sm mb-4">Databasöversikt och systemverktyg</p>
          </div>

          <div className="grid gap-4 max-w-xl">
            {/* Database overview */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="w-4 h-4" />
                  Databasöversikt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dbStats ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-secondary/50 text-center">
                      <p className="text-2xl font-bold">{dbStats.tables}</p>
                      <p className="text-xs text-muted-foreground">Tabeller</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 text-center">
                      <p className="text-2xl font-bold">{dbStats.totalRows.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Rader totalt</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Klicka nedan för att hämta statistik</p>
                )}
                <Button variant="outline" size="sm" className="gap-2" onClick={fetchDbStats} disabled={loadingStats}>
                  <RefreshCw className={cn('w-3.5 h-3.5', loadingStats && 'animate-spin')} />
                  {loadingStats ? 'Hämtar...' : 'Hämta statistik'}
                </Button>
              </CardContent>
            </Card>

            {/* System info */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="w-4 h-4" />
                  Systeminformation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Miljö</span>
                    <span className="font-medium">Produktion</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Framework</span>
                    <span className="font-medium">React + Vite</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Backend</span>
                    <span className="font-medium">Lovable Cloud</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Autentisering</span>
                    <Badge variant="outline" className="text-xs">Aktiv</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">RLS</span>
                    <Badge variant="outline" className="text-xs text-primary border-primary/30">Aktiverat</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettingsPage;
