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

const SAFE_TABLES = [
  "store_settings", "automation_rules", "page_sections", "site_updates",
  "email_templates", "shipping_carriers", "shipping_zones",
  "categories", "products", "bundles", "donation_projects",
];

const BLOCKED_SQL = [
  /drop\s+table/i, /drop\s+schema/i, /truncate/i, /delete\s+from\s+auth/i,
  /alter\s+table\s+auth/i, /drop\s+function/i, /create\s+or\s+replace\s+function/i,
  /grant\s/i, /revoke\s/i, /alter\s+role/i, /create\s+role/i,
];

/**
 * Rule-based fix analysis — no AI gateway.
 * Classifies fixes as manual/code_change since automated execution
 * requires human review without AI analysis.
 */
function analyzeFixRuleBased(body: FixRequest): FixPlan {
  const text = (body.fix_text || "").toLowerCase();

  // Detect config updates
  const configPatterns = SAFE_TABLES.filter(t => text.includes(t));
  if (configPatterns.length > 0) {
    return {
      executable: false,
      fix_type: "config_update",
      description: `Möjlig konfigurationsändring i: ${configPatterns.join(", ")}`,
      risk_level: "medium",
      reason_if_not_executable: "Kräver manuell granskning utan automatisk analys",
    };
  }

  // Detect work item updates
  if (text.includes("work_item") || text.includes("uppgift")) {
    return {
      executable: false,
      fix_type: "work_item_update",
      description: "Work item-uppdatering identifierad",
      risk_level: "low",
      reason_if_not_executable: "Kräver manuell granskning",
    };
  }

  // Default: manual
  return {
    executable: false,
    fix_type: "manual",
    description: "Fixen kräver manuell granskning och åtgärd",
    risk_level: "medium",
    reason_if_not_executable: "Automatisk analys ej tillgänglig — granska manuellt",
  };
}

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

    // Rule-based analysis (no AI)
    const fixPlan = analyzeFixRuleBased(body);

    // Not executable — return plan only
    if (!fixPlan.executable) {
      console.log(`[apply-fix] Not executable: ${fixPlan.reason_if_not_executable || fixPlan.fix_type}`);

      // Log the attempt
      await adminClient.from("read_log").insert({
        action_type: "apply_fix",
        target_type: fixPlan.fix_type,
        result: "manual_required",
        summary: `Fix-analys: ${fixPlan.description}`,
        triggered_by: user.id,
        linked_work_item_id: body.source_work_item_id || null,
        linked_bug_id: body.source_bug_id || null,
        metadata: { plan: fixPlan },
      });

      return new Response(JSON.stringify({
        success: false,
        executed: false,
        plan: fixPlan,
        message: fixPlan.reason_if_not_executable || "Fixen kräver manuell åtgärd",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: false,
      executed: false,
      plan: fixPlan,
      message: "Automatisk exekvering ej tillgänglig — granska manuellt",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[apply-fix] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.message?.includes("Unauthorized") ? 403 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
