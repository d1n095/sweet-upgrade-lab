import { type ReactNode } from 'react';
import { Shield } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

type PermissionAction = 'read' | 'update' | 'delete';

interface RequirePermissionProps {
  module: string;
  action?: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}

const DefaultDenied = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <Shield className="w-16 h-16 text-muted-foreground/30" />
    <h2 className="text-xl font-semibold text-muted-foreground">Åtkomst nekad</h2>
    <p className="text-sm text-muted-foreground">Du saknar behörighet för denna modul.</p>
  </div>
);

/**
 * Route-level permission gate.
 * Renders children only when the current user has the required permission,
 * derived exclusively from role_module_permissions in the DB.
 * No frontend logic is the authority — DB role wins.
 *
 * Usage:
 *   <RequirePermission module="orders" action="read">
 *     <OrdersPage />
 *   </RequirePermission>
 */
export const RequirePermission = ({
  module,
  action = 'read',
  children,
  fallback = <DefaultDenied />,
}: RequirePermissionProps) => {
  const { canRead, canUpdate, canDelete, isLoading } = usePermissions();

  if (isLoading) return null;

  const allowed =
    action === 'read'   ? canRead(module) :
    action === 'update' ? canUpdate(module) :
    action === 'delete' ? canDelete(module) :
    false;

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
};

export default RequirePermission;
