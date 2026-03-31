import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Fetch the bug report
    const { data: bug, error: bugErr } = await supabase
      .from("bug_reports")
      .select("id, description, page_url, created_at")
      .eq("id", bug_id)
      .single();

    if (bugErr || !bug) {
      return new Response(JSON.stringify({ error: "Bug not found" }), { status: 404, headers: corsHeaders });
    }

    // Rule-based bug classification
    const desc = (bug.description || "").toLowerCase();
    const url = (bug.page_url || "").toLowerCase();

    let category = "unclear";
    if (/betaln|stripe|kort|checkout|order|transaktion|payment|faktura/.test(desc) || url.includes("/checkout") || url.includes("/payment")) {
      category = "payment";
    } else if (/logga in|login|lösenord|password|registrer|auth|session|behörighet/.test(desc) || url.includes("/auth") || url.includes("/login")) {
      category = "auth";
    } else if (/knapp|button|visas inte|display|layout|css|stil|design|modal|dialog|färg|font|ikon/.test(desc)) {
      category = "UI";
    } else if (/navigat|länk|link|redirect|sida|page|router/.test(desc)) {
      category = "navigation";
    } else if (/långsam|slow|laddning|loading|timeout|prestanda|performance/.test(desc)) {
      category = "performance";
    } else if (/data|databas|database|supabase|tabell|spara|save|uppdater|update|hämta|fetch/.test(desc)) {
      category = "data";
    } else if (/admin|panel|dashboard|system|fel|error|crash|server/.test(desc) || url.includes("/admin")) {
      category = "system";
    }

    let severity = "medium";
    if (/kan inte betaln|payment fail|kritisk|kritiskt|critical|kraschar|crash|ingen kan|hela sidan/.test(desc)) {
      severity = "critical";
    } else if (/betaln|stripe|logga in|login|checkout|order/.test(desc)) {
      severity = "high";
    } else if (/stavfel|typo|liten|small|minor|kosmetisk|cosmetic/.test(desc)) {
      severity = "low";
    }

    let systemArea = "general";
    if (url.includes("/admin")) systemArea = "admin";
    else if (url.includes("/checkout")) systemArea = "checkout";
    else if (url.includes("/cart")) systemArea = "cart";
    else if (url.includes("/product")) systemArea = "product";
    else if (url.includes("/auth") || url.includes("/login")) systemArea = "auth";
    else if (url.includes("/profile") || url.includes("/member")) systemArea = "member";

    const tags: string[] = [category];
    if (/mobil|mobile|telefon/.test(desc)) tags.push("mobil");
    if (/safari|firefox|chrome|browser/.test(desc)) tags.push("webbläsare");
    if (url.includes("/admin")) tags.push("admin");

    const summary = bug.description.length > 120
      ? bug.description.slice(0, 117) + "..."
      : bug.description;

    const result = {
      summary,
      severity,
      category,
      blocker_statement: bug.description,
      root_cause_exact: "Automatisk klassificering — manuell analys krävs",
      location: { file_path: "okänd", function_name: "okänd", system_area: systemArea },
      fix_steps: ["Granska bugrapporten manuellt och identifiera rotorsaken"],
      copy_prompt: `Fixa följande bugg:\n\nSida: ${bug.page_url}\nBeskrivning: ${bug.description}`,
      repro_steps: null,
      tags,
      root_causes: [{ cause: "Automatisk klassificering — granskning krävs", confidence: 50, affected_area: systemArea }],
      is_reproducible: true,
      reproducibility_reasoning: "Okänd — kräver manuell granskning",
      fix_suggestions: [{ suggestion: "Granska bugrapporten och implementera en fix", effort: "medium", risk: "low" }],
      affected_components: [],
    };

    // Observability: log AI analysis completion
    const traceId = `bug-analysis-${bug_id.slice(0, 8)}-${Date.now()}`;
    await supabase.from("system_observability_log").insert({
      event_type: "action",
      severity: result.severity === "critical" ? "critical" : "info",
      source: "edge_function",
      message: `Bug analyserad: ${result.summary}`,
      details: { category: result.category, severity: result.severity, tags: result.tags },
      bug_id: bug_id,
      trace_id: traceId,
      component: "process-bug-report",
      user_id: user.id,
    });

    // Store full analysis in bug_reports
    await supabase.from("bug_reports").update({
      ai_summary: result.summary,
      ai_category: result.category,
      ai_severity: result.severity,
      ai_tags: result.tags,
      ai_clean_prompt: result.copy_prompt,
      ai_repro_steps: result.repro_steps || null,
      ai_processed_at: new Date().toISOString(),
      ai_actionable_fix: {
        blocker_statement: result.blocker_statement,
        root_cause_exact: result.root_cause_exact,
        location: result.location,
        fix_steps: result.fix_steps,
        copy_prompt: result.copy_prompt,
        root_causes: result.root_causes,
        is_reproducible: result.is_reproducible,
        reproducibility_reasoning: result.reproducibility_reasoning,
        fix_suggestions: result.fix_suggestions,
        affected_components: result.affected_components || [],
      },
    }).eq("id", bug_id);

    // Update linked work_item
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
        title: `Bug: ${result.summary}`,
        description: result.clean_prompt,
        priority: severityToPriority[result.severity] || "medium",
      }).eq("id", wi.id);

      // Observability: log work item update
      await supabase.from("system_observability_log").insert({
        event_type: "state_change",
        source: "edge_function",
        message: `Work item uppdaterad från bugganalys`,
        bug_id: bug_id,
        work_item_id: wi.id,
        trace_id: traceId,
        component: "process-bug-report",
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-bug-report error:", e);

    // Observability: log error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const errClient = createClient(supabaseUrl, serviceKey);
      await errClient.from("system_observability_log").insert({
        event_type: "error",
        severity: "error",
        source: "edge_function",
        message: `process-bug-report fel: ${e instanceof Error ? e.message : "Unknown"}`,
        error_code: e instanceof Error ? e.name : undefined,
        stack_trace: e instanceof Error ? e.stack?.slice(0, 2000) : undefined,
        component: "process-bug-report",
      });
    } catch (_) { /* ignore logging failure */ }

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Gather relevant system context to help AI diagnose */
async function gatherSystemContext(supabase: any, pageUrl: string): Promise<string> {
  const parts: string[] = [];

  try {
    // Recent related bugs on same page
    const { data: relatedBugs } = await supabase
      .from("bug_reports")
      .select("ai_summary, ai_category, status")
      .eq("page_url", pageUrl)
      .order("created_at", { ascending: false })
      .limit(5);

    if (relatedBugs?.length) {
      parts.push(`Related bugs on same page (${relatedBugs.length}):`);
      relatedBugs.forEach((b: any) => {
        parts.push(`  - [${b.status}] ${b.ai_summary || '(unprocessed)'} (${b.ai_category || 'unknown'})`);
      });
    }

    // Detect page area from URL
    if (pageUrl.includes("/admin")) {
      parts.push("Page area: Admin panel (staff-only, requires authentication and role check)");
    } else if (pageUrl.includes("/checkout")) {
      parts.push("Page area: Checkout flow (payment-critical, uses Stripe)");
    } else if (pageUrl.includes("/product")) {
      parts.push("Page area: Product pages (public, uses Supabase products table)");
    } else if (pageUrl.includes("/cart")) {
      parts.push("Page area: Cart (uses Zustand store, local state)");
    }

    // Recent incidents
    const { data: incidents } = await supabase
      .from("order_incidents")
      .select("title, type, status")
      .in("status", ["open", "in_progress"])
      .limit(3);

    if (incidents?.length) {
      parts.push(`Active incidents (${incidents.length}):`);
      incidents.forEach((i: any) => parts.push(`  - [${i.type}] ${i.title}`));
    }
  } catch (e) {
    parts.push("(Could not gather full system context)");
  }

  return parts.length > 0 ? parts.join("\n") : "No additional system context available.";
}
