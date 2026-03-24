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
            possible_cause: { type: "string" },
            fix_strategy: { type: "string" },
            code_suggestion: { type: "string" },
            affected_areas: { type: "array", items: { type: "string" } },
            risk_level: { type: "string", enum: ["low", "medium", "high"] },
            lovable_prompt: { type: "string" },
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
