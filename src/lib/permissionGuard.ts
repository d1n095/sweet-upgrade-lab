// ─── Section 6: Global enforcement layer ───
// Use enforce() before any critical action, mutation, or admin operation.
// Throws synchronously — never silently allows access.

import { hasPermission, type GranularPermissions, type PermissionAction } from './permissions';

/**
 * Assert that the given permissions grant `action` on `module`.
 * Throws "ACCESS DENIED" if the check fails.
 * Use this at the start of every critical mutation, admin operation, or data-write path.
 */
export const enforce = (
  permissions: GranularPermissions | null | undefined,
  module: string,
  action: PermissionAction = 'read',
): void => {
  if (!hasPermission(permissions, module, action)) {
    const msg = `ACCESS DENIED: ${module}.${action}`;
    console.warn('RBAC VIOLATION', { module, action, reason: 'enforce() blocked' });
    throw new Error(msg);
  }
};
