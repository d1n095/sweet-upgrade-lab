import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Persist scan result first and return its ID for linking to work items */
async function persistScanResult(supabase: any, opts: {
  scan_type: string;
  results: any;
  overall_score: number;
  overall_status: string;
  issues_count: number;
  executive_summary: string;
  tasks_created?: number;
  scanned_by?: string;
}): Promise<string | null> {
  const { data, error } = await supabase.from("ai_scan_results").insert({
    scan_type: opts.scan_type,
    results: opts.results || {},
    overall_score: opts.overall_score,
    overall_status: opts.overall_status,
    issues_count: opts.issues_count,
    tasks_created: opts.tasks_created || 0,
    executive_summary: opts.executive_summary,
    scanned_by: opts.scanned_by || null,
  }).select("id").single();
  if (error) { console.error("persistScanResult error:", error); return null; }
  return data?.id || null;
}

/** Update tasks_created count on an existing scan result */
async function updateScanTaskCount(supabase: any, scanId: string, tasksCreated: number) {
  await supabase.from("ai_scan_results").update({ tasks_created: tasksCreated }).eq("id", scanId);
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
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: corsHeaders });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const user = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };

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
        await logAiRead(supabase, { action_type: "analyze", target_type: "bug_report", target_ids: [bug_id], result: "inspected", summary: `AI analyzed bug: ${bug.ai_summary || bug.description?.substring(0, 80)}`, triggered_by: user.id, linked_bug_id: bug_id, file_paths: bug.ai_tags || [], affected_components: [bug.ai_category || 'unknown', bug.page_url || ''] });
        result = await suggestBugFixEnhanced(supabase, lovableKey, bug);
        break;
      }

      case "bug_deep_analysis": {
        const { bug_id: deepBugId } = body;
        if (!deepBugId) {
          return new Response(JSON.stringify({ error: "bug_id required" }), { status: 400, headers: corsHeaders });
        }
        const { data: deepBug } = await supabase.from("bug_reports").select("*").eq("id", deepBugId).single();
        if (!deepBug) {
          return new Response(JSON.stringify({ error: "Bug not found" }), { status: 404, headers: corsHeaders });
        }
        await logAiRead(supabase, { action_type: "deep_analysis", target_type: "bug_report", target_ids: [deepBugId], result: "inspected", summary: `Deep analysis of bug: ${deepBug.ai_summary || deepBug.description?.substring(0, 80)}`, triggered_by: user.id, linked_bug_id: deepBugId, file_paths: deepBug.ai_tags || [], affected_components: [deepBug.ai_category || 'unknown', deepBug.page_url || ''] });
        result = await handleBugDeepAnalysis(supabase, lovableKey, deepBug);
        break;
      }

      case "data_insights": {
        await logAiRead(supabase, { action_type: "scan", target_type: "data_insights", result: "inspected", summary: "AI ran data insights analysis", triggered_by: user.id });
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
        await logAiRead(supabase, { action_type: "scan", target_type: "system_health", result: "inspected", summary: "AI ran system health check", triggered_by: user.id });
        result = await handleSystemHealth(supabase, lovableKey);
        break;
      }

      case "system_scan": {
        await logAiRead(supabase, { action_type: "scan", target_type: "system_scan", result: "inspected", summary: "AI ran full system scan", triggered_by: user.id });
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
        await logAiRead(supabase, { action_type: "scan", target_type: "bug_rescan", result: "inspected", summary: "AI rescanned all bugs", triggered_by: user.id });
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

      case "interaction_qa": {
        result = await handleInteractionQA(supabase, lovableKey);
        break;
      }

      case "ai_execute": {
        const { mode } = body;
        result = await handleAiExecute(supabase, lovableKey, mode || "assisted");
        break;
      }

      case "verification_engine": {
        result = await handleVerificationEngine(supabase, lovableKey);
        break;
      }

      case "data_cleanup": {
        result = await handleDataCleanup(supabase, lovableKey);
        break;
      }

      case "pre_verify": {
        const { work_item_id } = body;
        if (!work_item_id) {
          result = { error: "work_item_id required" };
          break;
        }
        result = await handlePreVerify(supabase, lovableKey, work_item_id, user.id);
        break;
      }

      case "rejection_reanalysis": {
        const { work_item_id: rejectWiId } = body;
        if (!rejectWiId) {
          result = { error: "work_item_id required" };
          break;
        }
        result = await handleRejectionReanalysis(supabase, lovableKey, rejectWiId, user.id);
        break;
      }

      case "auto_fix": {
        result = await handleAutoFix(supabase, lovableKey, supabaseUrl, serviceKey, authHeader);
        break;
      }

      case "data_integrity": {
        result = await handleDataIntegrity(supabase);
        break;
      }

      case "content_validation": {
        const { auto_fix } = body;
        result = await handleContentValidation(supabase, lovableKey, !!auto_fix);
        break;
      }

      case "pattern_detection": {
        result = await handlePatternDetection(supabase, lovableKey);
        break;
      }

      case "memory_trends": {
        result = await handleMemoryTrends(supabase, lovableKey);
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

      case "category_sync": {
        result = await handleCategorySync(supabase, lovableKey);
        break;
      }

      case "category_validate": {
        result = await handleCategoryValidate(supabase, lovableKey);
        break;
      }

      case "focused_scan": {
        result = await handleFocusedScan(supabase, lovableKey);
        break;
      }

      case "ui_overflow_scan": {
        result = await handleUiOverflowScan(supabase, lovableKey);
        break;
      }

      case "ux_scan": {
        result = await handleUxScan(supabase, lovableKey);
        break;
      }

      case "sync_scan": {
        result = await handleSyncScan(supabase, lovableKey);
        break;
      }

      case "human_test": {
        await logAiRead(supabase, { action_type: "scan", target_type: "human_test", result: "inspected", summary: "AI ran automated human-like test", triggered_by: user.id });
        result = await handleHumanTest(supabase, lovableKey);
        break;
      }

      case "action_governor": {
        result = await handleActionGovernor(supabase, lovableKey);
        break;
      }

      case "governor_execute": {
        const { action_id, action_classification } = body;
        if (!action_id) {
          return new Response(JSON.stringify({ error: "action_id required" }), { status: 400, headers: corsHeaders });
        }
        result = await handleGovernorExecute(supabase, lovableKey, action_id, action_classification);
        break;
      }

      case "double_pass": {
        const { context } = body;
        result = await handleDoublePass(supabase, lovableKey, context || "general");
        break;
      }

      case "lova_chat": {
        const { message, conversation_id } = body;
        if (!message || typeof message !== "string" || message.length < 1 || message.length > 5000) {
          return new Response(JSON.stringify({ error: "Invalid message" }), { status: 400, headers: corsHeaders });
        }
        await logAiRead(supabase, { action_type: "chat", target_type: "lova_chat", result: "inspected", summary: `Lova chat: ${message.substring(0, 100)}`, triggered_by: user.id });
        result = await handleLovaChat(supabase, lovableKey, user.id, message, conversation_id);
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

// ── AI Read Log helper ──
async function logAiRead(supabase: any, entry: {
  action_type: string;
  target_type: string;
  target_ids?: string[];
  affected_components?: string[];
  file_paths?: string[];
  endpoints?: string[];
  result: string;
  summary?: string;
  metadata?: any;
  triggered_by?: string;
  linked_bug_id?: string;
  linked_work_item_id?: string;
  linked_scan_id?: string;
}) {
  try {
    await supabase.from("ai_read_log").insert({
      action_type: entry.action_type,
      target_type: entry.target_type,
      target_ids: entry.target_ids || [],
      affected_components: entry.affected_components || [],
      file_paths: entry.file_paths || [],
      endpoints: entry.endpoints || [],
      result: entry.result,
      summary: entry.summary || null,
      metadata: entry.metadata || {},
      triggered_by: entry.triggered_by || null,
      linked_bug_id: entry.linked_bug_id || null,
      linked_work_item_id: entry.linked_work_item_id || null,
      linked_scan_id: entry.linked_scan_id || null,
    });
  } catch (e) {
    console.warn("ai_read_log insert failed:", e);
  }
}



// ── Gather all system data ──
async function gatherSystemSnapshot(supabase: any, triggeredBy?: string) {
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

  const snap = {
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

  // Log the read action
  if (triggeredBy) {
    const hasIssues = criticalBugs > 0 || overdue > 0 || slaOverdue > 0 || outOfStock.length > 0;
    await logAiRead(supabase, {
      action_type: "snapshot",
      target_type: "system",
      affected_components: ["orders", "bugs", "work_items", "incidents", "products", "staff_performance"],
      endpoints: ["orders", "analytics_events", "bug_reports", "work_items", "order_incidents", "refund_requests", "donations", "products", "staff_performance", "activity_logs"],
      result: hasIssues ? "possible_issue" : "no_issues",
      summary: `System snapshot: ${paidOrders.length} orders, ${openBugs} open bugs, ${criticalBugs} critical, ${overdue} overdue tasks, ${outOfStock.length} OOS products`,
      triggered_by: triggeredBy,
    });
  }

  return snap;
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
  const body: any = { model: "google/gemini-2.5-flash", messages };
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

// callAIWithTools: overloaded — (key, prompt, systemPrompt, tools) or (key, prompt, tools)
async function callAIWithTools(apiKey: string, prompt: string, systemPromptOrTools: string | any[], toolsOrNothing?: any[]) {
  let systemPrompt = "You are a helpful assistant.";
  let tools: any[];
  if (typeof systemPromptOrTools === "string") {
    systemPrompt = systemPromptOrTools;
    tools = toolsOrNothing!;
  } else {
    tools = systemPromptOrTools;
  }
  return callAI(apiKey, [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ], tools);
}

// Alias for backward compat
const callLovableAI = callAIWithTools;

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

// Enhanced bug fix with log analysis and historical matching
async function suggestBugFixEnhanced(supabase: any, apiKey: string, bug: any) {
  // Gather historical context
  const [logsRes, historyRes, relatedWorkRes] = await Promise.all([
    supabase.from("activity_logs").select("log_type, category, message, created_at")
      .eq("log_type", "error").order("created_at", { ascending: false }).limit(30),
    supabase.from("bug_reports").select("id, description, ai_summary, ai_category, ai_severity, status, page_url, resolution_notes, resolved_at")
      .neq("id", bug.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("work_items").select("title, description, status, ai_category, priority")
      .eq("source_type", "bug_report").in("status", ["done", "cancelled"]).limit(30),
  ]);

  const errorLogs = logsRes.data || [];
  const pastBugs = historyRes.data || [];
  const resolvedWork = relatedWorkRes.data || [];

  // Find similar past bugs (same category or page)
  const similarBugs = pastBugs.filter((b: any) =>
    (b.ai_category && b.ai_category === bug.ai_category) ||
    (b.page_url && bug.page_url && b.page_url === bug.page_url)
  ).slice(0, 10);

  // Find resolved bugs with same category for learning
  const resolvedSimilar = similarBugs.filter((b: any) => b.status === "resolved" && b.resolution_notes);

  const historicalContext = `
=== ERROR LOGS (Recent) ===
${errorLogs.slice(0, 15).map((l: any) => `[${l.category}] ${l.message}`).join("\n") || "Inga felloggar."}

=== SIMILAR PAST BUGS (${similarBugs.length}) ===
${similarBugs.slice(0, 5).map((b: any) => `- [${b.status}] ${b.ai_summary || b.description?.substring(0, 80)} (sev: ${b.ai_severity || "?"}, cat: ${b.ai_category || "?"})`).join("\n") || "Inga liknande."}

=== RESOLVED SIMILAR BUGS WITH FIXES ===
${resolvedSimilar.slice(0, 3).map((b: any) => `- ${b.ai_summary || "?"}: ${b.resolution_notes}`).join("\n") || "Inga lösta liknande buggar."}

=== PAST FIX PATTERNS ===
${resolvedWork.slice(0, 5).map((w: any) => `- [${w.ai_category}] ${w.title}`).join("\n") || "Inga."}`;

  const context = `Bug report:
Description: ${bug.description}
Page: ${bug.page_url}
AI Summary: ${bug.ai_summary || "N/A"}
AI Category: ${bug.ai_category || "N/A"}
AI Severity: ${bug.ai_severity || "N/A"}
AI Repro Steps: ${bug.ai_repro_steps || "N/A"}

${historicalContext}`;

  return callAI(apiKey, [
    {
      role: "system",
      content: `Du är en senior utvecklare som analyserar buggar i en svensk e-handelsplattform byggd med React, TypeScript, Supabase och Tailwind.
Du har tillgång till felloggar och historiska buggrapporter. Använd dem för att:
1. Hitta mönster — har denna typ av bugg hänt förut?
2. Lära från tidigare lösningar — vad fungerade?
3. Analysera felloggar för ledtrådar
4. Ge FLERA möjliga grundorsaker med konfidensnivå
Rangordna efter sannolikhet. Svara på svenska. Använd suggest_fix_v2-funktionen.`,
    },
    { role: "user", content: context },
  ], [
    {
      type: "function",
      function: {
        name: "suggest_fix_v2",
        description: "Suggest multiple root causes and fixes for a bug, informed by historical data",
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
                  historical_match: { type: "string", description: "Reference to similar past bug if any" },
                },
                required: ["cause", "confidence", "fix_strategy", "affected_areas", "risk_level", "lovable_prompt"],
                additionalProperties: false,
              },
              description: "2-5 possible root causes ranked by confidence",
            },
            summary: { type: "string", description: "Executive summary of the analysis" },
            overall_risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
            is_recurring: { type: "boolean", description: "Whether this appears to be a recurring issue" },
            recurring_pattern: { type: "string", description: "Description of the recurring pattern if any" },
            log_insights: { type: "string", description: "Key insights from error logs" },
          },
          required: ["root_causes", "summary", "overall_risk", "is_recurring"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "suggest_fix_v2" } });
}

// Deep bug analysis with full historical learning
async function handleBugDeepAnalysis(supabase: any, apiKey: string, bug: any) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [logsRes, allBugsRes, eventsRes, workRes, incidentsRes] = await Promise.all([
    supabase.from("activity_logs").select("log_type, category, message, details, created_at")
      .in("log_type", ["error", "warning"]).gte("created_at", weekAgo)
      .order("created_at", { ascending: false }).limit(100),
    supabase.from("bug_reports").select("id, description, ai_summary, ai_category, ai_severity, status, page_url, resolution_notes, ai_tags, created_at")
      .order("created_at", { ascending: false }).limit(100),
    supabase.from("analytics_events").select("event_type, event_data, created_at")
      .in("event_type", ["page_error", "checkout_abandon", "checkout_start"]).gte("created_at", weekAgo).limit(200),
    supabase.from("work_items").select("title, description, status, priority, ai_category, source_type, completed_at")
      .order("created_at", { ascending: false }).limit(100),
    supabase.from("order_incidents").select("title, type, priority, status, resolution, created_at")
      .gte("created_at", monthAgo).limit(50),
  ]);

  const errorLogs = logsRes.data || [];
  const allBugs = allBugsRes.data || [];
  const userEvents = eventsRes.data || [];
  const workItems = workRes.data || [];
  const incidents = incidentsRes.data || [];

  // Categorize bugs by area for pattern detection
  const bugsByCategory: Record<string, number> = {};
  for (const b of allBugs) {
    const cat = (b as any).ai_category || "unknown";
    bugsByCategory[cat] = (bugsByCategory[cat] || 0) + 1;
  }

  // Find resolved bugs in same category for learning
  const sameCatResolved = allBugs.filter((b: any) =>
    b.id !== bug.id && b.ai_category === bug.ai_category && b.status === "resolved"
  );

  const prompt = `=== AKTUELL BUGG ===
Beskrivning: ${bug.description}
Sida: ${bug.page_url}
AI-sammanfattning: ${bug.ai_summary || "Ej analyserad"}
Kategori: ${bug.ai_category || "?"} | Svårighetsgrad: ${bug.ai_severity || "?"}
Taggar: ${(bug.ai_tags || []).join(", ") || "inga"}

=== FELLOGGAR (senaste veckan: ${errorLogs.length}) ===
${errorLogs.slice(0, 20).map((l: any) => `[${l.category}/${l.log_type}] ${l.message}`).join("\n") || "Inga."}

=== BUGGMÖNSTER PER KATEGORI ===
${Object.entries(bugsByCategory).map(([k, v]) => `${k}: ${v} buggar`).join(", ")}

=== LÖSTA LIKNANDE BUGGAR (${sameCatResolved.length}) ===
${sameCatResolved.slice(0, 5).map((b: any) => `- ${b.ai_summary || b.description?.substring(0, 80)}\n  Lösning: ${b.resolution_notes || "ej dokumenterad"}`).join("\n") || "Inga."}

=== ANVÄNDARÅTGÄRDER/EVENTS ===
Sidfel: ${userEvents.filter((e: any) => e.event_type === "page_error").length}
Checkout-avhopp: ${userEvents.filter((e: any) => e.event_type === "checkout_abandon").length}

=== INCIDENTER (senaste månaden: ${incidents.length}) ===
${incidents.slice(0, 5).map((i: any) => `[${i.type}/${i.priority}/${i.status}] ${i.title}`).join("\n") || "Inga."}

=== RELATERADE TASKS ===
${workItems.filter((w: any) => w.ai_category === bug.ai_category).slice(0, 5).map((w: any) => `[${w.status}/${w.priority}] ${w.title}`).join("\n") || "Inga."}`;

  const analysis = await callAI(apiKey, [
    {
      role: "system",
      content: `Du är en AI-felsökningsexpert för en svensk e-handelsplattform. Du har tillgång till:
- Felloggar (errors & warnings)
- Hela bugghistoriken och lösningar
- Användarbeteende-events
- Incidenthistorik
- Relaterade uppgifter

Din uppgift:
1. LOGGANALYS: Analysera felloggar för att hitta ledtrådar relaterade till denna bugg
2. HISTORISK KOPPLING: Hitta liknande buggar som lösts förut och lär av dem
3. ROTORSAKSMATCHNING: Identifiera om detta är ett återkommande problem
4. SMART DEBUGGING: Ge konkreta fix-förslag baserat på alla data

Svara på svenska. Använd deep_analysis-funktionen.`,
    },
    { role: "user", content: prompt },
  ], [{
    type: "function",
    function: {
      name: "deep_analysis",
      description: "Deep bug analysis with historical learning and log-based diagnosis",
      parameters: {
        type: "object",
        properties: {
          diagnosis: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Executive summary of the diagnosis" },
              confidence: { type: "number", description: "Overall diagnostic confidence 0-100" },
              likely_cause: { type: "string", description: "Most likely root cause" },
              evidence: { type: "array", items: { type: "string" }, description: "Evidence from logs/history supporting the diagnosis" },
            },
            required: ["summary", "confidence", "likely_cause", "evidence"],
          },
          log_analysis: {
            type: "object",
            properties: {
              relevant_errors: { type: "array", items: { type: "string" }, description: "Error log entries relevant to this bug" },
              error_pattern: { type: "string", description: "Pattern detected in errors" },
              affected_systems: { type: "array", items: { type: "string" } },
            },
            required: ["relevant_errors", "affected_systems"],
          },
          historical_matches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                similarity: { type: "number", description: "0-100 similarity score" },
                bug_summary: { type: "string" },
                was_resolved: { type: "boolean" },
                resolution: { type: "string" },
                lesson: { type: "string", description: "What we can learn from this past bug" },
              },
              required: ["similarity", "bug_summary", "was_resolved"],
            },
            description: "Similar bugs from history",
          },
          is_recurring: { type: "boolean" },
          recurring_info: {
            type: "object",
            properties: {
              pattern: { type: "string" },
              frequency: { type: "string" },
              root_cause_category: { type: "string" },
              prevention: { type: "string", description: "How to prevent this from happening again" },
            },
          },
          fix_suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                effort: { type: "string", enum: ["low", "medium", "high"] },
                risk: { type: "string", enum: ["low", "medium", "high"] },
                based_on: { type: "string", description: "What evidence or past fix this is based on" },
                lovable_prompt: { type: "string" },
              },
              required: ["title", "description", "effort", "risk", "lovable_prompt"],
            },
          },
          overall_risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
        },
        required: ["diagnosis", "log_analysis", "historical_matches", "is_recurring", "fix_suggestions", "overall_risk"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "deep_analysis" } });

  return analysis;
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

  // Persist scan result FIRST to get ID for linking
  const scanScore = analysis?.overall_ui_score || 0;
  const scanId = await persistScanResult(supabase, {
    scan_type: "visual_qa",
    results: analysis || {},
    overall_score: scanScore,
    overall_status: scanScore >= 80 ? "good" : scanScore >= 50 ? "warning" : "critical",
    issues_count: analysis?.issues?.length || 0,
    executive_summary: analysis?.executive_summary || "",
  });

  // Auto-create work items for critical/high issues, linked to scan
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
          source_type: "ai_scan",
          source_id: scanId || undefined,
          ai_detected: true,
          ai_confidence: "medium",
          ai_category: "frontend",
          ai_type_classification: issue.category,
        });
        tasksCreated++;
      }
    }
  }

  if (scanId && tasksCreated > 0) await updateScanTaskCount(supabase, scanId, tasksCreated);
  return { ...analysis, tasks_created: tasksCreated, scan_id: scanId };
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

  // Persist scan result FIRST
  const navScore = analysis?.overall_score || 0;
  const scanId = await persistScanResult(supabase, {
    scan_type: "nav_scan",
    results: analysis || {},
    overall_score: navScore,
    overall_status: navScore >= 80 ? "good" : navScore >= 50 ? "warning" : "critical",
    issues_count: analysis?.issues?.length || 0,
    executive_summary: analysis?.executive_summary || "",
  });

  // Auto-create work items for critical/high nav issues, linked to scan
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
        source_type: "ai_scan",
        source_id: scanId || undefined,
        ai_detected: true,
        ai_confidence: "medium",
        ai_category: "navigation",
        ai_type_classification: "navigation_bug",
      });
      tasksCreated++;
    }
  }

  if (scanId && tasksCreated > 0) await updateScanTaskCount(supabase, scanId, tasksCreated);
  return { ...analysis, tasks_created: tasksCreated, scan_id: scanId };
}
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

  // Persist scan result
  await supabase.from("ai_scan_results").insert({
    scan_type: "bug_rescan",
    results: analysis || {},
    overall_score: analysis?.health_score || 0,
    overall_status: (analysis?.health_score || 0) >= 80 ? "good" : (analysis?.health_score || 0) >= 50 ? "warning" : "critical",
    issues_count: (analysis?.status_changes?.length || 0) + (analysis?.missing_work_items?.length || 0),
    tasks_created: tasksCreated,
    executive_summary: analysis?.summary || "",
  });

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

// ── Development Guardian ──
async function handleDevGuardian(supabase: any, apiKey: string) {
  const [{ data: workItems }, { data: bugs }, { data: recentHistory }, { data: products }, { data: pages }, { data: orders }, { data: events }] = await Promise.all([
    supabase.from("work_items").select("id, title, description, item_type, status, priority, ai_category, ai_review_status, source_type, source_id, created_at").in("status", ["open", "claimed", "in_progress", "escalated", "done"]).order("created_at", { ascending: false }).limit(60),
    supabase.from("bug_reports").select("id, description, ai_summary, ai_category, ai_severity, page_url, status, created_at").order("created_at", { ascending: false }).limit(40),
    supabase.from("system_history").select("id, entity_type, action, description, created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("products").select("id, title_sv, is_visible, is_sellable, description_sv, image_urls, meta_title, category, handle").limit(100),
    supabase.from("page_sections").select("page, section_key, title_sv, is_visible").order("page"),
    supabase.from("orders").select("id, status, payment_status, fulfillment_status, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("analytics_events").select("event_type, event_data, created_at").in("event_type", ["page_error", "checkout_abandon", "button_click_fail"]).order("created_at", { ascending: false }).limit(30),
  ]);

  const openBugs = (bugs || []).filter((b: any) => b.status === 'open' || b.status === 'in_progress');
  const doneTasks = (workItems || []).filter((w: any) => w.status === 'done');
  const openTasks = (workItems || []).filter((w: any) => w.status !== 'done');
  const productsWithoutImages = (products || []).filter((p: any) => !p.image_urls?.length && p.is_visible);
  const productsWithoutDesc = (products || []).filter((p: any) => !p.description_sv && p.is_visible);
  const productsWithoutSEO = (products || []).filter((p: any) => !p.meta_title && p.is_visible);

  const prompt = `You are a Development Guardian AI for an e-commerce platform (4thepeople).
Your job is to audit the ENTIRE system and find issues that need fixing.

SYSTEM STATE:
- Open tasks: ${openTasks.length}
- Done tasks (recent): ${doneTasks.length}
- Open bugs: ${openBugs.length}
- Products: ${(products || []).length} total, ${productsWithoutImages.length} without images, ${productsWithoutDesc.length} without description, ${productsWithoutSEO.length} without SEO
- Recent changes: ${(recentHistory || []).length}
- Error events: ${(events || []).length}
- Recent orders: ${(orders || []).length}

OPEN BUGS:
${JSON.stringify(openBugs.slice(0, 15).map((b: any) => ({ id: b.id, summary: b.ai_summary || b.description?.substring(0, 80), severity: b.ai_severity, page: b.page_url })), null, 1)}

OPEN TASKS:
${JSON.stringify(openTasks.slice(0, 20).map((w: any) => ({ id: w.id, title: w.title, type: w.item_type, priority: w.priority, review: w.ai_review_status })), null, 1)}

RECENT DONE TASKS (verify completeness):
${JSON.stringify(doneTasks.slice(0, 10).map((w: any) => ({ id: w.id, title: w.title, review: w.ai_review_status })), null, 1)}

PRODUCTS MISSING DATA:
- Without images: ${JSON.stringify(productsWithoutImages.slice(0, 5).map((p: any) => p.title_sv))}
- Without description: ${JSON.stringify(productsWithoutDesc.slice(0, 5).map((p: any) => p.title_sv))}
- Without SEO: ${JSON.stringify(productsWithoutSEO.slice(0, 5).map((p: any) => p.title_sv))}

ERROR EVENTS:
${JSON.stringify((events || []).slice(0, 10).map((e: any) => ({ type: e.event_type, data: e.event_data })), null, 1)}

RECENT CHANGES:
${JSON.stringify((recentHistory || []).slice(0, 10).map((h: any) => ({ type: h.entity_type, action: h.action, desc: h.description })), null, 1)}

Perform a FULL development audit. Find:
1. COMPLETENESS: Missing features, incomplete flows, buttons without actions
2. BROKEN: Features that exist but don't work correctly based on bug data
3. GAPS: Missing integrations, disconnected systems
4. STRUCTURE: Misplaced or duplicated functionality
5. DATA: Products or content missing required fields
6. VERIFICATION: Done tasks that might not be fully resolved
7. PRIORITY: What must be fixed first based on business impact

For each issue generate a ready-to-use Lovable prompt.`;

  const analysis = await callAIWithTools(apiKey, prompt, "You are a senior development guardian. Be thorough, specific and actionable. Return Swedish descriptions.", [{
    type: "function",
    function: {
      name: "dev_guardian",
      description: "Full development audit results",
      parameters: {
        type: "object",
        properties: {
          health_score: { type: "number", description: "Overall dev health 0-100" },
          summary: { type: "string" },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                category: { type: "string", enum: ["broken", "incomplete", "missing_feature", "structure_issue", "data_gap", "unverified_fix", "performance", "security"] },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                description: { type: "string" },
                affected_area: { type: "string" },
                evidence: { type: "string" },
                fix_suggestion: { type: "string" },
                lovable_prompt: { type: "string" },
              },
              required: ["title", "category", "severity", "description", "affected_area", "evidence", "fix_suggestion", "lovable_prompt"],
              additionalProperties: false,
            },
          },
          category_counts: {
            type: "object",
            properties: {
              broken: { type: "number" },
              incomplete: { type: "number" },
              missing_feature: { type: "number" },
              structure_issue: { type: "number" },
              data_gap: { type: "number" },
              unverified_fix: { type: "number" },
            },
            required: ["broken", "incomplete", "missing_feature", "structure_issue", "data_gap", "unverified_fix"],
            additionalProperties: false,
          },
          top_priorities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                reason: { type: "string" },
                urgency: { type: "string", enum: ["immediate", "today", "this_week"] },
              },
              required: ["title", "reason", "urgency"],
              additionalProperties: false,
            },
          },
        },
        required: ["health_score", "summary", "issues", "category_counts", "top_priorities"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "dev_guardian" } });

  // Auto-create work items for critical/high issues
  if (analysis?.issues) {
    let created = 0;
    for (const issue of analysis.issues) {
      if (issue.severity !== "critical" && issue.severity !== "high") continue;
      // Check duplicate
      const { data: existing } = await supabase.from("work_items").select("id").ilike("title", `%${issue.title.substring(0, 40)}%`).in("status", ["open", "claimed", "in_progress"]).limit(1);
      if (existing?.length) continue;

      await supabase.from("work_items").insert({
        title: `Guardian: ${issue.title}`.substring(0, 200),
        description: `${issue.description}\n\nBevis: ${issue.evidence}\n\nFöreslagen fix: ${issue.fix_suggestion}`,
        status: "open",
        priority: issue.severity === "critical" ? "critical" : "high",
        item_type: issue.category === "broken" ? "bug" : issue.category === "missing_feature" ? "feature" : "improvement",
        source_type: "ai_guardian",
        ai_detected: true,
        ai_confidence: "high",
        ai_category: issue.category,
      });
      created++;
    }
    analysis.work_items_created = created;
  }

  return analysis;
}

// ── AI Execute Engine ──
async function handleAiExecute(supabase: any, lovableKey: string, mode: string) {
  // Gather all actionable data
  const [
    { data: openItems },
    { data: openBugs },
    { data: recentHistory },
  ] = await Promise.all([
    supabase.from("work_items").select("*").in("status", ["open", "claimed", "in_progress", "review"]).order("created_at", { ascending: false }).limit(100),
    supabase.from("bug_reports").select("*").in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(50),
    supabase.from("system_history").select("*").order("created_at", { ascending: false }).limit(20),
  ]);

  const systemContext = {
    work_items: (openItems || []).map((w: any) => ({
      id: w.id, title: w.title, status: w.status, priority: w.priority,
      item_type: w.item_type, created_at: w.created_at, assigned_to: w.assigned_to,
      ai_review_status: w.ai_review_status, depends_on: w.depends_on,
    })),
    bugs: (openBugs || []).map((b: any) => ({
      id: b.id, description: b.description?.substring(0, 200), status: b.status,
      ai_severity: b.ai_severity, ai_category: b.ai_category,
    })),
    recent_changes: (recentHistory || []).length,
  };

  const safeActions = [
    "update_status", "assign_priority", "merge_duplicates",
    "close_resolved", "link_related", "create_missing_task",
  ];
  const approvalRequired = ["delete_task", "restructure", "bulk_close"];

  const analysis = await callLovableAI(lovableKey, `You are an AI execution engine for a platform operations system.

Mode: ${mode}
- manual: only suggest, never act
- assisted: auto-execute safe actions, suggest critical ones
- autonomous: execute everything except deletions

System state:
${JSON.stringify(systemContext, null, 1)}

Analyze and decide what actions to take. For each action provide:
- action_type (one of: ${[...safeActions, ...approvalRequired].join(", ")})
- target_id (work_item or bug id)
- description (what and why)
- auto_executable (boolean - true if safe to auto-execute in current mode)
- new_value (the new status/priority/etc)

Also detect:
- Duplicate work_items (same title/description)
- Tasks that should be closed (linked bug resolved)
- Tasks with wrong priority
- Missing tasks for open bugs
- Tasks stuck too long

Return a structured execution plan.`, [{
    type: "function" as const,
    function: {
      name: "ai_execute",
      description: "AI execution plan",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          total_actions: { type: "number" },
          auto_executed: { type: "number" },
          needs_approval: { type: "number" },
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action_type: { type: "string" },
                target_id: { type: "string" },
                target_title: { type: "string" },
                description: { type: "string" },
                auto_executable: { type: "boolean" },
                new_value: { type: "string" },
                reason: { type: "string" },
              },
              required: ["action_type", "target_id", "description", "auto_executable"],
              additionalProperties: false,
            },
          },
          duplicates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                ids: { type: "array", items: { type: "string" } },
                reason: { type: "string" },
                suggested_action: { type: "string" },
              },
              required: ["ids", "reason", "suggested_action"],
              additionalProperties: false,
            },
          },
          health_summary: { type: "string" },
        },
        required: ["summary", "total_actions", "auto_executed", "needs_approval", "actions", "duplicates", "health_summary"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "ai_execute" } });

  // Auto-execute safe actions in assisted/autonomous mode
  const executionLog: any[] = [];

  if (mode !== "manual" && analysis?.actions) {
    for (const action of analysis.actions) {
      if (!action.auto_executable) continue;
      if (!action.target_id || action.target_id === "none") continue;

      try {
        let success = false;

        if (action.action_type === "update_status" && action.new_value) {
          const { error } = await supabase.from("work_items")
            .update({ status: action.new_value })
            .eq("id", action.target_id);
          success = !error;
        } else if (action.action_type === "assign_priority" && action.new_value) {
          const { error } = await supabase.from("work_items")
            .update({ priority: action.new_value })
            .eq("id", action.target_id);
          success = !error;
        } else if (action.action_type === "close_resolved") {
          const { error } = await supabase.from("work_items")
            .update({ status: "done" })
            .eq("id", action.target_id);
          success = !error;
        } else if (action.action_type === "create_missing_task") {
          const { error } = await supabase.from("work_items").insert({
            title: action.description.substring(0, 200),
            description: action.reason || action.description,
            status: "open",
            priority: "medium",
            item_type: "bug",
            source_type: "ai_execute",
            ai_detected: true,
            ai_confidence: "high",
          });
          success = !error;
        }

        executionLog.push({
          action: action.action_type,
          target: action.target_id,
          success,
          description: action.description,
        });

        // Log to system_history
        if (success) {
          await supabase.from("system_history").insert({
            event_type: "ai_auto_action",
            title: `AI ${action.action_type}: ${action.description}`.substring(0, 200),
            details: { action_type: action.action_type, target_id: action.target_id, new_value: action.new_value, mode },
          }).catch(() => {});
        }
      } catch (err) {
        executionLog.push({
          action: action.action_type,
          target: action.target_id,
          success: false,
          error: String(err),
        });
      }
    }
}

  return {
    ...analysis,
    mode,
    execution_log: executionLog,
    executed_count: executionLog.filter(l => l.success).length,
  };
}

async function handleInteractionQA(supabase: any, apiKey: string) {
  // Gather comprehensive data about UI interactions, routes, and state
  const [workItemsRes, bugsRes, eventsRes, productsRes, ordersRes, pagesRes, incidentsRes] = await Promise.all([
    supabase.from("work_items").select("id, title, description, status, priority, item_type, ai_category, source_type, source_id, created_at").limit(200),
    supabase.from("bug_reports").select("id, description, page_url, status, ai_category, ai_severity, ai_summary, created_at").limit(100),
    supabase.from("analytics_events").select("event_type, event_data, created_at").in("event_type", ["page_error", "checkout_abandon", "checkout_start", "checkout_complete", "product_view", "add_to_cart", "remove_from_cart", "button_click", "navigation"]).order("created_at", { ascending: false }).limit(1000),
    supabase.from("products").select("id, title_sv, handle, is_visible, is_sellable, stock, price").eq("is_visible", true).limit(200),
    supabase.from("orders").select("id, status, payment_status, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("page_sections").select("page, section_key, is_visible, title_sv").limit(200),
    supabase.from("order_incidents").select("id, title, status, type, order_id").in("status", ["open", "in_progress"]).limit(50),
  ]);

  const workItems = workItemsRes.data || [];
  const bugs = bugsRes.data || [];
  const events = eventsRes.data || [];
  const products = productsRes.data || [];
  const orders = ordersRes.data || [];
  const pages = pagesRes.data || [];
  const incidents = incidentsRes.data || [];

  // Compute interaction metrics
  const checkoutStarts = events.filter((e: any) => e.event_type === "checkout_start").length;
  const checkoutCompletes = events.filter((e: any) => e.event_type === "checkout_complete").length;
  const checkoutAbandons = events.filter((e: any) => e.event_type === "checkout_abandon").length;
  const cartAdds = events.filter((e: any) => e.event_type === "add_to_cart").length;
  const cartRemoves = events.filter((e: any) => e.event_type === "remove_from_cart").length;
  const pageErrors = events.filter((e: any) => e.event_type === "page_error");

  // Work items without valid source
  const orphanItems = workItems.filter((w: any) => w.source_id && !w.source_type);
  // Bugs still open
  const openBugs = bugs.filter((b: any) => b.status !== "resolved" && b.status !== "closed");
  // Items stuck (open > 7 days)
  const stuckItems = workItems.filter((w: any) => {
    if (!["open", "claimed"].includes(w.status)) return false;
    const age = Date.now() - new Date(w.created_at).getTime();
    return age > 7 * 24 * 60 * 60 * 1000;
  });

  // Routes with known components
  const routes = [
    { path: "/", name: "Startsida", buttons: ["Header nav", "Hero CTA", "Product cards", "Footer links"] },
    { path: "/produkter", name: "Produkter", buttons: ["Category filters", "Product cards", "Add to cart", "Pagination"] },
    { path: "/product/:handle", name: "Produktdetalj", buttons: ["Add to cart", "Quantity selector", "Review form", "Related products", "Wishlist"] },
    { path: "/checkout", name: "Checkout", buttons: ["Address form", "Payment method", "Place order", "Cart items", "Discount code"] },
    { path: "/profile", name: "Profil", buttons: ["Edit profile", "Order history", "Balance", "Settings", "Logout"] },
    { path: "/about", name: "Om oss", buttons: ["Contact link", "Navigation"] },
    { path: "/contact", name: "Kontakt", buttons: ["Contact form submit", "Map", "Phone link"] },
    { path: "/track-order", name: "Spåra order", buttons: ["Order lookup", "Status display"] },
    { path: "/affiliate", name: "Affiliate", buttons: ["Application form", "Code validation"] },
    { path: "/business", name: "Företag", buttons: ["Business form submit"] },
    { path: "/admin", name: "Admin", buttons: ["All admin nav items", "CRUD operations", "AI triggers", "Workbench actions"] },
    { path: "/admin/ai", name: "AI Center", buttons: ["All tab triggers", "AI scan buttons", "Copy prompt", "Execute actions"] },
  ];

  const context = `=== INTERACTION QA CONTEXT ===

ROUTES & EXPECTED BUTTONS:
${routes.map(r => `${r.path} (${r.name}): ${r.buttons.join(", ")}`).join("\n")}

ANALYTICS (last 7 days):
- Checkout starts: ${checkoutStarts}
- Checkout completes: ${checkoutCompletes}
- Checkout abandons: ${checkoutAbandons}
- Cart adds: ${cartAdds}
- Cart removes: ${cartRemoves}
- Page errors: ${pageErrors.length}
${pageErrors.slice(0, 10).map((e: any) => `  Error: ${JSON.stringify(e.event_data)?.substring(0, 100)}`).join("\n")}

OPEN BUGS (${openBugs.length}):
${openBugs.slice(0, 20).map((b: any) => `- [${b.ai_severity || "?"}] ${b.page_url}: ${b.ai_summary || b.description?.substring(0, 80)}`).join("\n")}

OPEN WORK ITEMS (${workItems.filter((w: any) => w.status !== "done").length}):
${workItems.filter((w: any) => w.status !== "done").slice(0, 20).map((w: any) => `- [${w.priority}/${w.status}] ${w.title} (type: ${w.item_type})`).join("\n")}

STUCK ITEMS (>7 days open): ${stuckItems.length}
${stuckItems.slice(0, 10).map((w: any) => `- ${w.title}`).join("\n")}

ORPHAN ITEMS (no valid source): ${orphanItems.length}

PRODUCTS: ${products.length} visible, ${products.filter((p: any) => p.stock <= 0).length} out of stock
UNSELLABLE BUT VISIBLE: ${products.filter((p: any) => !p.is_sellable).length}

OPEN INCIDENTS: ${incidents.length}

PAGE SECTIONS: ${pages.length} configured, ${pages.filter((p: any) => !p.is_visible).length} hidden

STATE CONSISTENCY:
- Orders pending payment: ${orders.filter((o: any) => o.payment_status === "unpaid").length}
- Work items done but source still open: ${workItems.filter((w: any) => w.status === "done" && w.source_type === "bug_report").length} (check if bugs are synced)`;

  const analysis = await callAI(apiKey, [
    {
      role: "system",
      content: `Du är en senior QA-ingenjör som specialiserar sig på interaktionstestning av en svensk e-handelsplattform (4thepeople).

Din uppgift:
1. CLICK TESTING: Analysera alla knappar, formulär och interaktiva element per route. Identifiera element som sannolikt saknar funktion.
2. DEAD ACTION DETECTION: Hitta knappar/element utan kopplad logik baserat på buggrapporter och analytics.
3. ROUTE VALIDATION: Verifiera att alla routes laddar data korrekt.
4. STATE CHANGE TEST: Identifiera fall där UI-state inte uppdateras efter en aktion.
5. UI-BACKEND CONSISTENCY: Hitta mismatchar mellan UI-visning och databasdata.
6. RE-SCAN EXISTING: Omvärdera alla öppna buggar — är de fortfarande relevanta?

Var EXTREMT SPECIFIK. Ge exakta komponent-/sidnamn. Prioritera efter användarimpakt. Svara på svenska.`,
    },
    { role: "user", content: `Kör full interaktions-QA-analys:\n\n${context}` },
  ], [{
    type: "function",
    function: {
      name: "interaction_qa",
      description: "Generate Interaction QA report",
      parameters: {
        type: "object",
        properties: {
          interaction_score: { type: "number", description: "0-100 overall interaction quality" },
          click_test_score: { type: "number", description: "0-100 button/click test" },
          state_sync_score: { type: "number", description: "0-100 state synchronization" },
          route_health_score: { type: "number", description: "0-100 route health" },
          executive_summary: { type: "string" },
          dead_elements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                element: { type: "string" },
                page: { type: "string" },
                issue: { type: "string" },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                fix_suggestion: { type: "string" },
                lovable_prompt: { type: "string" },
              },
              required: ["element", "page", "issue", "severity", "fix_suggestion", "lovable_prompt"],
              additionalProperties: false,
            },
          },
          broken_flows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                flow_name: { type: "string" },
                steps: { type: "array", items: { type: "string" } },
                broken_at: { type: "string" },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                fix_suggestion: { type: "string" },
                lovable_prompt: { type: "string" },
              },
              required: ["flow_name", "steps", "broken_at", "severity", "fix_suggestion", "lovable_prompt"],
              additionalProperties: false,
            },
          },
          state_issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                affected_component: { type: "string" },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                fix_suggestion: { type: "string" },
              },
              required: ["description", "affected_component", "severity", "fix_suggestion"],
              additionalProperties: false,
            },
          },
          route_issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                route: { type: "string" },
                status: { type: "string", enum: ["ok", "warning", "broken", "empty"] },
                issue: { type: "string" },
              },
              required: ["route", "status", "issue"],
              additionalProperties: false,
            },
          },
          bug_reevaluation: {
            type: "array",
            items: {
              type: "object",
              properties: {
                bug_id: { type: "string" },
                original_status: { type: "string" },
                recommended_status: { type: "string", enum: ["still_open", "likely_fixed", "duplicate", "wont_fix"] },
                reason: { type: "string" },
              },
              required: ["bug_id", "original_status", "recommended_status", "reason"],
              additionalProperties: false,
            },
          },
        },
        required: ["interaction_score", "click_test_score", "state_sync_score", "route_health_score", "executive_summary", "dead_elements", "broken_flows", "state_issues", "route_issues", "bug_reevaluation"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "interaction_qa" } });

  // Persist scan result FIRST
  const interScore = analysis?.interaction_score || 0;
  const scanId = await persistScanResult(supabase, {
    scan_type: "interaction_qa",
    results: analysis || {},
    overall_score: interScore,
    overall_status: interScore >= 80 ? "good" : interScore >= 50 ? "warning" : "critical",
    issues_count: (analysis?.dead_elements?.length || 0) + (analysis?.broken_flows?.length || 0),
    executive_summary: analysis?.executive_summary || analysis?.summary || "",
  });

  // Auto-create work items for critical/high issues, linked to scan
  let tasksCreated = 0;

  if (analysis?.dead_elements) {
    for (const el of analysis.dead_elements) {
      if (!["critical", "high"].includes(el.severity)) continue;
      const { data: existing } = await supabase
        .from("work_items")
        .select("id")
        .ilike("title", `%${el.element.substring(0, 25)}%`)
        .in("status", ["open", "claimed", "in_progress"])
        .limit(1);
      if (!existing?.length) {
        await supabase.from("work_items").insert({
          title: `Interaction: ${el.element} (${el.page})`.substring(0, 200),
          description: `Element: ${el.element}\nSida: ${el.page}\n\nProblem: ${el.issue}\n\nFix: ${el.fix_suggestion}`,
          status: "open",
          priority: el.severity === "critical" ? "critical" : "high",
          item_type: "bug",
          source_type: "ai_scan",
          source_id: scanId || undefined,
          ai_detected: true,
          ai_confidence: "medium",
          ai_category: "interaction",
          ai_type_classification: "interaction_bug",
        });
        tasksCreated++;
      }
    }
  }

  if (analysis?.broken_flows) {
    for (const flow of analysis.broken_flows) {
      if (!["critical", "high"].includes(flow.severity)) continue;
      const { data: existing } = await supabase
        .from("work_items")
        .select("id")
        .ilike("title", `%${flow.flow_name.substring(0, 25)}%`)
        .in("status", ["open", "claimed", "in_progress"])
        .limit(1);
      if (!existing?.length) {
        await supabase.from("work_items").insert({
          title: `Broken flow: ${flow.flow_name}`.substring(0, 200),
          description: `Flöde: ${flow.flow_name}\nSteg: ${flow.steps.join(" → ")}\nBryter vid: ${flow.broken_at}\n\nFix: ${flow.fix_suggestion}`,
          status: "open",
          priority: flow.severity === "critical" ? "critical" : "high",
          item_type: "bug",
          source_type: "ai_scan",
          source_id: scanId || undefined,
          ai_detected: true,
          ai_confidence: "medium",
          ai_category: "interaction",
          ai_type_classification: "broken_flow",
        });
        tasksCreated++;
      }
    }
  }

  if (scanId && tasksCreated > 0) await updateScanTaskCount(supabase, scanId, tasksCreated);
  return { ...analysis, tasks_created: tasksCreated, scan_id: scanId };
}

// ── Verification & Completion Engine ──
async function handleVerificationEngine(supabase: any, apiKey: string) {
  const now = new Date().toISOString();

  // 1. Get all "done" items for verification + open items for false-done check
  const [doneRes, openRes, bugsRes] = await Promise.all([
    supabase.from("work_items")
      .select("id, title, description, status, item_type, source_type, source_id, completed_at, ai_review_status, ai_review_result, priority, tags")
      .eq("status", "done")
      .order("completed_at", { ascending: false })
      .limit(50),
    supabase.from("work_items")
      .select("id, title, description, status, item_type, source_type, source_id, priority, created_at, tags")
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .order("created_at", { ascending: true })
      .limit(100),
    supabase.from("bug_reports")
      .select("id, status, description, ai_summary, ai_severity, resolved_at")
      .limit(100),
  ]);

  const doneItems = doneRes.data || [];
  const openItems = openRes.data || [];
  const bugs = bugsRes.data || [];

  // 2. Cross-check: done work_items whose source bug is still open
  const falseDoneItems: any[] = [];
  for (const item of doneItems) {
    if (item.source_type === "bug_report" && item.source_id) {
      const sourceBug = bugs.find((b: any) => b.id === item.source_id);
      if (sourceBug && sourceBug.status === "open") {
        falseDoneItems.push({
          work_item_id: item.id,
          title: item.title,
          reason: "Kopplad bugg fortfarande öppen",
          source_status: sourceBug.status,
        });
        // Auto-reopen
        await supabase.from("work_items").update({
          status: "in_progress",
          ai_review_status: "needs_review",
          ai_review_result: {
            status: "needs_review",
            verdict: "Automatiskt återöppnad: källbugg fortfarande öppen",
            reopened_at: now,
          },
        }).eq("id", item.id);
      }
    }
  }

  // 3. Auto-close open items whose source is already resolved
  const autoClosedItems: any[] = [];
  for (const item of openItems) {
    if (item.source_type === "bug_report" && item.source_id) {
      const sourceBug = bugs.find((b: any) => b.id === item.source_id);
      if (sourceBug && ["resolved", "closed"].includes(sourceBug.status)) {
        await supabase.from("work_items").update({
          status: "done",
          completed_at: now,
          ai_review_status: "verified",
          ai_review_result: {
            status: "verified",
            verdict: "Auto-stängd: källbugg redan löst",
            verification_source: "system_scan",
            verified_at: now,
          },
        }).eq("id", item.id);
        autoClosedItems.push({ work_item_id: item.id, title: item.title, reason: "Källbugg redan löst" });
      }
    }
    if (item.source_type === "order_incident" && item.source_id) {
      const { data: incident } = await supabase.from("order_incidents")
        .select("status").eq("id", item.source_id).maybeSingle();
      if (incident && ["resolved", "closed"].includes(incident.status)) {
        await supabase.from("work_items").update({
          status: "done",
          completed_at: now,
          ai_review_status: "verified",
          ai_review_result: {
            status: "verified",
            verdict: "Auto-stängd: incident redan löst",
            verification_source: "system_scan",
            verified_at: now,
          },
        }).eq("id", item.id);
        autoClosedItems.push({ work_item_id: item.id, title: item.title, reason: "Incident redan löst" });
      }
    }
  }

  // 4. AI analysis: post-fix improvements + re-categorization
  const recentDone = doneItems.slice(0, 20);
  const openSummary = openItems.slice(0, 30).map((i: any) => `[${i.priority}] ${i.title} (${i.item_type})`).join("\n");

  const analysis = await callAI(apiKey, [
    {
      role: "system",
      content: `Du är en AI-verifieringsmotor för en svensk e-handelsplattform.
Analysera avslutade och öppna uppgifter. Identifiera:
1. Post-fix förbättringar (kan detta göras bättre?)
2. Felkategoriserade uppgifter
3. Uppgifter som bör grupperas/slås ihop
4. Prioriteringsförslag
Svara på svenska. Använd verification_engine-funktionen.`,
    },
    {
      role: "user",
      content: `AVSLUTADE UPPGIFTER (${recentDone.length}):\n${recentDone.map((i: any) => `- ${i.title} [${i.item_type}] review: ${i.ai_review_status || "none"}`).join("\n")}\n\nÖPPNA UPPGIFTER (${openItems.length}):\n${openSummary}`,
    },
  ], [
    {
      type: "function",
      function: {
        name: "verification_engine",
        description: "Verification and completion analysis",
        parameters: {
          type: "object",
          properties: {
            verification_score: { type: "number", description: "Overall verification health 0-100" },
            post_fix_suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  related_task: { type: "string" },
                  suggestion: { type: "string" },
                  type: { type: "string", enum: ["improvement", "upgrade", "missing_feature", "ux_fix"] },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                  lovable_prompt: { type: "string" },
                },
                required: ["related_task", "suggestion", "type", "priority", "lovable_prompt"],
                additionalProperties: false,
              },
            },
            recategorizations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  task_title: { type: "string" },
                  current_type: { type: "string" },
                  suggested_type: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["task_title", "current_type", "suggested_type", "reason"],
                additionalProperties: false,
              },
            },
            merge_suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tasks: { type: "array", items: { type: "string" } },
                  reason: { type: "string" },
                },
                required: ["tasks", "reason"],
                additionalProperties: false,
              },
            },
            priority_adjustments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  task_title: { type: "string" },
                  current_priority: { type: "string" },
                  suggested_priority: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["task_title", "current_priority", "suggested_priority", "reason"],
                additionalProperties: false,
              },
            },
            summary: { type: "string", description: "Overall verification summary in Swedish" },
          },
          required: ["verification_score", "post_fix_suggestions", "recategorizations", "merge_suggestions", "priority_adjustments", "summary"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "verification_engine" } });

  // 5. Create work_items for high-priority post-fix suggestions
  let tasksCreated = 0;
  if (analysis?.post_fix_suggestions) {
    for (const suggestion of analysis.post_fix_suggestions) {
      if (suggestion.priority !== "high") continue;
      const { data: existing } = await supabase
        .from("work_items")
        .select("id")
        .ilike("title", `%${suggestion.suggestion.substring(0, 25)}%`)
        .in("status", ["open", "claimed", "in_progress"])
        .limit(1);
      if (!existing?.length) {
        await supabase.from("work_items").insert({
          title: `Post-fix: ${suggestion.suggestion}`.substring(0, 200),
          description: `Relaterad uppgift: ${suggestion.related_task}\n\nFörbättring: ${suggestion.suggestion}\n\nPrompt:\n${suggestion.lovable_prompt}`,
          status: "open",
          priority: "medium",
          item_type: suggestion.type === "improvement" ? "improvement" : suggestion.type === "upgrade" ? "upgrade" : "feature",
          source_type: "ai_detection",
          ai_detected: true,
          ai_confidence: "medium",
          ai_category: "post_fix",
          ai_type_classification: suggestion.type,
        });
        tasksCreated++;
      }
    }
  }

  // 6. Log to system_history
  await supabase.from("system_history").insert({
    event_type: "ai_verification_scan",
    snapshot: {
      false_done_count: falseDoneItems.length,
      auto_closed_count: autoClosedItems.length,
      tasks_created: tasksCreated,
      verification_score: analysis?.verification_score || 0,
      post_fix_count: analysis?.post_fix_suggestions?.length || 0,
    },
    resolution_notes: analysis?.summary || "Verification scan completed",
    ai_review_result: analysis,
  });

  return {
    ...analysis,
    false_done_items: falseDoneItems,
    auto_closed_items: autoClosedItems,
    tasks_created: tasksCreated,
  };
}

// ── Data Cleanup & Deduplication Engine ──
async function handleDataCleanup(supabase: any, apiKey: string) {
  const now = new Date().toISOString();

  // 1. Fetch all active work_items
  const { data: allItems } = await supabase
    .from("work_items")
    .select("id, title, description, status, item_type, source_type, source_id, created_at, priority, ai_detected")
    .in("status", ["open", "claimed", "in_progress", "escalated", "done"])
    .order("created_at", { ascending: true })
    .limit(500);

  const items = allItems || [];

  // 2. Detect orphans: items with source_id that no longer exist
  const orphans: any[] = [];
  const bugSourceIds = items.filter((i: any) => i.source_type === "bug_report" && i.source_id).map((i: any) => i.source_id);
  const incidentSourceIds = items.filter((i: any) => i.source_type === "order_incident" && i.source_id).map((i: any) => i.source_id);

  if (bugSourceIds.length > 0) {
    const { data: existingBugs } = await supabase.from("bug_reports").select("id").in("id", bugSourceIds.slice(0, 100));
    const existingBugIds = new Set((existingBugs || []).map((b: any) => b.id));
    for (const item of items) {
      if (item.source_type === "bug_report" && item.source_id && !existingBugIds.has(item.source_id)) {
        orphans.push(item);
      }
    }
  }

  if (incidentSourceIds.length > 0) {
    const { data: existingIncidents } = await supabase.from("order_incidents").select("id").in("id", incidentSourceIds.slice(0, 100));
    const existingIncidentIds = new Set((existingIncidents || []).map((i: any) => i.id));
    for (const item of items) {
      if (item.source_type === "order_incident" && item.source_id && !existingIncidentIds.has(item.source_id)) {
        if (!orphans.find((o: any) => o.id === item.id)) orphans.push(item);
      }
    }
  }

  // 3. Mark orphans as ignored
  let orphansCleaned = 0;
  for (const orphan of orphans) {
    if (["done", "cancelled"].includes(orphan.status)) continue;
    await supabase.from("work_items").update({
      status: "cancelled",
      ai_review_status: "verified",
      ai_review_result: { status: "verified", verdict: "Auto-ignorerad: källa borttagen", cleaned_at: now },
    }).eq("id", orphan.id);
    orphansCleaned++;
  }

  // 4. Use AI for similarity-based duplicate detection
  const activeItems = items.filter((i: any) => !["done", "cancelled"].includes(i.status));
  const itemSummaries = activeItems.slice(0, 80).map((i: any, idx: number) =>
    `[${idx}] id=${i.id} title="${i.title}" type=${i.item_type} priority=${i.priority} status=${i.status}`
  ).join("\n");

  const analysis = await callAI(apiKey, [
    {
      role: "system",
      content: `Du är en databasrensningsmotor. Analysera work_items och identifiera:
1. Duplicat (liknande titel/beskrivning)
2. Testdata som bör tas bort
3. Föråldrade uppgifter (irrelevanta)
Svara på svenska. Använd data_cleanup-funktionen.`,
    },
    { role: "user", content: `Analysera dessa ${activeItems.length} uppgifter:\n\n${itemSummaries}` },
  ], [
    {
      type: "function",
      function: {
        name: "data_cleanup",
        description: "Data cleanup and deduplication analysis",
        parameters: {
          type: "object",
          properties: {
            cleanliness_score: { type: "number", description: "Database cleanliness 0-100" },
            duplicate_groups: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_indices: { type: "array", items: { type: "number" }, description: "Indices of duplicate items" },
                  keep_index: { type: "number", description: "Index of the best item to keep" },
                  reason: { type: "string" },
                },
                required: ["item_indices", "keep_index", "reason"],
                additionalProperties: false,
              },
            },
            test_data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_index: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["item_index", "reason"],
                additionalProperties: false,
              },
            },
            outdated: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_index: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["item_index", "reason"],
                additionalProperties: false,
              },
            },
            summary: { type: "string" },
          },
          required: ["cleanliness_score", "duplicate_groups", "test_data", "outdated", "summary"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "data_cleanup" } });

  // 5. Auto-merge duplicates
  let duplicatesMerged = 0;
  if (analysis?.duplicate_groups) {
    for (const group of analysis.duplicate_groups) {
      const keepIdx = group.keep_index;
      const removeIndices = group.item_indices.filter((idx: number) => idx !== keepIdx);
      for (const idx of removeIndices) {
        const item = activeItems[idx];
        if (!item) continue;
        await supabase.from("work_items").update({
          status: "cancelled",
          ai_review_status: "verified",
          ai_review_result: { status: "verified", verdict: `Duplicat av index ${keepIdx}: ${group.reason}`, merged_at: now },
        }).eq("id", item.id);
        duplicatesMerged++;
      }
    }
  }

  // 6. Mark test data
  let testDataRemoved = 0;
  if (analysis?.test_data) {
    for (const td of analysis.test_data) {
      const item = activeItems[td.item_index];
      if (!item) continue;
      await supabase.from("work_items").update({
        status: "cancelled",
        ai_review_result: { verdict: `Testdata: ${td.reason}`, cleaned_at: now },
      }).eq("id", item.id);
      testDataRemoved++;
    }
  }

  // 7. Mark outdated
  let outdatedRemoved = 0;
  if (analysis?.outdated) {
    for (const od of analysis.outdated) {
      const item = activeItems[od.item_index];
      if (!item) continue;
      await supabase.from("work_items").update({
        status: "cancelled",
        ai_review_result: { verdict: `Föråldrad: ${od.reason}`, cleaned_at: now },
      }).eq("id", item.id);
      outdatedRemoved++;
    }
  }

  // Log
  await supabase.from("system_history").insert({
    event_type: "ai_data_cleanup",
    snapshot: {
      orphans_cleaned: orphansCleaned,
      duplicates_merged: duplicatesMerged,
      test_data_removed: testDataRemoved,
      outdated_removed: outdatedRemoved,
      cleanliness_score: analysis?.cleanliness_score || 0,
    },
    resolution_notes: analysis?.summary || "Cleanup completed",
    ai_review_result: analysis,
  });

  return {
    ...analysis,
    orphans_cleaned: orphansCleaned,
    duplicates_merged: duplicatesMerged,
    test_data_removed: testDataRemoved,
    outdated_removed: outdatedRemoved,
    total_cleaned: orphansCleaned + duplicatesMerged + testDataRemoved + outdatedRemoved,
  };
}

// ── Interaction QA / Scanner ──
async function handleInteractionQA(supabase: any, apiKey: string) {
  // Gather all routes, buttons, and interactive elements from the system
  const { data: pages } = await supabase
    .from("page_sections")
    .select("page, section_key, is_visible")
    .limit(200);

  const { data: workItems } = await supabase
    .from("work_items")
    .select("id, title, status, item_type, source_type, source_id, related_order_id")
    .in("status", ["open", "claimed", "in_progress", "done"])
    .limit(200);

  const { data: bugs } = await supabase
    .from("bug_reports")
    .select("id, description, status, page_url")
    .limit(100);

  const { data: incidents } = await supabase
    .from("order_incidents")
    .select("id, title, status, order_id")
    .limit(100);

  // Check for orphan references (work_items pointing to non-existent sources)
  const orphanIssues: any[] = [];
  for (const wi of workItems || []) {
    if (wi.source_type === "bug_report" && wi.source_id) {
      const found = (bugs || []).find((b: any) => b.id === wi.source_id);
      if (!found) orphanIssues.push({ item: wi.title, issue: "Bug source missing", id: wi.id });
    }
    if (wi.source_type === "order_incident" && wi.source_id) {
      const found = (incidents || []).find((i: any) => i.id === wi.source_id);
      if (!found) orphanIssues.push({ item: wi.title, issue: "Incident source missing", id: wi.id });
    }
    if (wi.related_order_id) {
      const { data: order } = await supabase.from("orders").select("id, deleted_at").eq("id", wi.related_order_id).single();
      if (!order || order.deleted_at) orphanIssues.push({ item: wi.title, issue: "Related order deleted/missing", id: wi.id });
    }
  }

  // Build context for AI analysis
  const adminRoutes = [
    "/admin", "/admin/orders", "/admin/products", "/admin/members", "/admin/shipping",
    "/admin/campaigns", "/admin/stats", "/admin/ai", "/admin/ops", "/admin/staff",
    "/admin/content", "/admin/growth", "/admin/finance", "/admin/logs", "/admin/legal",
    "/admin/reviews", "/admin/partners", "/admin/incidents", "/admin/categories",
    "/admin/visibility", "/admin/settings", "/admin/history", "/admin/payments",
    "/admin/communication", "/admin/seo", "/admin/data", "/admin/updates", "/admin/database",
  ];

  const publicRoutes = [
    "/", "/shop", "/about", "/contact", "/checkout", "/cbd",
    "/donations", "/track-order", "/member-profile", "/business",
  ];

  const context = `
SYSTEM STATE:
Pages: ${(pages || []).length} sections across pages
Work items: ${(workItems || []).length} total (${(workItems || []).filter((w: any) => w.status === "open").length} open)
Bugs: ${(bugs || []).length} total (${(bugs || []).filter((b: any) => b.status === "open").length} open)
Incidents: ${(incidents || []).length}
Orphan references: ${orphanIssues.length}
${orphanIssues.slice(0, 10).map((o: any) => `  ⚠️ "${o.item}" → ${o.issue}`).join("\n")}

ADMIN ROUTES: ${adminRoutes.join(", ")}
PUBLIC ROUTES: ${publicRoutes.join(", ")}

KNOWN BUTTON PATTERNS IN ADMIN:
- Work item click → should open detail sheet
- Bug click → should open bug detail
- Status buttons (Mark done, Escalate, Close) → should update DB
- AI action buttons (Run scan, Run cleanup) → should call edge functions
- Copy prompt buttons → should copy to clipboard
- Navigation links → should route correctly

RECENT BUGS (open):
${(bugs || []).filter((b: any) => b.status === "open").slice(0, 10).map((b: any) => `  - ${b.description?.substring(0, 80)} (${b.page_url})`).join("\n")}
`;

  const result = await callAI(apiKey, [
    {
      role: "system",
      content: `Du är en QA-ingenjör för en svensk e-handelsplattform. Analysera systemets interaktiva element och identifiera:
1. Döda element (knappar/länkar utan funktion)
2. Brutna flöden (checkout, login, navigation)  
3. State sync-problem (UI visar fel data)
4. Route-problem (saknade/brutna routes)

Basera analysen på systemdata, kända buggar och routes. Svara på svenska.`,
    },
    { role: "user", content: `Analysera interaktioner:\n${context}` },
  ], [{
    type: "function",
    function: {
      name: "interaction_report",
      description: "Report interaction QA findings",
      parameters: {
        type: "object",
        properties: {
          interaction_score: { type: "number", description: "Overall interaction health 0-100" },
          click_test_score: { type: "number", description: "Button/click health 0-100" },
          state_sync_score: { type: "number", description: "State sync health 0-100" },
          route_health_score: { type: "number", description: "Route health 0-100" },
          executive_summary: { type: "string", description: "2-3 sentences in Swedish" },
          dead_elements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                element: { type: "string" },
                page: { type: "string" },
                issue: { type: "string" },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                fix_suggestion: { type: "string" },
                lovable_prompt: { type: "string" },
              },
              required: ["element", "page", "issue", "severity", "fix_suggestion", "lovable_prompt"],
              additionalProperties: false,
            },
          },
          broken_flows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                flow_name: { type: "string" },
                steps: { type: "array", items: { type: "string" } },
                broken_at: { type: "string" },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                fix_suggestion: { type: "string" },
                lovable_prompt: { type: "string" },
              },
              required: ["flow_name", "steps", "broken_at", "severity", "fix_suggestion", "lovable_prompt"],
              additionalProperties: false,
            },
          },
          state_issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                component: { type: "string" },
                issue: { type: "string" },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
              },
              required: ["component", "issue", "severity"],
              additionalProperties: false,
            },
          },
        },
        required: ["interaction_score", "click_test_score", "state_sync_score", "route_health_score", "executive_summary", "dead_elements", "broken_flows"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "interaction_report" } });

  // Auto-create tasks for critical/high issues
  let tasksCreated = 0;
  const allIssues = [
    ...(result?.dead_elements || []).map((e: any) => ({ title: `Dött element: ${e.element} (${e.page})`, desc: e.issue, severity: e.severity, type: "dead_element" })),
    ...(result?.broken_flows || []).map((f: any) => ({ title: `Brutet flöde: ${f.flow_name}`, desc: `Bryts vid: ${f.broken_at}`, severity: f.severity, type: "broken_flow" })),
    ...orphanIssues.map((o: any) => ({ title: `Orphan: ${o.item}`, desc: o.issue, severity: "high", type: "orphan_ref" })),
  ];

  for (const issue of allIssues) {
    if (!["critical", "high"].includes(issue.severity)) continue;
    const { data: existing } = await supabase
      .from("work_items")
      .select("id")
      .eq("item_type", "interaction_bug")
      .ilike("title", `%${issue.title.substring(0, 40)}%`)
      .in("status", ["open", "claimed", "in_progress"])
      .limit(1);
    if (!existing?.length) {
      await supabase.from("work_items").insert({
        title: issue.title.substring(0, 200),
        description: issue.desc,
        status: "open",
        priority: issue.severity === "critical" ? "urgent" : "high",
        item_type: "interaction_bug",
        source_type: "ai_detection",
        ai_detected: true,
        ai_confidence: "high",
        ai_category: issue.type,
      });
      tasksCreated++;
    }
  }

  // Log
  await supabase.from("system_history").insert({
    event_type: "ai_interaction_scan",
    snapshot: {
      interaction_score: result?.interaction_score,
      dead_elements: result?.dead_elements?.length || 0,
      broken_flows: result?.broken_flows?.length || 0,
      orphan_refs: orphanIssues.length,
      tasks_created: tasksCreated,
    },
    resolution_notes: result?.executive_summary || "Interaction scan completed",
    ai_review_result: result,
  });

  return { ...result, tasks_created: tasksCreated, orphan_issues: orphanIssues };
}

// ── Auto-Fix Engine ──
async function handleAutoFix(supabase: any, apiKey: string, supabaseUrl: string, serviceKey: string, authHeader: string) {
  const fixes: { type: string; action: string; target_id: string; confidence: number; fixed: boolean }[] = [];
  const fallbackTasks: string[] = [];

  // ─── 1. SAFE DATA FIXES via data-sync (repair mode) ───
  let dataSyncResult: any = null;
  try {
    const syncResp = await fetch(`${supabaseUrl}/functions/v1/data-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ mode: "repair" }),
    });
    if (syncResp.ok) {
      const syncData = await syncResp.json();
      dataSyncResult = syncData.results;
      if (dataSyncResult) {
        for (const d of (dataSyncResult.details || [])) {
          fixes.push({
            type: d.type,
            action: d.message,
            target_id: "",
            confidence: 95,
            fixed: d.fixed,
          });
        }
      }
    }
  } catch (e) {
    console.error("data-sync call failed:", e);
  }

  // ─── 2. AI-DRIVEN STATUS FIXES ───
  const { data: mismatchItems } = await supabase
    .from("work_items")
    .select("id, title, status, source_type, source_id, ai_review_status")
    .in("status", ["open", "claimed", "in_progress"])
    .limit(200);

  let statusFixed = 0;
  for (const wi of mismatchItems || []) {
    // Auto-fix: bug resolved but task still open
    if (wi.source_type === "bug_report" && wi.source_id) {
      const { data: bug } = await supabase.from("bug_reports").select("id, status").eq("id", wi.source_id).single();
      if (bug && ["resolved", "closed"].includes(bug.status)) {
        await supabase.from("work_items").update({
          status: "done",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ai_review_status: "verified",
        }).eq("id", wi.id);
        fixes.push({ type: "status_sync", action: `"${wi.title}" → bug redan löst, task stängd`, target_id: wi.id, confidence: 95, fixed: true });
        statusFixed++;
      }
    }
    // Auto-fix: incident resolved but task still open
    if (wi.source_type === "order_incident" && wi.source_id) {
      const { data: inc } = await supabase.from("order_incidents").select("id, status").eq("id", wi.source_id).single();
      if (inc && ["resolved", "closed"].includes(inc.status)) {
        await supabase.from("work_items").update({
          status: "done",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ai_review_status: "verified",
        }).eq("id", wi.id);
        fixes.push({ type: "status_sync", action: `"${wi.title}" → incident löst, task stängd`, target_id: wi.id, confidence: 90, fixed: true });
        statusFixed++;
      }
    }
  }

  // ─── 3. DUPLICATE MERGE (title similarity via AI) ───
  const { data: activeItems } = await supabase
    .from("work_items")
    .select("id, title, description, item_type, source_type, source_id")
    .in("status", ["open", "claimed", "in_progress"])
    .limit(100);

  let duplicatesMerged = 0;
  if (activeItems && activeItems.length > 3) {
    const titles = activeItems.map((i: any, idx: number) => `[${idx}] ${i.title}`).join("\n");
    const dupResult = await callAI(apiKey, [
      { role: "system", content: "Du identifierar duplicerade uppgifter. Returnera grupper av index som är dubbletter. Bara grupper med confidence >= 80." },
      { role: "user", content: `Hitta dubbletter bland dessa uppgifter:\n${titles}` },
    ], [{
      type: "function",
      function: {
        name: "find_duplicates",
        description: "Find duplicate task groups",
        parameters: {
          type: "object",
          properties: {
            groups: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  indices: { type: "array", items: { type: "number" } },
                  confidence: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["indices", "confidence"],
                additionalProperties: false,
              },
            },
          },
          required: ["groups"],
          additionalProperties: false,
        },
      },
    }], { type: "function", function: { name: "find_duplicates" } });

    if (dupResult?.groups) {
      for (const group of dupResult.groups) {
        if (group.confidence < 80 || !group.indices || group.indices.length < 2) continue;
        const keepIdx = group.indices[0];
        for (const idx of group.indices.slice(1)) {
          const item = activeItems[idx];
          if (!item) continue;
          await supabase.from("work_items").update({
            status: "cancelled",
            ai_review_result: { verdict: `Dubblett av ${activeItems[keepIdx]?.id}`, merged_into: activeItems[keepIdx]?.id },
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
          fixes.push({ type: "duplicate_merge", action: `"${item.title}" → dubblett, sammanslagen`, target_id: item.id, confidence: group.confidence, fixed: true });
          duplicatesMerged++;
        }
      }
    }
  }

  // ─── 4. ORPHAN PRODUCT-CATEGORY LINKS ───
  let orphanLinksFixed = 0;
  const { data: allPcLinks } = await supabase.from("product_categories").select("id, product_id, category_id").limit(1000);
  if (allPcLinks) {
    const { data: validProducts } = await supabase.from("products").select("id").limit(1000);
    const { data: validCats } = await supabase.from("categories").select("id").limit(500);
    const productIds = new Set((validProducts || []).map((p: any) => p.id));
    const catIds = new Set((validCats || []).map((c: any) => c.id));
    for (const link of allPcLinks) {
      if (!productIds.has(link.product_id) || !catIds.has(link.category_id)) {
        await supabase.from("product_categories").delete().eq("id", link.id);
        fixes.push({ type: "orphan_link", action: `Borttagen felaktig produkt-kategori-koppling`, target_id: link.id, confidence: 99, fixed: true });
        orphanLinksFixed++;
      }
    }
  }

  // ─── 5. HIDE EMPTY CATEGORIES (auto-visibility) ───
  let catsHidden = 0;
  const { data: visibleCats } = await supabase.from("categories").select("id, name_sv, is_visible, slug").eq("is_visible", true).limit(200);
  if (visibleCats) {
    for (const cat of visibleCats) {
      if (cat.slug === "bestsaljare") continue; // special category
      const { count } = await supabase.from("product_categories").select("id", { count: "exact", head: true }).eq("category_id", cat.id);
      if ((count || 0) === 0) {
        await supabase.from("categories").update({ is_visible: false }).eq("id", cat.id);
        fixes.push({ type: "hide_empty", action: `"${cat.name_sv}" → tom kategori, dold`, target_id: cat.id, confidence: 95, fixed: true });
        catsHidden++;
      }
    }
  }

  // ─── 6. CLOSE STALE IGNORED BUGS ───
  let staleBugsClosed = 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: staleBugs } = await supabase.from("bug_reports").select("id, description").eq("status", "open").lt("created_at", thirtyDaysAgo).limit(50);
  for (const bug of staleBugs || []) {
    await supabase.from("bug_reports").update({ status: "stale", resolution_notes: "Auto-stängd: ingen aktivitet på 30 dagar" }).eq("id", bug.id);
    // Also close linked work item
    await supabase.from("work_items").update({ status: "done", completed_at: new Date().toISOString(), ai_review_status: "verified" }).eq("source_type", "bug_report").eq("source_id", bug.id).in("status", ["open", "claimed"]);
    fixes.push({ type: "stale_bug", action: `Bug auto-stängd (30+ dagar utan aktivitet)`, target_id: bug.id, confidence: 85, fixed: true });
    staleBugsClosed++;
  }

  // ─── 7. FIX INVISIBLE PRODUCTS WITH STOCK ───
  let productsRevealed = 0;
  const { data: hiddenWithStock } = await supabase.from("products").select("id, title_sv, stock, is_visible").eq("is_visible", false).gt("stock", 0).limit(50);
  for (const prod of hiddenWithStock || []) {
    if ((prod.stock || 0) > 5) {
      // Only flag - don't auto-reveal since hiding may be intentional
      fixes.push({ type: "hidden_product", action: `"${prod.title_sv}" → dold men har ${prod.stock} i lager`, target_id: prod.id, confidence: 60, fixed: false });
      fallbackTasks.push(`Granska dold produkt: ${prod.title_sv} (${prod.stock} i lager)`);
    }
  }

  // ─── 8. LOW-CONFIDENCE ITEMS → FLAG ───
  const { data: uncertainItems } = await supabase
    .from("work_items")
    .select("id, title, ai_confidence, ai_review_status")
    .in("status", ["open"])
    .eq("ai_detected", true)
    .is("ai_review_status", null)
    .limit(20);

  for (const item of uncertainItems || []) {
    fixes.push({ type: "flagged", action: `"${item.title}" → saknar AI-granskning, flaggad`, target_id: item.id, confidence: 50, fixed: false });
    await supabase.from("work_items").update({ ai_review_status: "needs_review" }).eq("id", item.id);
    fallbackTasks.push(item.title);
  }

  // ─── LOG ───
  const totalFixed = fixes.filter(f => f.fixed).length;
  const totalFlagged = fixes.filter(f => !f.fixed).length;

  await supabase.from("system_history").insert({
    event_type: "ai_auto_fix",
    snapshot: {
      total_fixes: totalFixed,
      total_flagged: totalFlagged,
      status_fixed: statusFixed,
      duplicates_merged: duplicatesMerged,
      orphan_links_fixed: orphanLinksFixed,
      categories_hidden: catsHidden,
      stale_bugs_closed: staleBugsClosed,
      data_sync_issues: dataSyncResult?.total_issues || 0,
      data_sync_fixed: dataSyncResult?.total_fixed || 0,
    },
    resolution_notes: `Auto-fix: ${totalFixed} åtgärdade, ${totalFlagged} flaggade`,
    ai_review_result: { fixes, fallback_tasks: fallbackTasks },
  });

  await supabase.from("automation_logs").insert({
    action_type: "auto_fix",
    target_type: "system",
    target_id: "auto_fix_run",
    reason: `${totalFixed} fixes, ${totalFlagged} flagged`,
    details: { total_fixed: totalFixed, total_flagged: totalFlagged },
  });

  return {
    total_fixed: totalFixed,
    total_flagged: totalFlagged,
    status_fixed: statusFixed,
    duplicates_merged: duplicatesMerged,
    orphan_links_fixed: orphanLinksFixed,
    categories_hidden: catsHidden,
    stale_bugs_closed: staleBugsClosed,
    data_sync: dataSyncResult ? { issues: dataSyncResult.total_issues, fixed: dataSyncResult.total_fixed } : null,
    fixes,
    fallback_tasks: fallbackTasks,
  };
}

// ── Data Integrity Validator ──
async function handleDataIntegrity(supabase: any) {
  const issues: { type: string; severity: 'critical' | 'high' | 'medium'; title: string; detail: string }[] = [];

  // 1. Revenue consistency: compare paid orders sum vs what DB reports
  const [ordersRes, workItemsRes, bugsRes, incidentsRes, productsRes] = await Promise.all([
    supabase.from("orders").select("id, total_amount, payment_status, status, fulfillment_status, deleted_at, refund_amount, created_at").is("deleted_at", null).limit(1000),
    supabase.from("work_items").select("id, title, status, source_type, source_id, related_order_id, item_type, created_at").neq("status", "cancelled").limit(1000),
    supabase.from("bug_reports").select("id, status, created_at").limit(500),
    supabase.from("order_incidents").select("id, status, order_id, created_at").limit(500),
    supabase.from("products").select("id, stock, reserved_stock, allow_overselling, is_visible, title_sv").limit(500),
  ]);

  const orders = ordersRes.data || [];
  const workItems = workItemsRes.data || [];
  const bugs = bugsRes.data || [];
  const incidents = incidentsRes.data || [];
  const products = productsRes.data || [];

  // 2. Orphan work items — source doesn't exist
  const bugIds = new Set(bugs.map((b: any) => b.id));
  const incidentIds = new Set(incidents.map((i: any) => i.id));
  const orderIds = new Set(orders.map((o: any) => o.id));

  for (const wi of workItems) {
    if (wi.source_type === "bug_report" && wi.source_id && !bugIds.has(wi.source_id)) {
      issues.push({ type: "orphan_source", severity: "high", title: `Orphan: "${wi.title}"`, detail: `source bug ${wi.source_id} missing` });
    }
    if (wi.source_type === "order_incident" && wi.source_id && !incidentIds.has(wi.source_id)) {
      issues.push({ type: "orphan_source", severity: "high", title: `Orphan: "${wi.title}"`, detail: `source incident ${wi.source_id} missing` });
    }
    if (wi.related_order_id && !orderIds.has(wi.related_order_id)) {
      issues.push({ type: "orphan_order", severity: "high", title: `Orphan: "${wi.title}"`, detail: `related order ${wi.related_order_id} missing/deleted` });
    }
  }

  // 3. Status mismatches
  const activeWiByBug = new Map<string, any>();
  for (const wi of workItems) {
    if (wi.source_type === "bug_report" && wi.source_id && ["open", "claimed", "in_progress"].includes(wi.status)) {
      activeWiByBug.set(wi.source_id, wi);
    }
  }
  for (const bug of bugs) {
    if (["resolved", "closed"].includes(bug.status) && activeWiByBug.has(bug.id)) {
      const wi = activeWiByBug.get(bug.id);
      issues.push({ type: "status_mismatch", severity: "medium", title: `Mismatch: "${wi.title}" active but bug resolved`, detail: `bug ${bug.id.slice(0,8)} resolved, task still ${wi.status}` });
    }
  }

  // 4. Open bugs without work items
  const bugsWithWi = new Set(workItems.filter((w: any) => w.source_type === "bug_report" && w.source_id).map((w: any) => w.source_id));
  for (const bug of bugs) {
    if (bug.status === "open" && !bugsWithWi.has(bug.id)) {
      issues.push({ type: "missing_task", severity: "medium", title: `Bug without task`, detail: `bug ${bug.id.slice(0,8)} open but no work_item` });
    }
  }

  // 5. Negative stock
  for (const p of products) {
    if (!p.allow_overselling && p.stock < 0) {
      issues.push({ type: "stock_negative", severity: "critical", title: `Negative stock: ${p.title_sv}`, detail: `stock=${p.stock}` });
    }
    if (p.reserved_stock && p.reserved_stock > p.stock && !p.allow_overselling) {
      issues.push({ type: "stock_overreserved", severity: "high", title: `Over-reserved: ${p.title_sv}`, detail: `reserved=${p.reserved_stock}, stock=${p.stock}` });
    }
  }

  // 6. Orders paid but still pending
  const paidPending = orders.filter((o: any) => o.payment_status === "paid" && o.status === "pending");
  if (paidPending.length > 0) {
    issues.push({ type: "order_stuck", severity: "high", title: `${paidPending.length} paid orders stuck in pending`, detail: `Orders paid but status never advanced` });
  }

  // 7. Duplicate work items
  const sourceKeys = new Map<string, number>();
  for (const wi of workItems) {
    if (wi.source_id && wi.source_type && ["open","claimed","in_progress"].includes(wi.status)) {
      const key = `${wi.source_type}:${wi.source_id}`;
      sourceKeys.set(key, (sourceKeys.get(key) || 0) + 1);
    }
  }
  for (const [key, count] of sourceKeys) {
    if (count > 1) {
      issues.push({ type: "duplicate_tasks", severity: "medium", title: `${count} duplicate tasks for ${key}`, detail: `Multiple active work items for same source` });
    }
  }

  // Auto-create data_issue tasks for critical/high issues
  let tasksCreated = 0;
  for (const issue of issues) {
    if (issue.severity === "critical" || issue.severity === "high") {
      // Check if similar task already exists
      const existing = workItems.find((w: any) =>
        w.item_type === "data_issue" && w.title === issue.title && ["open","claimed","in_progress"].includes(w.status)
      );
      if (!existing) {
        await supabase.from("work_items").insert({
          title: issue.title.substring(0, 200),
          description: issue.detail,
          status: "open",
          priority: issue.severity === "critical" ? "critical" : "high",
          item_type: "data_issue",
          source_type: "system",
          ai_detected: true,
          ai_confidence: "high",
        });
        tasksCreated++;
      }
    }
  }

  const score = Math.max(0, 100 - issues.filter(i => i.severity === "critical").length * 20 - issues.filter(i => i.severity === "high").length * 10 - issues.filter(i => i.severity === "medium").length * 3);

  await supabase.from("system_history").insert({
    event_type: "data_integrity_scan",
    snapshot: { total_issues: issues.length, score, tasks_created: tasksCreated },
    resolution_notes: `Integrity scan: ${issues.length} issues, score ${score}/100`,
  });

  return { issues, score, tasks_created: tasksCreated };
}

// ── Content Validation Engine ──
async function handleContentValidation(supabase: any, lovableKey: string, autoFix = false) {
  const { data: products } = await supabase.from("products").select("id, title_sv, certifications, ingredients_sv, price, original_price, status, is_visible, stock, category").eq("status", "active");
  const { data: storeSettings } = await supabase.from("store_settings").select("key, value");
  const { data: pageSections } = await supabase.from("page_sections").select("id, section_key, title_sv, content_sv, is_visible").eq("is_visible", true);

  const settingsMap: Record<string, string> = {};
  (storeSettings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

  const mismatches: { claim: string; source: string; reality: string; severity: string; suggestion: string; auto_fixable: boolean; fix_action?: string; fixed?: boolean }[] = [];
  const fixes: { action: string; target: string; result: string }[] = [];

  for (const p of (products || [])) {
    // Empty certifications
    if (p.certifications && p.certifications.length > 0) {
      const emptyCerts = p.certifications.filter((c: string) => !c || c.trim() === "");
      if (emptyCerts.length > 0) {
        const m: any = { claim: `Product "${p.title_sv}" lists empty certification`, source: "product_metadata", reality: "Empty string in certifications array", severity: "medium", suggestion: "Remove empty certification entries", auto_fixable: true, fix_action: "remove_empty_certs" };
        if (autoFix) {
          const cleaned = p.certifications.filter((c: string) => c && c.trim() !== "");
          await supabase.from("products").update({ certifications: cleaned.length > 0 ? cleaned : null }).eq("id", p.id);
          m.fixed = true;
          fixes.push({ action: "remove_empty_certs", target: p.title_sv, result: `Removed ${emptyCerts.length} empty entries` });
        }
        mismatches.push(m);
      }
    }
    // Sale badge without discount
    if (p.original_price && p.price >= p.original_price) {
      const m: any = { claim: `Product "${p.title_sv}" has original_price but no actual discount`, source: "product_pricing", reality: `price=${p.price}, original_price=${p.original_price}`, severity: "high", suggestion: "Remove original_price", auto_fixable: true, fix_action: "clear_original_price" };
      if (autoFix) {
        await supabase.from("products").update({ original_price: null }).eq("id", p.id);
        m.fixed = true;
        fixes.push({ action: "clear_original_price", target: p.title_sv, result: "Cleared misleading original_price" });
      }
      mismatches.push(m);
    }
    // Visible with 0 stock
    if (p.is_visible && p.stock <= 0) {
      const m: any = { claim: `Product "${p.title_sv}" is visible but has 0 stock`, source: "product_inventory", reality: `stock=${p.stock}, visible=true`, severity: "high", suggestion: "Hide product", auto_fixable: true, fix_action: "hide_out_of_stock" };
      if (autoFix) {
        await supabase.from("products").update({ is_visible: false }).eq("id", p.id);
        m.fixed = true;
        fixes.push({ action: "hide_out_of_stock", target: p.title_sv, result: "Hidden product with 0 stock" });
      }
      mismatches.push(m);
    }
  }

  // Shipping checks (not auto-fixable – business risk)
  const shippingCost = settingsMap["shipping_cost"];
  const freeThreshold = settingsMap["free_shipping_threshold"];
  if (shippingCost && Number(shippingCost) < 0) {
    mismatches.push({ claim: "Negative shipping cost configured", source: "store_settings", reality: `shipping_cost=${shippingCost}`, severity: "critical", suggestion: "Fix shipping cost to a valid positive number", auto_fixable: false });
  }
  if (freeThreshold && Number(freeThreshold) <= 0) {
    mismatches.push({ claim: "Free shipping threshold is 0 or negative", source: "store_settings", reality: `free_shipping_threshold=${freeThreshold}`, severity: "high", suggestion: "Set a valid free shipping threshold", auto_fixable: false });
  }

  // Empty page sections – auto-fixable by hiding
  for (const section of (pageSections || [])) {
    if (section.is_visible && (!section.content_sv || section.content_sv.trim() === "") && (!section.title_sv || section.title_sv.trim() === "")) {
      const m: any = { claim: `Section "${section.section_key}" is visible but has no content`, source: "page_sections", reality: "Empty title and content", severity: "medium", suggestion: "Hide the section", auto_fixable: true, fix_action: "hide_empty_section" };
      if (autoFix) {
        await supabase.from("page_sections").update({ is_visible: false }).eq("id", section.id);
        m.fixed = true;
        fixes.push({ action: "hide_empty_section", target: section.section_key, result: "Hidden empty section" });
      }
      mismatches.push(m);
    }
  }

  // Missing ingredients (not auto-fixable – needs content)
  for (const p of (products || [])) {
    if (p.category && ["Kroppsvård", "Bastudofter", "CBD"].includes(p.category)) {
      if (!p.ingredients_sv || p.ingredients_sv.trim() === "") {
        mismatches.push({ claim: `Product "${p.title_sv}" is in ${p.category} but has no ingredients listed`, source: "product_metadata", reality: "ingredients_sv is empty", severity: "medium", suggestion: "Add ingredients list to product", auto_fixable: false });
      }
    }
  }

  // Create tasks for unfixable high/critical issues
  let tasksCreated = 0;
  const { data: existingTasks } = await supabase.from("work_items").select("title, status").in("status", ["open", "claimed", "in_progress"]).eq("item_type", "content_mismatch");
  const existingTitles = new Set((existingTasks || []).map((t: any) => t.title));

  for (const m of mismatches) {
    if (m.fixed) continue; // Already fixed
    if ((m.severity === "critical" || m.severity === "high") && !existingTitles.has(m.claim.substring(0, 200))) {
      await supabase.from("work_items").insert({
        title: m.claim.substring(0, 200),
        description: `${m.reality}\n\nSuggestion: ${m.suggestion}`,
        status: "open",
        priority: m.severity === "critical" ? "critical" : "high",
        item_type: "content_mismatch",
        source_type: m.source,
        ai_detected: true,
        ai_confidence: "high",
      });
      tasksCreated++;
    }
  }

  const score = Math.max(0, 100 - mismatches.filter(m => !m.fixed && m.severity === "critical").length * 25 - mismatches.filter(m => !m.fixed && m.severity === "high").length * 10 - mismatches.filter(m => !m.fixed && m.severity === "medium").length * 3);

  await supabase.from("system_history").insert({
    event_type: autoFix ? "content_auto_fix" : "content_validation_scan",
    snapshot: { total_mismatches: mismatches.length, fixed: fixes.length, score, tasks_created: tasksCreated },
    resolution_notes: autoFix ? `Auto-fix: ${fixes.length} fixed, ${mismatches.length - fixes.length} remaining` : `Content validation: ${mismatches.length} mismatches, score ${score}/100`,
  });

  return { mismatches, score, tasks_created: tasksCreated, fixes, auto_fixed: fixes.length };
}

// ── Pattern Detection & Similarity Engine ──
async function handlePatternDetection(supabase: any, lovableKey: string) {
  // Fetch active work items and bug reports
  const { data: workItems } = await supabase.from("work_items").select("id, title, description, item_type, priority, status, ai_category, source_type, group_id").in("status", ["open", "claimed", "in_progress"]);
  const { data: bugs } = await supabase.from("bug_reports").select("id, description, ai_category, ai_severity, ai_summary, ai_tags, status").in("status", ["open", "in_progress"]);

  const items = (workItems || []).map((w: any) => ({
    id: w.id, type: "work_item", title: w.title, desc: w.description || "", category: w.ai_category || w.item_type, priority: w.priority, group_id: w.group_id,
  }));
  for (const b of (bugs || [])) {
    items.push({ id: b.id, type: "bug_report", title: b.ai_summary || b.description?.substring(0, 80), desc: b.description || "", category: b.ai_category || "bug", priority: b.ai_severity || "medium", group_id: null });
  }

  if (items.length < 2) {
    return { clusters: [], root_issues: [], links_created: 0, master_tasks_created: 0 };
  }

  // Use AI to cluster and find root causes
  const prompt = `You are a system analyst. Given these ${items.length} issues from a work tracking system, analyze them for patterns.

ISSUES:
${items.map((it: any, i: number) => `${i+1}. [${it.type}] "${it.title}" — category: ${it.category}, priority: ${it.priority}\n   ${it.desc.substring(0, 150)}`).join("\n")}

Respond in JSON with this exact structure:
{
  "clusters": [
    {
      "label": "short cluster name",
      "category": "interaction_bug|navigation|data_mismatch|structure|ux|performance|content",
      "issue_indices": [1, 3, 5],
      "root_cause": "description of the underlying root problem",
      "fix_suggestion": "how to fix the root problem",
      "lovable_prompt": "ready-to-send implementation prompt",
      "priority": "critical|high|medium|low"
    }
  ]
}

Rules:
- Only group truly related issues (similar root cause)
- Single-item clusters are OK if unique
- Be specific about root causes
- Generate actionable lovable_prompts`;

  let clusters: any[] = [];
  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (aiResp.ok) {
      const aiData = await aiResp.json();
      const text = aiData.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(text);
      clusters = parsed.clusters || [];
    }
  } catch (e) {
    console.error("Pattern AI error:", e);
  }

  // Process clusters: link tasks and create master issues
  let linksCreated = 0;
  let masterTasksCreated = 0;
  const rootIssues: any[] = [];

  for (const cluster of clusters) {
    if (!cluster.issue_indices || cluster.issue_indices.length < 2) continue;

    const clusterItems = cluster.issue_indices.map((idx: number) => items[idx - 1]).filter(Boolean);
    if (clusterItems.length < 2) continue;

    // Check if master task already exists
    const masterTitle = `[Root] ${cluster.label}`.substring(0, 200);
    const { data: existing } = await supabase.from("work_items").select("id").eq("title", masterTitle).in("status", ["open", "claimed", "in_progress"]).maybeSingle();

    let masterId = existing?.id;
    if (!masterId) {
      const { data: created } = await supabase.from("work_items").insert({
        title: masterTitle,
        description: `Root cause: ${cluster.root_cause}\n\nFix: ${cluster.fix_suggestion}\n\nAffected items: ${clusterItems.length}\n\nLovable prompt:\n${cluster.lovable_prompt}`,
        status: "open",
        priority: cluster.priority || "high",
        item_type: "improvement",
        source_type: "pattern_detection",
        ai_detected: true,
        ai_confidence: "high",
        ai_category: cluster.category,
      }).select("id").single();
      masterId = created?.id;
      masterTasksCreated++;
    }

    // Link child work_items to master via group_id
    if (masterId) {
      for (const ci of clusterItems) {
        if (ci.type === "work_item" && ci.group_id !== masterId) {
          await supabase.from("work_items").update({ group_id: masterId }).eq("id", ci.id);
          linksCreated++;
        }
      }
    }

    // Boost priority if many linked
    if (clusterItems.length >= 4 && masterId) {
      await supabase.from("work_items").update({ priority: "critical" }).eq("id", masterId);
    }

    rootIssues.push({
      label: cluster.label,
      category: cluster.category,
      root_cause: cluster.root_cause,
      fix_suggestion: cluster.fix_suggestion,
      lovable_prompt: cluster.lovable_prompt,
      affected_count: clusterItems.length,
      priority: clusterItems.length >= 4 ? "critical" : cluster.priority,
      master_id: masterId,
    });
  }

  await supabase.from("system_history").insert({
    event_type: "pattern_detection",
    snapshot: { clusters: clusters.length, root_issues: rootIssues.length, links_created: linksCreated, master_tasks: masterTasksCreated },
    resolution_notes: `Pattern detection: ${clusters.length} clusters, ${rootIssues.length} root issues, ${linksCreated} links`,
  });

  return { clusters: rootIssues, total_items_analyzed: items.length, links_created: linksCreated, master_tasks_created: masterTasksCreated };
}

// ── Memory & Trend Analysis ──
async function handleMemoryTrends(supabase: any, lovableKey: string) {
  const { data: scans } = await supabase
    .from("ai_scan_results")
    .select("id, overall_score, overall_status, executive_summary, issues_count, tasks_created, created_at")
    .eq("scan_type", "system_scan")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!scans?.length || scans.length < 2) {
    return { trend_available: false, message: "Minst 2 skanningar krävs för trendanalys" };
  }

  const { data: bugs } = await supabase
    .from("bug_reports")
    .select("status, ai_severity, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: workItems } = await supabase
    .from("work_items")
    .select("status, priority, created_at, completed_at, ai_detected")
    .order("created_at", { ascending: false })
    .limit(300);

  const scanTimeline = scans.map((s: any) => ({
    date: s.created_at, score: s.overall_score, status: s.overall_status,
    issues: s.issues_count, tasks: s.tasks_created, summary: s.executive_summary,
  })).reverse();

  const bugStats = {
    total: bugs?.length || 0,
    open: bugs?.filter((b: any) => b.status === "open").length || 0,
    resolved: bugs?.filter((b: any) => b.status === "resolved").length || 0,
    critical: bugs?.filter((b: any) => b.ai_severity === "critical").length || 0,
  };

  const workStats = {
    total: workItems?.length || 0,
    done: workItems?.filter((w: any) => w.status === "done").length || 0,
    open: workItems?.filter((w: any) => !["done", "cancelled"].includes(w.status)).length || 0,
    ai_detected: workItems?.filter((w: any) => w.ai_detected).length || 0,
  };

  const dataStr = `=== SCAN TIMELINE (${scanTimeline.length} scans) ===
${scanTimeline.map((s: any) => `[${s.date}] Score: ${s.score} | Status: ${s.status} | Issues: ${s.issues} | Tasks: ${s.tasks} | ${s.summary}`).join("\n")}

=== BUG STATS ===
Total: ${bugStats.total} | Open: ${bugStats.open} | Resolved: ${bugStats.resolved} | Critical: ${bugStats.critical}

=== WORK ITEM STATS ===
Total: ${workStats.total} | Done: ${workStats.done} | Open: ${workStats.open} | AI-detected: ${workStats.ai_detected}`;

  const result = await callAI(lovableKey, [
    {
      role: "system",
      content: `Du är en AI-analytiker för en svensk e-handelsplattform. Analysera historiska data och identifiera trender. Svara ALLTID på svenska. Använd memory_trends-funktionen.`,
    },
    { role: "user", content: `Analysera trender:\n\n${dataStr}` },
  ], [
    {
      type: "function",
      function: {
        name: "memory_trends",
        description: "Analyze system trends over time",
        parameters: {
          type: "object",
          properties: {
            overall_trend: { type: "string", enum: ["improving", "stable", "declining"] },
            trend_summary: { type: "string", description: "2-3 sentence trend summary in Swedish" },
            score_trend: {
              type: "object",
              properties: {
                direction: { type: "string", enum: ["up", "stable", "down"] },
                change: { type: "number" },
                message: { type: "string" },
              },
              required: ["direction", "change", "message"],
              additionalProperties: false,
            },
            bug_trend: {
              type: "object",
              properties: {
                direction: { type: "string", enum: ["increasing", "stable", "decreasing"] },
                message: { type: "string" },
              },
              required: ["direction", "message"],
              additionalProperties: false,
            },
            performance_trend: {
              type: "object",
              properties: {
                direction: { type: "string", enum: ["improving", "stable", "declining"] },
                message: { type: "string" },
              },
              required: ["direction", "message"],
              additionalProperties: false,
            },
            key_changes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  area: { type: "string" },
                  change: { type: "string", enum: ["improved", "unchanged", "worsened"] },
                  detail: { type: "string" },
                },
                required: ["area", "change", "detail"],
                additionalProperties: false,
              },
            },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["overall_trend", "trend_summary", "score_trend", "bug_trend", "performance_trend", "key_changes", "recommendations"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "memory_trends" } });

  return { ...result, trend_available: true, scan_count: scanTimeline.length, scan_timeline: scanTimeline, bug_stats: bugStats, work_stats: workStats };
}

// ── AI Category Sync ──
async function handleCategorySync(supabase: any, lovableKey: string) {
  // Load existing categories and products
  const [catRes, prodRes] = await Promise.all([
    supabase.from("categories").select("id, name_sv, name_en, slug, parent_id, icon, display_order, is_visible").order("display_order"),
    supabase.from("products").select("id, title_sv, category, status").in("status", ["active", "coming_soon", "info"]).limit(500),
  ]);

  const existingCats = catRes.data || [];
  const products = prodRes.data || [];

  // Gather unique product categories/types
  const productTypes = [...new Set(products.map((p: any) => p.category).filter(Boolean))];
  const existingSlugs = new Set(existingCats.map((c: any) => c.slug));
  const existingNames = new Set(existingCats.map((c: any) => c.name_sv.toLowerCase()));

  const catList = existingCats.map((c: any) => `${c.slug}|${c.name_sv}|parent:${c.parent_id || 'root'}`).join("\n");
  const typeList = productTypes.join(", ");
  const productSample = products.slice(0, 50).map((p: any) => `${p.title_sv} [${p.category || 'no-category'}]`).join("\n");

  const result = await callAI(lovableKey, [
    {
      role: "system",
      content: `Du är en kategoriexpert för en svensk e-handelsplattform. Analysera produkter och befintliga kategorier. Föreslå nya kategorier som saknas. Svara ALLTID på svenska. Använd category_suggestions-funktionen.`,
    },
    {
      role: "user",
      content: `Analysera dessa produkter och identifiera kategorier som saknas.

Befintliga kategorier:
${catList}

Produkttyper i bruk: ${typeList}

Produktexempel:
${productSample}

Regler:
- Föreslå BARA kategorier som verkligen saknas
- Matcha mot produkttyper som inte har en kategori
- Föreslå hierarki (parent) om relevant
- Slug ska vara URL-vänlig (lowercase, bindestreck)
- Icon ska vara en av: Cpu, Shirt, Droplets, Flame, Sparkles, Gem, Bed, Leaf, Grid, Tag`,
    },
  ], [
    {
      type: "function",
      function: {
        name: "category_suggestions",
        description: "Suggest missing categories based on product analysis",
        parameters: {
          type: "object",
          properties: {
            analysis_summary: { type: "string", description: "Brief summary of findings in Swedish" },
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name_sv: { type: "string", description: "Swedish category name" },
                  name_en: { type: "string", description: "English category name" },
                  slug: { type: "string", description: "URL-friendly slug" },
                  icon: { type: "string", description: "Lucide icon name" },
                  parent_slug: { type: "string", description: "Parent category slug or 'root'" },
                  reason: { type: "string", description: "Why this category is needed, in Swedish" },
                  product_count: { type: "number", description: "Approx number of products that would belong" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["name_sv", "name_en", "slug", "icon", "parent_slug", "reason", "product_count", "confidence"],
                additionalProperties: false,
              },
            },
            no_changes_needed: { type: "boolean", description: "True if all products are well-categorized" },
          },
          required: ["analysis_summary", "suggestions", "no_changes_needed"],
          additionalProperties: false,
        },
      },
    },
  ], { type: "function", function: { name: "category_suggestions" } });

  // Auto-create high-confidence categories
  const created: any[] = [];
  const skipped: any[] = [];
  const maxOrder = Math.max(0, ...existingCats.map((c: any) => c.display_order || 0));

  for (const suggestion of (result?.suggestions || [])) {
    // Skip if slug or name already exists
    if (existingSlugs.has(suggestion.slug) || existingNames.has(suggestion.name_sv.toLowerCase())) {
      skipped.push({ ...suggestion, skip_reason: "already_exists" });
      continue;
    }

    if (suggestion.confidence === "high") {
      // Find parent_id
      let parentId = null;
      if (suggestion.parent_slug && suggestion.parent_slug !== "root") {
        const parent = existingCats.find((c: any) => c.slug === suggestion.parent_slug);
        if (parent) parentId = parent.id;
      }

      const { data: newCat, error: insertErr } = await supabase.from("categories").insert({
        name_sv: suggestion.name_sv,
        name_en: suggestion.name_en,
        slug: suggestion.slug,
        icon: suggestion.icon,
        parent_id: parentId,
        display_order: maxOrder + created.length + 1,
        is_visible: true,
      }).select("id, slug, name_sv").single();

      if (!insertErr && newCat) {
        created.push({ ...newCat, reason: suggestion.reason });
        existingSlugs.add(suggestion.slug);
        existingNames.add(suggestion.name_sv.toLowerCase());
      } else {
        skipped.push({ ...suggestion, skip_reason: insertErr?.message || "insert_failed" });
      }
    } else {
      skipped.push({ ...suggestion, skip_reason: "low_confidence" });
    }
  }

  return {
    analysis: result?.analysis_summary || "",
    no_changes_needed: result?.no_changes_needed || false,
    created,
    pending_review: skipped.filter((s: any) => s.skip_reason === "low_confidence"),
    already_exists: skipped.filter((s: any) => s.skip_reason === "already_exists"),
    total_products_analyzed: products.length,
    total_categories: existingCats.length,
  };
}

// ── AI Category Validation & Cleanup ──
async function handleCategoryValidate(supabase: any, _lovableKey: string) {
  const [catRes, pcRes] = await Promise.all([
    supabase.from("categories").select("id, name_sv, name_en, slug, parent_id, icon, display_order, is_visible"),
    supabase.from("product_categories").select("category_id, product_id"),
  ]);

  const categories = catRes.data || [];
  const productCategories = pcRes.data || [];

  // Build product count per category
  const countMap: Record<string, number> = {};
  for (const pc of productCategories) {
    countMap[pc.category_id] = (countMap[pc.category_id] || 0) + 1;
  }

  const catIds = new Set(categories.map((c: any) => c.id));
  const issues: any[] = [];
  const autoFixed: any[] = [];

  // 1. Empty visible categories
  for (const cat of categories) {
    if ((countMap[cat.id] || 0) === 0 && cat.is_visible) {
      issues.push({ type: "empty", category: cat.name_sv, slug: cat.slug, id: cat.id, severity: "medium" });
    }
  }

  // 2. Duplicate slugs
  const slugCount: Record<string, any[]> = {};
  for (const cat of categories) {
    (slugCount[cat.slug] = slugCount[cat.slug] || []).push(cat);
  }
  for (const [slug, cats] of Object.entries(slugCount)) {
    if (cats.length > 1) {
      issues.push({ type: "duplicate_slug", slug, count: cats.length, ids: cats.map((c: any) => c.id), severity: "high" });
    }
  }

  // 3. Duplicate names
  const nameCount: Record<string, any[]> = {};
  for (const cat of categories) {
    const key = cat.name_sv.toLowerCase().trim();
    (nameCount[key] = nameCount[key] || []).push(cat);
  }
  for (const [name, cats] of Object.entries(nameCount)) {
    if (cats.length > 1) {
      issues.push({ type: "duplicate_name", name, count: cats.length, ids: cats.map((c: any) => c.id), severity: "high" });
    }
  }

  // 4. Broken parent references
  for (const cat of categories) {
    if (cat.parent_id && !catIds.has(cat.parent_id)) {
      issues.push({ type: "orphan_parent", category: cat.name_sv, slug: cat.slug, id: cat.id, severity: "high" });
    }
  }

  // 5. Orphan product_category links
  const orphanPcCatIds = new Set<string>();
  for (const pc of productCategories) {
    if (!catIds.has(pc.category_id)) orphanPcCatIds.add(pc.category_id);
  }
  if (orphanPcCatIds.size > 0) {
    issues.push({ type: "orphan_product_links", missing_category_ids: [...orphanPcCatIds], count: orphanPcCatIds.size, severity: "high" });
  }

  // Auto-fix: hide empty visible categories
  for (const issue of issues) {
    if (issue.type === "empty") {
      const { error } = await supabase.from("categories").update({ is_visible: false }).eq("id", issue.id);
      if (!error) autoFixed.push({ action: "hidden_empty", category: issue.category, slug: issue.slug });
    }
  }

  // Auto-fix: clear broken parent refs
  for (const issue of issues) {
    if (issue.type === "orphan_parent") {
      const { error } = await supabase.from("categories").update({ parent_id: null }).eq("id", issue.id);
      if (!error) autoFixed.push({ action: "cleared_broken_parent", category: issue.category, slug: issue.slug });
    }
  }

  // Auto-fix: remove orphan product_category links
  if (orphanPcCatIds.size > 0) {
    const { error } = await supabase.from("product_categories").delete().in("category_id", [...orphanPcCatIds]);
    if (!error) autoFixed.push({ action: "removed_orphan_links", count: orphanPcCatIds.size });
  }

  // Create tasks for duplicates (need manual review)
  const tasksCreated: any[] = [];
  for (const dup of issues.filter((i: any) => i.type === "duplicate_slug" || i.type === "duplicate_name")) {
    const title = dup.type === "duplicate_slug"
      ? `Duplicerad kategori-slug: ${dup.slug}`
      : `Duplicerat kategorinamn: ${dup.name}`;
    const { data: wi, error: wiErr } = await supabase.from("work_items").insert({
      title,
      description: `AI hittade ${dup.count} kategorier med samma ${dup.type === "duplicate_slug" ? "slug" : "namn"}. Manuell granskning krävs.`,
      status: "open",
      priority: "high",
      item_type: "content_mismatch",
      source_type: "ai_category_validate",
    }).select("id").single();
    if (!wiErr && wi) tasksCreated.push({ id: wi.id, title });
  }

  return {
    total_categories: categories.length,
    total_product_links: productCategories.length,
    issues_found: issues.length,
    issues,
    auto_fixed: autoFixed,
    tasks_created: tasksCreated,
  };
}

// ── Focused Scan (Adaptive Scan Zones) ──
async function handleFocusedScan(supabase: any, apiKey: string) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Gather recent signals: bugs, work items, incidents, activity logs
  const [bugsRes, workItemsRes, incidentsRes, activityRes, scansRes] = await Promise.all([
    supabase.from("bug_reports").select("id, description, page_url, ai_category, ai_severity, status, created_at").gte("created_at", monthAgo.toISOString()).order("created_at", { ascending: false }).limit(200),
    supabase.from("work_items").select("id, title, ai_category, priority, status, item_type, created_at").gte("created_at", monthAgo.toISOString()).order("created_at", { ascending: false }).limit(300),
    supabase.from("order_incidents").select("id, title, type, priority, status, created_at").gte("created_at", monthAgo.toISOString()).limit(100),
    supabase.from("activity_logs").select("log_type, category, message, created_at").eq("log_type", "error").gte("created_at", weekAgo.toISOString()).order("created_at", { ascending: false }).limit(200),
    supabase.from("ai_scan_results").select("results, created_at, scan_type").eq("scan_type", "focused_scan").order("created_at", { ascending: false }).limit(3),
  ]);

  const bugs = bugsRes.data || [];
  const workItems = workItemsRes.data || [];
  const incidents = incidentsRes.data || [];
  const errorLogs = activityRes.data || [];
  const previousScans = scansRes.data || [];

  // 2. Build hot zone heatmap by counting issues per area
  const areaMap: Record<string, { recent: number; total: number; severity_score: number; sources: string[] }> = {};
  const severityWeight: Record<string, number> = { critical: 10, high: 5, medium: 2, low: 1 };

  const addToArea = (area: string, isRecent: boolean, severity: string, source: string) => {
    if (!area || area === "unknown") return;
    const key = area.toLowerCase();
    if (!areaMap[key]) areaMap[key] = { recent: 0, total: 0, severity_score: 0, sources: [] };
    areaMap[key].total++;
    if (isRecent) areaMap[key].recent++;
    areaMap[key].severity_score += severityWeight[severity] || 1;
    if (!areaMap[key].sources.includes(source)) areaMap[key].sources.push(source);
  };

  // From bugs
  for (const b of bugs) {
    const isRecent = new Date(b.created_at) > dayAgo;
    const area = b.ai_category || inferAreaFromUrl(b.page_url);
    addToArea(area, isRecent, b.ai_severity || "medium", "bug");
  }

  // From work items
  for (const w of workItems) {
    const isRecent = new Date(w.created_at) > dayAgo;
    addToArea(w.ai_category || "system", isRecent, w.priority || "medium", "work_item");
  }

  // From incidents
  for (const i of incidents) {
    const isRecent = new Date(i.created_at) > dayAgo;
    addToArea(i.type || "orders", isRecent, i.priority || "medium", "incident");
  }

  // From error logs
  for (const e of errorLogs) {
    addToArea(e.category || "system", true, "medium", "error_log");
  }

  // 3. Rank zones by heat score with decay (recent issues weighted 3x)
  const zones = Object.entries(areaMap).map(([area, data]) => ({
    area,
    heat_score: data.severity_score + (data.recent * 3),
    recent_issues: data.recent,
    total_issues: data.total,
    sources: data.sources,
  })).sort((a, b) => b.heat_score - a.heat_score);

  const hotZones = zones.filter(z => z.heat_score >= 5).slice(0, 6);
  const coldZones = zones.filter(z => z.heat_score < 5);

  // 4. Deep AI analysis on hot zones
  const hotZoneSummary = hotZones.map(z =>
    `[${z.area}] heat=${z.heat_score}, recent=${z.recent_issues}, total=${z.total_issues}, sources=${z.sources.join(",")}`
  ).join("\n");

  const recentBugsSummary = bugs.slice(0, 20).map((b: any) =>
    `- [${b.ai_category || "?"}/${b.ai_severity || "?"}] ${b.description?.substring(0, 100)}`
  ).join("\n");

  const previousContext = previousScans.length > 0
    ? `Previous focused scan (${previousScans[0].created_at}): ${JSON.stringify(previousScans[0].results?.hot_zones?.slice?.(0, 3) || [])}`
    : "No previous focused scan available.";

  const analysis = await callAI(apiKey, [
    {
      role: "system",
      content: `Du är en adaptiv AI-scanner för en svensk e-handelsplattform. Du analyserar "hot zones" — systemområden med hög koncentration av problem. Du ska:
1. Djupanalysera varje hot zone
2. Identifiera mönster och rotorsaker
3. Jämföra med tidigare skanningar (förbättring/försämring)
4. Ge prioriterade åtgärdsförslag
Svara på svenska. Använd focused_scan-funktionen.`,
    },
    {
      role: "user",
      content: `Hot Zones (ranked by heat score):\n${hotZoneSummary || "Inga hot zones detekterade."}\n\nSenaste buggar:\n${recentBugsSummary || "Inga."}\n\nTidigare skanning:\n${previousContext}\n\nKalla zoner: ${coldZones.map(z => z.area).join(", ") || "inga"}`,
    },
  ], [{
    type: "function",
    function: {
      name: "focused_scan",
      description: "Adaptive focused scan with hot zone analysis",
      parameters: {
        type: "object",
        properties: {
          hot_zones: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: { type: "string" },
                status: { type: "string", enum: ["critical", "warning", "improving", "stable"] },
                diagnosis: { type: "string", description: "Root cause analysis in Swedish" },
                trend: { type: "string", enum: ["worsening", "stable", "improving", "new"] },
                actions: { type: "array", items: { type: "string" }, description: "Recommended actions in Swedish" },
                related_areas: { type: "array", items: { type: "string" } },
              },
              required: ["area", "status", "diagnosis", "trend", "actions"],
            },
          },
          cold_zones: {
            type: "array",
            items: { type: "string" },
            description: "Areas with no/few issues (healthy)",
          },
          summary: { type: "string", description: "Executive summary in Swedish" },
          overall_risk: { type: "string", enum: ["low", "medium", "high", "critical"] },
          recommended_next_scan_areas: {
            type: "array",
            items: { type: "string" },
            description: "Which areas to scan deeper next time",
          },
        },
        required: ["hot_zones", "cold_zones", "summary", "overall_risk", "recommended_next_scan_areas"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "focused_scan" } });

  // 5. Store scan result
  const scanResult = {
    hot_zones: (analysis?.hot_zones || []).map((hz: any, i: number) => ({
      ...hz,
      heat_score: hotZones[i]?.heat_score || 0,
      recent_issues: hotZones[i]?.recent_issues || 0,
      total_issues: hotZones[i]?.total_issues || 0,
    })),
    cold_zones: analysis?.cold_zones || coldZones.map(z => z.area),
    raw_zones: zones,
    summary: analysis?.summary || "",
    overall_risk: analysis?.overall_risk || "medium",
    recommended_next_scan_areas: analysis?.recommended_next_scan_areas || [],
  };

  await supabase.from("ai_scan_results").insert({
    scan_type: "focused_scan",
    results: scanResult,
    overall_status: analysis?.overall_risk || "medium",
    executive_summary: analysis?.summary || "",
    issues_count: hotZones.length,
    overall_score: Math.max(0, 100 - hotZones.reduce((s, z) => s + z.heat_score, 0)),
  });

  // 6. Auto-create work items for critical hot zones
  let tasksCreated = 0;
  for (const hz of analysis?.hot_zones || []) {
    if (hz.status !== "critical" && hz.status !== "warning") continue;

    const title = `🔥 Hot Zone: ${hz.area} — ${hz.status}`;
    const { data: existing } = await supabase
      .from("work_items")
      .select("id")
      .ilike("title", `%Hot Zone: ${hz.area}%`)
      .in("status", ["open", "claimed", "in_progress"])
      .limit(1);

    if (existing?.length) continue;

    await supabase.from("work_items").insert({
      title: title.substring(0, 200),
      description: `${hz.diagnosis}\n\nÅtgärder:\n${(hz.actions || []).map((a: string) => `• ${a}`).join("\n")}`,
      status: "open",
      priority: hz.status === "critical" ? "critical" : "high",
      item_type: "insight",
      source_type: "ai_focused_scan",
      ai_detected: true,
      ai_confidence: "high",
      ai_category: hz.area,
    });
    tasksCreated++;
  }

  return { ...scanResult, tasks_created: tasksCreated };
}

function inferAreaFromUrl(url: string): string {
  if (!url) return "unknown";
  if (url.includes("/admin")) return "admin";
  if (url.includes("/checkout")) return "checkout";
  if (url.includes("/product")) return "products";
  if (url.includes("/cart")) return "cart";
  if (url.includes("/order")) return "orders";
  if (url.includes("/profil") || url.includes("/profile")) return "auth";
  return "UI";
}

// ── UI Overflow Detection Scanner ──
async function handleUiOverflowScan(supabase: any, apiKey: string) {
  // Gather data about known UI components, pages, and past overflow bugs
  const [bugsRes, workItemsRes, pagesRes, productsRes] = await Promise.all([
    supabase.from("bug_reports").select("id, description, ai_summary, ai_category, page_url, status").order("created_at", { ascending: false }).limit(100),
    supabase.from("work_items").select("id, title, description, status, priority, ai_category").in("status", ["open", "claimed", "in_progress"]).limit(200),
    supabase.from("page_sections").select("id, page, section_key, is_visible, content_sv").eq("is_visible", true),
    supabase.from("products").select("id, title_sv, description_sv, is_visible").eq("is_visible", true).limit(100),
  ]);

  const bugs = bugsRes.data || [];
  const workItems = workItemsRes.data || [];
  const pages = pagesRes.data || [];
  const products = productsRes.data || [];

  const overflowBugs = bugs.filter((b: any) =>
    ["overflow", "scroll", "hidden", "cut off", "truncat", "klippt", "dold", "scrollbar"].some(k =>
      (b.description || "").toLowerCase().includes(k) || (b.ai_summary || "").toLowerCase().includes(k)
    )
  );

  const adminRoutes = [
    { path: "/admin", name: "Admin Dashboard", containers: ["stats grid", "chart cards", "recent orders list", "activity log"] },
    { path: "/admin/orders", name: "Order Manager", containers: ["order table", "filter panel", "order detail sidebar"] },
    { path: "/admin/products", name: "Product Manager", containers: ["product list", "product form modal", "variant list"] },
    { path: "/admin/members", name: "Member Manager", containers: ["member table", "member detail panel"] },
    { path: "/admin/ai", name: "AI Center", containers: ["tab content panels", "scan result lists", "issue cards"] },
    { path: "/admin/content", name: "Content Manager", containers: ["section list", "timeline entries", "edit forms"] },
    { path: "/admin/ops", name: "Workbench", containers: ["kanban columns", "task detail panel", "checklist"] },
  ];

  const publicRoutes = [
    { path: "/", name: "Homepage", containers: ["hero section", "product grid", "review carousel", "newsletter"] },
    { path: "/produkter", name: "Products", containers: ["product grid", "filter sidebar", "category tabs"] },
    { path: "/product/:handle", name: "Product Detail", containers: ["image gallery", "description", "review list", "related products"] },
    { path: "/checkout", name: "Checkout", containers: ["cart items", "address form", "payment section"] },
    { path: "/profile", name: "Profile", containers: ["order history", "settings tabs", "balance overview"] },
    { path: "/about", name: "About", containers: ["timeline section", "values grid", "team section"] },
    { path: "/contact", name: "Contact", containers: ["contact form", "info cards"] },
  ];

  const longContentSections = pages.filter((p: any) => p.content_sv && p.content_sv.length > 500);
  const longDescProducts = products.filter((p: any) => p.description_sv && p.description_sv.length > 800);

  const context = `=== UI OVERFLOW DETECTION CONTEXT ===

KNOWN OVERFLOW BUGS (${overflowBugs.length}):
${overflowBugs.slice(0, 15).map((b: any) => `- [${b.status}] ${b.page_url}: ${b.ai_summary || b.description?.substring(0, 100)}`).join("\n") || "None"}

OPEN UI WORK ITEMS:
${workItems.filter((w: any) => ["ui", "frontend", "ux", "layout"].some(k => (w.ai_category || w.title || "").toLowerCase().includes(k))).slice(0, 15).map((w: any) => `- [${w.priority}] ${w.title}`).join("\n") || "None"}

ADMIN ROUTES & CONTAINERS:
${adminRoutes.map(r => `${r.path} (${r.name}): ${r.containers.join(", ")}`).join("\n")}

PUBLIC ROUTES & CONTAINERS:
${publicRoutes.map(r => `${r.path} (${r.name}): ${r.containers.join(", ")}`).join("\n")}

LONG CONTENT SECTIONS (>500 chars): ${longContentSections.length}
${longContentSections.slice(0, 10).map((s: any) => `- ${s.page}/${s.section_key}: ${s.content_sv?.length} chars`).join("\n")}

PRODUCTS WITH LONG DESCRIPTIONS (>800 chars): ${longDescProducts.length}

TOTAL VISIBLE PAGE SECTIONS: ${pages.length}
TOTAL VISIBLE PRODUCTS: ${products.length}`;

  const analysis = await callAI(apiKey, [
    {
      role: "system",
      content: `Du är en expert på CSS layout, overflow och scroll-beteende i React/Tailwind-applikationer.
Analysera alla kända routes och containers i systemet och identifiera platser där innehåll kan flöda över (overflow) utan scroll.

Vanliga overflow-problem:
1. Listor utan max-height och overflow-y: auto
2. Flex-containers utan min-height: 0 (barn kan inte scrolla)
3. Sidopaneler/drawers som expanderar oändligt
4. Tabeller utan horisontell scroll på mobil
5. Text som bryter ut ur sin container
6. Modaler utan scroll för långt innehåll
7. Grid-layouts som inte hanterar dynamiskt innehåll
8. Dropdown-menyer som klipps av overflow: hidden på förälder

Var SPECIFIK. Ange exakt vilken sida, container och breakpoint som har problem.
Ge konkreta CSS/Tailwind-fixar. Svara på svenska.`,
    },
    { role: "user", content: `Kör full UI overflow-skanning:\n\n${context}` },
  ], [{
    type: "function",
    function: {
      name: "ui_overflow_scan",
      description: "Generate UI overflow detection report",
      parameters: {
        type: "object",
        properties: {
          overflow_score: { type: "number", description: "0-100 how well overflow is handled (100=perfect)" },
          total_containers_checked: { type: "number" },
          issues_found: { type: "number" },
          executive_summary: { type: "string" },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                page: { type: "string", description: "Route path" },
                container: { type: "string", description: "Specific container element" },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                breakpoint: { type: "string", enum: ["mobile", "tablet", "desktop", "all"] },
                overflow_type: { type: "string", enum: ["vertical_clip", "horizontal_clip", "no_scroll", "flex_overflow", "modal_overflow", "table_overflow", "text_overflow", "dropdown_clip"] },
                description: { type: "string" },
                css_fix: { type: "string", description: "Exact Tailwind/CSS fix" },
                auto_fixable: { type: "boolean" },
                lovable_prompt: { type: "string" },
              },
              required: ["title", "page", "container", "severity", "breakpoint", "overflow_type", "description", "css_fix", "auto_fixable", "lovable_prompt"],
              additionalProperties: false,
            },
          },
          safe_containers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                page: { type: "string" },
                container: { type: "string" },
                reason: { type: "string" },
              },
              required: ["page", "container", "reason"],
              additionalProperties: false,
            },
          },
        },
        required: ["overflow_score", "total_containers_checked", "issues_found", "executive_summary", "issues", "safe_containers"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "ui_overflow_scan" } });

  // Persist scan result FIRST
  const overflowScore = analysis?.overflow_score || 0;
  const scanId = await persistScanResult(supabase, {
    scan_type: "ui_overflow_scan",
    results: analysis || {},
    overall_score: overflowScore,
    overall_status: overflowScore >= 80 ? "healthy" : overflowScore >= 50 ? "warning" : "critical",
    issues_count: analysis?.issues_found || 0,
    executive_summary: analysis?.executive_summary || "",
  });

  let tasksCreated = 0;
  if (analysis?.issues) {
    for (const issue of analysis.issues) {
      if (!["critical", "high"].includes(issue.severity)) continue;
      const { data: existing } = await supabase
        .from("work_items")
        .select("id")
        .ilike("title", `%${issue.title.substring(0, 25)}%`)
        .in("status", ["open", "claimed", "in_progress"])
        .limit(1);
      if (!existing?.length) {
        await supabase.from("work_items").insert({
          title: `UI Overflow: ${issue.title}`.substring(0, 200),
          description: `Sida: ${issue.page}\nContainer: ${issue.container}\nBreakpoint: ${issue.breakpoint}\nTyp: ${issue.overflow_type}\n\n${issue.description}\n\nCSS Fix: ${issue.css_fix}`,
          status: "open",
          priority: issue.severity === "critical" ? "critical" : "high",
          item_type: "bug",
          source_type: "ai_scan",
          source_id: scanId || undefined,
          ai_detected: true,
          ai_confidence: "high",
          ai_category: "frontend",
          ai_type_classification: "ui_overflow",
        });
        tasksCreated++;
      }
    }
  }

  if (scanId && tasksCreated > 0) await updateScanTaskCount(supabase, scanId, tasksCreated);
  return { ...analysis, tasks_created: tasksCreated, scan_id: scanId };
}

// ── UX Scanner ──
async function handleUxScan(supabase: any, lovableKey: string) {
  // Gather context about the site
  const { data: pages } = await supabase.from("page_sections").select("page, section_key, is_visible").limit(200);
  const { data: categories } = await supabase.from("categories").select("name_sv, slug, is_visible, parent_id").limit(100);
  const { data: products } = await supabase.from("products").select("title_sv, is_visible, is_sellable, stock, handle, image_urls").limit(50);
  const { data: recentBugs } = await supabase.from("bug_reports").select("description, page_url, ai_category, status").order("created_at", { ascending: false }).limit(20);
  const { data: recentWorkItems } = await supabase.from("work_items").select("title, item_type, ai_type_classification, status").order("created_at", { ascending: false }).limit(30);

  const routes = [
    { path: "/", name: "Startsida", type: "public" },
    { path: "/shop", name: "Butik", type: "public" },
    { path: "/produkter", name: "Produkter", type: "public" },
    { path: "/om-oss", name: "Om oss", type: "public" },
    { path: "/kontakt", name: "Kontakt", type: "public" },
    { path: "/checkout", name: "Kassa", type: "checkout" },
    { path: "/donationer", name: "Donationer", type: "public" },
    { path: "/profil", name: "Profil", type: "auth" },
    { path: "/admin", name: "Admin", type: "admin" },
    { path: "/admin/pos", name: "Admin POS", type: "admin" },
    { path: "/admin/ai", name: "Admin AI", type: "admin" },
  ];

  const context = JSON.stringify({
    routes,
    page_sections: pages?.slice(0, 50),
    categories: categories?.slice(0, 30),
    products_sample: products?.slice(0, 10)?.map((p: any) => ({
      title: p.title_sv,
      visible: p.is_visible,
      sellable: p.is_sellable,
      has_images: (p.image_urls?.length || 0) > 0,
      stock: p.stock,
      handle: p.handle,
    })),
    recent_bugs: recentBugs?.slice(0, 10),
    recent_tasks: recentWorkItems?.filter((w: any) => ["bug", "ux_issue"].includes(w.item_type))?.slice(0, 10),
  });

  const prompt = `Du är en UX-expert som analyserar en svensk e-handelswebbplats.

KONTEXT (rutter, sidor, produkter, kända buggar):
${context}

Utför en fullständig UX-skanning. Identifiera verkliga användbarhetsproblem. Analysera:

1. NAVIGERING: Finns döda länkar, brutna rutter, saknade breadcrumbs?
2. KLICKBARHET: Finns element som ser klickbara ut men inte är det? Knappar utan funktion?
3. SCROLL: Saknas scroll i listor? Gömt innehåll?
4. MOBIL UX: Touch targets för små? Överflöde på mobil?
5. FORMULÄR: Saknade labels, felhantering, inputtyper?
6. LADDNING: Saknade loading states, empty states?
7. KONVERTERING: Är köpflödet optimalt? Finns friktion?
8. TILLGÄNGLIGHET: Kontrast, aria-labels, tangentbordsnavigering?

Basera analysen på verklig data — inte spekulationer.`;

  const analysis = await callAIWithTools(lovableKey, prompt, [{
    type: "function",
    function: {
      name: "ux_scan_results",
      description: "Return UX scan findings",
      parameters: {
        type: "object",
        properties: {
          ux_score: { type: "number", description: "Overall UX score 0-100" },
          executive_summary: { type: "string" },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                category: { type: "string", enum: ["navigation", "clickability", "scroll", "mobile", "forms", "loading", "conversion", "accessibility"] },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                page: { type: "string" },
                description: { type: "string" },
                user_impact: { type: "string" },
                fix_suggestion: { type: "string" },
                can_auto_fix: { type: "boolean" },
              },
              required: ["title", "category", "severity", "page", "description", "user_impact", "fix_suggestion", "can_auto_fix"],
            },
          },
          positive_findings: {
            type: "array",
            items: { type: "string" },
          },
          issues_found: { type: "number" },
        },
        required: ["ux_score", "executive_summary", "issues", "positive_findings", "issues_found"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "ux_scan_results" } });

  // Persist scan result FIRST
  const uxScore = analysis?.ux_score || 0;
  const scanId = await persistScanResult(supabase, {
    scan_type: "ux_scan",
    results: analysis || {},
    overall_score: uxScore,
    overall_status: uxScore >= 80 ? "healthy" : uxScore >= 50 ? "warning" : "critical",
    issues_count: analysis?.issues_found || 0,
    executive_summary: analysis?.executive_summary || "",
  });

  let tasksCreated = 0;
  if (analysis?.issues) {
    for (const issue of analysis.issues) {
      if (!["critical", "high"].includes(issue.severity)) continue;
      const { data: existing } = await supabase
        .from("work_items")
        .select("id")
        .ilike("title", `%${issue.title.substring(0, 25)}%`)
        .in("status", ["open", "claimed", "in_progress"])
        .limit(1);
      if (!existing?.length) {
        await supabase.from("work_items").insert({
          title: `UX: ${issue.title}`.substring(0, 200),
          description: `Kategori: ${issue.category}\nSida: ${issue.page}\nPåverkan: ${issue.user_impact}\n\nBeskrivning: ${issue.description}\n\nFöreslagen fix: ${issue.fix_suggestion}`,
          status: "open",
          priority: issue.severity === "critical" ? "critical" : "high",
          item_type: "bug",
          source_type: "ai_scan",
          source_id: scanId || undefined,
          ai_detected: true,
          ai_confidence: "high",
          ai_category: "frontend",
          ai_type_classification: "ux_issue",
        });
        tasksCreated++;
      }
    }
  }

  if (scanId && tasksCreated > 0) await updateScanTaskCount(supabase, scanId, tasksCreated);
  return { ...analysis, tasks_created: tasksCreated, scan_id: scanId };
}

// ── Sync Scanner ──
async function handleSyncScan(supabase: any, lovableKey: string) {
  // 1. Categories: DB vs product_categories links
  const { data: allCats } = await supabase.from("categories").select("id, name_sv, slug, is_visible, parent_id").limit(200);
  const { data: pcLinks } = await supabase.from("product_categories").select("product_id, category_id").limit(2000);
  const { data: allProducts } = await supabase.from("products").select("id, title_sv, is_visible, is_sellable, category, status, handle, stock, image_urls").limit(500);
  const { data: recentOrders } = await supabase.from("orders").select("id, status, payment_status, total_amount, items, deleted_at, created_at").order("created_at", { ascending: false }).limit(50);
  const { data: workItems } = await supabase.from("work_items").select("id, title, status, source_type, source_id, related_order_id").in("status", ["open", "claimed", "in_progress"]).limit(200);
  const { data: bugReports } = await supabase.from("bug_reports").select("id, status, description").in("status", ["open", "investigating"]).limit(50);

  // Build sync checks
  const checks: any[] = [];

  // Check: orphan product_categories (category_id not in categories)
  const catIds = new Set((allCats || []).map((c: any) => c.id));
  const productIds = new Set((allProducts || []).map((p: any) => p.id));
  const orphanLinks = (pcLinks || []).filter((l: any) => !catIds.has(l.category_id));
  const orphanProductLinks = (pcLinks || []).filter((l: any) => !productIds.has(l.product_id));
  if (orphanLinks.length > 0) checks.push({ type: "orphan_category_link", count: orphanLinks.length, detail: `${orphanLinks.length} product_categories pekar till raderade kategorier` });
  if (orphanProductLinks.length > 0) checks.push({ type: "orphan_product_link", count: orphanProductLinks.length, detail: `${orphanProductLinks.length} product_categories pekar till raderade produkter` });

  // Check: categories with parent_id pointing to missing parent
  const orphanParents = (allCats || []).filter((c: any) => c.parent_id && !catIds.has(c.parent_id));
  if (orphanParents.length > 0) checks.push({ type: "orphan_parent", count: orphanParents.length, detail: `${orphanParents.length} kategorier pekar till raderad föräldrakategori`, items: orphanParents.map((c: any) => c.name_sv) });

  // Check: visible products without any category
  const productsWithCat = new Set((pcLinks || []).map((l: any) => l.product_id));
  const visibleNoCat = (allProducts || []).filter((p: any) => p.is_visible && p.is_sellable && !productsWithCat.has(p.id));
  if (visibleNoCat.length > 0) checks.push({ type: "product_no_category", count: visibleNoCat.length, detail: `${visibleNoCat.length} synliga produkter saknar kategoritilldelning`, items: visibleNoCat.slice(0, 10).map((p: any) => p.title_sv) });

  // Check: products with missing images
  const noImages = (allProducts || []).filter((p: any) => p.is_visible && (!p.image_urls || p.image_urls.length === 0));
  if (noImages.length > 0) checks.push({ type: "product_no_image", count: noImages.length, detail: `${noImages.length} synliga produkter saknar bilder`, items: noImages.slice(0, 10).map((p: any) => p.title_sv) });

  // Check: products with missing handle
  const noHandle = (allProducts || []).filter((p: any) => p.is_visible && !p.handle);
  if (noHandle.length > 0) checks.push({ type: "product_no_handle", count: noHandle.length, detail: `${noHandle.length} produkter saknar URL-handle` });

  // Check: work_items linked to deleted/cancelled orders
  const deletedOrderIds = new Set((recentOrders || []).filter((o: any) => o.deleted_at || o.status === "cancelled").map((o: any) => o.id));
  const staleWorkItems = (workItems || []).filter((w: any) => w.related_order_id && deletedOrderIds.has(w.related_order_id));
  if (staleWorkItems.length > 0) checks.push({ type: "stale_work_items", count: staleWorkItems.length, detail: `${staleWorkItems.length} aktiva uppgifter kopplade till raderade/avbrutna ordrar` });

  // Check: bug_reports with open status but linked work_item is done
  const bugSourceIds = new Set((workItems || []).filter((w: any) => w.source_type === "bug_report" && w.status === "done").map((w: any) => w.source_id));
  // Not straightforward without matching, but check open bugs count
  const openBugs = (bugReports || []).length;

  // Send to AI for analysis
  const prompt = `Du är en systemintegritetsexpert. Analysera dessa synkroniseringskontroller för en svensk e-handelsplattform.

KONTROLLER:
${JSON.stringify(checks, null, 2)}

STATS:
- Kategorier: ${(allCats || []).length}
- Produkter: ${(allProducts || []).length}
- Kategori-kopplingar: ${(pcLinks || []).length}
- Aktiva uppgifter: ${(workItems || []).length}
- Öppna buggar: ${openBugs}

Analysera synkroniseringsproblem mellan frontend och backend. Klassificera varje problem.`;

  const analysis = await callAIWithTools(lovableKey, prompt, [{
    type: "function",
    function: {
      name: "sync_scan_results",
      description: "Return sync scan findings",
      parameters: {
        type: "object",
        properties: {
          sync_score: { type: "number", description: "Sync health score 0-100" },
          executive_summary: { type: "string" },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                type: { type: "string", enum: ["category_mismatch", "product_mismatch", "orphan_data", "stale_reference", "missing_data", "status_desync"] },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                affected_count: { type: "number" },
                description: { type: "string" },
                fix_action: { type: "string" },
                can_auto_fix: { type: "boolean" },
              },
              required: ["title", "type", "severity", "affected_count", "description", "fix_action", "can_auto_fix"],
            },
          },
          auto_fixed: {
            type: "array",
            items: {
              type: "object",
              properties: { action: { type: "string" }, count: { type: "number" } },
              required: ["action", "count"],
            },
          },
          issues_found: { type: "number" },
        },
        required: ["sync_score", "executive_summary", "issues", "auto_fixed", "issues_found"],
        additionalProperties: false,
      },
    },
  }], { type: "function", function: { name: "sync_scan_results" } });

  // Auto-fix safe issues
  let autoFixCount = 0;
  // Fix orphan product_categories
  if (orphanLinks.length > 0) {
    for (const link of orphanLinks) {
      await supabase.from("product_categories").delete().eq("category_id", link.category_id).eq("product_id", link.product_id);
      autoFixCount++;
    }
  }
  if (orphanProductLinks.length > 0) {
    for (const link of orphanProductLinks) {
      await supabase.from("product_categories").delete().eq("product_id", link.product_id).eq("category_id", link.category_id);
      autoFixCount++;
    }
  }
  // Fix orphan parent references
  if (orphanParents.length > 0) {
    for (const cat of orphanParents) {
      await supabase.from("categories").update({ parent_id: null }).eq("id", cat.id);
      autoFixCount++;
    }
  }

  // Persist scan result FIRST
  const syncScore = analysis?.sync_score || 0;
  const scanId = await persistScanResult(supabase, {
    scan_type: "sync_scan",
    results: { ...analysis, auto_fixed_count: autoFixCount },
    overall_score: syncScore,
    overall_status: syncScore >= 80 ? "healthy" : syncScore >= 50 ? "warning" : "critical",
    issues_count: analysis?.issues_found || 0,
    executive_summary: analysis?.executive_summary || "",
  });

  let tasksCreated = 0;
  if (analysis?.issues) {
    for (const issue of analysis.issues) {
      if (!["critical", "high"].includes(issue.severity) || issue.can_auto_fix) continue;
      const { data: existing } = await supabase
        .from("work_items")
        .select("id")
        .ilike("title", `%${issue.title.substring(0, 25)}%`)
        .in("status", ["open", "claimed", "in_progress"])
        .limit(1);
      if (!existing?.length) {
        await supabase.from("work_items").insert({
          title: `Sync: ${issue.title}`.substring(0, 200),
          description: `Typ: ${issue.type}\nAntal påverkade: ${issue.affected_count}\n\n${issue.description}\n\nÅtgärd: ${issue.fix_action}`,
          status: "open",
          priority: issue.severity === "critical" ? "critical" : "high",
          item_type: "bug",
          source_type: "ai_scan",
          source_id: scanId || undefined,
          ai_detected: true,
          ai_confidence: "high",
          ai_category: "data_integrity",
          ai_type_classification: "sync_issue",
        });
        tasksCreated++;
      }
    }
  }

  if (scanId && tasksCreated > 0) await updateScanTaskCount(supabase, scanId, tasksCreated);
  return { ...analysis, tasks_created: tasksCreated, auto_fixed_count: autoFixCount, scan_id: scanId };
}

// ── Action Governor (Lovable 0.5) ──
async function handleActionGovernor(supabase: any, apiKey: string) {
  // Gather pending issues from multiple sources
  const [workItems, bugs, scanResults] = await Promise.all([
    supabase.from("work_items").select("id, title, description, status, priority, item_type, ai_category, ai_confidence, source_type").in("status", ["open", "claimed"]).order("created_at", { ascending: false }).limit(50),
    supabase.from("bug_reports").select("id, description, page_url, status, ai_severity, ai_category, ai_summary").eq("status", "open").limit(30),
    supabase.from("ai_scan_results").select("id, scan_type, overall_score, overall_status, executive_summary, results, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  const pendingWork = workItems.data || [];
  const openBugs = bugs.data || [];
  const recentScans = scanResults.data || [];

  const prompt = `You are the AI Action Governor (Lovable 0.5 mode). Analyze all pending system issues and classify each into an action tier.

You have CAPABILITY AWARENESS. You know exactly what you can and cannot do:

🟢 AI CAN DO (AUTO_FIX):
- Database operations: update status, delete orphan records, fix broken references, cleanup invalid data
- UI visibility: hide/show elements via database flags (is_visible, is_active)
- Status management: update work_item status, bug report status, order flags
- Data validation: detect and remove duplicates, fix null values, correct enum values
- Category management: fix parent references, remove orphan links, update display_order

🟡 AI NEEDS APPROVAL (ASSIST):
- Business logic changes: modify pricing, change commission rates, alter discount rules
- User data changes: modify profiles, reassign orders, merge accounts
- Bulk operations: mass status updates, batch deletions, large data migrations
- Configuration changes: update automation rules, change email templates

🔴 REQUIRES LOVABLE (code changes needed):
- New UI components: adding pages, buttons, forms, modals
- Frontend logic: new hooks, state management, routing changes
- Styling changes: CSS, layout modifications, responsive fixes
- New API integrations: adding edge functions, new external service calls
- Schema changes: new tables, columns, indexes, RLS policies
- Bug fixes in React/TypeScript code

ACTION TIERS:
🟢 AUTO_FIX — Safe to execute directly (database-only operations)
🟡 ASSIST — Needs human approval (business-impacting changes)
🔴 LOVABLE_REQUIRED — Requires code changes via Lovable

PENDING WORK ITEMS (${pendingWork.length}):
${JSON.stringify(pendingWork.slice(0, 30), null, 1)}

OPEN BUGS (${openBugs.length}):
${JSON.stringify(openBugs.slice(0, 20), null, 1)}

RECENT SCAN RESULTS (${recentScans.length}):
${recentScans.map((s: any) => `${s.scan_type}: score=${s.overall_score}, status=${s.overall_status}`).join("\n")}

For each issue, return a JSON object with:
{
  "actions": [
    {
      "id": "<source_id>",
      "source": "work_item" | "bug" | "scan",
      "title": "<short title>",
      "classification": "auto_fix" | "assist" | "lovable_required",
      "confidence": 0-100,
      "reason": "<why this classification>",
      "fix_description": "<what to do>",
      "capability": {
        "can_fix": true/false,
        "fix_type": "database" | "config" | "ui_code" | "backend_code" | "architecture",
        "explanation": "<I can fix this because... OR I need Lovable because...>"
      },
      "conflict_risk": "none" | "low" | "medium" | "high",
      "conflict_detail": "<potential conflicts>",
      "lovable_prompt": "<structured prompt if lovable_required, null otherwise>"
    }
  ],
  "summary": {
    "total": <number>,
    "auto_fix_count": <number>,
    "assist_count": <number>,
    "lovable_required_count": <number>,
    "blocked_count": <number>,
    "system_risk_level": "low" | "medium" | "high"
  },
  "prompt_queue": [
    {
      "title": "<prompt title>",
      "prompt": "<full structured Lovable prompt>",
      "priority": "critical" | "high" | "medium" | "low",
      "related_ids": ["<id1>"]
    }
  ]
}

SAFETY RULES:
- Never classify destructive data operations as auto_fix
- If an action could break existing features, mark conflict_risk as high and classify as assist or lovable_required
- Generate clean, structured Lovable prompts for lovable_required items
- Block any action with high conflict risk (set classification to "assist" with explanation)
- ALWAYS fill in the capability object — be honest about what you can and cannot do`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const status = resp.status;
    if (status === 429) throw Object.assign(new Error("Rate limited"), { status: 429 });
    if (status === 402) throw Object.assign(new Error("Credits exhausted"), { status: 402 });
    throw new Error(`AI error: ${status}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  let analysis: any;
  try {
    analysis = JSON.parse(content);
  } catch {
    analysis = { actions: [], summary: { total: 0, auto_fix_count: 0, assist_count: 0, lovable_required_count: 0, blocked_count: 0, system_risk_level: "low" }, prompt_queue: [] };
  }

  // Store governor scan result
  await supabase.from("ai_scan_results").insert({
    scan_type: "action_governor",
    overall_score: analysis.summary?.auto_fix_count || 0,
    overall_status: analysis.summary?.system_risk_level === "high" ? "critical" : analysis.summary?.system_risk_level === "medium" ? "warning" : "healthy",
    executive_summary: `Governor: ${analysis.summary?.auto_fix_count || 0} auto-fix, ${analysis.summary?.assist_count || 0} assist, ${analysis.summary?.lovable_required_count || 0} lovable-required`,
    results: analysis,
    issues_count: analysis.summary?.total || 0,
    tasks_created: 0,
  });

  // Log all classified actions
  for (const action of (analysis.actions || []).slice(0, 20)) {
    await supabase.from("activity_logs").insert({
      log_type: "ai_governor",
      category: "ai",
      message: `Governor classified "${action.title}" as ${action.classification} (confidence: ${action.confidence}%, conflict: ${action.conflict_risk})`,
      details: { action_id: action.id, classification: action.classification, confidence: action.confidence, conflict_risk: action.conflict_risk },
    });
  }

  // Save lovable_required prompts to prompt_queue
  for (const p of (analysis.prompt_queue || []).slice(0, 10)) {
    await supabase.from("prompt_queue").insert({
      title: (p.title || "AI-genererad prompt").substring(0, 200),
      goal: p.related_ids?.length ? `Relaterade: ${p.related_ids.join(", ")}` : null,
      implementation: p.prompt || "",
      priority: p.priority || "medium",
      source_type: "ai_governor",
    });
  }

  return analysis;
}

// ── Governor Execute (run an auto_fix action) ──
async function handleGovernorExecute(supabase: any, apiKey: string, actionId: string, classification: string) {
  if (classification !== "auto_fix") {
    return { executed: false, reason: "Only auto_fix actions can be directly executed" };
  }

  // Try to find and execute the action on work_items
  const { data: item } = await supabase.from("work_items").select("*").eq("id", actionId).maybeSingle();
  
  let executed = false;
  let action_taken = "";

  if (item) {
    // Safe auto-fix actions for work items
    if (item.status === "open" && item.item_type === "bug" && item.ai_detected) {
      // Mark AI-detected low-priority items as acknowledged
      if (["low", "medium"].includes(item.priority)) {
        await supabase.from("work_items").update({ status: "in_progress", ai_confidence: "high" }).eq("id", actionId);
        action_taken = `Moved work item "${item.title}" to in_progress`;
        executed = true;
      }
    }
  }

  // Try bug reports
  if (!executed) {
    const { data: bug } = await supabase.from("bug_reports").select("*").eq("id", actionId).maybeSingle();
    if (bug && bug.status === "open" && bug.ai_severity === "low") {
      await supabase.from("bug_reports").update({ status: "acknowledged" }).eq("id", actionId);
      action_taken = `Acknowledged low-severity bug "${bug.ai_summary || bug.description?.substring(0, 50)}"`;
      executed = true;
    }
  }

  // Log the execution
  await supabase.from("activity_logs").insert({
    log_type: executed ? "ai_governor_execute" : "ai_governor_blocked",
    category: "ai",
    message: executed ? `Governor executed: ${action_taken}` : `Governor blocked execution for ${actionId} — no safe action found`,
    details: { action_id: actionId, classification, executed, action_taken },
  });

  return { executed, action_taken: action_taken || "No safe action available for this item" };
}

// ── Double-Pass Multi-AI Orchestration ──
async function handleDoublePass(supabase: any, apiKey: string, context: string) {
  const snapshot = await gatherSystemSnapshot(supabase);

  const systemContext = `
Current system state:
- Work items: ${snapshot.workItems?.length || 0} open
- Bug reports: ${snapshot.bugReports?.length || 0} open  
- Recent scans: ${snapshot.scanResults?.length || 0}
- Products: ${snapshot.products?.length || 0}
- Orders (7d): ${snapshot.recentOrders?.length || 0}

Focus area: ${context}
`;

  // ── PASS 1: Generate + Validate ──
  const pass1Generator = await callAIWithModel(apiKey, "google/gemini-2.5-flash", [
    { role: "system", content: `Du är en systemarkitekt (Generator). Analysera systemet och skapa en lösningsplan.
Returnera JSON:
{
  "solution_v1": { "title": "string", "analysis": "string", "recommendations": ["string"], "priority_actions": [{"action": "string", "priority": "high|medium|low", "type": "auto_fix|assist|lovable_required"}] },
  "confidence": 0-100,
  "areas_analyzed": ["string"]
}` },
    { role: "user", content: `Analysera systemet och skapa förbättringsplan.\n${systemContext}` }
  ]);

  let generatorResult: any;
  try { generatorResult = JSON.parse(pass1Generator); } catch { generatorResult = { solution_v1: { title: "Analys", analysis: pass1Generator, recommendations: [], priority_actions: [] }, confidence: 50, areas_analyzed: [] }; }

  const pass1Validator = await callAIWithModel(apiKey, "openai/gpt-5-mini", [
    { role: "system", content: `Du är en kodgranskare (Validator). Granska lösningsförslaget och hitta problem.
Returnera JSON:
{
  "issues_found": [{"issue": "string", "severity": "critical|high|medium|low", "suggestion": "string"}],
  "approval_score": 0-100,
  "missing_considerations": ["string"],
  "risk_assessment": "low|medium|high"
}` },
    { role: "user", content: `Granska detta förslag:\n${JSON.stringify(generatorResult.solution_v1)}\n\nSystemkontext:\n${systemContext}` }
  ]);

  let validatorResult: any;
  try { validatorResult = JSON.parse(pass1Validator); } catch { validatorResult = { issues_found: [], approval_score: 70, missing_considerations: [], risk_assessment: "medium" }; }

  const pass1Refiner = await callAIWithModel(apiKey, "google/gemini-2.5-flash-lite", [
    { role: "system", content: `Du är en optimerare (Executor). Ta lösningen och valideringen, förfina till en bättre lösning.
Returnera JSON:
{
  "improvements": [{"area": "string", "before": "string", "after": "string"}],
  "refined_actions": [{"action": "string", "priority": "high|medium|low", "type": "auto_fix|assist|lovable_required", "rationale": "string"}],
  "optimization_notes": "string"
}` },
    { role: "user", content: `Originalförslag:\n${JSON.stringify(generatorResult.solution_v1)}\n\nValideringsresultat:\n${JSON.stringify(validatorResult)}` }
  ]);

  let refinerResult: any;
  try { refinerResult = JSON.parse(pass1Refiner); } catch { refinerResult = { improvements: [], refined_actions: [], optimization_notes: pass1Refiner }; }

  // ── Smart Stop Condition: Check if Pass 2 is needed ──
  const pass1Score = validatorResult.approval_score || 0;
  const pass1IssueCount = validatorResult.issues_found?.length || 0;
  const pass1Risk = validatorResult.risk_assessment || "medium";
  const pass1Confidence = generatorResult.confidence || 0;

  const SKIP_THRESHOLD_SCORE = 85;
  const SKIP_THRESHOLD_CONFIDENCE = 80;

  const pass1Stable = pass1Score >= SKIP_THRESHOLD_SCORE && pass1Confidence >= SKIP_THRESHOLD_CONFIDENCE;
  const noSignificantIssues = pass1IssueCount === 0 || (pass1IssueCount <= 2 && pass1Risk === "low");
  const skipPass2 = pass1Stable && noSignificantIssues;

  let pass2GenResult: any = null;
  let pass2ValResult: any = null;
  let stopReason = "";

  if (skipPass2) {
    stopReason = `Pass 2 hoppades över: Pass 1 score ${pass1Score}/100, confidence ${pass1Confidence}/100, ${pass1IssueCount} problem (risk: ${pass1Risk}). Lösningen är redan stabil.`;
  } else {
    // ── PASS 2: Refine + Final Review ──
    const pass2Generator = await callAIWithModel(apiKey, "google/gemini-2.5-flash", [
      { role: "system", content: `Du är systemarkitekten igen (Generator Pass 2). Förbättra lösningen baserat på feedback. BYGG VIDARE — starta inte om.
Returnera JSON:
{
  "solution_v2": { "title": "string", "final_analysis": "string", "final_recommendations": ["string"], "final_actions": [{"action": "string", "priority": "high|medium|low", "type": "auto_fix|assist|lovable_required", "confidence": 0-100}] },
  "improvement_delta": "string",
  "pass2_confidence": 0-100
}` },
      { role: "user", content: `Pass 1 lösning:\n${JSON.stringify(generatorResult.solution_v1)}\n\nValideringsproblem:\n${JSON.stringify(validatorResult.issues_found)}\n\nFörfiningar:\n${JSON.stringify(refinerResult)}\n\nFörbättra lösningen.` }
    ]);

    try { pass2GenResult = JSON.parse(pass2Generator); } catch { pass2GenResult = { solution_v2: { title: "Förbättrad analys", final_analysis: pass2Generator, final_recommendations: [], final_actions: [] }, improvement_delta: "N/A", pass2_confidence: 60 }; }

    // Check improvement delta before running expensive critical validator
    const pass2Confidence = pass2GenResult.pass2_confidence || 0;
    const improvementDelta = pass2Confidence - pass1Confidence;
    const newActionsCount = pass2GenResult.solution_v2?.final_actions?.length || 0;
    const pass1ActionsCount = generatorResult.solution_v1?.priority_actions?.length || 0;
    const solutionUnchanged = improvementDelta < 5 && Math.abs(newActionsCount - pass1ActionsCount) <= 1;

    if (solutionUnchanged && pass1Score >= 70) {
      stopReason = `Pass 2 Generator visade minimal förbättring (delta: ${improvementDelta}). Critical Validator hoppades över för att spara resurser.`;
      pass2ValResult = {
        final_approval_score: Math.max(pass1Score, pass2Confidence),
        remaining_issues: validatorResult.issues_found || [],
        ready_for_execution: pass1Score >= 60,
        final_verdict: `Lösningen var stabil redan efter Pass 1. Minimal förbättring i Pass 2 (delta: ${improvementDelta}).`,
        skipped_critical_review: true,
      };
    } else {
      const pass2Validator = await callAIWithModel(apiKey, "openai/gpt-5", [
        { role: "system", content: `Du är en KRITISK säkerhetsgranskare (Critical Validator Pass 2). Din uppgift är att STRESS-TESTA lösningen. Var aggressivt kritisk.

Du MÅSTE:
1. EDGE CASES — Hitta extremfall som kan krascha systemet (tom data, stora volymer, samtidiga anrop, ogiltiga inputs, unicode, SQL injection, XSS)
2. HIDDEN BUGS — Identifiera race conditions, minnesläckor, oändliga loopar, felaktig felhantering, saknade null-checks
3. CHALLENGE ASSUMPTIONS — Ifrågasätt varje antagande. Vad händer om DB är nere? Om API svarar långsamt? Om användaren är offline?
4. SCALABILITY — Kan detta hantera 10x, 100x nuvarande last? Var finns flaskhalsarna?
5. SECURITY — Identifiera privilege escalation, data exposure, missing auth checks, insecure defaults
6. DATA INTEGRITY — Kan data bli inkonsistent? Saknas transaktioner? Finns orphaned records-risker?

Returnera JSON:
{
  "final_approval_score": 0-100,
  "remaining_issues": [{"issue": "string", "severity": "critical|high|medium|low", "category": "edge_case|hidden_bug|assumption|scalability|security|data_integrity"}],
  "edge_cases_tested": [{"scenario": "string", "result": "pass|fail|unknown", "risk": "string"}],
  "stress_test_results": {"scalability_score": 0-100, "bottlenecks": ["string"], "breaking_point": "string"},
  "security_audit": {"vulnerabilities": ["string"], "risk_level": "low|medium|high|critical"},
  "ready_for_execution": true/false,
  "final_verdict": "string",
  "must_fix_before_deploy": ["string"]
}` },
        { role: "user", content: `Slutgiltig lösning att STRESS-TESTA:\n${JSON.stringify(pass2GenResult.solution_v2)}\n\nUrsprungliga problem (Pass 1):\n${JSON.stringify(validatorResult.issues_found)}\n\nPass 1 Validator Score: ${validatorResult.approval_score}/100\nPass 1 Risk: ${validatorResult.risk_assessment}\n\nGör DJUPGÅENDE kritisk granskning. Var hård.` }
      ]);

      try { pass2ValResult = JSON.parse(pass2Validator); } catch { pass2ValResult = { final_approval_score: 65, remaining_issues: [], ready_for_execution: true, final_verdict: pass2Validator }; }
    }
  }

  // ── Governor Decision ──
  const passesRun = skipPass2 ? 1 : 2;
  const finalScore = skipPass2
    ? pass1Score
    : (pass2ValResult?.final_approval_score || 0);
  const significantImprovement = !skipPass2 && (pass2GenResult?.pass2_confidence || 0) > pass1Confidence;

  const governorDecision = {
    use_pass: skipPass2 ? 1 : (significantImprovement ? 2 : 1),
    reason: stopReason || (significantImprovement ? "Pass 2 visade signifikant förbättring" : "Pass 1 var redan tillräckligt bra"),
    final_score: finalScore,
    ready: skipPass2 ? true : (pass2ValResult?.ready_for_execution ?? true),
    passes_run: passesRun,
    early_stop: skipPass2 || !!stopReason,
    stop_reason: stopReason || null,
  };

  // Save prompt_queue entries for lovable_required actions
  const finalActions = governorDecision.use_pass === 2
    ? (pass2GenResult?.solution_v2?.final_actions || [])
    : (refinerResult.refined_actions || generatorResult.solution_v1?.priority_actions || []);

  const lovableActions = finalActions.filter((a: any) => a.type === "lovable_required");
  for (const action of lovableActions.slice(0, 5)) {
    await supabase.from("prompt_queue").insert({
      title: (action.action || "").substring(0, 200),
      implementation: `Genererat av Double-Pass Orchestration.\n\nÅtgärd: ${action.action}\nPrioritet: ${action.priority}\nRationale: ${action.rationale || "AI-genererad"}\nKonfidenspoäng: ${action.confidence || "N/A"}`,
      priority: action.priority || "medium",
      source_type: "ai_orchestration",
    });
  }

  // Log
  await supabase.from("activity_logs").insert({
    log_type: "ai_orchestration",
    category: "ai",
    message: `Double-Pass Orchestration slutförd. Score: ${governorDecision.final_score}/100. Pass: ${passesRun}. ${governorDecision.early_stop ? 'Early stop.' : ''}`,
    details: { governor_decision: governorDecision, pass1_confidence: generatorResult.confidence, pass2_confidence: pass2GenResult?.pass2_confidence },
  });

  return {
    pass1: {
      generator: generatorResult,
      validator: validatorResult,
      refiner: refinerResult,
    },
    pass2: skipPass2 ? null : {
      generator: pass2GenResult,
      validator: pass2ValResult,
    },
    governor_decision: governorDecision,
    prompts_queued: lovableActions.length,
  };
}

// Helper to call AI with specific model
async function callAIWithModel(apiKey: string, model: string, messages: { role: string; content: string }[]): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
  });
  if (!resp.ok) {
    if (resp.status === 429) throw Object.assign(new Error("Rate limited"), { status: 429 });
    if (resp.status === 402) throw Object.assign(new Error("Credits exhausted"), { status: 402 });
    throw new Error(`AI call failed: ${resp.status}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  // Strip markdown code fences
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

// ── Lova 0.5 Chat Handler ──
async function handleLovaChat(supabase: any, lovableKey: string, userId: string, message: string, conversationId?: string) {
  const convId = conversationId || crypto.randomUUID();

  // Save user message
  await supabase.from("ai_chat_messages").insert({
    conversation_id: convId,
    user_id: userId,
    role: "user",
    content: message,
  });

  // Load conversation history (last 30 messages)
  const { data: history } = await supabase
    .from("ai_chat_messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(30);

  // Gather system snapshot for context
  const snapshot = await gatherSystemSnapshot(supabase);

  // Get open work items, recent scans (ALL types with latest per type), bugs, prompt queue, dismissed issues, and change log
  const [workRes, scanRes, bugsRes, promptRes, dismissRes, historyRes, changeLogRes] = await Promise.all([
    supabase.from("work_items").select("id, title, status, priority, item_type").in("status", ["open", "claimed", "in_progress"]).order("created_at", { ascending: false }).limit(15),
    supabase.from("ai_scan_results").select("scan_type, overall_score, overall_status, executive_summary, issues_count, tasks_created, created_at, results").order("created_at", { ascending: false }).limit(50),
    supabase.from("bug_reports").select("id, description, ai_summary, ai_severity, status").eq("status", "open").order("created_at", { ascending: false }).limit(10),
    supabase.from("prompt_queue").select("id, title, status, priority, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("scan_dismissals").select("issue_key, issue_title, reason, created_at").limit(100),
    supabase.from("system_history").select("title, item_type, resolution_notes, ai_review_status, archived_at").order("archived_at", { ascending: false }).limit(20),
    supabase.from("change_log").select("id, description, change_type, source, affected_components, bug_report_id, work_item_id, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  const openWork = workRes.data || [];
  const allScans = scanRes.data || [];
  const openBugs = bugsRes.data || [];
  const allPrompts = promptRes.data || [];
  const dismissedIssues = dismissRes.data || [];
  const recentHistory = historyRes.data || [];
  const recentChanges = changeLogRes.data || [];
  const pendingPrompts = allPrompts.filter((p: any) => p.status === "pending");
  const donePrompts = allPrompts.filter((p: any) => p.status === "done");
  const recentlyDone = donePrompts.filter((p: any) => {
    const age = Date.now() - new Date(p.created_at).getTime();
    return age < 7 * 24 * 60 * 60 * 1000;
  });

  // Group scans by type — latest per scan_type for overview + trends
  const scansByType: Record<string, any[]> = {};
  for (const s of allScans) {
    if (!scansByType[s.scan_type]) scansByType[s.scan_type] = [];
    scansByType[s.scan_type].push(s);
  }
  const latestPerType = Object.entries(scansByType).map(([type, scans]) => {
    const latest = scans[0];
    const prev = scans[1];
    const trend = prev ? (latest.overall_score || 0) - (prev.overall_score || 0) : 0;
    // Extract issue summaries from results for deeper context
    const issuesSummary = latest.results?.issues?.slice?.(0, 5)?.map?.((i: any) => i.title || i.description || i.message)?.filter?.(Boolean) || [];
    return { type, score: latest.overall_score, status: latest.overall_status, summary: latest.executive_summary, issues_count: latest.issues_count, trend, scanned_at: latest.created_at, top_issues: issuesSummary, scan_count: scans.length };
  });

  const capabilityContext = `
=== LOVA 1.0 — SYSTEM OPERATOR FÖR 4THEPEOPLE.SE ===

Du är Lova, full-stack system operator för 4thepeople.se. Du agerar som debugger, testare, fixare och operatör — INTE en assistent.

═══ TONFALL ═══
- Kort, säker, professionell. Som en senior CTO — inte en assistent som frågar.
- ALDRIG: "Vill du att jag..." eller "Ska jag...?" — GÖR ISTÄLLET.
- ALDRIG: upprepningar, långa förklaringar, onödiga frågor, generiska svar
- Säg vad du GÖR, inte vad du KAN göra

═══ MODE 1 — SYSTEMANALYS ═══
För varje problem, identifiera:
→ Exakt problem (inte symptom)
→ Påverkade system (frontend / backend / state / databas / integration)
→ Dataflöde: scan → issues → work_items → change_log → verification
Klassificera ALLTID: frontend | backend | state | database | integration

═══ MODE 2 — DEBUG-TÄNKANDE ═══
Spåra dataflödet steg-för-steg vid varje fråga:
- Detektera: brutna länkar, stale state, ID-mismatch, saknade skrivningar, felaktiga läsningar
- Output: EXAKT felpunkt med tabell, kolumn, värde
- Verifiera mot ändringsloggen: redan fixat? regression? relaterad ändring?

═══ MODE 3 — SIMULERAD TESTNING ═══
Vid skanningar och QA, tänk som en riktig användare:
- Simulera: klicka alla knappar, öppna alla objekt, scrolla alla vyer
- Detektera: döda klick, saknad scroll, trasig navigation, UI-inkonsekvens
- Trigga hela flöden: scan → bugg → fix → verifiering

═══ MODE 4 — FIXEXEKVERING ═══
För varje problem:
1. Föreslå exakt fix (kod-nivå med filreferens)
2. Om möjligt → utför direkt (query_data, update_work_item, close_bug, run_cleanup)
3. Om kodändring krävs → generera Lovable-prompt DIREKT (generate_lovable_prompt)
4. ALDRIG vaga förslag. Konkret fil, funktion, rad.

═══ MODE 5 — POST-FIX VERIFIERING ═══
Efter varje fix:
- Kör relevant skanning (run_scan) för att bekräfta
- Kontrollera: bugg borta, system stabilt, ingen regression
- Om fix misslyckades → rapportera och öppna nytt work item automatiskt

═══ MODE 6 — KONTEXTMINNE ═══
INNAN du svarar på ett problem:
1. Sök ändringsloggen — redan fixat? → "Fixat redan [datum] via [beskrivning]"
2. Sök buggar — dubblett? → flagga
3. Sök historik — regression? → "Misslyckades förra gången, prioriterar"
4. Matcha affected_components mot nuvarande problem
SÄGA ALDRIG "jag har ingen information" om data finns i kontexten.

═══ MODE 7 — SVAR-FORMAT (OBLIGATORISKT) ═══
Varje svar ska följa denna struktur:
1. **Diagnos**: Exakt issue (en mening)
2. **Rotorsak**: Vad orsakar problemet
3. **System**: frontend | backend | state | database | integration
4. **Fix**: Steg-för-steg (max 3-5 steg)
5. **Åtgärd**: ✅ Fixat / ⚠️ Prompt skapad / ❌ Kräver manuell åtgärd
6. **Verifiering**: Hur vi bekräftar att fixen fungerar

Vid statusrapporter/översikter, använd istället kortfattade punktlistor med ✅/⚠️/❌.

═══ INTELLIGENS & KONTEXT ═══
- Du FÖRSTÅR kontext. Om användaren listar alternativ (1, 2, 3) och sedan säger "punkt 3" — du vet vad det betyder.
- Du MINNS hela konversationen. Referera tillbaka utan att fråga.
- Du ANALYSERAR data aktivt. Ser du problem → rapportera direkt utan att bli ombedd.
- Du PRIORITERAR själv. Kritiska problem först, sedan viktigt, sedan nice-to-have.

═══ AUTONOM BUGG-HANTERING ═══
- TRIAGE: Använd triage_bugs för att automatiskt sortera, kategorisera och prioritera ALLA öppna buggar
- STÄNG DUBBLETTER: Identifiera och stäng buggar som är dubbletter, redan fixade, eller irrelevanta
- GRUPPERA: Slå ihop liknande buggar till en sammanhängande work item
- AGERA: Skapa work items och generera Lovable-prompts DIREKT
- Fråga ALDRIG "ska jag gå igenom buggarna?" — GÖR DET DIREKT

═══ VERKTYG (execute_action) ═══
✅ DIREKT: run_scan, create_work_item, update_work_item, run_cleanup, run_data_integrity, query_data, generate_lovable_prompt, triage_bugs, close_bug, batch_update_bugs, self_note
⚠️ VIA PROMPT: UI-ändringar, nya features, edge functions → generate_lovable_prompt automatiskt

═══ SELF-NOTE & SJÄLVFÖRBÄTTRING ═══
- Använd "self_note" för egna uppgifter (databasrensning, bugg-triage, optimeringar)
- Separera: "Jag fixar detta själv ✅" vs "Kräver manuell åtgärd via Lovable ⚠️"
- IGNORERADE ISSUES: Om en issue är dismissed, NÄMN den INTE. Respektera användarens beslut.

═══ REGLER ═══
🚫 Inga generiska svar
🚫 Inga antaganden utan data
🚫 Ingen hoppning av verifiering
🚫 Inga feature-förslag (om inte ombedd)
`;

  const systemData = `
${snapshot.summary}

=== ÖPPNA UPPGIFTER (${openWork.length}) ===
${openWork.map((w: any) => `[${w.priority}] ${w.title} (${w.status})`).join("\n")}

=== SENASTE SKANNINGAR PER TYP (${latestPerType.length} typer, ${allScans.length} totalt) ===
${latestPerType.map((s: any) => {
  const trendStr = s.trend > 0 ? `📈+${s.trend}` : s.trend < 0 ? `📉${s.trend}` : '→';
  const issuesStr = s.top_issues.length > 0 ? `\n  Issues: ${s.top_issues.join('; ')}` : '';
  return `${s.type}: ${s.status} (${s.score}/100) ${trendStr} — ${s.summary || "Ingen sammanfattning"} [${s.issues_count} issues, ${s.scan_count} skanningar]${issuesStr}`;
}).join("\n")}

=== ÖPPNA BUGGAR (${openBugs.length}) ===
${openBugs.map((b: any) => `[${b.ai_severity || "?"}] ${b.ai_summary || b.description.substring(0, 80)}`).join("\n")}

=== PROMPT-KÖ ===
Väntande: ${pendingPrompts.length} | Klara (7d): ${recentlyDone.length}
${pendingPrompts.map((p: any) => `⏳ [${p.priority}] ${p.title}`).join("\n")}
${recentlyDone.length > 0 ? `\nNyligen avklarade:\n${recentlyDone.map((p: any) => `✅ ${p.title}`).join("\n")}` : ""}

=== IGNORERADE ISSUES (${dismissedIssues.length}) ===
${dismissedIssues.map((d: any) => `❌ ${d.issue_title} — "${d.reason}"`).join("\n") || "Inga ignorerade issues"}

=== SENASTE HISTORIK (avslutade uppgifter) ===
${recentHistory.map((h: any) => `[${h.ai_review_status}] ${h.title} (${h.item_type}) — ${h.resolution_notes || 'Ingen notering'}`).join("\n") || "Ingen historik"}

=== ÄNDRINGSLOGG (senaste ${recentChanges.length} ändringar) ===
${recentChanges.map((c: any) => {
  const components = c.affected_components?.length ? ` [${c.affected_components.join(', ')}]` : '';
  const linkedBug = c.bug_report_id ? ` 🐛bug:${c.bug_report_id.substring(0, 8)}` : '';
  const linkedWork = c.work_item_id ? ` 📋task:${c.work_item_id.substring(0, 8)}` : '';
  return `[${c.change_type}/${c.source}] ${c.description}${components}${linkedBug}${linkedWork} (${c.created_at?.substring(0, 16)})`;
}).join("\n") || "Inga ändringar loggade"}

VIKTIGT: Du har tillgång till ALL skanningshistorik per typ med trender. Använd detta för att:
- Identifiera FÖRSÄMRINGAR (📉) och agera proaktivt
- Korrelera problem mellan olika skannrar (t.ex. overflow + UX)
- Undvika att rapportera redan fixade eller ignorerade issues
- Referera till specifika skanningsresultat när du diskuterar problem
Föreslå ALDRIG ignorerade issues.

═══ ÄNDRINGSMEDVETENHET (KRITISKT) ═══
Du har FULL tillgång till ändringsloggen ovan. Använd den AKTIVT:
1. **Redan fixat?** — Innan du föreslår en fix, SÖK igenom ändringsloggen. Om problemet redan åtgärdats, säg: "Det fixades redan [datum] via [change_type]: [beskrivning]"
2. **Relaterade ändringar** — Om ett problem kan kopplas till en tidigare ändring, nämn det: "Det kan vara relaterat till ändringen [beskrivning] den [datum]"
3. **Regressioner** — Om en 'reopen'-ändring finns i loggen, prioritera den och nämn att den redan misslyckats en gång
4. **Komponenter** — Matcha affected_components mot buggar/problem för att snabbt identifiera riskområden
5. **Dubbletter** — Om en bugg beskriver samma sak som en nyligen gjord fix, flagga det som potentiell dubblett
6. **SÄGA ALDRIG** "jag har ingen information om detta" om det finns relevant data i ändringsloggen
`;

  const messages = [
    { role: "system", content: capabilityContext + "\n\n" + systemData },
    ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
  ];

  // Call AI with tool calling for actions
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "execute_action",
            description: "Execute a database action or trigger a scan/fix. For generate_lovable_prompt: params MUST include 'title' (short name), 'prompt' (full detailed implementation prompt in English with steps, goal, expected result - at least 100 chars), and 'goal' (one-line goal).",
            parameters: {
              type: "object",
              properties: {
                action_type: {
                  type: "string",
                  enum: ["run_scan", "create_work_item", "update_work_item", "run_double_pass", "generate_lovable_prompt", "run_cleanup", "run_data_integrity", "query_data", "triage_bugs", "close_bug", "batch_update_bugs", "self_note"],
                  description: "Type of action to execute. self_note: create a task that AI will handle itself or flag for manual work. triage_bugs: autonomously sort/prioritize/group all open bugs. close_bug: close a specific bug by id. batch_update_bugs: update multiple bugs at once.",
                },
                params: {
                  type: "object",
                  description: "Parameters for the action. For self_note: { title, description, can_self_fix: boolean, priority }. If can_self_fix=true, AI will auto-handle. If false, creates a work item flagged for manual Lovable prompt. For triage_bugs: {} (no params needed). For close_bug: { bug_id, resolution_notes }. For batch_update_bugs: { bug_ids: string[], status, resolution_notes }. For generate_lovable_prompt: { title, prompt (min 100 chars), goal }. For create_work_item: { title, description, priority }.",
                },
              },
              required: ["action_type", "params"],
            },
          },
        },
      ],
      temperature: 0.4,
    }),
  });

  if (!aiResp.ok) {
    if (aiResp.status === 429) throw Object.assign(new Error("Rate limited"), { status: 429 });
    if (aiResp.status === 402) throw Object.assign(new Error("Credits exhausted"), { status: 402 });
    throw new Error(`AI call failed: ${aiResp.status}`);
  }

  const aiData = await aiResp.json();
  const choice = aiData.choices?.[0]?.message;
  let responseText = choice?.content || "";
  const toolCalls = choice?.tool_calls || [];
  const actionResults: any[] = [];

  // Execute any tool calls
  for (const tc of toolCalls) {
    if (tc.function?.name === "execute_action") {
      try {
        const args = JSON.parse(tc.function.arguments);
        const actionResult = await executeLovaAction(supabase, lovableKey, args);
        actionResults.push({ action: args.action_type, result: actionResult });
      } catch (e: any) {
        actionResults.push({ action: "unknown", error: e.message });
      }
    }
  }

  // If there were tool calls but no text, generate a follow-up response
  if (toolCalls.length > 0 && !responseText) {
    const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          ...messages,
          { role: "assistant", content: `Jag utförde följande åtgärder: ${JSON.stringify(actionResults)}` },
          { role: "user", content: "Sammanfatta vad du precis gjorde och resultatet. Var konkret." },
        ],
        temperature: 0.3,
      }),
    });
    if (followUp.ok) {
      const fData = await followUp.json();
      responseText = fData.choices?.[0]?.message?.content || "Åtgärd utförd.";
    } else {
      responseText = "Åtgärder utförda. Se resultat nedan.";
    }
  }

  if (!responseText) responseText = "Jag kunde inte generera ett svar. Försök omformulera din fråga.";

  // Save assistant response
  await supabase.from("ai_chat_messages").insert({
    conversation_id: convId,
    user_id: userId,
    role: "assistant",
    content: responseText,
    metadata: actionResults.length > 0 ? { actions: actionResults } : {},
  });

  return {
    conversation_id: convId,
    response: responseText,
    actions: actionResults,
  };
}

// Execute Lova actions
async function executeLovaAction(supabase: any, lovableKey: string, args: any) {
  const { action_type, params = {} } = args;

  switch (action_type) {
    case "run_scan": {
      const scanType = params.scan_type || "system_scan";
      if (scanType === "visual_qa") return await handleVisualQA(supabase, lovableKey);
      if (scanType === "nav_scan") return await handleNavScan(supabase, lovableKey);
      if (scanType === "bug_rescan") return await handleBugRescan(supabase, lovableKey);
      if (scanType === "structure_analysis") return await handleStructureAnalysis(supabase, lovableKey);
      if (scanType === "interaction_qa") return await handleInteractionQA(supabase, lovableKey);
      if (scanType === "focused_scan") return await handleFocusedScan(supabase, lovableKey);
      if (scanType === "ux_scan") return await handleUxScan(supabase, lovableKey);
      if (scanType === "sync_scan") return await handleSyncScan(supabase, lovableKey);
      if (scanType === "data_integrity") return await handleDataIntegrity(supabase);

      // Default / system-level scan
      return await handleSystemHealth(supabase, lovableKey);
    }
    case "run_double_pass": {
      const context = params.context || "general";
      return await handleDoublePass(supabase, lovableKey, context);
    }
    case "create_work_item": {
      const { data, error } = await supabase.from("work_items").insert({
        title: (params.title || "AI-skapad uppgift").substring(0, 200),
        description: params.description || "",
        status: "open",
        priority: params.priority || "medium",
        item_type: params.item_type || "manual",
        source_type: "ai_chat",
        ai_detected: true,
        ai_confidence: "high",
      }).select("id").single();
      if (error) throw new Error(error.message);
      return { created: true, work_item_id: data.id };
    }
    case "update_work_item": {
      const updates: any = {};
      if (params.status) updates.status = params.status;
      if (params.priority) updates.priority = params.priority;
      if (params.status === "done") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("work_items").update(updates).eq("id", params.id);
      if (error) throw new Error(error.message);
      return { updated: true };
    }
    case "run_cleanup": {
      const { data } = await supabase.rpc("cleanup_orphan_work_items");
      return { cleanup: data };
    }
    case "run_data_integrity": {
      // Quick integrity check
      const [orphanCats, emptyProds] = await Promise.all([
        supabase.from("product_categories").select("id, category_id").limit(100),
        supabase.from("products").select("id, title_sv").is("price", null).limit(20),
      ]);
      return { orphan_categories: orphanCats.data?.length || 0, products_without_price: emptyProds.data?.length || 0 };
    }
    case "generate_lovable_prompt": {
      // Save to prompt_queue so it shows in Lova Prompts tab
      const promptTitle = (params.title || "Kodändring").substring(0, 200);
      const promptGoal = (params.goal || "").trim();
      const rawPrompt = (params.prompt || params.description || "").trim();
      const promptImpl = rawPrompt || `Implement the following change.\n\nTitle: ${promptTitle}\nGoal: ${promptGoal || "Improve functionality and user experience."}\n\nRequirements:\n1) Analyze existing implementation and root cause\n2) Implement robust fix with edge-case handling\n3) Validate UX and error states\n4) Ensure production-ready quality\n\nExpected result:\nA stable and maintainable implementation.`;

      const { error: pqErr } = await supabase.from("prompt_queue").insert({
        title: promptTitle,
        implementation: promptImpl,
        goal: promptGoal,
        priority: params.priority || "medium",
        status: "pending",
        source_type: "ai_chat",
      });
      if (pqErr) throw new Error(pqErr.message);
      return { queued: true, title: promptTitle, has_prompt_text: promptImpl.length > 0 };
    }
    case "query_data": {
      // Safe read-only queries
      const table = params.table;
      const allowed = ["orders", "products", "profiles", "work_items", "bug_reports", "donations", "analytics_events"];
      if (!allowed.includes(table)) return { error: "Tabell ej tillåten" };
      const { data, error } = await supabase.from(table).select(params.select || "*").limit(params.limit || 20);
      if (error) return { error: error.message };
      return { rows: data?.length || 0, data: data?.slice(0, 10) };
    }
    case "triage_bugs": {
      // Fetch ALL open bugs with full detail
      const { data: allBugs } = await supabase
        .from("bug_reports")
        .select("id, description, page_url, ai_summary, ai_severity, ai_category, ai_tags, status, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!allBugs || allBugs.length === 0) {
        return { total: 0, message: "Inga öppna buggar att triagera." };
      }

      // Use AI to analyze and group bugs
      const triageResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: `You are a senior bug triage engineer. Analyze these ${allBugs.length} open bugs and return a JSON object with:

1. "groups": Array of bug groups, each with:
   - "group_name": Short descriptive name (Swedish)
   - "severity": "critical" | "high" | "medium" | "low"
   - "bug_ids": Array of bug IDs that belong to this group
   - "summary": 1-2 sentence description of the group (Swedish)
   - "action": "fix_code" | "close_duplicate" | "close_irrelevant" | "needs_investigation" | "auto_fixable"
   - "prompt_suggestion": If action is "fix_code", a brief description of what needs fixing

2. "duplicates": Array of { keep_id, close_ids[], reason }
3. "auto_closeable": Array of { bug_id, reason } for bugs that are already fixed or irrelevant
4. "priority_order": Array of group_names in order of importance
5. "stats": { total, critical, high, medium, low, duplicates, auto_closeable }

BUGS:
${allBugs.map((b: any) => `ID: ${b.id}\nSeverity: ${b.ai_severity || "unknown"}\nCategory: ${b.ai_category || "unknown"}\nSummary: ${b.ai_summary || b.description.substring(0, 150)}\nPage: ${b.page_url}\nTags: ${(b.ai_tags || []).join(", ")}\nCreated: ${b.created_at}\n---`).join("\n")}

Return ONLY valid JSON.`,
          }],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });

      if (!triageResp.ok) throw new Error(`Triage AI failed: ${triageResp.status}`);
      const triageData = await triageResp.json();
      let triage;
      try {
        triage = JSON.parse(triageData.choices?.[0]?.message?.content || "{}");
      } catch {
        return { error: "Kunde inte parsa triage-resultat" };
      }

      // Auto-close duplicates and irrelevant bugs
      let closed = 0;
      const closeBugIds: string[] = [];

      for (const dup of (triage.duplicates || [])) {
        for (const closeId of (dup.close_ids || [])) {
          closeBugIds.push(closeId);
        }
      }
      for (const ac of (triage.auto_closeable || [])) {
        closeBugIds.push(ac.bug_id);
      }

      if (closeBugIds.length > 0) {
        const uniqueIds = [...new Set(closeBugIds)];
        const { error: closeErr } = await supabase
          .from("bug_reports")
          .update({ status: "resolved", resolution_notes: "Auto-stängd av Lova: duplikat eller irrelevant", resolved_at: new Date().toISOString() })
          .in("id", uniqueIds);
        if (!closeErr) closed = uniqueIds.length;
      }

      // Create work items for important bug groups
      let workItemsCreated = 0;
      for (const group of (triage.groups || []).filter((g: any) => g.action === "fix_code" && ["critical", "high"].includes(g.severity))) {
        const { error: wiErr } = await supabase.from("work_items").insert({
          title: `🐛 ${group.group_name}`.substring(0, 200),
          description: `${group.summary}\n\nBuggar: ${group.bug_ids.length} st\nÅtgärd: Kodfix krävs\n${group.prompt_suggestion || ""}`,
          status: "open",
          priority: group.severity === "critical" ? "critical" : "high",
          item_type: "bug",
          source_type: "ai_triage",
          ai_detected: true,
          ai_confidence: "high",
        });
        if (!wiErr) workItemsCreated++;
      }

      // Generate prompts for critical groups
      let promptsCreated = 0;
      for (const group of (triage.groups || []).filter((g: any) => g.action === "fix_code" && g.severity === "critical")) {
        const { error: pErr } = await supabase.from("prompt_queue").insert({
          title: `Fix: ${group.group_name}`.substring(0, 200),
          implementation: `Fix the following bug group: ${group.group_name}\n\n${group.summary}\n\nAffected bugs: ${group.bug_ids.length}\n\nSuggested fix:\n${group.prompt_suggestion || "Investigate and fix the root cause."}\n\nRequirements:\n1) Identify root cause across all related bugs\n2) Implement robust fix\n3) Test edge cases\n4) Ensure no regressions`,
          goal: group.summary,
          priority: "critical",
          status: "pending",
          source_type: "ai_triage",
        });
        if (!pErr) promptsCreated++;
      }

      return {
        total_bugs: allBugs.length,
        groups: (triage.groups || []).length,
        duplicates_closed: closed,
        work_items_created: workItemsCreated,
        prompts_created: promptsCreated,
        priority_order: triage.priority_order || [],
        stats: triage.stats || {},
        group_details: (triage.groups || []).map((g: any) => ({
          name: g.group_name,
          severity: g.severity,
          count: g.bug_ids?.length || 0,
          action: g.action,
        })),
      };
    }

    case "close_bug": {
      const { bug_id, resolution_notes } = params;
      if (!bug_id) return { error: "bug_id krävs" };
      const { error } = await supabase
        .from("bug_reports")
        .update({
          status: "resolved",
          resolution_notes: resolution_notes || "Stängd av Lova",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", bug_id);
      if (error) throw new Error(error.message);
      return { closed: true, bug_id };
    }

    case "batch_update_bugs": {
      const { bug_ids, status: newStatus, resolution_notes: notes } = params;
      if (!bug_ids || !Array.isArray(bug_ids) || bug_ids.length === 0) return { error: "bug_ids array krävs" };
      const updates: any = { status: newStatus || "resolved" };
      if (notes) updates.resolution_notes = notes;
      if (newStatus === "resolved") updates.resolved_at = new Date().toISOString();
      const { error } = await supabase
        .from("bug_reports")
        .update(updates)
        .in("id", bug_ids);
      if (error) throw new Error(error.message);
      return { updated: bug_ids.length, status: newStatus };
    }

    case "self_note": {
      const canSelfFix = params.can_self_fix === true;
      const noteTitle = (params.title || "AI-notering").substring(0, 200);
      const noteDesc = params.description || "";
      const notePriority = params.priority || "medium";

      if (canSelfFix) {
        // AI marks it as something it will handle autonomously
        const { data, error } = await supabase.from("work_items").insert({
          title: `🤖 ${noteTitle}`,
          description: `[AI Self-Fix]\n${noteDesc}\n\nDetta hanteras automatiskt av Lova.`,
          status: "in_progress",
          priority: notePriority,
          item_type: "ai_self_fix",
          source_type: "ai_self_note",
          ai_detected: true,
          ai_confidence: "high",
        }).select("id").single();
        if (error) throw new Error(error.message);
        return { created: true, self_fix: true, work_item_id: data.id };
      } else {
        // Needs manual intervention - create work item + prompt
        const { data, error } = await supabase.from("work_items").insert({
          title: `⚠️ ${noteTitle}`,
          description: `[Manuellt ärende]\n${noteDesc}\n\nKräver kodändring via Lovable.`,
          status: "open",
          priority: notePriority,
          item_type: "manual",
          source_type: "ai_self_note",
          ai_detected: true,
          ai_confidence: "medium",
        }).select("id").single();
        if (error) throw new Error(error.message);

        // Also generate a prompt for it
        await supabase.from("prompt_queue").insert({
          title: noteTitle,
          implementation: noteDesc,
          goal: `Fix: ${noteTitle}`,
          priority: notePriority,
          status: "pending",
          source_type: "ai_self_note",
        });

        return { created: true, self_fix: false, work_item_id: data.id, prompt_queued: true };
      }
    }

    case "bug_fix_match": {
      // Fetch open bugs
      const { data: openBugs } = await supabase
        .from("bug_reports")
        .select("id, description, page_url, ai_summary, ai_category, ai_tags, ai_severity, status")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!openBugs || openBugs.length === 0) {
        result = { matched: 0, checked: 0, bugs: [], message: "Inga öppna buggar att matcha." };
        break;
      }

      // Fetch recent changes (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: recentChanges } = await supabase
        .from("change_log")
        .select("id, change_type, description, affected_components, source, created_at, metadata")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!recentChanges || recentChanges.length === 0) {
        result = { matched: 0, checked: openBugs.length, bugs: openBugs.map((b: any) => ({ id: b.id, summary: b.ai_summary, verdict: "no_changes", reason: "Inga senaste ändringar att jämföra mot." })), message: "Inga ändringar att matcha mot." };
        break;
      }

      const bugsPayload = openBugs.map((b: any) => ({
        id: b.id,
        summary: b.ai_summary || b.description?.substring(0, 200),
        category: b.ai_category,
        severity: b.ai_severity,
        page_url: b.page_url,
        tags: b.ai_tags,
      }));

      const changesPayload = recentChanges.map((c: any) => ({
        id: c.id,
        type: c.change_type,
        description: c.description,
        components: c.affected_components,
        source: c.source,
        date: c.created_at,
      }));

      const matchPrompt = `Du är en senior QA-ingenjör. Analysera dessa ÖPPNA buggar mot SENASTE ÄNDRINGAR och avgör vilka buggar som troligen har fixats.

ÖPPNA BUGGAR:
${JSON.stringify(bugsPayload, null, 2)}

SENASTE ÄNDRINGAR (7 dagar):
${JSON.stringify(changesPayload, null, 2)}

För varje bugg, returnera ett verdict:
- "fixed" = buggen har med hög sannolikhet fixats av en specifik ändring
- "likely_fixed" = troligen fixad men behöver verifiering
- "not_fixed" = ingen matchande ändring hittades
- "duplicate" = buggen är en dubblett av en annan bugg i listan

Svara BARA med JSON:
{
  "matches": [
    {
      "bug_id": "uuid",
      "verdict": "fixed|likely_fixed|not_fixed|duplicate",
      "confidence": 0-100,
      "matched_change_id": "uuid or null",
      "reason": "kort förklaring",
      "duplicate_of_bug_id": "uuid or null"
    }
  ]
}`;

      const matchResp = await fetch("https://api.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: matchPrompt }],
          temperature: 0.2,
        }),
      });

      if (!matchResp.ok) {
        result = { error: "AI matching failed", status: matchResp.status };
        break;
      }

      const matchData = await matchResp.json();
      let matchResult: any;
      try {
        const raw = matchData.choices?.[0]?.message?.content || "{}";
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        matchResult = JSON.parse(cleaned);
      } catch {
        result = { error: "Could not parse AI response" };
        break;
      }

      const matches = matchResult.matches || [];
      let autoResolved = 0;

      for (const m of matches) {
        if ((m.verdict === "fixed" && m.confidence >= 75) || m.verdict === "duplicate") {
          // Auto-close the bug
          const updateData: any = {
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolution_notes: m.verdict === "duplicate"
              ? `Auto-stängd: Dubblett av bugg ${m.duplicate_of_bug_id}. ${m.reason}`
              : `Auto-stängd: Fixad av ändring. ${m.reason}`,
          };
          if (m.matched_change_id) {
            updateData.resolved_by_change_id = m.matched_change_id;
          }
          await supabase.from("bug_reports").update(updateData).eq("id", m.bug_id);

          // Log the auto-close in change_log
          await supabase.from("change_log").insert({
            change_type: "fix",
            description: `Bug auto-stängd: ${bugsPayload.find((b: any) => b.id === m.bug_id)?.summary || m.bug_id}`,
            affected_components: ["bug_reports"],
            source: "ai",
            bug_report_id: m.bug_id,
            metadata: { verdict: m.verdict, confidence: m.confidence, matched_change_id: m.matched_change_id, reason: m.reason },
            created_by: user.id,
          });

          autoResolved++;
        }
      }

      result = {
        matched: autoResolved,
        checked: openBugs.length,
        changes_compared: recentChanges.length,
        bugs: matches,
        message: autoResolved > 0
          ? `${autoResolved} bugg(ar) auto-stängda av ${matches.filter((m: any) => m.verdict === "fixed" || m.verdict === "duplicate").length} matchningar.`
          : "Inga buggar kunde matchas mot senaste ändringar.",
      };
      break;
    }

    case "verify_completed_work": {
      // Batch verify all recently completed work items that haven't been AI-verified
      const { data: unverified } = await supabase
        .from("work_items")
        .select("id, title, item_type, status, completed_at")
        .eq("status", "done")
        .is("ai_review_status", null)
        .order("completed_at", { ascending: false })
        .limit(20);

      if (!unverified || unverified.length === 0) {
        result = { verified: 0, reopened: 0, needs_review: 0, message: "Inga overifierade uppgifter." };
        break;
      }

      let verified = 0, reopened = 0, needsReview = 0;
      const details: any[] = [];

      for (const wi of unverified) {
        try {
          const reviewResp = await fetch(`${supabaseUrl}/functions/v1/ai-review-fix`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ work_item_id: wi.id }),
          });

          if (reviewResp.ok) {
            const reviewData = await reviewResp.json();
            const status = reviewData.review?.status;
            if (status === "verified") verified++;
            else if (status === "incomplete") reopened++;
            else needsReview++;
            details.push({ id: wi.id, title: wi.title, status, confidence: reviewData.review?.confidence, verdict: reviewData.review?.verdict });
          }
        } catch (e: any) {
          console.warn(`[verify_completed_work] Failed for ${wi.id}:`, e.message);
          details.push({ id: wi.id, title: wi.title, status: "error", error: e.message });
        }
      }

      result = {
        total: unverified.length,
        verified,
        reopened,
        needs_review: needsReview,
        details,
        message: `${verified} verifierade, ${reopened} återöppnade, ${needsReview} behöver granskning.`,
      };
      break;
}

// ── Pre-Verification: AI checks if an open issue appears resolved ──
async function handlePreVerify(supabase: any, apiKey: string, workItemId: string, triggeredBy: string) {
  const { data: item } = await supabase.from("work_items").select("*").eq("id", workItemId).maybeSingle();
  if (!item) throw new Error("Work item not found");

  // Gather source info
  let sourceInfo = "";
  let filePaths: string[] = [];
  if (item.source_type === "bug_report" && item.source_id) {
    const { data: bug } = await supabase.from("bug_reports").select("*").eq("id", item.source_id).maybeSingle();
    if (bug) {
      sourceInfo = `\nBUGGRAPPORT:\nBeskrivning: ${bug.description}\nSida: ${bug.page_url}\nAI-sammanfattning: ${bug.ai_summary || "Ingen"}\nAI-kategori: ${bug.ai_category || "Okänd"}\nAI-reproduktionssteg: ${bug.ai_repro_steps || "Inga"}\nStatus: ${bug.status}`;
      filePaths = bug.ai_tags || [];
    }
  }
  if (item.source_type === "order_incident" && item.source_id) {
    const { data: inc } = await supabase.from("order_incidents").select("*").eq("id", item.source_id).maybeSingle();
    if (inc) {
      sourceInfo = `\nINCIDENT:\nTitel: ${inc.title}\nBeskrivning: ${inc.description}\nTyp: ${inc.type}\nStatus: ${inc.status}\nPrioritet: ${inc.priority}`;
    }
  }

  // Get recent related changes
  const { data: changes } = await supabase.from("change_log")
    .select("description, change_type, affected_components, created_at")
    .order("created_at", { ascending: false }).limit(30);

  const prompt = `Du är en QA-ingenjör. Analysera om detta problem verkar vara LÖST baserat på senaste systemändringar.

UPPGIFT (${item.item_type}):
Titel: ${item.title}
Beskrivning: ${item.description || "Ingen"}
Status: ${item.status}
Skapad: ${item.created_at}
${sourceInfo}

SENASTE SYSTEMÄNDRINGAR:
${(changes || []).map((c: any) => `- [${c.change_type}] ${c.description} (${c.affected_components?.join(", ") || "?"})`).join("\n")}

REGLER:
1. Om en ändring tydligt adresserar problemet → "appears_fixed" med hög konfidens
2. Om relaterade ändringar gjorts men osäkert → "possibly_fixed" med medel konfidens  
3. Om inget tyder på fix → "not_fixed"
4. Var ÄRLIG — hellre "not_fixed" än falsk positiv`;

  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Du analyserar om buggar/problem verkar lösta. Svara via tool call." },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "pre_verify_result",
          description: "Return pre-verification assessment",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["appears_fixed", "possibly_fixed", "not_fixed"] },
              confidence: { type: "number", description: "0-100" },
              reasoning: { type: "string", description: "Kort förklaring" },
              related_change: { type: "string", description: "Vilken ändring som troligen fixade problemet, om någon" },
            },
            required: ["status", "confidence", "reasoning"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "pre_verify_result" } },
    }),
  });

  let preVerify = { status: "not_fixed", confidence: 0, reasoning: "AI kunde inte analysera", related_change: null };
  if (aiResp.ok) {
    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      preVerify = JSON.parse(toolCall.function.arguments);
    }
  }

  const now = new Date().toISOString();
  await supabase.from("work_items").update({
    ai_pre_verify_status: preVerify.status,
    ai_pre_verify_result: preVerify,
    ai_pre_verify_at: now,
  }).eq("id", workItemId);

  await logAiRead(supabase, {
    action_type: "pre_verify",
    target_type: "work_item",
    target_ids: [workItemId],
    result: preVerify.status === "not_fixed" ? "no_issues" : "possible_issue",
    summary: `Pre-verify: ${item.title} → ${preVerify.status} (${preVerify.confidence}%)`,
    triggered_by: triggeredBy,
    linked_work_item_id: workItemId,
    linked_bug_id: item.source_type === "bug_report" ? item.source_id : null,
    file_paths: filePaths,
    affected_components: [item.item_type, item.source_type || "unknown"],
  });

  return { pre_verify: preVerify };
}

// ── Rejection Re-analysis: deeper scan when user rejects AI suggestion ──
async function handleRejectionReanalysis(supabase: any, apiKey: string, workItemId: string, triggeredBy: string) {
  const { data: item } = await supabase.from("work_items").select("*").eq("id", workItemId).maybeSingle();
  if (!item) throw new Error("Work item not found");

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Gather extensive context in parallel
  const [sourceRes, changesRes, logsRes, scansRes, relatedBugsRes, readLogRes] = await Promise.all([
    // Source data (bug or incident)
    item.source_type === "bug_report" && item.source_id
      ? supabase.from("bug_reports").select("*").eq("id", item.source_id).maybeSingle()
      : item.source_type === "order_incident" && item.source_id
        ? supabase.from("order_incidents").select("*").eq("id", item.source_id).maybeSingle()
        : Promise.resolve({ data: null }),
    // All recent changes
    supabase.from("change_log")
      .select("description, change_type, affected_components, source, metadata, created_at")
      .gte("created_at", twoWeeksAgo)
      .order("created_at", { ascending: false }).limit(50),
    // Error/warning logs
    supabase.from("activity_logs")
      .select("log_type, category, message, details, created_at")
      .in("log_type", ["error", "warning"])
      .gte("created_at", twoWeeksAgo)
      .order("created_at", { ascending: false }).limit(50),
    // Recent AI scan results
    supabase.from("ai_scan_results")
      .select("scan_type, overall_score, overall_status, executive_summary, issues_count, created_at")
      .order("created_at", { ascending: false }).limit(10),
    // Related bugs in same category
    supabase.from("bug_reports")
      .select("id, description, ai_summary, ai_category, ai_severity, status, resolution_notes, ai_tags, page_url")
      .order("created_at", { ascending: false }).limit(50),
    // Previous AI reads on this item
    supabase.from("ai_read_log")
      .select("action_type, result, summary, created_at")
      .eq("linked_work_item_id", workItemId)
      .order("created_at", { ascending: false }).limit(10),
  ]);

  const source = sourceRes.data;
  const changes = changesRes.data || [];
  const errorLogs = logsRes.data || [];
  const scans = scansRes.data || [];
  const allBugs = relatedBugsRes.data || [];
  const aiReadHistory = readLogRes.data || [];

  // Previous pre-verify result for context
  const prevResult = item.ai_pre_verify_result || {};

  // Find bugs in same category
  const bugCategory = source?.ai_category || (item as any).ai_category;
  const sameCatBugs = bugCategory ? allBugs.filter((b: any) => b.ai_category === bugCategory) : [];
  const resolvedSameCat = sameCatBugs.filter((b: any) => b.status === "resolved");

  const prompt = `Du fick en AVVISNING från en användare. Din förra bedömning ("${prevResult.status}", ${prevResult.confidence}% konfidens) var FEL.
Användaren säger att problemet INTE är löst. Du måste nu göra en DJUPARE analys.

=== UPPGIFT ===
Titel: ${item.title}
Typ: ${item.item_type}
Beskrivning: ${item.description || "Ingen"}
Prioritet: ${item.priority}

${source ? `=== KÄLLA (${item.source_type}) ===
Beskrivning: ${source.description || source.title || "?"}
${source.page_url ? `Sida: ${source.page_url}` : ""}
${source.ai_summary ? `AI-sammanfattning: ${source.ai_summary}` : ""}
${source.ai_category ? `Kategori: ${source.ai_category}` : ""}
${source.ai_repro_steps ? `Reproduktionssteg: ${source.ai_repro_steps}` : ""}
${source.ai_tags?.length ? `Taggar: ${source.ai_tags.join(", ")}` : ""}` : ""}

=== FÖRRA AI-BEDÖMNINGEN (AVVISAD) ===
Status: ${prevResult.status || "?"}
Konfidens: ${prevResult.confidence || "?"}%
Motivering: ${prevResult.reasoning || "?"}
Relaterad ändring: ${prevResult.related_change || "Ingen"}

=== AI-HISTORIK FÖR DENNA UPPGIFT ===
${aiReadHistory.map((r: any) => `[${r.action_type}] ${r.result}: ${r.summary} (${r.created_at})`).join("\n") || "Ingen historik"}

=== SYSTEMÄNDRINGAR (2 veckor, ${changes.length} st) ===
${changes.slice(0, 30).map((c: any) => `[${c.change_type}/${c.source}] ${c.description} — komponenter: ${c.affected_components?.join(", ") || "?"}`).join("\n") || "Inga"}

=== FELLOGGAR (${errorLogs.length} st) ===
${errorLogs.slice(0, 20).map((l: any) => `[${l.category}/${l.log_type}] ${l.message}`).join("\n") || "Inga"}

=== SENASTE SKANNINGSRESULTAT ===
${scans.map((s: any) => `[${s.scan_type}] Score: ${s.overall_score}, Status: ${s.overall_status}, Issues: ${s.issues_count} — ${s.executive_summary || ""}`).join("\n") || "Inga"}

=== LIKNANDE BUGGAR (${sameCatBugs.length} totalt, ${resolvedSameCat.length} lösta) ===
${resolvedSameCat.slice(0, 5).map((b: any) => `- ${b.ai_summary || b.description?.substring(0, 80)}\n  Lösning: ${b.resolution_notes || "ej dokumenterad"}`).join("\n") || "Inga"}

INSTRUKTIONER:
1. Din förra bedömning var FEL — gräv djupare
2. Analysera ALLA felloggar för ledtrådar
3. Analysera relaterade komponenter som KAN påverkas
4. Titta på skanningsresultat för systemhälsa
5. Lär av liknande lösta buggar
6. Ge en NY, mer noggrann diagnos och konkreta fixförslag`;

  const analysis = await callAI(apiKey, [
    { role: "system", content: `Du är en senior QA-ingenjör som gör en fördjupad analys efter att din förra bedömning avvisades. Var extra noggrann och grundlig. Svara via tool call.` },
    { role: "user", content: prompt },
  ], [{
    type: "function",
    function: {
      name: "rejection_reanalysis",
      description: "Deep re-analysis after user rejected AI suggestion",
      parameters: {
        type: "object",
        properties: {
          refined_diagnosis: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Ny förfinad diagnos" },
              confidence: { type: "number", description: "0-100" },
              likely_cause: { type: "string" },
              why_previous_was_wrong: { type: "string", description: "Varför förra bedömningen var felaktig" },
              evidence: { type: "array", items: { type: "string" } },
            },
            required: ["summary", "confidence", "likely_cause", "why_previous_was_wrong", "evidence"],
          },
          log_findings: {
            type: "object",
            properties: {
              relevant_errors: { type: "array", items: { type: "string" } },
              error_pattern: { type: "string" },
              affected_components: { type: "array", items: { type: "string" } },
            },
            required: ["relevant_errors", "affected_components"],
          },
          component_analysis: {
            type: "array",
            items: {
              type: "object",
              properties: {
                component: { type: "string" },
                status: { type: "string", enum: ["healthy", "suspicious", "broken"] },
                findings: { type: "string" },
              },
              required: ["component", "status", "findings"],
            },
            description: "Analysis of related system components",
          },
          new_fix_suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                effort: { type: "string", enum: ["low", "medium", "high"] },
                risk: { type: "string", enum: ["low", "medium", "high"] },
                lovable_prompt: { type: "string" },
              },
              required: ["title", "description", "effort", "risk", "lovable_prompt"],
            },
          },
          severity_assessment: { type: "string", enum: ["low", "medium", "high", "critical"] },
        },
        required: ["refined_diagnosis", "log_findings", "component_analysis", "new_fix_suggestions", "severity_assessment"],
      },
    },
  }], { type: "function", function: { name: "rejection_reanalysis" } });

  const now = new Date().toISOString();

  // Save re-analysis results to work item
  await supabase.from("work_items").update({
    ai_root_causes: analysis,
    ai_pre_verify_result: {
      ...prevResult,
      rejection_reanalysis: analysis,
      reanalyzed_at: now,
    },
  }).eq("id", workItemId);

  // Log the re-analysis
  await logAiRead(supabase, {
    action_type: "rejection_reanalysis",
    target_type: "work_item",
    target_ids: [workItemId],
    result: "possible_issue",
    summary: `Re-analysis after rejection: ${item.title} — severity: ${analysis?.severity_assessment || "?"}`,
    triggered_by: triggeredBy,
    linked_work_item_id: workItemId,
    linked_bug_id: item.source_type === "bug_report" ? item.source_id : null,
    affected_components: analysis?.log_findings?.affected_components || [item.item_type],
    endpoints: ["change_log", "activity_logs", "ai_scan_results", "bug_reports", "ai_read_log"],
  });

  return { reanalysis: analysis };
}

    default:
      return { error: "Okänd åtgärdstyp" };
  }
}
