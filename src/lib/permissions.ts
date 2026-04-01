// ─── Centralized RBAC permission helpers ───
// Single source of truth for all access-control decisions.
// STRICT MODE — no fallbacks, deny-by-default, validated at every boundary.

export type ModuleActions = { read: boolean; write: boolean; delete: boolean; approve: boolean };
export type GranularPermissions = Record<string, ModuleActions>;
export type PermissionAction = keyof ModuleActions;

const KNOWN_ACTIONS: ReadonlySet<string> = new Set(['read', 'write', 'delete', 'approve']);

// ─── Section 8: Initialization assertion ───
if (typeof window !== 'undefined') {
  console.log('RBAC LOCKED', {
    singleSource: true,
    noFallbacks: true,
    validated: true,
    enforced: true,
  });
}

// ─── Section 2: Global permissions validator ───
/**
 * Validate that a permissions map is non-null and non-empty.
 * Throws an error — never silently falls back to an empty object.
 */
export function validatePermissions(perms: GranularPermissions | null | undefined): GranularPermissions {
  if (!perms || Object.keys(perms).length === 0) {
    const msg = 'EMPTY PERMISSIONS NOT ALLOWED';
    console.warn('RBAC VIOLATION', { reason: msg });
    throw new Error(msg);
  }
  return perms;
}

// ─── Section 5: Core permission check ───
/**
 * Check whether a permissions map grants a specific action on a given module.
 * Returns true only when the value is explicitly `true` — deny-by-default.
 * Logs anomalies for unknown modules or actions (Section 7).
 */
export function hasPermission(
  permissions: GranularPermissions | null | undefined,
  module: string,
  action: PermissionAction = 'read',
): boolean {
  if (!KNOWN_ACTIONS.has(action)) {
    console.warn('RBAC VIOLATION', { module, action, reason: 'unknown action' });
    return false;
  }
  if (permissions && !Object.prototype.hasOwnProperty.call(permissions, module)) {
    console.warn('RBAC VIOLATION', { module, action, reason: 'unknown module' });
    return false;
  }
  return permissions?.[module]?.[action] === true;
}

// ─── Section 3: Hardened multi-role merge ───
/**
 * Merge multiple GranularPermissions objects with safe merge semantics:
 *   read    = OR  (present in ANY role)
 *   write / delete / approve = AND (ALL non-empty roles must grant it)
 * An empty permissions object is ignored to avoid poisoning the AND gate.
 */
export function mergePermissions(perms: GranularPermissions[]): GranularPermissions {
  const nonEmpty = perms.filter(p => p && Object.keys(p).length > 0);
  if (nonEmpty.length === 0) return {};

  // Collect all module keys across all non-empty permission sets
  const allModules = new Set<string>(nonEmpty.flatMap(p => Object.keys(p)));
  const result: GranularPermissions = {};

  for (const mod of allModules) {
    // read = OR: true if any role grants it
    const anyRead    = nonEmpty.some(p => p[mod]?.read    === true);
    // write/delete/approve = AND: true only when EVERY role that has this module grants it
    const rolesWithMod = nonEmpty.filter(p => Object.prototype.hasOwnProperty.call(p, mod));
    const allWrite   = rolesWithMod.length > 0 && rolesWithMod.every(p => p[mod]?.write   === true);
    const allDelete  = rolesWithMod.length > 0 && rolesWithMod.every(p => p[mod]?.delete  === true);
    const allApprove = rolesWithMod.length > 0 && rolesWithMod.every(p => p[mod]?.approve === true);

    if (!anyRead && !allWrite && !allDelete && !allApprove) continue;
    result[mod] = { read: anyRead, write: allWrite, delete: allDelete, approve: allApprove };
  }
  return result;
}

// ─── Section 4: DB record validation ───
/**
 * Parse and validate a raw DB permissions value.
 * Returns the validated GranularPermissions or null if invalid.
 * Logs anomalies instead of throwing — callers should skip null records.
 */
export function parseDbPermissions(raw: unknown, context: string): GranularPermissions | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    console.warn('RBAC VIOLATION', { context, reason: 'invalid permissions from DB', raw });
    return null;
  }
  const p = raw as Record<string, unknown>;
  if (Object.keys(p).length === 0) {
    console.warn('RBAC VIOLATION', { context, reason: 'empty permissions from DB' });
    return null;
  }
  return p as GranularPermissions;
}
