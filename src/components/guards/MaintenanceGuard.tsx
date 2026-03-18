import { ReactNode } from 'react';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { useAdminRole } from '@/hooks/useAdminRole';
import { Wrench } from 'lucide-react';

const MaintenanceGuard = ({ children }: { children: ReactNode }) => {
  const { maintenanceMode } = useStoreSettings();
  const { isAdmin } = useAdminRole();

  // Admins can always bypass maintenance mode
  if (maintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Wrench className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-semibold mb-3">Vi är snart tillbaka</h1>
          <p className="text-muted-foreground">
            Vi gör en snabb uppdatering av butiken. Var god återkom om en stund.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MaintenanceGuard;
