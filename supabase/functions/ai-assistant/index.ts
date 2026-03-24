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

    // Verify caller is staff
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const staffRoles = ["admin", "founder", "it", "support", "moderator"];
    const isStaff = roles?.some((r: any) => staffRoles.includes(r.role));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { type } = body;

    if (!type || typeof type !== "string") {
      return new Response(JSON.stringify({ error: "type required" }), { status: 400, headers: corsHeaders });
    }

    let result: any;

    switch (type) {
      case "generate_prompt": {
        const { input } = body;
        if (!input || typeof input !== "string" || input.length < 5 || input.length > 5000) {
          return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: corsHeaders });
        }
        result = await generatePrompt(lovableKey, input);
        break;
      }

      case "bug_fix_suggestion": {
        const { bug_id } = body;
        if (!bug_id) {
          return new Response(JSON.stringify({ error: "bug_id required" }), { status: 400, headers: corsHeaders });
        }
        const { data: bug } = await supabase
          .from("bug_reports")
          .select("*")
          .eq("id", bug_id)
          .single();
        if (!bug) {
          return new Response(JSON.stringify({ error: "Bug not found" }), { status: 404, headers: corsHeaders });
        }
        result = await suggestBugFix(lovableKey, bug);
        break;
      }

      case "data_insights": {
        // Fetch recent stats
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [ordersRes, eventsRes, bugsRes] = await Promise.all([
          supabase.from("orders").select("total_amount, payment_status, created_at, status").gte("created_at", weekAgo.toISOString()).limit(500),
          supabase.from("analytics_events").select("event_type, created_at").gte("created_at", weekAgo.toISOString()).limit(1000),
          supabase.from("bug_reports").select("status, ai_severity, created_at").gte("created_at", weekAgo.toISOString()).limit(100),
        ]);

        const orders = ordersRes.data || [];
        const events = eventsRes.data || [];
        const bugs = bugsRes.data || [];

        const paidOrders = orders.filter((o: any) => o.payment_status === "paid");
        const revenue = paidOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
        const views = events.filter((e: any) => e.event_type === "product_view").length;
        const carts = events.filter((e: any) => e.event_type === "add_to_cart").length;
        const checkouts = events.filter((e: any) => e.event_type === "checkout_start").length;
        const purchases = events.filter((e: any) => e.event_type === "checkout_complete").length;

        const summary = `Last 7 days:
Revenue: ${revenue} SEK (${paidOrders.length} orders)
AOV: ${paidOrders.length > 0 ? Math.round(revenue / paidOrders.length) : 0} SEK
Funnel: ${views} views → ${carts} carts → ${checkouts} checkouts → ${purchases} purchases
Conversion: ${views > 0 ? ((purchases / views) * 100).toFixed(1) : 0}%
Cart→Checkout: ${carts > 0 ? ((checkouts / carts) * 100).toFixed(1) : 0}%
Open bugs: ${bugs.filter((b: any) => b.status === "open").length}
Critical bugs: ${bugs.filter((b: any) => b.ai_severity === "critical").length}`;

        result = await analyzeData(lovableKey, summary);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown type" }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    const status = e instanceof Response ? e.status : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: status === 429 ? 429 : status === 402 ? 402 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callAI(apiKey: string, messages: any[], tools?: any[], tool_choice?: any) {
  const body: any = {
    model: "google/gemini-3-flash-preview",
    messages,
  };
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw Object.assign(new Error("Rate limited"), { status: 429 });
    if (resp.status === 402) throw Object.assign(new Error("Credits exhausted"), { status: 402 });
    throw new Error(`AI error: ${resp.status}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) return JSON.parse(toolCall.function.arguments);
  return { text: data.choices?.[0]?.message?.content || "" };
}

async function generatePrompt(apiKey: string, input: string) {
  return callAI(apiKey, [
    {
      role: "system",
      content: `You are a prompt engineer. Convert user input into structured Lovable prompts.
Always respond in Swedish. Use the generate_prompt function.`,
    },
    { role: "user", content: input },
  ], [
    {
      type: "function",
      function: {
        name: "generate_prompt",
        description: "Generate a structured Lovable prompt",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short title for the prompt, in Swedish" },
            goal: { type: "string", description: "MÅL section - what should be achieved" },
            problem: { type: "string", description: "PROBLEM section - what is wrong or needed" },
            steps: { type: "array", items: { type: "string" }, description: "IMPLEMENTATION STEPS" },
            expected_result: { type: "string", description: "FÖRVÄNTAT RESULTAT" },
            tags: { type: "array", items: { type: "string" }, description: "Tags in Swedish" },
            category: { type: "string", enum: ["UI", "backend", "security", "performance", "feature", "bug", "data"] },
            priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
            full_prompt: { type: "string", description: "The complete formatted prompt ready to paste into Lovable" },
          },
          required: ["title", "goal", "steps", "expected_result", "tags", "category", "priority", "full_prompt"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "generate_prompt" } });
}

async function suggestBugFix(apiKey: string, bug: any) {
  const context = `Bug report:
Description: ${bug.description}
Page: ${bug.page_url}
AI Summary: ${bug.ai_summary || "N/A"}
AI Category: ${bug.ai_category || "N/A"}
AI Severity: ${bug.ai_severity || "N/A"}
AI Repro Steps: ${bug.ai_repro_steps || "N/A"}
AI Clean Prompt: ${bug.ai_clean_prompt || "N/A"}`;

  return callAI(apiKey, [
    {
      role: "system",
      content: `You are a senior developer analyzing bugs in a Swedish e-commerce platform built with React, TypeScript, Supabase, and Tailwind.
Analyze the bug and suggest fixes. Respond in Swedish. Use the suggest_fix function.`,
    },
    { role: "user", content: context },
  ], [
    {
      type: "function",
      function: {
        name: "suggest_fix",
        description: "Suggest a fix for a bug",
        parameters: {
          type: "object",
          properties: {
            possible_cause: { type: "string", description: "Most likely root cause in Swedish" },
            fix_strategy: { type: "string", description: "High-level fix strategy in Swedish" },
            code_suggestion: { type: "string", description: "Code-level suggestion or pseudo-code if applicable" },
            affected_areas: { type: "array", items: { type: "string" }, description: "Files or areas likely affected" },
            risk_level: { type: "string", enum: ["low", "medium", "high"], description: "Risk of the fix" },
            lovable_prompt: { type: "string", description: "Ready-to-use Lovable prompt to fix this bug, in Swedish" },
          },
          required: ["possible_cause", "fix_strategy", "affected_areas", "risk_level", "lovable_prompt"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "suggest_fix" } });
}

async function analyzeData(apiKey: string, summary: string) {
  return callAI(apiKey, [
    {
      role: "system",
      content: `You are a business analyst for a Swedish e-commerce platform. Analyze data and provide actionable insights.
Respond in Swedish. Use the analyze_data function.`,
    },
    { role: "user", content: `Analyze this data and provide insights:\n\n${summary}` },
  ], [
    {
      type: "function",
      function: {
        name: "analyze_data",
        description: "Analyze business data and provide insights",
        parameters: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["warning", "opportunity", "info"] },
                  title: { type: "string" },
                  description: { type: "string" },
                  action: { type: "string", description: "Recommended action" },
                },
                required: ["type", "title", "description", "action"],
                additionalProperties: false,
              },
            },
            summary: { type: "string", description: "Executive summary in Swedish" },
            health_score: { type: "number", description: "Overall health score 0-100" },
          },
          required: ["insights", "summary", "health_score"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "analyze_data" } });
}
