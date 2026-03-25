import { useEffect, useState } from 'react';
import { Settings, ShoppingCart, Wrench, Home, AlertTriangle, Eye, EyeOff, Globe, Shield, Database, RefreshCw, UserPlus, CreditCard, User, Instagram, Facebook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { usePageVisibility, ToggleablePage } from '@/stores/pageVisibilityStore';
import { usePaymentMethodsStore } from '@/stores/paymentMethodsStore';
import { PAYMENT_ICON_MAP, GenericIcon } from '@/components/trust/PaymentMethodIcons';
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

const profileSettings = [
  { key: 'require_phone', label: 'Kräv telefonnummer', desc: 'Kunder uppmanas att ange telefon för komplett profil' },
  { key: 'require_address', label: 'Kräv adress', desc: 'Kunder uppmanas att ange leveransadress' },
  { key: 'guest_checkout', label: 'Tillåt gästcheckout', desc: 'Kunder kan köpa utan att skapa konto' },
  { key: 'auto_save_profile', label: 'Auto-spara efter köp', desc: 'Checkout-info sparas automatiskt till kundprofil' },
];

const AdminSettingsPage = () => {
  const {
    siteActive, checkoutEnabled, registrationEnabled, isLoaded, fetchSettings,
    setSiteActive, setCheckoutEnabled, setRegistrationEnabled, setHomepageSetting,
    homepageBestsellers, homepageReviews, homepagePhilosophy, homepageAbout,
    requirePhone, requireAddress, guestCheckout, autoSaveProfile, setProfileSetting,
    socialInstagram, socialFacebook, setSocialSetting,
  } = useStoreSettings();
  const { isVisible, setVisibility } = usePageVisibility();
  const { methods, isLoaded: paymentLoaded, load: loadPayments, toggle: togglePayment } = usePaymentMethodsStore();
  const [dbStats, setDbStats] = useState<{ tables: number; totalRows: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!isLoaded) fetchSettings();
    if (!paymentLoaded) loadPayments();
  }, [isLoaded, fetchSettings, paymentLoaded, loadPayments]);

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
        <ScrollableTabs>
          <TabsList className="w-max bg-secondary/50">
            <TabsTrigger value="general">🔐 Generellt</TabsTrigger>
            <TabsTrigger value="profile">👤 Profil & Kund</TabsTrigger>
            <TabsTrigger value="payments">💰 Betalningar</TabsTrigger>
            <TabsTrigger value="shipping">🚚 Frakt</TabsTrigger>
            <TabsTrigger value="pages">📄 Sidor</TabsTrigger>
            <TabsTrigger value="homepage">🏠 Startsida</TabsTrigger>
            <TabsTrigger value="advanced">⚙️ System</TabsTrigger>
          </TabsList>
        </ScrollableTabs>

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

            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlus className="w-4 h-4" />
                  Registrering
                  {!registrationEnabled && <Badge variant="secondary" className="text-xs">Avstängd</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Tillåt registrering</Label>
                    <p className="text-xs text-muted-foreground mt-1">Stäng av för att blockera nya registreringar. "Bli medlem" döljs.</p>
                  </div>
                  <Switch checked={registrationEnabled} onCheckedChange={setRegistrationEnabled} />
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

        {/* Profile & Customer */}
        <TabsContent value="profile" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <User className="w-4 h-4" />
              Profil & Kundinställningar
            </h2>
            <p className="text-muted-foreground text-sm mb-4">Styr vilken information som krävs av kunder</p>
          </div>
          <div className="grid gap-3 max-w-xl">
            {profileSettings.map((setting) => {
              const getValue = () => {
                switch (setting.key) {
                  case 'require_phone': return requirePhone;
                  case 'require_address': return requireAddress;
                  case 'guest_checkout': return guestCheckout;
                  case 'auto_save_profile': return autoSaveProfile;
                  default: return false;
                }
              };
              return (
                <div key={setting.key} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                  <div>
                    <Label className="text-sm font-medium">{setting.label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{setting.desc}</p>
                  </div>
                  <Switch
                    checked={getValue()}
                    onCheckedChange={(checked) => setProfileSetting(setting.key, checked)}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground max-w-xl">
            Ändringar sparas direkt. "Kräv"-inställningar visar en banner för kunder med ofullständig profil.
          </p>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4" />
              Betalningsmetoder
            </h2>
            <p className="text-muted-foreground text-sm mb-4">Styr vilka betalningsikoner som visas i footern och på produktsidor</p>
          </div>
          <div className="grid gap-3 max-w-xl">
            {methods.map((method) => {
              const Icon = PAYMENT_ICON_MAP[method.id];
              return (
                <div key={method.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <div className="w-12 flex justify-center">
                      {Icon ? <Icon size="sm" /> : <GenericIcon name={method.name} size="sm" />}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">{method.name}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {method.enabled ? 'Visas för kunder' : 'Dold'}
                      </p>
                    </div>
                  </div>
                  <Switch checked={method.enabled} onCheckedChange={() => togglePayment(method.id)} />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground max-w-xl">
            Ändringar sparas direkt och påverkar vilka betalningsikoner som visas på hela sajten.
          </p>
        </TabsContent>

        {/* Shipping */}
        <TabsContent value="shipping" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
              🚚 Fraktinställningar
            </h2>
            <p className="text-muted-foreground text-sm mb-4">Gränser och leveranstider hanteras via butiksinställningar i databasen</p>
          </div>
          <div className="grid gap-3 max-w-xl">
            <Card className="border-border">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <Label className="text-sm font-medium">Fri frakt-gräns</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Hanteras i store_settings (free_shipping_threshold)</p>
                  </div>
                  <Badge variant="outline">499 kr</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <Label className="text-sm font-medium">Standard fraktkostnad</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Hanteras i store_settings (shipping_cost)</p>
                  </div>
                  <Badge variant="outline">49 kr</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <Label className="text-sm font-medium">Leveranstid</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Visas för kunder i kassan</p>
                  </div>
                  <Badge variant="outline">3–5 vardagar</Badge>
                </div>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">
              Fraktinställningar uppdateras via butiksinställningar i databasen för att synkroniseras i realtid.
            </p>
          </div>
        </TabsContent>

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
