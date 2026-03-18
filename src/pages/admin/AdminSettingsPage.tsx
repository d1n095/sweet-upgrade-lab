import { Settings, AlertTriangle, ShoppingCart, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useStoreSettings } from '@/stores/storeSettingsStore';

const AdminSettingsPage = () => {
  const { maintenanceMode, checkoutEnabled, setMaintenanceMode, setCheckoutEnabled } = useStoreSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inställningar</h1>
        <p className="text-muted-foreground text-sm mt-1">Butikinställningar och kontroller</p>
      </div>

      <div className="grid gap-4 max-w-xl">
        {/* Maintenance Mode */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="w-4 h-4" />
              Underhållsläge
              {maintenanceMode && <Badge variant="destructive" className="text-xs">Aktivt</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Sätt butiken i underhållsläge</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Besökare ser ett underhållsmeddelande istället för butiken
                </p>
              </div>
              <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
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

      {(maintenanceMode || !checkoutEnabled) && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 max-w-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm">
            {maintenanceMode && 'Butiken är i underhållsläge. '}
            {!checkoutEnabled && 'Kassan är avstängd – kunder kan inte slutföra köp.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminSettingsPage;
