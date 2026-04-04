import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type Module = 'orders' | 'inventory' | 'statistics' | 'donations' | 'affiliate' | 'users' | 'system' | 'finance' | 'reviews' | 'content';
export type Action = 'read' | 'create' | 'update' | 'delete';

interface ModulePermission {
  module: string;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export const useModulePermissions = () => {
  const { user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setPermissions([]);
        setIsLoading(false);
        return;
      }
      try {
        // Get user roles first
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (!roles?.length) {
          setPermissions([]);
          setIsLoading(false);
          return;
        }

        const roleNames = roles.map(r => r.role);

        // Get permissions for all user roles
        const { data: perms } = await supabase
          .from('role_module_permissions')
          .select('module, can_read, can_create, can_update, can_delete')
          .in('role', roleNames);

        // Merge permissions (OR logic: if any role grants access, grant it)
        const merged = new Map<string, ModulePermission>();
        for (const p of perms || []) {
          const existing = merged.get(p.module);
          if (existing) {
            existing.can_read = existing.can_read || p.can_read;
            existing.can_create = existing.can_create || p.can_create;
            existing.can_update = existing.can_update || p.can_update;
            existing.can_delete = existing.can_delete || p.can_delete;
          } else {
            merged.set(p.module, { ...p });
          }
        }

        setPermissions(Array.from(merged.values()));
      } catch {
        setPermissions([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) load();
  }, [user, authLoading]);

  const can = useMemo(() => {
    return (module: Module, action: Action = 'read'): boolean => {
      const perm = permissions.find(p => p.module === module);
      if (!perm) return false;
      switch (action) {
        case 'read': return perm.can_read;
        case 'create': return perm.can_create;
        case 'update': return perm.can_update;
        case 'delete': return perm.can_delete;
        default: return false;
      }
    };
  }, [permissions]);

  const allowedModules = useMemo(
    () => permissions.filter(p => p.can_read).map(p => p.module),
    [permissions]
  );

  return { can, permissions, isLoading: authLoading || isLoading, allowedModules };
};
