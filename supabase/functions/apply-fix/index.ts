import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FixRequest {
  fix_text: string;
  issue_title: string;
  issue_category?: string;
  issue_severity?: string;
  source_work_item_id?: string;
  source_bug_id?: string;
}

interface FixPlan {
  executable: boolean;
  fix_type: "db_query" | "config_update" | "work_item_update" | "code_change" | "manual";
  description: string;
  sql_statements?: string[];
  config_updates?: { table: string; id?: string; updates: Record<string, unknown> }[];
  risk_level: "low" | "medium" | "high";
  reason_if_not_executable?: string;
}

// Allowed tables for safe config/data updates
const SAFE_TABLES = [
  "store_settings", "automation_rules", "page_sections", "site_updates",
  "email_templates", "shipping_carriers", "shipping_zones",
  "categories", "products", "bundles", "donation_projects",
];

// Blocked SQL patterns
const BLOCKED_SQL = [
  /drop\s+table/i, /drop\s+schema/i, /truncate/i, /delete\s+from\s+auth/i,
  /alter\s+table\s+auth/i, /drop\s+function/i, /create\s+or\s+replace\s+function/i,
  /grant\s/i, /revoke\s/i, /alter\s+role/i, /create\s+role/i,
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Global AI kill-switch
  const AI_ENABLED = false;
  if (!AI_ENABLED) {
    return new Response(JSON.stringify({ skipped: true, reason: "AI_DISABLED" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r: any) =>
      ["admin", "founder", "it"].includes(r.role)
    );
    if (!isAdmin) throw new Error("Unauthorized: admin role required");

    const body: FixRequest = await req.json();
    if (!body.fix_text) throw new Error("fix_text required");

    console.log(`[apply-fix] Analyzing fix for: ${body.issue_title}`);

    // ── Step 1: Ask AI to create an execution plan ──
    let fixPlan: FixPlan = {
      executable: false,
      fix_type: "manual",
      description: "AI ej tillgänglig — kan inte analysera fix",
      risk_level: "high",
      reason_if_not_executable: "AI-nyckel saknas",
    };

    if (apiKey) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `Du är en säkerhetsmedveten systemoperatör. Analysera fixen och skapa en exekveringsplan.

REGLER:
- Du får BARA föreslå "executable: true" om fixen kan göras via:
  1. Databasuppdateringar (UPDATE/INSERT på publika tabeller)
  2. Konfigurationsändringar (store_settings, automation_rules, etc.)
  3. Work item-statusändringar
- Du får ALDRIG föreslå:
  1. DROP/TRUNCATE/ALTER på auth/storage/realtime schemas
  2. Ändringar i frontend-kod (React/TypeScript) — dessa MÅSTE kopieras som prompt
  3. Edge function-ändringar — dessa MÅSTE kopieras som prompt
  4. GRANT/REVOKE/role-ändringar
- Om fixen kräver kodändringar → executable: false, fix_type: "code_change"
- Var KONSERVATIV. Om du är osäker → executable: false

SAFE TABLES (tillåtna för uppdatering):
${SAFE_TABLES.join(", ")}

Svara via tool call.`,
              },
              {
                role: "user",
                content: `ISSUE: ${body.issue_title}
KATEGORI: ${body.issue_category || "okänd"}
SEVERITY: ${body.issue_severity || "medium"}

FIX ATT ANALYSERA:
${body.fix_text}`,
              },
            ],
            tools: [{
              type: "function",
              function: {
                name: "fix_plan",
                description: "Return structured fix execution plan",
                parameters: {
                  type: "object",
                  properties: {
                    executable: { type: "boolean", description: "Om fixen kan köras automatiskt" },
                    fix_type: {
                      type: "string",
                      enum: ["db_query", "config_update", "work_item_update", "code_change", "manual"],
                    },
                    description: { type: "string", description: "Kort beskrivning av vad som kommer utföras" },
                    sql_statements: {
                      type: "array",
                      items: { type: "string" },
                      description: "SQL-satser att köra (om db_query)",
                    },
                    config_updates: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          table: { type: "string" },
                          id: { type: "string" },
                          updates: { type: "object" },
                        },
                        required: ["table", "updates"],
                      },
                      description: "Konfigurationsuppdateringar att köra",
                    },
                    risk_level: { type: "string", enum: ["low", "medium", "high"] },
                    reason_if_not_executable: { type: "string" },
                  },
                  required: ["executable", "fix_type", "description", "risk_level"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "fix_plan" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            fixPlan = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (e) {
        console.error("[apply-fix] AI analysis failed:", e);
      }
    }

    // ── Step 2: If not executable, return plan only ──
    if (!fixPlan.executable) {
      console.log(`[apply-fix] Not executable: ${fixPlan.reason_if_not_executable || fixPlan.fix_type}`);
      return new Response(JSON.stringify({
        success: false,
        executed: false,
        plan: fixPlan,
        message: fixPlan.reason_if_not_executable || "Fixen kräver manuell åtgärd (kodändring)",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Step 3: Safety checks on SQL ──
    if (fixPlan.fix_type === "db_query" && fixPlan.sql_statements?.length) {
      for (const sql of fixPlan.sql_statements) {
        for (const pattern of BLOCKED_SQL) {
          if (pattern.test(sql)) {
            console.error(`[apply-fix] BLOCKED SQL: ${sql}`);
            return new Response(JSON.stringify({
              success: false,
              executed: false,
              plan: fixPlan,
              message: `Blockerad: SQL innehåller förbjuden operation`,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      }
    }

    // ── Step 4: Safety check on config updates ──
    if (fixPlan.fix_type === "config_update" && fixPlan.config_updates?.length) {
      for (const update of fixPlan.config_updates) {
        if (!SAFE_TABLES.includes(update.table)) {
          return new Response(JSON.stringify({
            success: false,
            executed: false,
            plan: fixPlan,
            message: `Blockerad: Tabell "${update.table}" är inte tillåten`,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // ── Step 5: Execute the fix ──
    console.log(`[apply-fix] Executing ${fixPlan.fix_type}: ${fixPlan.description}`);
    const executionResults: { step: string; success: boolean; detail?: string }[] = [];

    if (fixPlan.fix_type === "config_update" && fixPlan.config_updates?.length) {
      for (const update of fixPlan.config_updates) {
        try {
          let query = adminClient.from(update.table).update(update.updates);
          if (update.id) {
            query = query.eq("id", update.id);
          }
          const { error } = await query;
          executionResults.push({
            step: `UPDATE ${update.table}`,
            success: !error,
            detail: error?.message,
          });
        } catch (e: any) {
          executionResults.push({ step: `UPDATE ${update.table}`, success: false, detail: e.message });
        }
      }
    }

    if (fixPlan.fix_type === "work_item_update") {
      // Handle work item specific updates
      if (body.source_work_item_id) {
        const { error } = await adminClient
          .from("work_items")
          .update({ resolution_notes: `Auto-fix: ${fixPlan.description}` })
          .eq("id", body.source_work_item_id);
        executionResults.push({
          step: "Update work item",
          success: !error,
          detail: error?.message,
        });
      }
    }

    const allSuccess = executionResults.length > 0 && executionResults.every((r) => r.success);

    // ── Step 6: Log the change ──
    await adminClient.from("change_log").insert({
      change_type: "auto_fix",
      description: `⚡ Auto-fix: ${fixPlan.description} (${body.issue_title})`,
      source: "ai_apply_fix",
      affected_components: ["auto_fix", fixPlan.fix_type],
      work_item_id: body.source_work_item_id || null,
      bug_report_id: body.source_bug_id || null,
      metadata: {
        fix_plan: fixPlan,
        execution_results: executionResults,
        applied_by: user.id,
        issue_severity: body.issue_severity,
      },
    });

    // ── Step 7: Log to AI read log ──
    await adminClient.from("ai_read_log").insert({
      action_type: "apply_fix",
      target_type: fixPlan.fix_type,
      result: allSuccess ? "success" : "partial_failure",
      summary: `Auto-fix: ${fixPlan.description}`,
      triggered_by: user.id,
      linked_work_item_id: body.source_work_item_id || null,
      linked_bug_id: body.source_bug_id || null,
      metadata: { plan: fixPlan, results: executionResults },
    });

    console.log(`[apply-fix] Complete: ${allSuccess ? "SUCCESS" : "PARTIAL"} — ${executionResults.length} steps`);

    return new Response(JSON.stringify({
      success: allSuccess,
      executed: true,
      plan: fixPlan,
      results: executionResults,
      message: allSuccess
        ? `✅ Fix applicerad: ${fixPlan.description}`
        : `⚠️ Delvis applicerad: ${executionResults.filter((r) => !r.success).map((r) => r.detail).join(", ")}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[apply-fix] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.message?.includes("Unauthorized") ? 403 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
