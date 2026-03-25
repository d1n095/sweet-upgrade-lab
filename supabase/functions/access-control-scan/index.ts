import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AccessIssue {
  type: "over_permissioned" | "under_permissioned" | "orphan_role" | "broken_access" | "insecure_access" | "no_role" | "duplicate_role" | "stale_access";
  user_id?: string;
  user_email?: string;
  username?: string;
  role?: string;
  detail: string;
  risk: "critical" | "high" | "medium" | "low";
  recommendation: string;
}

interface RoleSummary {
  role: string;
  user_count: number;
  modules: string[];
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
    const isAdmin = callerRoles?.some((r: any) => ["admin", "founder", "it"].includes(r.role));
    if (!isAdmin) throw new Error("Unauthorized: admin role required");

    console.log("[access-control-scan] Starting scan...");

    // ── Gather all data ──
    const [
      { data: allRoles },
      { data: allPermissions },
      { data: allProfiles },
    ] = await Promise.all([
      sb.from("user_roles").select("id, user_id, role"),
      sb.from("role_module_permissions").select("*"),
      sb.from("profiles").select("user_id, username, first_name, last_name, is_member, level, created_at"),
    ]);

    // Get auth users via admin API
    const { data: { users: authUsers } } = await sb.auth.admin.listUsers({ perPage: 1000 });

    const issues: AccessIssue[] = [];
    const roleSummaries: RoleSummary[] = [];

    // Build lookup maps
    const rolesByUser = new Map<string, string[]>();
    for (const r of allRoles || []) {
      const uid = r.user_id as string;
      if (!rolesByUser.has(uid)) rolesByUser.set(uid, []);
      rolesByUser.get(uid)!.push(r.role as string);
    }

    const profileMap = new Map<string, any>();
    for (const p of allProfiles || []) {
      profileMap.set(p.user_id, p);
    }

    const permissionsByRole = new Map<string, any[]>();
    for (const p of allPermissions || []) {
      const role = p.role as string;
      if (!permissionsByRole.has(role)) permissionsByRole.set(role, []);
      permissionsByRole.get(role)!.push(p);
    }

    // Build role summaries
    const roleCounts = new Map<string, number>();
    for (const [, roles] of rolesByUser) {
      for (const role of roles) {
        roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
      }
    }
    for (const [role, count] of roleCounts) {
      const perms = permissionsByRole.get(role) || [];
      roleSummaries.push({
        role,
        user_count: count,
        modules: perms.map((p: any) => p.module),
      });
    }

    // ── Check 1: Users without any role ──
    for (const authUser of authUsers || []) {
      const roles = rolesByUser.get(authUser.id);
      const profile = profileMap.get(authUser.id);
      if (!roles || roles.length === 0) {
        issues.push({
          type: "no_role",
          user_id: authUser.id,
          user_email: authUser.email,
          username: profile?.username,
          detail: "Användare saknar tilldelad roll",
          risk: "low",
          recommendation: "Tilldela lämplig roll eller verifiera att detta är en vanlig kund",
        });
      }
    }

    // ── Check 2: Over-permissioned users (multiple high-privilege roles) ──
    const highPrivRoles = ["admin", "founder", "it"];
    for (const [userId, roles] of rolesByUser) {
      const profile = profileMap.get(userId);
      const authUser = authUsers?.find((u: any) => u.id === userId);
      const highRoles = roles.filter(r => highPrivRoles.includes(r));

      if (highRoles.length > 1) {
        issues.push({
          type: "over_permissioned",
          user_id: userId,
          user_email: authUser?.email,
          username: profile?.username,
          role: highRoles.join(", "),
          detail: `Användare har ${highRoles.length} högnivåroller: ${highRoles.join(", ")}`,
          risk: "high",
          recommendation: "Granska om alla roller behövs — principen om minsta privilegium",
        });
      }

      // Check for duplicate roles
      const uniqueRoles = new Set(roles);
      if (uniqueRoles.size < roles.length) {
        issues.push({
          type: "duplicate_role",
          user_id: userId,
          user_email: authUser?.email,
          username: profile?.username,
          role: roles.join(", "),
          detail: `Duplicerade rollposter hittade`,
          risk: "medium",
          recommendation: "Ta bort duplicerade rollposter",
        });
      }

      // Check for conflicting roles
      const hasFinance = roles.includes("finance");
      const hasWarehouse = roles.includes("warehouse");
      if (hasFinance && hasWarehouse) {
        issues.push({
          type: "over_permissioned",
          user_id: userId,
          user_email: authUser?.email,
          username: profile?.username,
          role: roles.join(", "),
          detail: "Användare har både finance och warehouse — potentiell intressekonflikt",
          risk: "medium",
          recommendation: "Separera ekonomi- och lageransvar enligt segregation of duties",
        });
      }
    }

    // ── Check 3: Orphan roles (defined in permissions but no users assigned) ──
    const definedRoles = new Set((allPermissions || []).map((p: any) => p.role));
    const assignedRoles = new Set<string>();
    for (const [, roles] of rolesByUser) {
      for (const r of roles) assignedRoles.add(r);
    }
    for (const role of definedRoles) {
      if (!assignedRoles.has(role)) {
        issues.push({
          type: "orphan_role",
          role,
          detail: `Rollen "${role}" har behörigheter definierade men inga tilldelade användare`,
          risk: "low",
          recommendation: "Granska om rollen fortfarande behövs eller tilldela lämpliga användare",
        });
      }
    }

    // ── Check 4: Roles without permissions defined ──
    for (const role of assignedRoles) {
      if (!permissionsByRole.has(role) || permissionsByRole.get(role)!.length === 0) {
        // Skip admin/founder/it — they have implicit full access
        if (highPrivRoles.includes(role)) continue;
        issues.push({
          type: "broken_access",
          role,
          detail: `Rollen "${role}" är tilldelad men saknar modulbehörigheter`,
          risk: "high",
          recommendation: "Definiera modulbehörigheter för rollen i role_module_permissions",
        });
      }
    }

    // ── Check 5: Stale admin access (users with admin role who haven't logged in recently) ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    for (const [userId, roles] of rolesByUser) {
      if (!roles.some(r => highPrivRoles.includes(r))) continue;
      const authUser = authUsers?.find((u: any) => u.id === userId);
      const profile = profileMap.get(userId);
      if (authUser?.last_sign_in_at && authUser.last_sign_in_at < thirtyDaysAgo) {
        issues.push({
          type: "stale_access",
          user_id: userId,
          user_email: authUser?.email,
          username: profile?.username,
          role: roles.join(", "),
          detail: `Admin-användare har inte loggat in på >30 dagar (senast: ${new Date(authUser.last_sign_in_at).toLocaleDateString("sv-SE")})`,
          risk: "high",
          recommendation: "Inaktivera eller degradera åtkomst för inaktiva admin-konton",
        });
      }
    }

    // ── Check 6: Users with roles but no profile ──
    for (const [userId, roles] of rolesByUser) {
      if (!profileMap.has(userId)) {
        const authUser = authUsers?.find((u: any) => u.id === userId);
        issues.push({
          type: "broken_access",
          user_id: userId,
          user_email: authUser?.email,
          role: roles.join(", "),
          detail: "Användare har roller men saknar profil — potentiellt kvarglömt konto",
          risk: "medium",
          recommendation: "Granska och skapa profil eller ta bort rollerna",
        });
      }
    }

    // ── Check 7: Permission coverage gaps ──
    const criticalModules = ["orders", "products", "members", "settings"];
    for (const [role, perms] of permissionsByRole) {
      if (highPrivRoles.includes(role)) continue;
      const modules = perms.map((p: any) => p.module);
      // Check for write access on sensitive modules by non-admin roles
      for (const perm of perms) {
        if (
          (perm as any).can_delete &&
          ["orders", "members", "products"].includes((perm as any).module)
        ) {
          issues.push({
            type: "insecure_access",
            role,
            detail: `Rollen "${role}" har DELETE-behörighet på "${(perm as any).module}"`,
            risk: "critical",
            recommendation: "DELETE-behörighet bör begränsas till admin/founder",
          });
        }
      }
    }

    // Sort issues by risk severity
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    issues.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);

    // Build summary
    const summary = {
      total_users: authUsers?.length || 0,
      users_with_roles: rolesByUser.size,
      users_without_roles: (authUsers?.length || 0) - rolesByUser.size,
      total_roles: assignedRoles.size,
      total_permissions: allPermissions?.length || 0,
      issues_found: issues.length,
      critical_issues: issues.filter(i => i.risk === "critical").length,
      high_issues: issues.filter(i => i.risk === "high").length,
      medium_issues: issues.filter(i => i.risk === "medium").length,
      low_issues: issues.filter(i => i.risk === "low").length,
    };

    // Log to ai_read_log
    await sb.from("ai_read_log").insert({
      action_type: "access_control_scan",
      target_type: "security",
      result: issues.length > 0 ? "issues_found" : "clean",
      summary: `Access scan: ${issues.length} issues (${summary.critical_issues} kritiska, ${summary.high_issues} höga)`,
      triggered_by: user.id,
      metadata: { summary, issues_count: issues.length },
    });

    console.log(`[access-control-scan] Complete: ${issues.length} issues found`);

    return new Response(JSON.stringify({
      success: true,
      summary,
      issues,
      roles: roleSummaries,
      scanned_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[access-control-scan] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.message?.includes("Unauthorized") ? 403 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
