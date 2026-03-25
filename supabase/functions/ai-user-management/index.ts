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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

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

        await sb.from("user_roles").insert({ user_id, role });

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

        await sb.from("user_roles").delete().eq("user_id", user_id).eq("role", role);

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

        // Ban for 100 years (effectively permanent)
        const banUntil = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
        await sb.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });

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

      // ── AI: Analyze & recommend changes ──
      case "ai_analyze": {
        if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

        // Gather data
        const { data: { users: authUsers } } = await sb.auth.admin.listUsers({ perPage: 1000 });
        const { data: allRoles } = await sb.from("user_roles").select("user_id, role");
        const { data: allPerms } = await sb.from("role_module_permissions").select("*");
        const { data: allProfiles } = await sb.from("profiles").select("user_id, username, first_name, last_name, is_member, level, created_at");

        const roleMap = new Map<string, string[]>();
        for (const r of allRoles || []) {
          if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
          roleMap.get(r.user_id)!.push(r.role);
        }

        const usersData = (authUsers || []).map(u => {
          const profile = (allProfiles || []).find((p: any) => p.user_id === u.id);
          return {
            email: u.email,
            roles: roleMap.get(u.id) || [],
            last_sign_in: u.last_sign_in_at,
            created: u.created_at,
            username: profile?.username,
            is_member: profile?.is_member,
            level: profile?.level,
          };
        }).filter(u => (u.roles.length > 0)); // Only analyze users with roles

        const permsSummary: Record<string, string[]> = {};
        for (const p of allPerms || []) {
          if (!permsSummary[p.role]) permsSummary[p.role] = [];
          const actions = [];
          if (p.can_read) actions.push("read");
          if (p.can_create) actions.push("create");
          if (p.can_update) actions.push("update");
          if (p.can_delete) actions.push("delete");
          permsSummary[p.role].push(`${p.module}(${actions.join(",")})`);
        }

        const systemPrompt = `Du är Lova, en AI-säkerhetsoperatör för ett e-handelsföretag.
Analysera användare och roller och ge konkreta rekommendationer.

Regler:
- Följ principen om minsta privilegium
- Inaktiva admin-konton (>30 dagar) bör flaggas
- Användare med flera högnivåroller bör förenklas
- Finance + warehouse = intressekonflikt
- Roller utan modulbehörigheter = trasig åtkomst
- Svara på svenska
- Returnera EXAKT JSON med "recommendations" array

Tillgängliga roller: ${validRoles.join(", ")}

Varje rekommendation ska ha:
- user_email (string)
- current_roles (string[])
- suggested_action: "downgrade" | "upgrade" | "remove_role" | "add_role" | "deactivate" | "no_change"
- suggested_role (string, optional)
- reason (string)
- risk: "critical" | "high" | "medium" | "low"`;

        const userPrompt = `Analysera dessa användare och ge rekommendationer:

ANVÄNDARE:
${JSON.stringify(usersData, null, 2)}

ROLLBEHÖRIGHETER:
${JSON.stringify(permsSummary, null, 2)}

Idag: ${new Date().toISOString().split("T")[0]}`;

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "provide_recommendations",
                description: "Return user management recommendations",
                parameters: {
                  type: "object",
                  properties: {
                    summary: { type: "string", description: "Executive summary in Swedish" },
                    recommendations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          user_email: { type: "string" },
                          current_roles: { type: "array", items: { type: "string" } },
                          suggested_action: { type: "string", enum: ["downgrade", "upgrade", "remove_role", "add_role", "deactivate", "no_change"] },
                          suggested_role: { type: "string" },
                          reason: { type: "string" },
                          risk: { type: "string", enum: ["critical", "high", "medium", "low"] },
                        },
                        required: ["user_email", "current_roles", "suggested_action", "reason", "risk"],
                      },
                    },
                  },
                  required: ["summary", "recommendations"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "provide_recommendations" } },
          }),
        });

        if (!aiResp.ok) {
          if (aiResp.status === 429) throw new Error("AI rate limit — försök igen om en stund");
          if (aiResp.status === 402) throw new Error("AI-krediter slut — fyll på i Settings > Workspace > Usage");
          throw new Error(`AI gateway error: ${aiResp.status}`);
        }

        const aiData = await aiResp.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        let recommendations: any = { summary: "Ingen AI-analys tillgänglig", recommendations: [] };

        if (toolCall?.function?.arguments) {
          try {
            recommendations = JSON.parse(toolCall.function.arguments);
          } catch {
            recommendations = { summary: "Kunde inte tolka AI-svar", recommendations: [] };
          }
        }

        await sb.from("ai_read_log").insert({
          action_type: "ai_user_analysis",
          target_type: "user",
          result: "analyzed",
          summary: recommendations.summary,
          triggered_by: user.id,
          metadata: { recommendations_count: recommendations.recommendations?.length || 0 },
        });

        return new Response(JSON.stringify({
          success: true,
          ...recommendations,
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
