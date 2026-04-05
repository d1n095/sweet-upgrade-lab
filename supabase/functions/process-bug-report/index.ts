import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── PROCESS-BUG-REPORT — Rule-based (zero AI) ──
// AI analysis removed. Bug reports are processed with deterministic rules only.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Rule-based bug classifier ──
function classifyBug(description: string, pageUrl: string): {
  summary: string;
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  tags: string[];
} {
  const text = `${description} ${pageUrl}`.toLowerCase();

  let severity: "low" | "medium" | "high" | "critical" = "medium";
  let category = "system";
  const tags: string[] = [];

  if (/payment|betaling|stripe|checkout|order faile/.test(text)) {
    severity = "critical";
    category = "payment";
    tags.push("payment", "checkout");
  } else if (/crash|error|inte fungerar|broken|cannot|kan inte|failed|500|404/.test(text)) {
    severity = "high";
    category = "system";
    tags.push("error");
  } else if (/auth|login|inlogg|session|access|behörighet/.test(text)) {
    severity = "high";
    category = "auth";
    tags.push("auth");
  } else if (/layout|design|ui|display|visar|visas inte|styling/.test(text)) {
    severity = "low";
    category = "UI";
    tags.push("ui", "display");
  } else if (/slow|trög|performance|laddning|loading/.test(text)) {
    severity = "medium";
    category = "performance";
    tags.push("performance");
  } else if (/data|saknas|missing|incorrect|felaktig|wrong/.test(text)) {
    severity = "high";
    category = "data";
    tags.push("data");
  }

  if (pageUrl.includes("/admin")) tags.push("admin");
  if (pageUrl.includes("/checkout")) tags.push("checkout");
  if (pageUrl.includes("/product")) tags.push("product");

  const summary = description.slice(0, 120).replace(/\n/g, " ").trim() || "Bug rapporterad";

  return { summary, severity, category, tags };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is staff
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const staffRoles = ["admin", "founder", "it", "support", "moderator"];
    const isStaff = roles?.some((r: any) => staffRoles.includes(r.role));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
    }

    const { bug_id } = await req.json();
    if (!bug_id) {
      return new Response(JSON.stringify({ error: "bug_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: bug, error: bugErr } = await supabase
      .from("bug_reports")
      .select("id, description, page_url, created_at")
      .eq("id", bug_id)
      .single();

    if (bugErr || !bug) {
      return new Response(JSON.stringify({ error: "Bug not found" }), { status: 404, headers: corsHeaders });
    }

    // ── Rule-based classification (no AI) ──
    const { summary, severity, category, tags } = classifyBug(bug.description || "", bug.page_url || "");

    const traceId = `bug-analysis-${bug_id.slice(0, 8)}-${Date.now()}`;

    await supabase.from("system_observability_log").insert({
      event_type: "action",
      severity: severity === "critical" ? "critical" : "info",
      source: "edge_function",
      message: `Bug klassificerad (regelbaserat): ${summary}`,
      details: { category, severity, tags },
      bug_id,
      trace_id: traceId,
      component: "process-bug-report",
      user_id: user.id,
    });

    await supabase.from("bug_reports").update({
      ai_summary: summary,
      ai_category: category,
      ai_severity: severity,
      ai_tags: tags,
      ai_processed_at: new Date().toISOString(),
      ai_actionable_fix: {
        blocker_statement: summary,
        root_cause_exact: "Regelbaserad klassificering — manuell granskning krävs",
        location: { file_path: "", function_name: "", system_area: category },
        fix_steps: ["Granska buggrapporten manuellt", "Identifiera källa i kod", "Testa fix i staging"],
        copy_prompt: `Fixa bug: ${summary}`,
        root_causes: [{ cause: "Okänd — manuell granskning krävs", confidence: 30, affected_area: category }],
        is_reproducible: true,
        reproducibility_reasoning: "Regelbaserad — kan inte avgöra automatiskt",
        fix_suggestions: [{ suggestion: "Granska manuellt och fixa i kod", effort: "medium", risk: "low" }],
        affected_components: [],
        mode: "rule_based",
      },
    }).eq("id", bug_id);

    // Update linked work_item priority
    const severityToPriority: Record<string, string> = {
      critical: "critical", high: "high", medium: "medium", low: "low",
    };
    const { data: wi } = await supabase
      .from("work_items")
      .select("id")
      .eq("source_type", "bug_report")
      .eq("source_id", bug_id)
      .maybeSingle();

    if (wi) {
      await supabase.from("work_items").update({
        title: `Bug: ${summary}`,
        priority: severityToPriority[severity] || "medium",
      }).eq("id", wi.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: { summary, severity, category, tags, mode: "rule_based" },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-bug-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
