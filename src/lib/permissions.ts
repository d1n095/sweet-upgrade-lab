// ─── Centralized RBAC permission helpers ───
// Single source of truth for all access-control decisions.

export type ModuleActions = { read: boolean; write: boolean; delete: boolean; approve: boolean };
export type GranularPermissions = Record<string, ModuleActions>;
export type PermissionAction = keyof ModuleActions;

/**
 * Check whether a permissions map grants a specific action on a given module.
 * Returns true only when the value is explicitly `true` — deny-by-default.
 */
export function hasPermission(
  permissions: GranularPermissions | null | undefined,
  module: string,
  action: PermissionAction = 'read',
): boolean {
  return permissions?.[module]?.[action] === true;
}

/**
 * Merge multiple GranularPermissions objects using union logic.
 * `true` overrides `false`; undefined / missing actions are treated as `false`.
 */
export function mergePermissions(perms: GranularPermissions[]): GranularPermissions {
  const result: GranularPermissions = {};
  for (const p of perms) {
    for (const [mod, actions] of Object.entries(p)) {
      if (!result[mod]) result[mod] = { read: false, write: false, delete: false, approve: false };
      result[mod].read    = result[mod].read    || (actions.read    ?? false);
      result[mod].write   = result[mod].write   || (actions.write   ?? false);
      result[mod].delete  = result[mod].delete  || (actions.delete  ?? false);
      result[mod].approve = result[mod].approve || (actions.approve ?? false);
    }
  }
  return result;
}
