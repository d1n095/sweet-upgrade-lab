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
Your job is to deeply analyze bug reports: classify them, determine root causes, assess if the issue is likely reproducible, and suggest fixes.
Always respond by calling the analyze_bug function. Write summaries and descriptions in Swedish. Use English for enum values only.`,
          },
          {
            role: "user",
            content: `Analyze this bug report in detail:

Page: ${bug.page_url}
Reported: ${bug.created_at}
Description: ${bug.description}

System context:
${systemContext}

Provide:
1. Classification (summary, severity, category, tags)
2. Root cause analysis with 2-5 possible causes ranked by confidence
3. Whether the issue seems reproducible and why
4. Concrete fix suggestions
5. A clean developer prompt for Lovable AI`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_bug",
              description: "Full bug analysis with root cause, verification, and fix suggestions",
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
                  repro_steps: {
                    type: "string",
                    description: "Step-by-step reproduction instructions in Swedish",
                  },
                  clean_prompt: {
                    type: "string",
                    description: "Well-structured developer prompt in Swedish for fixing this issue via Lovable",
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
                        affected_area: { type: "string", description: "Which system area (e.g. 'checkout', 'auth', 'admin', 'cart')" },
                      },
                      required: ["cause", "confidence", "affected_area"],
                    },
                    description: "2-5 possible root causes ranked by confidence",
                  },
                  is_reproducible: {
                    type: "boolean",
                    description: "Whether the issue seems reproducible based on description",
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
                    description: "List of likely affected file paths or component names",
                  },
                },
                required: ["summary", "severity", "category", "clean_prompt", "tags", "root_causes", "is_reproducible", "reproducibility_reasoning", "fix_suggestions"],
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

    // Store full analysis in bug_reports
    await supabase.from("bug_reports").update({
      ai_summary: result.summary,
      ai_category: result.category,
      ai_severity: result.severity,
      ai_tags: result.tags,
      ai_clean_prompt: result.clean_prompt,
      ai_repro_steps: result.repro_steps || null,
      ai_processed_at: new Date().toISOString(),
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
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-bug-report error:", e);
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
