import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;


    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const sb = createClient(supabaseUrl, serviceKey);

    // Only founder/admin can manage users
    const { data: callerRoles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
    const callerRoleList = (callerRoles || []).map((r: any) => r.role);
    const isFounder = callerRoleList.includes("founder");
    const isAdmin = isFounder || callerRoleList.includes("admin");
    if (!isAdmin) throw new Error("Unauthorized: admin/founder required");

    const body = await req.json();
    const { action } = body;

    console.log(`[ai-user-mgmt] action=${action}`, body);

    const validRoles = ["admin", "moderator", "founder", "it", "support", "manager", "marketing", "finance", "warehouse"];

    const logAudit = async (targetUserId: string | null, auditAction: string, detail: string, roleBefore?: string[], roleAfter?: string[], permChanges?: any, targetEmail?: string) => {
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
          target_email: targetEmail || null,
          source: "ai-user-management",
        });
      } catch (e) { console.error("[audit] Failed:", e); }
    };

    switch (action) {
      // ── List all users with roles ──
      case "list_users": {
        const { data: { users: authUsers } } = await sb.auth.admin.listUsers({ perPage: 1000 });
        const { data: allRoles } = await sb.from("user_roles").select("user_id, role");
        const { data: allProfiles } = await sb.from("profiles").select("user_id, username, first_name, last_name, is_member, level, created_at");

        const roleMap = new Map<string, string[]>();
        for (const r of allRoles || []) {
          if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
          roleMap.get(r.user_id)!.push(r.role);
        }
        const profileMap = new Map<string, any>();
        for (const p of allProfiles || []) profileMap.set(p.user_id, p);

        const users = (authUsers || []).map(u => {
          const profile = profileMap.get(u.id);
          const roles = roleMap.get(u.id) || [];
          return {
            id: u.id,
            email: u.email,
            username: profile?.username || null,
            first_name: profile?.first_name || null,
            last_name: profile?.last_name || null,
            is_member: profile?.is_member || false,
            level: profile?.level || 1,
            roles,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            is_banned: u.banned_until ? new Date(u.banned_until) > new Date() : false,
          };
        });

        return new Response(JSON.stringify({ success: true, users }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Assign role ──
      case "assign_role": {
        const { user_id, role } = body;
        if (!user_id || !role) throw new Error("user_id and role required");
        if (!validRoles.includes(role)) throw new Error(`Invalid role: ${role}`);
        // Only founders can assign founder/admin
        if (["founder", "admin"].includes(role) && !isFounder) throw new Error("Only founders can assign admin/founder roles");

        // Check if already has role
        const { data: existing } = await sb.from("user_roles").select("id").eq("user_id", user_id).eq("role", role);
        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ success: true, detail: "Rollen finns redan" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get current roles before change
        const { data: beforeRoles } = await sb.from("user_roles").select("role").eq("user_id", user_id);
        const rolesBefore = (beforeRoles || []).map((r: any) => r.role);

        await sb.from("user_roles").insert({ user_id, role });

        await logAudit(user_id, "role_assigned", `Tilldelade rollen "${role}"`, rolesBefore, [...rolesBefore, role], null, body.target_email);

        await sb.from("ai_read_log").insert({
          action_type: "user_role_assign",
          target_type: "user",
          target_ids: [user_id],
          result: "applied",
          summary: `Tilldelade rollen "${role}" till användare`,
          triggered_by: user.id,
        });

        return new Response(JSON.stringify({ success: true, detail: `Rollen "${role}" tilldelad` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Remove role ──
      case "remove_role": {
        const { user_id, role } = body;
        if (!user_id || !role) throw new Error("user_id and role required");
        if (["founder", "admin"].includes(role) && !isFounder) throw new Error("Only founders can remove admin/founder roles");

        // Prevent removing own founder role
        if (user_id === user.id && role === "founder") throw new Error("Cannot remove your own founder role");

        const { data: beforeRolesRm } = await sb.from("user_roles").select("role").eq("user_id", user_id);
        const rolesBeforeRm = (beforeRolesRm || []).map((r: any) => r.role);

        await sb.from("user_roles").delete().eq("user_id", user_id).eq("role", role);

        await logAudit(user_id, "role_removed", `Tog bort rollen "${role}"`, rolesBeforeRm, rolesBeforeRm.filter((r: string) => r !== role));

        await sb.from("ai_read_log").insert({
          action_type: "user_role_remove",
          target_type: "user",
          target_ids: [user_id],
          result: "applied",
          summary: `Tog bort rollen "${role}" från användare`,
          triggered_by: user.id,
        });

        return new Response(JSON.stringify({ success: true, detail: `Rollen "${role}" borttagen` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Deactivate user (ban) ──
      case "deactivate_user": {
        const { user_id } = body;
        if (!user_id) throw new Error("user_id required");
        if (user_id === user.id) throw new Error("Cannot deactivate yourself");
        if (!isFounder) throw new Error("Only founders can deactivate users");

        // Check target isn't a founder
        const { data: targetRoles } = await sb.from("user_roles").select("role").eq("user_id", user_id);
        if ((targetRoles || []).some((r: any) => r.role === "founder")) throw new Error("Cannot deactivate a founder");

        await sb.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });

        await logAudit(user_id, "user_deactivated", "Användare inaktiverad", (targetRoles || []).map((r: any) => r.role), (targetRoles || []).map((r: any) => r.role));

        await sb.from("ai_read_log").insert({
          action_type: "user_deactivate",
          target_type: "user",
          target_ids: [user_id],
          result: "applied",
          summary: "Användare inaktiverad",
          triggered_by: user.id,
        });

        return new Response(JSON.stringify({ success: true, detail: "Användare inaktiverad" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Reactivate user ──
      case "reactivate_user": {
        const { user_id } = body;
        if (!user_id) throw new Error("user_id required");
        if (!isFounder) throw new Error("Only founders can reactivate users");

        await sb.auth.admin.updateUserById(user_id, { ban_duration: "none" });

        await logAudit(user_id, "user_reactivated", "Användare återaktiverad");

        await sb.from("ai_read_log").insert({
          action_type: "user_reactivate",
          target_type: "user",
          target_ids: [user_id],
          result: "applied",
          summary: "Användare återaktiverad",
          triggered_by: user.id,
        });

        return new Response(JSON.stringify({ success: true, detail: "Användare återaktiverad" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Analyze & recommend changes (rule-based) ──
      case "ai_analyze": {
        const { data: { users: authUsers } } = await sb.auth.admin.listUsers({ perPage: 1000 });
        const { data: allRoles } = await sb.from("user_roles").select("user_id, role");
        const { data: allProfiles } = await sb.from("profiles").select("user_id, username, first_name, last_name, is_member, level, created_at");

        const roleMap = new Map<string, string[]>();
        for (const r of allRoles || []) {
          if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
          roleMap.get(r.user_id)!.push(r.role);
        }

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const usersData = (authUsers || []).map(u => ({
          email: u.email,
          roles: roleMap.get(u.id) || [],
          last_sign_in: u.last_sign_in_at,
          created: u.created_at,
          username: (allProfiles || []).find((p: any) => p.user_id === u.id)?.username,
        })).filter(u => u.roles.length > 0);

        // Rule-based recommendations
        const recommendations: any[] = [];
        for (const u of usersData) {
          const lastSignIn = u.last_sign_in ? new Date(u.last_sign_in) : null;
          const isInactive = !lastSignIn || lastSignIn < thirtyDaysAgo;
          const hasHighPrivilege = u.roles.some((r: string) => ["admin", "founder"].includes(r));
          const hasFinanceAndWarehouse = u.roles.includes("finance") && u.roles.includes("warehouse");

          if (isInactive && hasHighPrivilege && !u.roles.includes("founder")) {
            recommendations.push({
              user_email: u.email,
              current_roles: u.roles,
              suggested_action: "deactivate",
              reason: "Inaktivt admin-konto (>30 dagar sedan inloggning)",
              risk: "high",
            });
          } else if (hasFinanceAndWarehouse) {
            recommendations.push({
              user_email: u.email,
              current_roles: u.roles,
              suggested_action: "remove_role",
              suggested_role: "warehouse",
              reason: "Finance + warehouse är intressekonflikt",
              risk: "medium",
            });
          }
        }

        return new Response(JSON.stringify({
          success: true,
          summary: `Regelbaserad analys av ${usersData.length} användare. ${recommendations.length} rekommendation(er) hittades.`,
          recommendations,
          analyzed_users: usersData.length,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (e: any) {
    console.error("[ai-user-mgmt] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.message?.includes("Unauthorized") ? 403 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
