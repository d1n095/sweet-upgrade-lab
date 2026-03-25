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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: corsHeaders });
    }

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

    // Gather system context for smarter analysis
    const systemContext = await gatherSystemContext(supabase, bug.page_url);

    // Call AI with enhanced analysis prompt
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert bug analyst for a Swedish e-commerce web application built with React, Supabase, and Stripe.
Your job is to produce ACTIONABLE, EXECUTABLE fix instructions — not vague descriptions.
Every analysis must include: exact file paths, exact function names, exact step-by-step fix instructions, and a ready-to-copy Lovable prompt.
Always respond by calling the analyze_bug function. Write all text in Swedish. Use English for enum values and file paths only.`,
          },
          {
            role: "user",
            content: `Analyze this bug report and produce an actionable fix:

Page: ${bug.page_url}
Reported: ${bug.created_at}
Description: ${bug.description}

System context:
${systemContext}

Your output MUST follow this exact structure:
1. BLOCKER: One sentence describing what is broken
2. ROOT CAUSE: The exact technical cause (specific code/logic issue)
3. LOCATION: Exact file path, function name, and line area
4. FIX: Step-by-step concrete fix instructions (no vague wording — say exactly what to add/change/remove)
5. COPY PROMPT: A complete, ready-to-paste Lovable prompt that fixes this issue. Include DO/Ensure/Fields sections.
6. Classification metadata (severity, category, tags)
7. Root cause analysis with confidence scores
8. Reproducibility assessment`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_bug",
              description: "Actionable bug analysis with executable fix instructions",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Short clear summary in Swedish, max 120 chars",
                  },
                  severity: {
                    type: "string",
                    enum: ["low", "medium", "high", "critical"],
                  },
                  category: {
                    type: "string",
                    enum: ["UI", "payment", "auth", "system", "performance", "data", "navigation", "unclear"],
                  },
                  blocker_statement: {
                    type: "string",
                    description: "One sentence in Swedish describing what is broken for the user",
                  },
                  root_cause_exact: {
                    type: "string",
                    description: "The exact technical root cause in Swedish — specific code/logic issue, not vague",
                  },
                  location: {
                    type: "object",
                    properties: {
                      file_path: { type: "string", description: "Exact file path e.g. src/components/cart/CartDrawer.tsx" },
                      function_name: { type: "string", description: "Function or component name e.g. CartDrawer, handleSubmit" },
                      system_area: { type: "string", description: "System area e.g. checkout, cart, admin, auth" },
                    },
                    required: ["file_path", "function_name", "system_area"],
                  },
                  fix_steps: {
                    type: "array",
                    items: { type: "string" },
                    description: "Ordered list of exact, concrete fix steps in Swedish. Each step must say exactly what to do (e.g. 'Lägg till onClick={() => navigate(\"/checkout\")} på Button-elementet på rad 128')",
                  },
                  copy_prompt: {
                    type: "string",
                    description: "A complete, ready-to-paste Lovable prompt in Swedish. Must include sections: what to fix, DO steps, Ensure requirements. Must reference exact files and functions. No vague wording.",
                  },
                  repro_steps: {
                    type: "string",
                    description: "Step-by-step reproduction instructions in Swedish",
                  },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Relevant tags in Swedish",
                  },
                  root_causes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        cause: { type: "string", description: "Description of potential cause in Swedish" },
                        confidence: { type: "number", description: "Confidence 0-100" },
                        affected_area: { type: "string", description: "Which system area" },
                      },
                      required: ["cause", "confidence", "affected_area"],
                    },
                    description: "2-5 possible root causes ranked by confidence",
                  },
                  is_reproducible: {
                    type: "boolean",
                    description: "Whether the issue seems reproducible",
                  },
                  reproducibility_reasoning: {
                    type: "string",
                    description: "Why the issue is or isn't likely reproducible, in Swedish",
                  },
                  fix_suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        suggestion: { type: "string", description: "Fix suggestion in Swedish" },
                        effort: { type: "string", enum: ["low", "medium", "high"] },
                        risk: { type: "string", enum: ["low", "medium", "high"] },
                      },
                      required: ["suggestion", "effort", "risk"],
                    },
                    description: "1-3 concrete fix suggestions",
                  },
                  affected_components: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of likely affected file paths",
                  },
                },
                required: ["summary", "severity", "category", "blocker_statement", "root_cause_exact", "location", "fix_steps", "copy_prompt", "tags", "root_causes", "is_reproducible", "reproducibility_reasoning", "fix_suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_bug" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limited, try again later" }), { status: 429, headers: corsHeaders });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: corsHeaders });
      }
      console.error("AI error:", status, await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI processing failed" }), { status: 500, headers: corsHeaders });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), { status: 500, headers: corsHeaders });
    }

    const result = JSON.parse(toolCall.function.arguments);

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
