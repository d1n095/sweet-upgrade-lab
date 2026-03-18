import { useEffect } from 'react';
import { Settings, AlertTriangle, ShoppingCart, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useStoreSettings } from '@/stores/storeSettingsStore';

const AdminSettingsPage = () => {
  const { siteActive, checkoutEnabled, isLoaded, fetchSettings, setSiteActive, setCheckoutEnabled } = useStoreSettings();

  useEffect(() => {
    if (!isLoaded) fetchSettings();
  }, [isLoaded, fetchSettings]);

  return (
    <div className="space-y-6">
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
    </div>
  );
};

export default AdminSettingsPage;
