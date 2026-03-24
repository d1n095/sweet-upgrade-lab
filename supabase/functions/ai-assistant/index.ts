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
        const { data: bug } = await supabase.from("bug_reports").select("*").eq("id", bug_id).single();
        if (!bug) {
          return new Response(JSON.stringify({ error: "Bug not found" }), { status: 404, headers: corsHeaders });
        }
        result = await suggestBugFix(lovableKey, bug);
        break;
      }

      case "data_insights": {
        result = await handleDataInsights(supabase, lovableKey, body);
        break;
      }

      case "unified_report": {
        result = await handleUnifiedReport(supabase, lovableKey);
        break;
      }

      case "product_suggestions": {
        result = await handleProductSuggestions(supabase, lovableKey);
        break;
      }

      case "system_health": {
        result = await handleSystemHealth(supabase, lovableKey);
        break;
      }

      case "system_scan": {
        result = await handleSystemScan(supabase, lovableKey, supabaseUrl, serviceKey);
        break;
      }

      case "action_engine": {
        result = await handleActionEngine(supabase, lovableKey);
        break;
      }

      case "visual_qa": {
        result = await handleVisualQA(supabase, lovableKey);
        break;
      }

      case "nav_scan": {
        result = await handleNavScan(supabase, lovableKey);
        break;
      }

      case "bug_rescan": {
        result = await handleBugRescan(supabase, lovableKey);
        break;
      }

      case "structure_analysis": {
        result = await handleStructureAnalysis(supabase, lovableKey);
        break;
      }

      case "dev_guardian": {
        result = await handleDevGuardian(supabase, lovableKey);
        break;
      }

      case "create_action": {
        const { title, description, priority, category, source_type: srcType, source_id: srcId } = body;
        if (!title) {
          return new Response(JSON.stringify({ error: "title required" }), { status: 400, headers: corsHeaders });
        }
        const { data: newItem, error: insertErr } = await supabase.from("work_items").insert({
          title: title.substring(0, 200),
          description: description || "",
          status: "open",
          priority: priority || "medium",
          item_type: srcType === "bug_fix" ? "bug" : "manual",
          source_type: srcType || "manual",
          source_id: srcId || null,
          ai_detected: false,
          ai_confidence: "none",
          ai_category: category || null,
        }).select("id").single();
        if (insertErr) throw new Error(insertErr.message);
        result = { work_item_id: newItem.id, created: true };
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

// ── Gather all system data ──
async function gatherSystemSnapshot(supabase: any) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const weekStr = weekAgo.toISOString();
  const monthStr = monthAgo.toISOString();

  const [
    ordersRes, eventsRes, bugsRes, workItemsRes,
    incidentsRes, refundsRes, donationsRes,
    productsRes, staffPerfRes, activityRes,
  ] = await Promise.all([
    supabase.from("orders").select("total_amount, payment_status, created_at, status, refund_amount, fulfillment_status, packed_at, shipped_at, delivered_at, deleted_at").gte("created_at", weekStr).is("deleted_at", null).limit(500),
    supabase.from("analytics_events").select("event_type, created_at").gte("created_at", weekStr).limit(2000),
    supabase.from("bug_reports").select("status, ai_severity, ai_category, created_at").limit(100),
    supabase.from("work_items").select("status, priority, item_type, ai_detected, created_at, completed_at, due_at").limit(500),
    supabase.from("order_incidents").select("status, priority, type, sla_status, created_at").gte("created_at", monthStr).limit(200),
    supabase.from("refund_requests").select("status, refund_amount, reason, created_at").gte("created_at", monthStr).limit(100),
    supabase.from("donations").select("amount, source, created_at").gte("created_at", monthStr).limit(200),
    supabase.from("products").select("title_sv, stock, low_stock_threshold, is_visible, price").eq("is_visible", true).limit(200),
    supabase.from("staff_performance").select("tasks_completed, sla_hits, sla_misses, points, avg_completion_seconds").limit(50),
    supabase.from("activity_logs").select("log_type, category, created_at").gte("created_at", weekStr).order("created_at", { ascending: false }).limit(200),
  ]);

  const orders = ordersRes.data || [];
  const events = eventsRes.data || [];
  const bugs = bugsRes.data || [];
  const workItems = workItemsRes.data || [];
  const incidents = incidentsRes.data || [];
  const refunds = refundsRes.data || [];
  const donations = donationsRes.data || [];
  const products = productsRes.data || [];
  const staffPerf = staffPerfRes.data || [];
  const activities = activityRes.data || [];

  // ── Derived metrics ──
  const paidOrders = orders.filter((o: any) => o.payment_status === "paid");
  const revenue = paidOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
  const totalRefunds = paidOrders.reduce((s: number, o: any) => s + (o.refund_amount || 0), 0);
  const aov = paidOrders.length > 0 ? Math.round(revenue / paidOrders.length) : 0;

  const views = events.filter((e: any) => e.event_type === "product_view").length;
  const carts = events.filter((e: any) => e.event_type === "add_to_cart").length;
  const checkouts = events.filter((e: any) => e.event_type === "checkout_start").length;
  const purchases = events.filter((e: any) => e.event_type === "checkout_complete").length;
  const abandons = events.filter((e: any) => e.event_type === "checkout_abandon").length;
  const conversion = views > 0 ? ((purchases / views) * 100).toFixed(1) : "0";
  const cartToCheckout = carts > 0 ? ((checkouts / carts) * 100).toFixed(1) : "0";
  const checkoutToOrder = checkouts > 0 ? ((purchases / checkouts) * 100).toFixed(1) : "0";

  const openBugs = bugs.filter((b: any) => b.status === "open").length;
  const criticalBugs = bugs.filter((b: any) => b.ai_severity === "critical").length;
  const highBugs = bugs.filter((b: any) => b.ai_severity === "high").length;

  const openItems = workItems.filter((w: any) => !["done", "cancelled"].includes(w.status)).length;
  const aiDetected = workItems.filter((w: any) => w.ai_detected).length;
  const overdue = workItems.filter((w: any) => w.due_at && !["done", "cancelled"].includes(w.status) && new Date(w.due_at) < now).length;

  const unresolvedIncidents = incidents.filter((i: any) => !["resolved", "closed"].includes(i.status)).length;
  const highIncidents = incidents.filter((i: any) => i.priority === "high").length;
  const slaOverdue = incidents.filter((i: any) => i.sla_status === "overdue").length;

  const pendingRefunds = refunds.filter((r: any) => r.status === "pending").length;
  const refundTotal = refunds.filter((r: any) => r.status === "approved").reduce((s: number, r: any) => s + (r.refund_amount || 0), 0);

  const totalDonations = donations.reduce((s: number, d: any) => s + (d.amount || 0), 0);

  const lowStockProducts = products.filter((p: any) => p.stock !== null && p.stock <= (p.low_stock_threshold || 5));
  const outOfStock = products.filter((p: any) => p.stock !== null && p.stock <= 0);

  const totalSlaHits = staffPerf.reduce((s: number, p: any) => s + (p.sla_hits || 0), 0);
  const totalSlaMisses = staffPerf.reduce((s: number, p: any) => s + (p.sla_misses || 0), 0);
  const slaRate = (totalSlaHits + totalSlaMisses) > 0 ? Math.round((totalSlaHits / (totalSlaHits + totalSlaMisses)) * 100) : 100;

  const errorLogs = activities.filter((a: any) => a.log_type === "error").length;
  const warningLogs = activities.filter((a: any) => a.log_type === "warning").length;

  return {
    summary: `=== SYSTEM SNAPSHOT (Last 7 days) ===

📦 ORDERS
Revenue: ${revenue} SEK (${paidOrders.length} paid orders)
AOV: ${aov} SEK
Refunded: ${totalRefunds} SEK
Unfulfilled: ${orders.filter((o: any) => o.fulfillment_status === "unfulfilled" && o.payment_status === "paid").length}
Not packed: ${paidOrders.filter((o: any) => !o.packed_at).length}
Not shipped: ${paidOrders.filter((o: any) => o.packed_at && !o.shipped_at).length}

📊 FUNNEL
Views: ${views} → Cart: ${carts} → Checkout: ${checkouts} → Purchase: ${purchases}
Conversion: ${conversion}%
Cart→Checkout: ${cartToCheckout}%
Checkout→Order: ${checkoutToOrder}%
Abandoned checkouts: ${abandons}

🐛 BUGS
Open: ${openBugs} | Critical: ${criticalBugs} | High: ${highBugs}
Total reports: ${bugs.length}

📋 WORK ITEMS
Open: ${openItems} | AI-detected: ${aiDetected} | Overdue: ${overdue}
Total: ${workItems.length}

🚨 INCIDENTS (30d)
Total: ${incidents.length} | Unresolved: ${unresolvedIncidents} | High priority: ${highIncidents}
SLA overdue: ${slaOverdue}

💰 REFUNDS (30d)
Pending: ${pendingRefunds} | Approved total: ${Math.round(refundTotal)} SEK

🎁 DONATIONS (30d)
Total: ${Math.round(totalDonations)} SEK from ${donations.length} donations

🏪 PRODUCTS
Visible: ${products.length} | Low stock: ${lowStockProducts.length} | Out of stock: ${outOfStock.length}
${lowStockProducts.slice(0, 5).map((p: any) => `  ⚠️ ${p.title_sv}: ${p.stock} kvar`).join("\n")}

👥 STAFF PERFORMANCE
SLA hit rate: ${slaRate}%
Total tasks completed: ${staffPerf.reduce((s: number, p: any) => s + (p.tasks_completed || 0), 0)}

📝 ACTIVITY LOGS (7d)
Errors: ${errorLogs} | Warnings: ${warningLogs}`,

    metrics: {
      revenue, orders: paidOrders.length, aov, refunds: totalRefunds,
      conversion: parseFloat(conversion as string), views, purchases, abandons,
      openBugs, criticalBugs, openItems, overdue, aiDetected,
      unresolvedIncidents, slaOverdue, pendingRefunds,
      lowStock: lowStockProducts.length, outOfStock: outOfStock.length,
      slaRate, errorLogs, warningLogs, totalDonations,
    },
  };
}

// ── Handle data_insights ──
async function handleDataInsights(supabase: any, lovableKey: string, body: any) {
  const { summary, metrics } = await gatherSystemSnapshot(supabase);
  const result = await analyzeData(lovableKey, summary);

  if (body.auto_action && result?.insights) {
    let created = 0;
    for (const insight of result.insights) {
      if (insight.type !== "warning") continue;
      const { data: existing } = await supabase
        .from("work_items")
        .select("id")
        .eq("ai_detected", true)
        .eq("item_type", "insight")
        .ilike("title", `%${insight.title.substring(0, 30)}%`)
        .in("status", ["open", "claimed", "in_progress"])
        .limit(1);
      if (!existing?.length) {
        await supabase.from("work_items").insert({
          title: `AI Insight: ${insight.title}`,
          description: `${insight.description}\n\nRekommenderad åtgärd: ${insight.action}`,
          status: "open",
          priority: "high",
          item_type: "insight",
          source_type: "ai_detection",
          ai_detected: true,
          ai_confidence: "medium",
          ai_category: "business",
        });
        created++;
      }
    }
    result.work_items_created = created;
  }

  result.raw_metrics = metrics;
  return result;
}

// ── Handle unified_report ──
async function handleUnifiedReport(supabase: any, lovableKey: string) {
  const { summary, metrics } = await gatherSystemSnapshot(supabase);

  const result = await callAI(lovableKey, [
    {
      role: "system",
      content: `Du är en AI-operatör för en svensk e-handelsplattform (4thepeople). 
Analysera systemets tillstånd och ge en tydlig, kortfattad rapport med betyg och åtgärder.
Svara ALLTID på svenska. Använd unified_report-funktionen.`,
    },
    { role: "user", content: `Ge en komplett systemrapport baserad på denna data:\n\n${summary}` },
  ], [
    {
      type: "function",
      function: {
        name: "unified_report",
        description: "Generate a unified system report",
        parameters: {
          type: "object",
          properties: {
            overall_score: { type: "number", description: "Overall system health 0-100" },
            overall_status: { type: "string", enum: ["healthy", "warning", "critical"], description: "Overall status" },
            executive_summary: { type: "string", description: "2-3 sentence executive summary in Swedish" },
            areas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Area name (e.g. Orders, Bugs, Performance)" },
                  score: { type: "number", description: "Score 0-100" },
                  status: { type: "string", enum: ["healthy", "warning", "critical"] },
                  summary: { type: "string", description: "One line summary in Swedish" },
                  actions: { type: "array", items: { type: "string" }, description: "Recommended actions in Swedish" },
                },
                required: ["name", "score", "status", "summary", "actions"],
                additionalProperties: false,
              },
            },
            top_priorities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  urgency: { type: "string", enum: ["now", "today", "this_week"] },
                  reason: { type: "string" },
                },
                required: ["title", "urgency", "reason"],
                additionalProperties: false,
              },
              description: "Top 5 priorities right now",
            },
          },
          required: ["overall_score", "overall_status", "executive_summary", "areas", "top_priorities"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "unified_report" } });

  return { ...result, raw_metrics: metrics };
}

// ── AI call helper ──
async function callAI(apiKey: string, messages: any[], tools?: any[], tool_choice?: any) {
  const body: any = { model: "google/gemini-3-flash-preview", messages };
  if (tools) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
            title: { type: "string" },
            goal: { type: "string" },
            problem: { type: "string" },
            steps: { type: "array", items: { type: "string" } },
            expected_result: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            category: { type: "string", enum: ["UI", "backend", "security", "performance", "feature", "bug", "data"] },
            priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
            full_prompt: { type: "string" },
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
AI Repro Steps: ${bug.ai_repro_steps || "N/A"}`;

  return callAI(apiKey, [
    {
      role: "system",
      content: `Du är en senior utvecklare som analyserar buggar i en svensk e-handelsplattform byggd med React, TypeScript, Supabase och Tailwind.
Analysera buggen och ge FLERA möjliga grundorsaker med konfidensnivå. För varje orsak, ge en fix-strategi och Lovable-prompt.
Rangordna efter sannolikhet. Svara på svenska. Använd suggest_fix_v2-funktionen.`,
    },
    { role: "user", content: context },
  ], [
    {
      type: "function",
      function: {
        name: "suggest_fix_v2",
        description: "Suggest multiple root causes and fixes for a bug",
        parameters: {
          type: "object",
          properties: {
            root_causes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  cause: { type: "string", description: "Description of the root cause" },
                  confidence: { type: "number", description: "0-100 confidence score" },
                  fix_strategy: { type: "string" },
                  code_suggestion: { type: "string" },
                  affected_areas: { type: "array", items: { type: "string" } },
                  risk_level: { type: "string", enum: ["low", "medium", "high"] },
                  lovable_prompt: { type: "string" },
                },
                required: ["cause", "confidence", "fix_strategy", "affected_areas", "risk_level", "lovable_prompt"],
                additionalProperties: false,
              },
              description: "2-5 possible root causes ranked by confidence",
            },
            summary: { type: "string", description: "Executive summary of the analysis" },
            overall_risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
          },
          required: ["root_causes", "summary", "overall_risk"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "suggest_fix_v2" } });
}

async function analyzeData(apiKey: string, summary: string) {
  return callAI(apiKey, [
    {
      role: "system",
      content: `Du är en affärsanalytiker för en svensk e-handelsplattform. Analysera ALL data och ge handlingsbara insikter. Svara på svenska.`,
    },
    { role: "user", content: `Analysera denna systemdata och ge insikter:\n\n${summary}` },
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
                  action: { type: "string" },
                },
                required: ["type", "title", "description", "action"],
                additionalProperties: false,
              },
            },
            summary: { type: "string" },
            health_score: { type: "number" },
          },
          required: ["insights", "summary", "health_score"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "analyze_data" } });
}

// ── Product Suggestions ──
async function handleProductSuggestions(supabase: any, apiKey: string) {
  const [productsRes, salesRes, ordersRes, eventsRes] = await Promise.all([
    supabase.from("products").select("title_sv, price, stock, badge, category, is_visible").eq("is_visible", true).limit(200),
    supabase.from("product_sales").select("product_title, total_quantity_sold, last_sale_at").order("total_quantity_sold", { ascending: false }).limit(50),
    supabase.from("orders").select("total_amount, items, created_at").eq("payment_status", "paid").order("created_at", { ascending: false }).limit(200),
    supabase.from("analytics_events").select("event_type, event_data").in("event_type", ["product_view", "add_to_cart"]).order("created_at", { ascending: false }).limit(500),
  ]);

  const products = productsRes.data || [];
  const sales = salesRes.data || [];
  const orders = ordersRes.data || [];
  const events = eventsRes.data || [];

  const aov = orders.length > 0 ? Math.round(orders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0) / orders.length) : 0;
  const topViewed = events.filter((e: any) => e.event_type === "product_view").slice(0, 20);
  const cartAdds = events.filter((e: any) => e.event_type === "add_to_cart").length;

  const context = `PRODUKTDATA:
Antal produkter: ${products.length}
Produkter: ${products.slice(0, 30).map((p: any) => `${p.title_sv} (${p.price} kr, lager: ${p.stock})`).join(", ")}

FÖRSÄLJNING:
Topprodukter: ${sales.slice(0, 10).map((s: any) => `${s.product_title}: ${s.total_quantity_sold} sålda`).join(", ")}
AOV: ${aov} kr
Antal ordrar (senaste): ${orders.length}
Kundkorgs-tillägg: ${cartAdds}

KATEGORIER: ${[...new Set(products.map((p: any) => p.category).filter(Boolean))].join(", ")}`;

  return callAI(apiKey, [
    {
      role: "system",
      content: `Du är produktstrateg för en svensk e-handelsplattform (4thepeople) som säljer giftfria kroppsvårdsprodukter och bastutillbehör. Analysera datan och ge konkreta produktförslag. Svara på svenska.`,
    },
    { role: "user", content: context },
  ], [
    {
      type: "function",
      function: {
        name: "product_suggestions",
        description: "Generate product and bundle suggestions",
        parameters: {
          type: "object",
          properties: {
            new_products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  reason: { type: "string" },
                  estimated_price: { type: "string" },
                  category: { type: "string" },
                },
                required: ["name", "reason", "estimated_price", "category"],
                additionalProperties: false,
              },
            },
            bundles: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  products: { type: "array", items: { type: "string" } },
                  discount: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["name", "products", "discount", "reason"],
                additionalProperties: false,
              },
            },
            pricing_suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product: { type: "string" },
                  current_price: { type: "string" },
                  suggested_action: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["product", "suggested_action", "reason"],
                additionalProperties: false,
              },
            },
            campaign_ideas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  target: { type: "string" },
                },
                required: ["title", "description", "target"],
                additionalProperties: false,
              },
            },
            summary: { type: "string" },
          },
          required: ["new_products", "bundles", "pricing_suggestions", "campaign_ideas", "summary"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "product_suggestions" } });
}

// ── System Health ──
async function handleSystemHealth(supabase: any, apiKey: string) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dayStr = dayAgo.toISOString();

  const [bugsRes, workRes, incidentsRes, logsRes, ordersRes] = await Promise.all([
    supabase.from("bug_reports").select("id, status, ai_severity, ai_category, ai_summary, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(50),
    supabase.from("work_items").select("id, title, status, priority, item_type, ai_detected, due_at, created_at").not("status", "in", '("done","cancelled")').order("created_at", { ascending: false }).limit(100),
    supabase.from("order_incidents").select("id, status, priority, type, sla_status, title").not("status", "in", '("resolved","closed")').limit(50),
    supabase.from("activity_logs").select("log_type, category, message, created_at").gte("created_at", dayStr).eq("log_type", "error").limit(50),
    supabase.from("orders").select("id, status, payment_status, fulfillment_status, packed_at, shipped_at, created_at").eq("payment_status", "paid").is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
  ]);

  const bugs = bugsRes.data || [];
  const work = workRes.data || [];
  const incidents = incidentsRes.data || [];
  const errors = logsRes.data || [];
  const orders = ordersRes.data || [];

  const overdue = work.filter((w: any) => w.due_at && new Date(w.due_at) < now);
  const unpackedPaid = orders.filter((o: any) => !o.packed_at && o.payment_status === "paid");
  const criticalBugs = bugs.filter((b: any) => b.ai_severity === "critical" || b.ai_severity === "high");
  const slaBreaches = incidents.filter((i: any) => i.sla_status === "overdue");

  const context = `SYSTEMSTATUS (senaste 24h):

BUGGAR: ${bugs.length} öppna (${criticalBugs.length} kritiska/höga)
${bugs.slice(0, 10).map((b: any) => `- [${b.ai_severity || "?"}] ${b.ai_summary || b.id}`).join("\n")}

UPPGIFTER: ${work.length} aktiva, ${overdue.length} försenade
${overdue.slice(0, 5).map((w: any) => `- FÖRSENAD: ${w.title}`).join("\n")}

INCIDENTER: ${incidents.length} öppna, ${slaBreaches.length} SLA-brott
${slaBreaches.slice(0, 5).map((i: any) => `- SLA BROTT: ${i.title}`).join("\n")}

FEL (24h): ${errors.length} loggade fel
${errors.slice(0, 10).map((e: any) => `- ${e.category}: ${e.message}`).join("\n")}

ORDRAR: ${unpackedPaid.length} betalda men ej packade`;

  return callAI(apiKey, [
    {
      role: "system",
      content: `Du är systemövervakare för en svensk e-handelsplattform. Analysera systemets hälsa och identifiera kritiska problem, duplicerade buggar och saknade åtgärder. Svara på svenska.`,
    },
    { role: "user", content: context },
  ], [
    {
      type: "function",
      function: {
        name: "system_health",
        description: "Analyze system health and detect issues",
        parameters: {
          type: "object",
          properties: {
            critical_issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  severity: { type: "string", enum: ["critical", "high", "medium"] },
                  description: { type: "string" },
                  suggested_action: { type: "string" },
                },
                required: ["title", "severity", "description", "suggested_action"],
                additionalProperties: false,
              },
            },
            duplicate_bugs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  bug_ids: { type: "array", items: { type: "string" } },
                  reason: { type: "string" },
                  suggested_action: { type: "string" },
                },
                required: ["bug_ids", "reason", "suggested_action"],
                additionalProperties: false,
              },
            },
            missing_fixes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  area: { type: "string" },
                  problem: { type: "string" },
                  suggestion: { type: "string" },
                },
                required: ["area", "problem", "suggestion"],
                additionalProperties: false,
              },
            },
            improvements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  impact: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["title", "description", "impact"],
                additionalProperties: false,
              },
            },
            health_score: { type: "number" },
            summary: { type: "string" },
          },
          required: ["critical_issues", "duplicate_bugs", "missing_fixes", "improvements", "health_score", "summary"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "system_health" } });
}

// ── Full System Scan Engine ──
async function handleSystemScan(supabase: any, apiKey: string, supabaseUrl: string, serviceKey: string) {
  const scanStart = Date.now();

  // 1. Gather full snapshot
  const { summary, metrics } = await gatherSystemSnapshot(supabase);

  // 2. Deep AI analysis – detect ALL issues (bugs, improvements, features, upgrades)
  const analysis = await callAI(apiKey, [
    {
      role: "system",
      content: `Du är en AI-systemanalytiker för en svensk e-handelsplattform (4thepeople).
Skanna ALL systemdata och identifiera ALLA problem, förbättringsmöjligheter och saknade funktioner.
Klassificera varje issue korrekt. Var specifik och handlingsbar. Svara på svenska.
Du MÅSTE använda system_scan-funktionen.`,
    },
    { role: "user", content: `Genomför en fullständig systemskanning:\n\n${summary}` },
  ], [{
    type: "function",
    function: {
      name: "system_scan",
      description: "Full system scan with issue detection and fix suggestions",
      parameters: {
        type: "object",
        properties: {
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Short clear issue title" },
                description: { type: "string", description: "What the issue is" },
                type: { type: "string", enum: ["bug", "improvement", "feature", "upgrade", "task"] },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                category: { type: "string", enum: ["payment", "checkout", "orders", "products", "UI", "auth", "performance", "data", "security", "system"] },
                fix_suggestion: { type: "string", description: "How to fix or implement" },
                lovable_prompt: { type: "string", description: "Ready-to-use Lovable prompt" },
                urgency: { type: "string", enum: ["now", "today", "this_week", "backlog"] },
              },
              required: ["title", "description", "type", "severity", "category", "fix_suggestion", "urgency"],
              additionalProperties: false,
            },
          },
          system_score: { type: "number", description: "Overall system health 0-100" },
          executive_summary: { type: "string", description: "2-3 sentence summary" },
          risk_areas: {
            type: "array",
            items: { type: "string" },
            description: "Top risk areas in the system",
          },
        },
        required: ["issues", "system_score", "executive_summary", "risk_areas"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "system_scan" } });

  // 3. Auto-create work_items for detected issues (with dedup)
  let created = 0;
  let skipped = 0;
  const createdIds: string[] = [];

  for (const issue of analysis?.issues || []) {
    // Dedup: check if similar task already exists
    const searchTitle = issue.title.substring(0, 40);
    const { data: existing } = await supabase
      .from("work_items")
      .select("id")
      .ilike("title", `%${searchTitle}%`)
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .limit(1);

    if (existing?.length) {
      skipped++;
      continue;
    }

    const priorityMap: Record<string, string> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    };

    const { data: newItem } = await supabase.from("work_items").insert({
      title: `AI Scan: ${issue.title}`.substring(0, 200),
      description: `${issue.description}\n\n🔧 Fix-förslag: ${issue.fix_suggestion}${issue.lovable_prompt ? `\n\n📋 Lovable-prompt:\n${issue.lovable_prompt}` : ""}`,
      status: "open",
      priority: priorityMap[issue.severity] || "medium",
      item_type: issue.type === "bug" ? "bug" : issue.type === "task" ? "manual" : "insight",
      source_type: "ai_detection",
      ai_detected: true,
      ai_confidence: issue.severity === "critical" || issue.severity === "high" ? "high" : "medium",
      ai_category: issue.category,
      ai_type_classification: issue.type,
      ai_type_reason: `AI System Scan: ${issue.urgency}`,
    }).select("id").single();

    if (newItem) {
      createdIds.push(newItem.id);
      created++;
    }
  }

  // 4. Trigger task manager for prioritization + orchestration
  let taskManagerResult: any = null;
  try {
    const tmResp = await fetch(`${supabaseUrl}/functions/v1/ai-task-manager`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "full_cycle" }),
    });
    if (tmResp.ok) {
      const tmData = await tmResp.json();
      taskManagerResult = tmData.results;
    }
  } catch (e) {
    console.error("Task manager trigger failed:", e);
  }

  // 5. Fetch final master task list (ordered)
  const { data: masterList } = await supabase
    .from("work_items")
    .select("id, title, status, priority, item_type, ai_detected, ai_category, ai_type_classification, ai_confidence, execution_order, depends_on, blocks, conflict_flag, duplicate_of, created_at, ai_type_reason")
    .in("status", ["open", "claimed", "in_progress", "escalated"])
    .order("execution_order", { ascending: true, nullsFirst: false })
    .limit(100);

  // Group by urgency
  const mustDo = (masterList || []).filter((t: any) => t.priority === "critical" || t.execution_order <= 5);
  const nextUp = (masterList || []).filter((t: any) => !mustDo.includes(t) && (t.priority === "high" || (t.execution_order > 5 && t.execution_order <= 20)));
  const optional = (masterList || []).filter((t: any) => !mustDo.includes(t) && !nextUp.includes(t));

  return {
    scan_duration_ms: Date.now() - scanStart,
    system_score: analysis?.system_score || 0,
    executive_summary: analysis?.executive_summary || "",
    risk_areas: analysis?.risk_areas || [],
    issues_found: analysis?.issues?.length || 0,
    issues: analysis?.issues || [],
    tasks_created: created,
    tasks_skipped_duplicate: skipped,
    task_manager: taskManagerResult,
    master_list: {
      must_do: mustDo,
      next_up: nextUp,
      optional: optional,
      total: (masterList || []).length,
    },
  };
}

// ── Visual QA Engine ──
async function handleVisualQA(supabase: any, apiKey: string) {
  // Gather all relevant data for UI analysis
  const [bugsRes, workItemsRes, eventsRes, productsRes, pagesRes] = await Promise.all([
    supabase.from("bug_reports").select("description, page_url, ai_category, ai_severity, status, ai_summary").limit(50),
    supabase.from("work_items").select("title, description, item_type, ai_category, status, priority").in("status", ["open", "claimed", "in_progress", "escalated"]).limit(100),
    supabase.from("analytics_events").select("event_type, event_data, created_at").in("event_type", ["page_error", "checkout_abandon", "checkout_start", "product_view", "add_to_cart"]).order("created_at", { ascending: false }).limit(500),
    supabase.from("products").select("title_sv, handle, image_urls, is_visible, description_sv, price, stock").eq("is_visible", true).limit(100),
    supabase.from("page_sections").select("page, section_key, is_visible, title_sv, content_sv").limit(200),
  ]);

  const bugs = bugsRes.data || [];
  const workItems = workItemsRes.data || [];
  const events = eventsRes.data || [];
  const products = productsRes.data || [];
  const pages = pagesRes.data || [];

  const uiBugs = bugs.filter((b: any) => ["ui", "frontend", "layout", "design", "navigation", "responsive"].some(k => (b.ai_category || "").toLowerCase().includes(k) || (b.description || "").toLowerCase().includes(k)));
  const abandonRate = (() => {
    const starts = events.filter((e: any) => e.event_type === "checkout_start").length;
    const abandons = events.filter((e: any) => e.event_type === "checkout_abandon").length;
    return starts > 0 ? Math.round((abandons / starts) * 100) : 0;
  })();
  const productsMissingImages = products.filter((p: any) => !p.image_urls?.length);
  const productsMissingDesc = products.filter((p: any) => !p.description_sv);
  const emptyPages = pages.filter((p: any) => p.is_visible && (!p.content_sv || p.content_sv.trim().length < 10));

  const routes = [
    "/", "/produkter", "/product/:handle", "/about", "/contact",
    "/checkout", "/profile", "/track-order", "/affiliate",
    "/business", "/donations", "/whats-new", "/policies/privacy",
    "/policies/returns", "/policies/shipping", "/policies/terms",
  ];

  const context = `=== VISUAL QA CONTEXT ===

ROUTES: ${routes.join(", ")}

UI BUGS (${uiBugs.length}):
${uiBugs.slice(0, 15).map((b: any) => `- [${b.ai_severity || "?"}] ${b.page_url}: ${b.ai_summary || b.description?.substring(0, 100)}`).join("\n")}

OPEN UI WORK ITEMS:
${workItems.filter((w: any) => ["ui", "frontend", "ux"].some(k => (w.ai_category || w.item_type || "").includes(k))).slice(0, 10).map((w: any) => `- [${w.priority}] ${w.title}`).join("\n")}

CHECKOUT ABANDON RATE: ${abandonRate}%

PRODUCTS MISSING IMAGES: ${productsMissingImages.length} (${productsMissingImages.slice(0, 5).map((p: any) => p.title_sv).join(", ")})
PRODUCTS MISSING DESCRIPTION: ${productsMissingDesc.length}

EMPTY/THIN PAGE SECTIONS: ${emptyPages.length}
${emptyPages.slice(0, 10).map((p: any) => `- ${p.page}/${p.section_key}`).join("\n")}

PAGE SECTIONS CONFIGURED: ${pages.length}
VISIBLE PRODUCTS: ${products.length}
OUT OF STOCK: ${products.filter((p: any) => p.stock !== null && p.stock <= 0).length}`;

  const analysis = await callAI(apiKey, [
    {
      role: "system",
      content: `Du är en senior UX/UI-expert och QA-ingenjör som analyserar en svensk e-handelsplattform (4thepeople).
Analysera all tillgänglig data och identifiera UI-problem, responsivitetsproblem, UX-friktionspunkter och förbättringsmöjligheter.
Bedöm VARJE sida/flöde. Testa mentalt varje breakpoint (mobil 375px, tablet 768px, desktop 1280px).
Var SPECIFIK med vilka sidor och element som har problem. Svara på svenska.`,
    },
    { role: "user", content: `Kör full Visual QA-analys:\n\n${context}` },
  ], [{
    type: "function",
    function: {
      name: "visual_qa",
      description: "Generate Visual QA report",
      parameters: {
        type: "object",
        properties: {
          overall_ui_score: { type: "number", description: "0-100 overall UI quality" },
          mobile_score: { type: "number", description: "0-100 mobile experience" },
          desktop_score: { type: "number", description: "0-100 desktop experience" },
          usability_score: { type: "number", description: "0-100 usability" },
          accessibility_score: { type: "number", description: "0-100 accessibility estimate" },
          executive_summary: { type: "string" },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                page: { type: "string" },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                category: { type: "string", enum: ["responsive", "layout", "navigation", "content", "accessibility", "performance", "ux_friction", "missing_element", "broken_flow"] },
                breakpoint: { type: "string", enum: ["mobile", "tablet", "desktop", "all"] },
                description: { type: "string" },
                fix_suggestion: { type: "string" },
                lovable_prompt: { type: "string" },
              },
              required: ["title", "page", "severity", "category", "breakpoint", "description", "fix_suggestion", "lovable_prompt"],
              additionalProperties: false,
            },
          },
          flow_tests: {
            type: "array",
            items: {
              type: "object",
              properties: {
                flow_name: { type: "string" },
                status: { type: "string", enum: ["pass", "warning", "fail"] },
                issues: { type: "array", items: { type: "string" } },
              },
              required: ["flow_name", "status", "issues"],
              additionalProperties: false,
            },
          },
          page_scores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                page: { type: "string" },
                score: { type: "number" },
                status: { type: "string", enum: ["good", "warning", "critical"] },
                notes: { type: "string" },
              },
              required: ["page", "score", "status", "notes"],
              additionalProperties: false,
            },
          },
        },
        required: ["overall_ui_score", "mobile_score", "desktop_score", "usability_score", "accessibility_score", "executive_summary", "issues", "flow_tests", "page_scores"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "visual_qa" } });

  // Auto-create work items for critical/high issues
  let tasksCreated = 0;
  if (analysis?.issues) {
    for (const issue of analysis.issues) {
      if (!["critical", "high"].includes(issue.severity)) continue;
      const { data: existing } = await supabase
        .from("work_items")
        .select("id")
        .ilike("title", `%${issue.title.substring(0, 30)}%`)
        .in("status", ["open", "claimed", "in_progress"])
        .limit(1);
      if (!existing?.length) {
        await supabase.from("work_items").insert({
          title: `UI QA: ${issue.title}`.substring(0, 200),
          description: `Sida: ${issue.page}\nBreakpoint: ${issue.breakpoint}\nKategori: ${issue.category}\n\n${issue.description}\n\nFix: ${issue.fix_suggestion}`,
          status: "open",
          priority: issue.severity === "critical" ? "critical" : "high",
          item_type: issue.category === "broken_flow" ? "bug" : "improvement",
          source_type: "ai_detection",
          ai_detected: true,
          ai_confidence: "medium",
          ai_category: "frontend",
          ai_type_classification: issue.category,
        });
        tasksCreated++;
      }
    }
  }

  return { ...analysis, tasks_created: tasksCreated };
}

// ── Navigation Scanner ──
async function handleNavScan(supabase: any, apiKey: string) {
  const routes = [
    { path: "/", name: "Startsida" },
    { path: "/produkter", name: "Produkter" },
    { path: "/product/:handle", name: "Produktdetalj" },
    { path: "/about", name: "Om oss" },
    { path: "/contact", name: "Kontakt" },
    { path: "/checkout", name: "Checkout" },
    { path: "/profile", name: "Profil" },
    { path: "/track-order", name: "Orderspårning" },
    { path: "/affiliate", name: "Affiliate" },
    { path: "/business", name: "Företag" },
    { path: "/whats-new", name: "Nyheter" },
    { path: "/suggest-product", name: "Önska produkt" },
    { path: "/balance", name: "Saldo" },
    { path: "/cbd", name: "CBD" },
    { path: "/policies/privacy", name: "Integritetspolicy" },
    { path: "/policies/returns", name: "Returpolicy" },
    { path: "/policies/shipping", name: "Fraktpolicy" },
    { path: "/policies/terms", name: "Villkor" },
    { path: "/reset-password", name: "Återställ lösenord" },
    { path: "/order-confirmation", name: "Orderbekräftelse" },
    { path: "/admin", name: "Admin" },
  ];

  // Get existing nav-related bugs/work_items
  const [bugsRes, workRes, pagesRes] = await Promise.all([
    supabase.from("bug_reports").select("description, page_url, ai_category, ai_severity, status, ai_summary").limit(100),
    supabase.from("work_items").select("title, status, ai_category, item_type").in("status", ["open", "claimed", "in_progress", "escalated"]).limit(200),
    supabase.from("page_sections").select("page, section_key, is_visible, title_sv").limit(200),
  ]);

  const bugs = bugsRes.data || [];
  const workItems = workRes.data || [];
  const pages = pagesRes.data || [];
  const navBugs = bugs.filter((b: any) => ["navigation", "routing", "link", "button"].some(k => (b.description || "").toLowerCase().includes(k) || (b.ai_category || "").toLowerCase().includes(k)));

  const context = `=== NAVIGATION SCAN ===
DEFINED ROUTES: ${routes.map(r => `${r.path} (${r.name})`).join(", ")}

NAV-RELATED BUGS (${navBugs.length}):
${navBugs.slice(0, 20).map((b: any) => `- [${b.status}/${b.ai_severity}] ${b.page_url}: ${b.ai_summary || b.description?.substring(0, 100)}`).join("\n")}

OPEN WORK ITEMS (${workItems.length}):
${workItems.slice(0, 20).map((w: any) => `- [${w.status}] ${w.title}`).join("\n")}

PAGE SECTIONS: ${pages.length} configured
HIDDEN SECTIONS: ${pages.filter((p: any) => !p.is_visible).length}`;

  const analysis = await callAI(apiKey, [
    {
      role: "system",
      content: `Du är en QA-expert som analyserar navigation och routing i en React-applikation (4thepeople e-handel).
Analysera alla routes, identifiera potentiella problem med navigation, brutna länkar, saknade sidor och felaktiga flöden.
Ge SPECIFIKA och handlingsbara resultat. Svara på svenska.`,
    },
    { role: "user", content: context },
  ], [{
    type: "function",
    function: {
      name: "nav_scan",
      description: "Navigation scan results",
      parameters: {
        type: "object",
        properties: {
          nav_score: { type: "number", description: "0-100 navigation health" },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                page: { type: "string" },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                issue_type: { type: "string", enum: ["broken_link", "wrong_route", "missing_page", "dead_button", "nav_inconsistency", "flow_break"] },
                description: { type: "string" },
                fix_suggestion: { type: "string" },
                lovable_prompt: { type: "string" },
              },
              required: ["title", "page", "severity", "issue_type", "description", "fix_suggestion", "lovable_prompt"],
              additionalProperties: false,
            },
          },
          route_status: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                name: { type: "string" },
                status: { type: "string", enum: ["ok", "warning", "broken", "missing"] },
                notes: { type: "string" },
              },
              required: ["path", "name", "status", "notes"],
              additionalProperties: false,
            },
          },
          summary: { type: "string" },
        },
        required: ["nav_score", "issues", "route_status", "summary"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "nav_scan" } });

  // Auto-create work items for critical/high nav issues
  let tasksCreated = 0;
  for (const issue of analysis?.issues || []) {
    if (!["critical", "high"].includes(issue.severity)) continue;
    const { data: existing } = await supabase
      .from("work_items")
      .select("id")
      .ilike("title", `%${issue.title.substring(0, 30)}%`)
      .in("status", ["open", "claimed", "in_progress"])
      .limit(1);
    if (!existing?.length) {
      await supabase.from("work_items").insert({
        title: `Nav: ${issue.title}`.substring(0, 200),
        description: `Sida: ${issue.page}\nTyp: ${issue.issue_type}\n\n${issue.description}\n\nFix: ${issue.fix_suggestion}`,
        status: "open",
        priority: issue.severity === "critical" ? "critical" : "high",
        item_type: "bug",
        source_type: "ai_detection",
        ai_detected: true,
        ai_confidence: "medium",
        ai_category: "navigation",
        ai_type_classification: "navigation_bug",
      });
      tasksCreated++;
    }
  }

  return { ...analysis, tasks_created: tasksCreated };
}

// ── Bug Re-scan & Status Engine ──
async function handleBugRescan(supabase: any, apiKey: string) {
  // Get ALL bugs and their linked work items
  const [bugsRes, workItemsRes] = await Promise.all([
    supabase.from("bug_reports").select("id, description, page_url, status, ai_summary, ai_severity, ai_category, ai_tags, created_at, resolved_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("work_items").select("id, title, status, priority, item_type, source_id, source_type, ai_detected, ai_review_status, created_at, completed_at, ignored").limit(300),
  ]);

  const bugs = bugsRes.data || [];
  const workItems = workItemsRes.data || [];

  const bugSummaries = bugs.map((b: any) => ({
    id: b.id,
    status: b.status,
    severity: b.ai_severity,
    category: b.ai_category,
    summary: b.ai_summary || b.description?.substring(0, 150),
    page: b.page_url,
    created: b.created_at,
    resolved: b.resolved_at,
    has_work_item: workItems.some((w: any) => w.source_id === b.id),
    work_item_status: workItems.find((w: any) => w.source_id === b.id)?.status || null,
  }));

  const context = `=== BUG RE-SCAN ===
TOTAL BUGS: ${bugs.length}
OPEN: ${bugs.filter((b: any) => b.status === "open").length}
RESOLVED: ${bugs.filter((b: any) => b.status === "resolved").length}

ALL BUGS:
${bugSummaries.map((b: any) => `[${b.id.slice(0,8)}] status=${b.status} sev=${b.severity} cat=${b.category} work_item=${b.work_item_status || "none"} | ${b.summary}`).join("\n")}

WORK ITEMS (${workItems.length}):
${workItems.slice(0, 30).map((w: any) => `[${w.id.slice(0,8)}] status=${w.status} type=${w.item_type} source=${w.source_type}/${w.source_id?.slice(0,8) || "?"} ignored=${w.ignored}`).join("\n")}`;

  const analysis = await callAI(apiKey, [
    {
      role: "system",
      content: `Du är en senior QA-chef som utvärderar ALLA buggar i ett system.
För varje bugg: bedöm om den fortfarande är relevant, om den redan är fixad, om den är en dubblett, eller om den bör omprioriteras.
Ge tydliga statusändringar. Svara på svenska.`,
    },
    { role: "user", content: context },
  ], [{
    type: "function",
    function: {
      name: "bug_rescan",
      description: "Re-evaluate all bugs and suggest status changes",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          total_evaluated: { type: "number" },
          status_changes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                bug_id: { type: "string" },
                current_status: { type: "string" },
                recommended_status: { type: "string", enum: ["open", "in_progress", "resolved", "ignored", "duplicate"] },
                reason: { type: "string" },
                confidence: { type: "number", description: "0-100" },
              },
              required: ["bug_id", "current_status", "recommended_status", "reason", "confidence"],
              additionalProperties: false,
            },
          },
          duplicates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                bug_ids: { type: "array", items: { type: "string" } },
                reason: { type: "string" },
              },
              required: ["bug_ids", "reason"],
              additionalProperties: false,
            },
          },
          work_item_updates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                work_item_id: { type: "string" },
                recommended_status: { type: "string", enum: ["open", "in_progress", "review", "done", "ignored"] },
                reason: { type: "string" },
              },
              required: ["work_item_id", "recommended_status", "reason"],
              additionalProperties: false,
            },
          },
          missing_work_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                bug_id: { type: "string" },
                title: { type: "string" },
                priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
              },
              required: ["bug_id", "title", "priority"],
              additionalProperties: false,
            },
          },
          health_score: { type: "number" },
        },
        required: ["summary", "total_evaluated", "status_changes", "duplicates", "work_item_updates", "missing_work_items", "health_score"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "bug_rescan" } });

  // Auto-apply high-confidence status changes
  let bugsUpdated = 0;
  let workItemsUpdated = 0;
  let tasksCreated = 0;

  // Apply bug status changes (only high confidence)
  for (const change of analysis?.status_changes || []) {
    if (change.confidence < 80) continue;
    if (change.recommended_status === change.current_status) continue;
    
    const updateData: any = { status: change.recommended_status };
    if (change.recommended_status === "resolved") {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolution_notes = `AI re-scan: ${change.reason}`;
    }
    
    const { error } = await supabase.from("bug_reports").update(updateData).eq("id", change.bug_id);
    if (!error) bugsUpdated++;
  }

  // Apply work item updates (only high confidence)
  for (const update of analysis?.work_item_updates || []) {
    const updateData: any = { status: update.recommended_status, updated_at: new Date().toISOString() };
    if (update.recommended_status === "done") updateData.completed_at = new Date().toISOString();
    if (update.recommended_status === "ignored") { updateData.ignored = true; updateData.ignored_reason = update.reason; }
    
    await supabase.from("work_items").update(updateData).eq("id", update.work_item_id);
    workItemsUpdated++;
  }

  // Create missing work items
  for (const missing of analysis?.missing_work_items || []) {
    const { data: existing } = await supabase
      .from("work_items")
      .select("id")
      .eq("source_id", missing.bug_id)
      .limit(1);
    if (!existing?.length) {
      await supabase.from("work_items").insert({
        title: missing.title.substring(0, 200),
        status: "open",
        priority: missing.priority,
        item_type: "bug",
        source_type: "bug_report",
        source_id: missing.bug_id,
        ai_detected: true,
        ai_confidence: "medium",
      });
      tasksCreated++;
    }
  }

  return {
    ...analysis,
    applied: { bugs_updated: bugsUpdated, work_items_updated: workItemsUpdated, tasks_created: tasksCreated },
  };
}

// ── Action + Revenue Engine ──
async function handleActionEngine(supabase: any, apiKey: string) {
  // Gather all relevant data
  const { summary, metrics } = await gatherSystemSnapshot(supabase);

  // Get open work items with details
  const { data: workItems } = await supabase
    .from("work_items")
    .select("id, title, description, status, priority, item_type, ai_category, ai_type_classification, ai_confidence, source_type, source_id, created_at")
    .in("status", ["open", "claimed", "in_progress", "escalated"])
    .order("created_at", { ascending: false })
    .limit(30);

  // Get product performance
  const { data: products } = await supabase
    .from("products")
    .select("title_sv, price, stock, badge, category, is_visible")
    .eq("is_visible", true)
    .limit(100);

  const { data: sales } = await supabase
    .from("product_sales")
    .select("product_title, total_quantity_sold")
    .order("total_quantity_sold", { ascending: false })
    .limit(30);

  const workItemsSummary = (workItems || []).slice(0, 20).map((w: any) =>
    `[${w.priority}/${w.item_type}] ${w.title} (${w.ai_category || "uncategorized"})`
  ).join("\n");

  const productSummary = (products || []).slice(0, 20).map((p: any) =>
    `${p.title_sv}: ${p.price} kr, lager: ${p.stock}`
  ).join(", ");

  const salesSummary = (sales || []).slice(0, 10).map((s: any) =>
    `${s.product_title}: ${s.total_quantity_sold} sålda`
  ).join(", ");

  const context = `${summary}

AKTIVA UPPGIFTER (${(workItems || []).length}):
${workItemsSummary}

PRODUKTER: ${productSummary}
FÖRSÄLJNING: ${salesSummary}`;

  return callAI(apiKey, [
    {
      role: "system",
      content: `Du är en AI-operativ chef för en svensk e-handelsplattform (4thepeople) som säljer giftfria produkter.
Din uppgift är att generera KONKRETA HANDLINGSPLANER som maximerar intäkter och systemstabilitet.
För varje åtgärd: ge root cause, fix-strategi, implementation steps och en redo Lovable-prompt.
Koppla buggar till intäktsförlust. Föreslå kampanjer och bundles baserat på data.
Rangordna ALLT efter intäktspåverkan. Svara på svenska. Använd action_engine-funktionen.`,
    },
    { role: "user", content: `Generera handlingsplan baserat på:\n\n${context}` },
  ], [{
    type: "function",
    function: {
      name: "action_engine",
      description: "Generate prioritized action plan with revenue impact",
      parameters: {
        type: "object",
        properties: {
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                type: { type: "string", enum: ["fix", "improvement", "revenue", "campaign", "bundle", "upsell"] },
                priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                revenue_impact: { type: "string", enum: ["high", "medium", "low", "none"] },
                root_cause: { type: "string" },
                fix_strategy: { type: "string" },
                implementation_steps: { type: "array", items: { type: "string" } },
                expected_result: { type: "string" },
                lovable_prompt: { type: "string" },
                linked_systems: { type: "array", items: { type: "string" } },
                estimated_revenue_change: { type: "string" },
              },
              required: ["title", "type", "priority", "revenue_impact", "root_cause", "fix_strategy", "implementation_steps", "expected_result", "lovable_prompt", "linked_systems"],
              additionalProperties: false,
            },
          },
          campaigns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                discount: { type: "string" },
                target_audience: { type: "string" },
                expected_revenue: { type: "string" },
                timing: { type: "string" },
              },
              required: ["name", "description", "discount", "target_audience", "expected_revenue", "timing"],
              additionalProperties: false,
            },
          },
          bundle_suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                products: { type: "array", items: { type: "string" } },
                discount_percent: { type: "number" },
                reason: { type: "string" },
                expected_aov_increase: { type: "string" },
              },
              required: ["name", "products", "discount_percent", "reason", "expected_aov_increase"],
              additionalProperties: false,
            },
          },
          cross_system_links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                issue: { type: "string" },
                revenue_connection: { type: "string" },
                impact_description: { type: "string" },
              },
              required: ["issue", "revenue_connection", "impact_description"],
              additionalProperties: false,
            },
          },
          summary: { type: "string" },
          total_estimated_revenue_opportunity: { type: "string" },
        },
        required: ["actions", "campaigns", "bundle_suggestions", "cross_system_links", "summary", "total_estimated_revenue_opportunity"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "action_engine" } });
}

// ── Structure Analysis ──
async function handleStructureAnalysis(supabase: any, apiKey: string) {
  // Gather admin routes, page sections, work items with structure issues, and existing bug reports about UI/nav
  const [{ data: pages }, { data: workItems }, { data: bugs }, { data: products }] = await Promise.all([
    supabase.from("page_sections").select("page, section_key, title_sv, is_visible, display_order").order("page").order("display_order"),
    supabase.from("work_items").select("id, title, item_type, status, ai_category").in("status", ["open", "claimed", "in_progress", "escalated"]).limit(50),
    supabase.from("bug_reports").select("id, description, ai_category, ai_summary, page_url, status").in("status", ["open", "in_progress"]).limit(30),
    supabase.from("products").select("id, title_sv, category, is_visible, meta_title, meta_description").limit(100),
  ]);

  // Build admin route map from known pages
  const adminRoutes = [
    { path: "/admin", label: "Overview" },
    { path: "/admin/orders", label: "Orders" },
    { path: "/admin/products", label: "Products" },
    { path: "/admin/members", label: "Members" },
    { path: "/admin/ai", label: "AI Center" },
    { path: "/admin/content", label: "Content" },
    { path: "/admin/seo", label: "SEO" },
    { path: "/admin/categories", label: "Categories" },
    { path: "/admin/campaigns", label: "Campaigns" },
    { path: "/admin/shipping", label: "Shipping" },
    { path: "/admin/finance", label: "Finance" },
    { path: "/admin/payments", label: "Payments" },
    { path: "/admin/reviews", label: "Reviews" },
    { path: "/admin/growth", label: "Growth" },
    { path: "/admin/insights", label: "Insights" },
    { path: "/admin/stats", label: "Stats" },
    { path: "/admin/staff", label: "Staff" },
    { path: "/admin/partners", label: "Partners" },
    { path: "/admin/ops", label: "Operations" },
    { path: "/admin/incidents", label: "Incidents" },
    { path: "/admin/history", label: "History" },
    { path: "/admin/logs", label: "Logs" },
    { path: "/admin/legal", label: "Legal" },
    { path: "/admin/updates", label: "Updates" },
    { path: "/admin/visibility", label: "Visibility" },
    { path: "/admin/settings", label: "Settings" },
    { path: "/admin/data", label: "Data" },
    { path: "/admin/database", label: "Database" },
    { path: "/admin/communication", label: "Communication" },
  ];

  const prompt = `You are a software architecture analyst for an e-commerce admin system.

ADMIN ROUTES:
${JSON.stringify(adminRoutes, null, 1)}

PAGE SECTIONS (CMS):
${JSON.stringify((pages || []).slice(0, 40), null, 1)}

OPEN WORK ITEMS (${(workItems || []).length}):
${JSON.stringify((workItems || []).slice(0, 20).map((w: any) => ({ id: w.id, title: w.title, type: w.item_type, category: w.ai_category })), null, 1)}

OPEN BUGS (${(bugs || []).length}):
${JSON.stringify((bugs || []).slice(0, 15).map((b: any) => ({ id: b.id, summary: b.ai_summary || b.description?.substring(0, 80), category: b.ai_category, page: b.page_url })), null, 1)}

PRODUCTS (${(products || []).length} total, sample):
${JSON.stringify((products || []).slice(0, 10).map((p: any) => ({ title: p.title_sv, category: p.category, has_seo: !!(p.meta_title && p.meta_description) })), null, 1)}

Analyze the STRUCTURE and ORGANIZATION of this admin system. Find:
1. Misplaced features (e.g. SEO in wrong location)
2. Duplicated sections or overlapping modules
3. Fragmented functionality (related things split across too many places)
4. Inconsistent navigation groupings
5. Modules that should be merged
6. Missing logical groupings

For each issue, provide a concrete suggestion and a ready-to-use Lovable prompt to fix it.`;

  return callAIWithTools(apiKey, prompt, "You are an expert UX architect and software structure analyst. Be specific and actionable. Return Swedish text for all user-facing strings.", [{
    type: "function",
    function: {
      name: "structure_analysis",
      description: "Structural analysis of admin system",
      parameters: {
        type: "object",
        properties: {
          overall_score: { type: "number", description: "Structure health 0-100" },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                issue_type: { type: "string", enum: ["misplaced", "duplicated", "fragmented", "inconsistent", "merge_candidate", "missing_group"] },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                current_location: { type: "string" },
                suggested_location: { type: "string" },
                explanation: { type: "string" },
                affected_routes: { type: "array", items: { type: "string" } },
                lovable_prompt: { type: "string" },
              },
              required: ["title", "issue_type", "severity", "current_location", "suggested_location", "explanation", "affected_routes", "lovable_prompt"],
              additionalProperties: false,
            },
          },
          merge_suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                modules: { type: "array", items: { type: "string" } },
                merged_name: { type: "string" },
                reason: { type: "string" },
                lovable_prompt: { type: "string" },
              },
              required: ["modules", "merged_name", "reason", "lovable_prompt"],
              additionalProperties: false,
            },
          },
          ideal_structure: {
            type: "array",
            items: {
              type: "object",
              properties: {
                group: { type: "string" },
                modules: { type: "array", items: { type: "string" } },
              },
              required: ["group", "modules"],
              additionalProperties: false,
            },
          },
          summary: { type: "string" },
        },
        required: ["overall_score", "issues", "merge_suggestions", "ideal_structure", "summary"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "structure_analysis" } });
}
