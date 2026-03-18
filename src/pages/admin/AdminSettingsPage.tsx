import { useEffect } from 'react';
import { Settings, AlertTriangle, ShoppingCart, Wrench, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useStoreSettings } from '@/stores/storeSettingsStore';

const homepageSections = [
  { key: 'homepage_philosophy', label: 'Filosofi-sektion', desc: '"Hur vi väljer produkter" med tre kort' },
  { key: 'homepage_bestsellers', label: 'Populära produkter', desc: 'Visar 4 topprodukter från databasen' },
  { key: 'homepage_reviews', label: 'Kundrecensioner', desc: 'Visar senaste godkända recensioner' },
  { key: 'homepage_about', label: 'Om 4thepeople', desc: 'Kort om-sektion med filosofi' },
];

const AdminSettingsPage = () => {
  const {
    siteActive, checkoutEnabled, isLoaded, fetchSettings,
    setSiteActive, setCheckoutEnabled, setHomepageSetting,
    homepageBestsellers, homepageReviews, homepagePhilosophy, homepageAbout,
  } = useStoreSettings();

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Inställningar</h1>
        <p className="text-muted-foreground text-sm mt-1">Globala butikinställningar</p>
      </div>

      <div className="grid gap-4 max-w-xl">
        {/* Site Active */}
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
                <p className="text-xs text-muted-foreground mt-1">
                  Stäng av för att visa underhållssida för alla besökare
                </p>
              </div>
              <Switch checked={siteActive} onCheckedChange={setSiteActive} />
            </div>
          </CardContent>
        </Card>

        {/* Checkout Toggle */}
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
                <p className="text-xs text-muted-foreground mt-1">
                  Stäng av för att tillfälligt stoppa nya beställningar
                </p>
              </div>
              <Switch checked={checkoutEnabled} onCheckedChange={setCheckoutEnabled} />
            </div>
          </CardContent>
        </Card>
      </div>

      {(!siteActive || !checkoutEnabled) && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 max-w-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm">
            {!siteActive && 'Sajten är inaktiv — besökare ser underhållssidan. '}
            {!checkoutEnabled && 'Kassan är avstängd — kunder kan inte slutföra köp.'}
          </p>
        </div>
      )}

      {/* Homepage Sections */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Home className="w-4 h-4" />
          Startsidans sektioner
        </h2>
        <p className="text-muted-foreground text-sm mb-4">Visa eller dölj sektioner på startsidan</p>

        <div className="grid gap-3 max-w-xl">
          {homepageSections.map((section) => (
            <div
              key={section.key}
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-card"
            >
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
      </div>
    </div>
  );
};

export default AdminSettingsPage;
