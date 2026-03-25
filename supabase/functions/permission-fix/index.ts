import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FixRequest {
  action: string;
  user_id?: string;
  role?: string;
  module?: string;
  issues?: any[];
}

interface FixResult {
  action: string;
  success: boolean;
  detail: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin/founder
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const sb = createClient(supabaseUrl, serviceKey);

    const { data: callerRoles } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isFounderOrAdmin = callerRoles?.some((r: any) => ["admin", "founder"].includes(r.role));
    if (!isFounderOrAdmin) throw new Error("Unauthorized: admin/founder role required");

    const body: FixRequest = await req.json();
    const results: FixResult[] = [];

    console.log(`[permission-fix] Action: ${body.action}`, body);

    const logAudit = async (targetUserId: string | null, auditAction: string, detail: string, roleBefore?: string[], roleAfter?: string[], permChanges?: any) => {
      try {
        await sb.from("access_audit_log").insert({
          user_id: user.id,
          target_user_id: targetUserId,
          action: auditAction,
          role_before: roleBefore || null,
          role_after: roleAfter || null,
          permission_changes: permChanges || null,
          detail,
          actor_email: user.email,
          source: "permission-fix",
        });
      } catch (e) { console.error("[audit] Failed:", e); }
    };

    // ── Least-privilege permission defaults per role ──
    const roleDefaults: Record<string, Record<string, { can_read: boolean; can_create: boolean; can_update: boolean; can_delete: boolean }>> = {
      support: {
        orders: { can_read: true, can_create: false, can_update: true, can_delete: false },
        reviews: { can_read: true, can_create: false, can_update: true, can_delete: false },
        users: { can_read: true, can_create: false, can_update: false, can_delete: false },
      },
      warehouse: {
        inventory: { can_read: true, can_create: false, can_update: true, can_delete: false },
        orders: { can_read: true, can_create: false, can_update: true, can_delete: false },
      },
      finance: {
        finance: { can_read: true, can_create: true, can_update: true, can_delete: false },
        orders: { can_read: true, can_create: false, can_update: false, can_delete: false },
        donations: { can_read: true, can_create: false, can_update: false, can_delete: false },
        affiliate: { can_read: true, can_create: false, can_update: true, can_delete: false },
        statistics: { can_read: true, can_create: false, can_update: false, can_delete: false },
      },
      marketing: {
        content: { can_read: true, can_create: true, can_update: true, can_delete: false },
        affiliate: { can_read: true, can_create: false, can_update: true, can_delete: false },
        donations: { can_read: true, can_create: true, can_update: true, can_delete: false },
        inventory: { can_read: true, can_create: false, can_update: false, can_delete: false },
        reviews: { can_read: true, can_create: false, can_update: false, can_delete: false },
        statistics: { can_read: true, can_create: false, can_update: false, can_delete: false },
      },
      moderator: {
        content: { can_read: true, can_create: true, can_update: true, can_delete: false },
        inventory: { can_read: true, can_create: false, can_update: false, can_delete: false },
        orders: { can_read: true, can_create: false, can_update: true, can_delete: false },
        reviews: { can_read: true, can_create: true, can_update: true, can_delete: false },
        users: { can_read: true, can_create: false, can_update: false, can_delete: false },
      },
      manager: {
        affiliate: { can_read: true, can_create: true, can_update: true, can_delete: false },
        content: { can_read: true, can_create: true, can_update: true, can_delete: false },
        donations: { can_read: true, can_create: true, can_update: true, can_delete: false },
        finance: { can_read: true, can_create: false, can_update: false, can_delete: false },
        inventory: { can_read: true, can_create: true, can_update: true, can_delete: false },
        orders: { can_read: true, can_create: true, can_update: true, can_delete: false },
        reviews: { can_read: true, can_create: true, can_update: true, can_delete: false },
        statistics: { can_read: true, can_create: false, can_update: false, can_delete: false },
        users: { can_read: true, can_create: false, can_update: true, can_delete: false },
      },
      it: {
        system: { can_read: true, can_create: true, can_update: true, can_delete: true },
        users: { can_read: true, can_create: true, can_update: true, can_delete: false },
        inventory: { can_read: true, can_create: false, can_update: false, can_delete: false },
        orders: { can_read: true, can_create: false, can_update: false, can_delete: false },
        statistics: { can_read: true, can_create: false, can_update: false, can_delete: false },
      },
    };

    switch (body.action) {
      // ── Fix: Remove duplicate role entries for a user ──
      case "fix_duplicate_role": {
        if (!body.user_id) throw new Error("user_id required");
        const { data: userRoles } = await sb.from("user_roles").select("*").eq("user_id", body.user_id);
        const seen = new Set<string>();
        const toDelete: string[] = [];
        for (const r of userRoles || []) {
          if (seen.has(r.role)) toDelete.push(r.id);
          else seen.add(r.role);
        }
        if (toDelete.length > 0) {
          await sb.from("user_roles").delete().in("id", toDelete);
          await logAudit(body.user_id!, "duplicate_role_removed", `Removed ${toDelete.length} duplicate role entries`);
          results.push({ action: "fix_duplicate_role", success: true, detail: `Removed ${toDelete.length} duplicate role entries` });
        } else {
          results.push({ action: "fix_duplicate_role", success: true, detail: "No duplicates found" });
        }
        break;
      }

      // ── Fix: Remove DELETE permission on sensitive modules for non-admin roles ──
      case "fix_insecure_delete": {
        if (!body.role || !body.module) throw new Error("role and module required");
        const sensitiveModules = ["orders", "members", "products", "users"];
        const adminRoles = ["admin", "founder"];
        if (adminRoles.includes(body.role)) {
          results.push({ action: "fix_insecure_delete", success: false, detail: "Cannot modify admin/founder permissions" });
          break;
        }
        if (sensitiveModules.includes(body.module)) {
          await sb.from("role_module_permissions")
            .update({ can_delete: false })
            .eq("role", body.role)
            .eq("module", body.module);
          await logAudit(null, "insecure_delete_fixed", `Removed DELETE on "${body.module}" for role "${body.role}"`, null, null, { role: body.role, module: body.module, removed: "can_delete" });
          results.push({ action: "fix_insecure_delete", success: true, detail: `Removed DELETE on "${body.module}" for role "${body.role}"` });
        }
        break;
      }

      // ── Fix: Remove extra high-privilege role (keep the highest one) ──
      case "fix_over_permissioned": {
        if (!body.user_id) throw new Error("user_id required");
        const { data: userRoles } = await sb.from("user_roles").select("*").eq("user_id", body.user_id);
        const highPriv = ["founder", "admin", "it"];
        const highRoles = (userRoles || []).filter(r => highPriv.includes(r.role));

        if (highRoles.length <= 1) {
          results.push({ action: "fix_over_permissioned", success: true, detail: "No excess high-privilege roles" });
          break;
        }
        // Keep the highest: founder > admin > it
        const priority = ["founder", "admin", "it"];
        highRoles.sort((a, b) => priority.indexOf(a.role) - priority.indexOf(b.role));
        const toRemove = highRoles.slice(1); // Keep the first (highest priority)
        for (const r of toRemove) {
          await sb.from("user_roles").delete().eq("id", r.id);
        }
        const keptRoles = (userRoles || []).map(r => r.role).filter(r => !toRemove.map(tr => tr.role).includes(r));
        await logAudit(body.user_id!, "over_permissioned_fixed", `Kept "${highRoles[0].role}", removed: ${toRemove.map(r => r.role).join(", ")}`, (userRoles || []).map(r => r.role), keptRoles);
        results.push({
          action: "fix_over_permissioned",
          success: true,
          detail: `Kept "${highRoles[0].role}", removed: ${toRemove.map(r => r.role).join(", ")}`,
        });
        break;
      }

      // ── Fix: Reset a role's permissions to least-privilege defaults ──
      case "fix_role_permissions": {
        if (!body.role) throw new Error("role required");
        const defaults = roleDefaults[body.role];
        if (!defaults) {
          results.push({ action: "fix_role_permissions", success: false, detail: `No defaults defined for role "${body.role}"` });
          break;
        }
        // Delete current permissions for this role
        await sb.from("role_module_permissions").delete().eq("role", body.role);
        // Insert defaults
        const rows = Object.entries(defaults).map(([module, perms]) => ({
          role: body.role,
          module,
          ...perms,
        }));
        await sb.from("role_module_permissions").insert(rows);
        await logAudit(null, "role_permissions_reset", `Reset "${body.role}" to ${rows.length} module permissions (least-privilege)`, null, null, { role: body.role, modules: Object.keys(defaults) });
        results.push({
          action: "fix_role_permissions",
          success: true,
          detail: `Reset "${body.role}" to ${rows.length} module permissions (least-privilege)`,
        });
        break;
      }

      // ── Fix: Remove orphan role permissions (no users assigned) ──
      case "fix_orphan_role": {
        if (!body.role) throw new Error("role required");
        const { data: usersWithRole } = await sb.from("user_roles").select("id").eq("role", body.role);
        if (usersWithRole && usersWithRole.length > 0) {
          results.push({ action: "fix_orphan_role", success: false, detail: `Role "${body.role}" still has ${usersWithRole.length} users` });
          break;
        }
        await sb.from("role_module_permissions").delete().eq("role", body.role);
        await logAudit(null, "orphan_role_removed", `Removed permissions for orphan role "${body.role}"`, null, null, { role: body.role });
        results.push({ action: "fix_orphan_role", success: true, detail: `Removed permissions for orphan role "${body.role}"` });
        break;
      }

      // ── Fix: Remove conflicting roles (finance + warehouse) ──
      case "fix_role_conflict": {
        if (!body.user_id || !body.role) throw new Error("user_id and role (to remove) required");
        await sb.from("user_roles").delete().eq("user_id", body.user_id).eq("role", body.role);
        await logAudit(body.user_id!, "role_conflict_fixed", `Removed conflicting role "${body.role}"`, null, null, { removed_role: body.role });
        results.push({ action: "fix_role_conflict", success: true, detail: `Removed role "${body.role}" from user` });
        break;
      }

      // ── Auto-fix all: process all provided issues ──
      case "auto_fix_all": {
        if (!body.issues || body.issues.length === 0) {
          results.push({ action: "auto_fix_all", success: true, detail: "No fixable issues provided" });
          break;
        }

        for (const issue of body.issues) {
          try {
            switch (issue.type) {
              case "duplicate_role":
                if (issue.user_id) {
                  const { data: ur } = await sb.from("user_roles").select("*").eq("user_id", issue.user_id);
                  const seen = new Set<string>();
                  for (const r of ur || []) {
                    if (seen.has(r.role)) await sb.from("user_roles").delete().eq("id", r.id);
                    else seen.add(r.role);
                  }
                  results.push({ action: `fix_duplicate:${issue.user_id}`, success: true, detail: "Duplicates removed" });
                }
                break;
              case "insecure_access":
                if (issue.role) {
                  const roleStr = issue.role as string;
                  const moduleMatch = issue.detail?.match(/"([^"]+)".*"([^"]+)"/);
                  if (moduleMatch) {
                    await sb.from("role_module_permissions")
                      .update({ can_delete: false })
                      .eq("role", moduleMatch[1])
                      .eq("module", moduleMatch[2]);
                    results.push({ action: `fix_insecure:${roleStr}`, success: true, detail: "DELETE removed" });
                  }
                }
                break;
              case "orphan_role":
                if (issue.role) {
                  const { data: check } = await sb.from("user_roles").select("id").eq("role", issue.role);
                  if (!check || check.length === 0) {
                    await sb.from("role_module_permissions").delete().eq("role", issue.role);
                    results.push({ action: `fix_orphan:${issue.role}`, success: true, detail: "Orphan removed" });
                  }
                }
                break;
              default:
                results.push({ action: `skip:${issue.type}`, success: true, detail: "Requires manual review" });
            }
          } catch (e: any) {
            results.push({ action: `error:${issue.type}`, success: false, detail: e.message });
          }
        }
        break;
      }

      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

    // Log the fix action
    await sb.from("ai_read_log").insert({
      action_type: "permission_fix",
      target_type: "security",
      result: results.every(r => r.success) ? "fixed" : "partial",
      summary: `Permission fix: ${body.action} — ${results.filter(r => r.success).length}/${results.length} succeeded`,
      triggered_by: user.id,
      metadata: { action: body.action, results },
    });

    console.log(`[permission-fix] Done: ${results.length} results`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[permission-fix] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.message?.includes("Unauthorized") ? 403 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
