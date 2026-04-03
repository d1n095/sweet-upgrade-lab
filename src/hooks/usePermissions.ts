import { useModulePermissions, type Module } from './useModulePermissions';

/**
 * Single-source-of-truth permission hook.
 * Permissions are fetched exclusively from role_module_permissions via the user's role(s).
 * No frontend logic — DB is the only authority.
 */
export const usePermissions = () => {
  const { can, isLoading } = useModulePermissions();

  return {
    canRead:   (module: string): boolean => can(module as Module, 'read'),
    canUpdate: (module: string): boolean => can(module as Module, 'update'),
    canDelete: (module: string): boolean => can(module as Module, 'delete'),
    isLoading,
  };
};
