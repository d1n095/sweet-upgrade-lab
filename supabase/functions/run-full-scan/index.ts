import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const AI_ENABLED = false;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const STEPS = [
  { id: "data_integrity",      label: "Dataintegritet",       scanType: "data_integrity" },
  { id: "functional_behavior", label: "Funktionsbeteende",    scanType: "functional_behavior" },
  { id: "sync_scan",           label: "Synkronisering",       scanType: "sync_scan" },
  { id: "system_scan",         label: "Systemhälsa",          scanType: "system_scan" },
  { id: "feature_detection",   label: "Funktionsdetektering", scanType: "feature_detection" },
  { id: "interaction_qa",      label: "Interaktions-QA",      scanType: "interaction_qa" },
  { id: "component_map",       label: "Komponentkarta",       scanType: "component_map" },
  { id: "ui_flow_integrity",   label: "UI-flödesintegritet",  scanType: "ui_flow_integrity" },
];

const DATA_INTEGRITY_RULES = ["work_items_without_source","orphan_work_items","duplicate_work_items","work_items_deleted_order","status_mismatch","stale_claimed","entity_validation","id_trace","frontend_backend_mismatch","empty_tables"];
const BEHAVIOR_RULES       = ["create_work_item_verify","bug_to_work_item","incident_to_work_item","status_sync","dismiss_no_reappear","order_lifecycle","incident_notification"];
const SYNC_RULES           = ["product_missing_title","product_invalid_price","active_product_no_image","active_product_no_handle","order_shipped_no_timestamp","order_paid_cancelled","affiliate_no_code","duplicate_codes"];
const SYSTEM_RULES         = ["open_bugs_threshold","escalated_items","errors_24h","unread_notifications","stale_escalated","score_regression"];
const FEATURE_RULES        = ["table_accessible","row_count_detected","write_access_round_trip"];
const INTERACTION_RULES    = ["bundle_orphan","orphan_notifications","incidents_missing_order","automation_empty_config","email_missing_fields","bundles_no_items","products_no_handle","affiliate_missing_fields","email_no_cta"];
const COMPONENT_RULES      = ["sections_missing_label","products_missing_title","products_missing_desc","categories_missing_label","bundles_no_items","inconsistent_images","duplicate_display_order","email_no_cta","tags_no_color"];
const FLOW_RULES           = ["products_missing_handle","categories_missing_slug","flows_analytics","bundles_no_products","required_legal_docs","ui_components_text","sellable_products_valid_price"];

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function normalizeIssue(raw: any, defaults: { type?: string; location?: string } = {}): any {
  return {
    type:           raw.type          || defaults.type     || "invalid_state",
    severity:       raw.severity      || "medium",
    location:       raw.location      || raw.component     || defaults.location || "unknown",
    title:          raw.title         || raw.description   || "Issue detected",
    description:    raw.description   || raw.title         || "",
    component:      raw.component     || raw.location      || defaults.location || "unknown",
    entity:         raw.entity        || raw.component     || "unknown",
    entity_id:      raw.entity_id     || raw.id            || null,
    expected_state: raw.expected_state || raw.expected     || null,
    actual_state:   raw.actual_state  || raw.actual        || raw.title || null,
    fix_suggestion: raw.fix_suggestion || raw._suggested_fix || null,
    _issue_type:    raw._issue_type   || null,
    _impact_score:  raw._impact_score || null,
  };
}

function generateFingerprint(issue: any): string {
  const text = `${issue.title || issue.description || ""}|${issue.component || issue.location || ""}|${issue.type || ""}`;
  let hash = 0;
  for (let i = 0; i < text.length; i++) { hash = ((hash << 5) - hash) + text.charCodeAt(i); hash |= 0; }
  return `fp_${Math.abs(hash).toString(36)}`;
}

function groupSimilarIssues(issues: any[]): any[] {
  const seen = new Map<string, boolean>();
  return issues.filter(i => { const fp = generateFingerprint(i); if (seen.has(fp)) return false; seen.set(fp, true); return true; });
}

function buildUnifiedResult(stepResults: Record<string, any>, totalDuration: number) {
  const allIssues = Object.values(stepResults).flatMap((r: any) => r?.issues || []);
  const broken_flows         = allIssues.filter((i: any) => ["broken_flow","action_failed","lost_state","missing_data","request_failed"].includes(i.type));
  const fake_features        = allIssues.filter((i: any) => i.type === "invalid_state" && i._issue_type === "upgrade");
  const interaction_failures = allIssues.filter((i: any) => ["stale_state","partial_execution","silent_failure"].includes(i.type));
  const data_issues          = allIssues.filter((i: any) => ["data_loss","failed_insert","data_validation","id_trace","data_mismatch","empty_table"].includes(i.type));
  const score = Math.max(0, Math.min(100,
    100
    - allIssues.filter((i: any) => i.severity === "critical").length * 10
    - allIssues.filter((i: any) => i.severity === "high").length * 5
    - allIssues.filter((i: any) => i.severity === "medium").length * 2
  ));
  return { broken_flows, fake_features, interaction_failures, data_issues, all_issues: allIssues, total_issues: allIssues.length, system_health_score: score, total_duration_ms: totalDuration, scanned_at: new Date().toISOString() };
}

// ── DATA INTEGRITY SCAN ──────────────────────────────────────────────────
async function runDataIntegrityScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();
  try {
    // 1. Work items without source
    const { data: sourceless } = await supabase.from("work_items")
      .select("id,title,item_type").in("status",["open","claimed","in_progress","escalated"])
      .is("source_id",null).not("item_type","in",'("manual","manual_task","general")').limit(100);
    for (const wi of sourceless || [])
      issues.push({ type:"failed_insert", severity:"high", entity:"work_item", entity_id:wi.id, title:`Work item utan källa: "${wi.title}"`, component:"work_items" });

    // 2. Orphan work items (bug source)
    const { data: bugSourced } = await supabase.from("work_items")
      .select("id,title,source_id").eq("source_type","bug_report")
      .not("source_id","is",null).in("status",["open","claimed","in_progress","escalated"]).limit(200);
    for (const wi of bugSourced || []) {
      const { data: bug } = await supabase.from("bug_reports").select("id").eq("id",wi.source_id).maybeSingle();
      if (!bug) issues.push({ type:"data_loss", severity:"critical", entity:"work_item", entity_id:wi.id, title:`Orphan: "${wi.title}" → bug ${wi.source_id.slice(0,8)} finns ej`, component:"work_items" });
    }

    // 3. Orphan work items (incident source)
    const { data: incSourced } = await supabase.from("work_items")
      .select("id,title,source_id").eq("source_type","order_incident")
      .not("source_id","is",null).in("status",["open","claimed","in_progress","escalated"]).limit(200);
    for (const wi of incSourced || []) {
      const { data: inc } = await supabase.from("order_incidents").select("id").eq("id",wi.source_id).maybeSingle();
      if (!inc) issues.push({ type:"data_loss", severity:"critical", entity:"work_item", entity_id:wi.id, title:`Orphan: "${wi.title}" → incident ${wi.source_id.slice(0,8)} finns ej`, component:"work_items" });
    }

    // 4. Duplicate active work items for same source
    const { data: activeItems } = await supabase.from("work_items")
      .select("id,source_type,source_id").in("status",["open","claimed","in_progress","escalated"])
      .not("source_id","is",null).limit(500);
    const srcMap = new Map<string, any[]>();
    for (const wi of activeItems || []) {
      const k = `${wi.source_type}:${wi.source_id}`;
      if (!srcMap.has(k)) srcMap.set(k, []);
      srcMap.get(k)!.push(wi);
    }
    for (const [k, items] of srcMap)
      if (items.length > 1) issues.push({ type:"stale_state", severity:"high", entity:"work_item", entity_id:items.map((i:any)=>i.id).join(","), title:`${items.length} duplicerade work items för ${k}`, component:"work_items" });

    // 5. Work items linked to deleted/cancelled orders
    const { data: orderLinked } = await supabase.from("work_items")
      .select("id,title,related_order_id").not("related_order_id","is",null)
      .in("status",["open","claimed","in_progress"]).limit(200);
    for (const wi of orderLinked || []) {
      const { data: order } = await supabase.from("orders").select("id,status,deleted_at").eq("id",wi.related_order_id).maybeSingle();
      if (!order) issues.push({ type:"data_loss", severity:"high", entity:"work_item", entity_id:wi.id, title:`"${wi.title}" → order finns ej`, component:"work_items" });
      else if (order.deleted_at) issues.push({ type:"incorrect_filtering", severity:"high", entity:"work_item", entity_id:wi.id, title:`"${wi.title}" → order soft-deleted`, component:"work_items" });
      else if (["cancelled","delivered","completed"].includes(order.status)) issues.push({ type:"stale_state", severity:"medium", entity:"work_item", entity_id:wi.id, title:`"${wi.title}" → order redan ${order.status}`, component:"work_items" });
    }

    // 6. Status mismatch: bug resolved but work_item still open
    const { data: resolvedBugs } = await supabase.from("bug_reports").select("id").eq("status","resolved").limit(100);
    for (const bug of resolvedBugs || []) {
      const { data: activeWi } = await supabase.from("work_items").select("id,title")
        .eq("source_type","bug_report").eq("source_id",bug.id)
        .in("status",["open","claimed","in_progress","escalated"]).limit(1);
      if (activeWi?.length) issues.push({ type:"stale_state", severity:"high", entity:"work_item", entity_id:activeWi[0].id, title:`"${activeWi[0].title}" aktiv trots löst bug`, component:"work_items" });
    }

    // 7. Stale claimed items (>30 min)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: staleClaimed } = await supabase.from("work_items").select("id,title")
      .eq("status","claimed").lt("claimed_at",thirtyMinAgo).limit(50);
    for (const wi of staleClaimed || [])
      issues.push({ type:"stale_state", severity:"medium", entity:"work_item", entity_id:wi.id, title:`"${wi.title}" claimad >30min utan progress`, component:"work_items" });

    // 8. Entity validation: required fields must not be null
    for (const ev of [
      { table:"orders",   required:["id","user_id","order_email","status","payment_status","total_amount"] },
      { table:"profiles", required:["id","user_id"] },
      { table:"products", required:["id","title_sv","price","status"] },
    ]) {
      try {
        const { data: rows } = await supabase.from(ev.table).select(ev.required.join(",")).limit(200);
        for (const row of rows || []) {
          const nullF = ev.required.filter(f => row[f] === null || row[f] === undefined);
          if (nullF.length > 0) issues.push({ type:"data_validation", severity:nullF.includes("id")?"critical":"medium", entity:ev.table, entity_id:(row.id||"?").toString().slice(0,8), title:`${ev.table}: null [${nullF.join(",")}]`, component:ev.table });
        }
      } catch (_) {}
    }

    // 9. Tables that must have data
    for (const { table, label, severity } of [
      { table:"profiles",                label:"users",            severity:"critical" as const },
      { table:"products",                label:"products",         severity:"critical" as const },
      { table:"user_roles",              label:"user_roles",       severity:"critical" as const },
      { table:"role_module_permissions", label:"role_permissions", severity:"critical" as const },
      { table:"orders",                  label:"orders",           severity:"high"     as const },
      { table:"legal_documents",         label:"legal_documents",  severity:"high"     as const },
      { table:"store_settings",          label:"store_settings",   severity:"high"     as const },
    ]) {
      try {
        const { count } = await supabase.from(table).select("id", { count:"exact", head:true });
        if (!count) issues.push({ type:"empty_table", severity, entity:label, entity_id:table, title:`No data: ${label} = 0`, component:table });
      } catch (_) {}
    }

  } catch (e: any) {
    issues.push({ type:"scan_error", severity:"critical", entity:"integrity_scan", title:`Integrity scan error: ${e.message}`, component:"integrity_scan" });
  }
  const normalized = issues.map(i => normalizeIssue(i));
  return { issues:normalized, issues_found:normalized.length, input_size:DATA_INTEGRITY_RULES.length, rules_applied:DATA_INTEGRITY_RULES, ...(normalized.length === 0 ? { _empty_reason:"no_detection" } : {}), duration_ms:Date.now()-startMs, scanned_at:new Date().toISOString() };
}

// ── FUNCTIONAL BEHAVIOR SCAN ─────────────────────────────────────────────
async function runFunctionalBehaviorScan(supabase: any, scanRunId: string): Promise<any> {
  const failures: any[] = [];
  const startMs = Date.now();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  try {
    // Chain 1: create + verify work item
    const probeTitle = `__behavior_probe_${Date.now()}`;
    const { data: probe, error: insertErr } = await supabase.from("work_items")
      .insert({ title:probeTitle, status:"cancelled", priority:"low", item_type:"general", source_type:"behavior_scan", description:"Temporary probe — auto-deleted" })
      .select("id,title").single();
    if (insertErr || !probe) {
      failures.push({ chain:"create_work_item", failure_type:"action_failed", severity:"critical", title:`INSERT work_item failed: ${insertErr?.message}`, component:"work_items" });
    } else {
      const { data: fetched } = await supabase.from("work_items").select("id,title").eq("id",probe.id).maybeSingle();
      if (!fetched) failures.push({ chain:"create_work_item", failure_type:"lost_state", severity:"critical", title:`Row ${probe.id.slice(0,8)} not found after INSERT`, component:"work_items" });
      else if (fetched.title !== probeTitle) failures.push({ chain:"create_work_item", failure_type:"silent_failure", severity:"high", title:`Title mismatch after INSERT`, component:"work_items" });
      await supabase.from("work_items").delete().eq("id",probe.id);
    }

    // Chain 2: bug → work_item trigger
    const { data: recentBugs } = await supabase.from("bug_reports").select("id").gte("created_at",fiveMinAgo).limit(10);
    for (const bug of recentBugs || []) {
      const { data: wi } = await supabase.from("work_items").select("id").eq("source_type","bug_report").eq("source_id",bug.id).limit(1);
      if (!wi?.length) failures.push({ chain:"bug_to_work_item", failure_type:"action_failed", severity:"high", title:`No work_item for bug ${bug.id.slice(0,8)}`, component:"work_items" });
    }

    // Chain 3: incident → work_item
    const { data: recentInc } = await supabase.from("order_incidents").select("id").gte("created_at",fiveMinAgo).limit(10);
    for (const inc of recentInc || []) {
      const { data: wi } = await supabase.from("work_items").select("id").eq("source_type","order_incident").eq("source_id",inc.id).limit(1);
      if (!wi?.length) failures.push({ chain:"incident_to_work_item", failure_type:"action_failed", severity:"high", title:`No work_item for incident ${inc.id.slice(0,8)}`, component:"work_items" });
    }

    // Chain 4: status sync — done work_item should resolve its bug
    const { data: doneWi } = await supabase.from("work_items").select("id,source_id").eq("status","done").eq("source_type","bug_report").not("source_id","is",null).limit(20);
    for (const wi of doneWi || []) {
      const { data: bug } = await supabase.from("bug_reports").select("id,status").eq("id",wi.source_id).maybeSingle();
      if (bug && bug.status !== "resolved") failures.push({ chain:"status_sync", failure_type:"partial_execution", severity:"high", title:`Work item done but bug status=${bug.status}`, component:"bug_reports" });
    }

    // Chain 5: dismiss → no reappear
    const { data: dismissals } = await supabase.from("scan_dismissals").select("issue_key").order("dismissed_at",{ascending:false}).limit(50);
    const { data: activeWis } = await supabase.from("work_items").select("id,title").in("status",["open","claimed","in_progress"]).eq("source_type","scan").limit(200);
    for (const d of dismissals || []) {
      const reapp = (activeWis || []).find((wi: any) => wi.title?.includes(d.issue_key));
      if (reapp) failures.push({ chain:"dismiss_reappear", failure_type:"silent_failure", severity:"medium", title:`"${d.issue_key}" reappeared as ${reapp.id.slice(0,8)}`, component:"scan_dismissals" });
    }

    // Chain 6: order lifecycle — shipped orders should not have active packing tasks
    const { data: paidOrders } = await supabase.from("orders").select("id").eq("payment_status","paid").in("fulfillment_status",["shipped","delivered"]).is("deleted_at",null).limit(50);
    for (const order of paidOrders || []) {
      const { data: task } = await supabase.from("work_items").select("id,title")
        .eq("related_order_id",order.id).in("status",["open","claimed","in_progress"]).in("item_type",["pack_order","packing","shipping"]).limit(1);
      if (task?.length) failures.push({ chain:"order_lifecycle", failure_type:"stale_state", severity:"medium", title:`Active packing task for shipped order`, component:"work_items" });
    }

    // Chain 7: incident → notification
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: hourInc } = await supabase.from("order_incidents").select("id").gte("created_at",oneHourAgo).limit(10);
    for (const inc of hourInc || []) {
      const { data: notif } = await supabase.from("notifications").select("id").eq("related_id",inc.id).eq("related_type","incident").limit(1);
      if (!notif?.length) failures.push({ chain:"incident_notification", failure_type:"action_failed", severity:"medium", title:`No notification for incident ${inc.id.slice(0,8)}`, component:"notifications" });
    }

  } catch (e: any) {
    failures.push({ chain:"scan_error", failure_type:"action_failed", severity:"critical", title:`Behavior scan error: ${e.message}`, component:"behavior_scan" });
  }
  const issues = failures.map(f => normalizeIssue({ ...f, type:f.failure_type || "broken_flow" }));
  return { failures, issues, issues_found:failures.length, input_size:BEHAVIOR_RULES.length, rules_applied:BEHAVIOR_RULES, ...(failures.length === 0 ? { _empty_reason:"no_detection" } : {}), duration_ms:Date.now()-startMs, scanned_at:new Date().toISOString() };
}

// ── SYNC SCAN ────────────────────────────────────────────────────────────
async function runRealSyncScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();
  try {
    const { data: products } = await supabase.from("products").select("id,title_sv,price,status,image_urls,handle").limit(500);
    for (const p of products || []) {
      if (!p.title_sv || p.title_sv.trim() === "") issues.push({ title:`Produkt utan titel (id: ${p.id?.slice(0,8)})`, severity:"high", field:"title_sv", component:"products" });
      if (p.price == null || p.price <= 0) issues.push({ title:`Produkt utan giltigt pris: "${p.title_sv}" (${p.price})`, severity:"high", field:"price", component:"products" });
      if (p.status === "active" && (!p.image_urls || p.image_urls.length === 0)) issues.push({ title:`Aktiv produkt utan bild: "${p.title_sv}"`, severity:"medium", field:"image_urls", component:"products" });
      if (p.status === "active" && !p.handle) issues.push({ title:`Aktiv produkt utan handle: "${p.title_sv}"`, severity:"high", field:"handle", component:"products" });
    }
    const { data: orders } = await supabase.from("orders").select("id,status,payment_status,fulfillment_status,shipped_at,delivered_at").is("deleted_at",null).order("created_at",{ascending:false}).limit(200);
    for (const o of orders || []) {
      if (o.fulfillment_status === "shipped" && !o.shipped_at) issues.push({ title:`Order ${o.id.slice(0,8)} shipped utan shipped_at`, severity:"high", field:"shipped_at", component:"orders" });
      if (o.fulfillment_status === "delivered" && !o.delivered_at) issues.push({ title:`Order ${o.id.slice(0,8)} delivered utan delivered_at`, severity:"high", field:"delivered_at", component:"orders" });
      if (o.payment_status === "paid" && o.status === "cancelled") issues.push({ title:`Order ${o.id.slice(0,8)} betalad men avbruten`, severity:"critical", field:"status", component:"orders" });
    }
    const { data: affiliates } = await supabase.from("affiliates").select("id,name,code").eq("is_active",true).limit(100);
    for (const a of affiliates || [])
      if (!a.code || a.code.trim() === "") issues.push({ title:`Aktiv affiliate utan kod: "${a.name}"`, severity:"high", field:"code", component:"affiliates" });
    const { data: allCodes }        = await supabase.from("affiliates").select("code").eq("is_active",true);
    const { data: influencerCodes } = await supabase.from("influencers").select("code").eq("is_active",true);
    const codeMap = new Map<string, number>();
    for (const a of [...(allCodes || []), ...(influencerCodes || [])]) {
      const c = (a.code || "").toLowerCase();
      if (c) codeMap.set(c, (codeMap.get(c) || 0) + 1);
    }
    for (const [code, count] of codeMap)
      if (count > 1) issues.push({ title:`Duplikat rabattkod: "${code}" (${count} st)`, severity:"critical", field:"code", component:"affiliates" });
  } catch (e: any) {
    issues.push({ title:`Sync scan error: ${e.message}`, severity:"critical", component:"sync_scan" });
  }
  const normalized = issues.map(i => normalizeIssue({ ...i, type:i.type || (i.field ? "missing_data" : "mismatch") }));
  return { issues:normalized, issues_found:normalized.length, input_size:SYNC_RULES.length, rules_applied:SYNC_RULES, ...(normalized.length === 0 ? { _empty_reason:"no_detection" } : {}), duration_ms:Date.now()-startMs, scanned_at:new Date().toISOString() };
}

// ── SYSTEM SCAN ──────────────────────────────────────────────────────────
async function runRealSystemScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const metrics: Record<string, number> = {};
  const startMs = Date.now();
  try {
    for (const { table, filter, key } of [
      { table:"bug_reports",   filter:{ status:"open" },    key:"open_bugs" },
      { table:"work_items",    filter:{ status:"escalated" },key:"work_items_escalated" },
      { table:"notifications", filter:{ read:false },        key:"unread_notifications" },
    ]) {
      let q = supabase.from(table).select("*", { count:"exact", head:true });
      for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
      const { count } = await q;
      metrics[key] = count || 0;
    }
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentErrors } = await supabase.from("activity_logs").select("*", { count:"exact", head:true }).eq("log_type","error").gte("created_at",oneDayAgo);
    metrics.errors_last_24h = recentErrors || 0;

    if (metrics.open_bugs > 20)              issues.push({ title:`${metrics.open_bugs} öppna buggar`, severity:"high", component:"bug_reports" });
    if (metrics.work_items_escalated > 5)    issues.push({ title:`${metrics.work_items_escalated} eskalerade ärenden`, severity:"critical", component:"work_items" });
    if (metrics.errors_last_24h > 50)        issues.push({ title:`${metrics.errors_last_24h} fel senaste 24h`, severity:"high", component:"activity_logs" });
    if (metrics.unread_notifications > 100)  issues.push({ title:`${metrics.unread_notifications} olästa notiser`, severity:"medium", component:"notifications" });

    const { data: staleEsc } = await supabase.from("work_items").select("id,title").eq("status","escalated").lt("updated_at",oneDayAgo).limit(20);
    for (const wi of staleEsc || [])
      issues.push({ title:`Eskalerat ärende >24h: "${wi.title}"`, severity:"high", component:"work_items", entity_id:wi.id });

    const { data: recentScans } = await supabase.from("ai_scan_results").select("overall_score").eq("scan_type","full_orchestrated").order("created_at",{ascending:false}).limit(3);
    if ((recentScans?.length || 0) >= 2) {
      const [cur, prev] = [recentScans![0].overall_score || 0, recentScans![1].overall_score || 0];
      if (cur < prev - 10) issues.push({ title:`Systempoäng sjunkit: ${prev} → ${cur}`, severity:"high", component:"system_health" });
      metrics.score_delta = cur - prev;
    }
  } catch (e: any) {
    issues.push({ title:`System scan error: ${e.message}`, severity:"critical", component:"system_scan" });
  }
  const normalized = issues.map(i => normalizeIssue({ ...i, type:i.type || "invalid_state" }));
  return { issues:normalized, issues_found:normalized.length, metrics, input_size:Object.keys(metrics).length, rules_applied:SYSTEM_RULES, ...(normalized.length === 0 ? { _empty_reason:"no_detection" } : {}), duration_ms:Date.now()-startMs, scanned_at:new Date().toISOString() };
}

// ── FEATURE DETECTION ────────────────────────────────────────────────────
async function runRealFeatureDetection(supabase: any, scanRunId: string): Promise<any> {
  const features: any[] = [];
  const startMs = Date.now();
  for (const { name, table, query } of [
    { name:"Produkter",        table:"products",        query:"id,title_sv,status" },
    { name:"Ordrar",           table:"orders",          query:"id,status,created_at" },
    { name:"Kategorier",       table:"categories",      query:"id,name_sv,slug" },
    { name:"Recensioner",      table:"reviews",         query:"id,rating,product_id" },
    { name:"Affiliates",       table:"affiliates",      query:"id,name,code" },
    { name:"Influencers",      table:"influencers",     query:"id,name,code" },
    { name:"Bugrapporter",     table:"bug_reports",     query:"id,description,status" },
    { name:"Work Items",       table:"work_items",      query:"id,title,status" },
    { name:"Donationer",       table:"donations",       query:"id,amount,source" },
    { name:"E-postmallar",     table:"email_templates", query:"id,template_type,is_active" },
    { name:"Bundles",          table:"bundles",         query:"id,name,is_active" },
    { name:"Aktivitetsloggar", table:"activity_logs",   query:"id,log_type,message" },
    { name:"Notiser",          table:"notifications",   query:"id,type,read" },
  ]) {
    try {
      const { error, count } = await supabase.from(table).select(query, { count:"exact" }).limit(1);
      features.push(error
        ? { name, status:"broken", reason:error.message, component:table }
        : { name, status:"working", row_count:count || 0, component:table });
    } catch (e: any) { features.push({ name, status:"error", reason:e.message, component:table }); }
  }
  try {
    const { data: ins, error: insErr } = await supabase.from("activity_logs")
      .insert({ message:`__probe_${Date.now()}`, log_type:"probe", category:"feature_detection" }).select("id").single();
    if (insErr) features.push({ name:"Skrivåtkomst", status:"broken", reason:insErr.message });
    else {
      const { data: f } = await supabase.from("activity_logs").select("id").eq("id",ins.id).maybeSingle();
      features.push({ name:"Skrivåtkomst", status:f ? "working" : "broken", component:"activity_logs" });
      if (f) await supabase.from("activity_logs").delete().eq("id",ins.id);
    }
  } catch (e: any) { features.push({ name:"Skrivåtkomst", status:"error", reason:e.message }); }

  const broken = features.filter(f => f.status !== "working").length;
  const issues = features.filter(f => f.status !== "working")
    .map(f => normalizeIssue({ type:"invalid_state", severity:"high", title:`Feature not working: "${f.name}"`, component:f.component || f.name }));
  return { features, issues, issues_found:broken, input_size:features.length, rules_applied:FEATURE_RULES, ...(broken === 0 ? { _empty_reason:"no_detection" } : {}), duration_ms:Date.now()-startMs, scanned_at:new Date().toISOString() };
}

// ── INTERACTION QA ───────────────────────────────────────────────────────
async function runRealInteractionQA(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();
  try {
    // Bundles with no items (dead CTA)
    const { data: bundles } = await supabase.from("bundles").select("id,name").eq("is_active",true).limit(50);
    for (const b of bundles || []) {
      const { count } = await supabase.from("bundle_items").select("id", { count:"exact", head:true }).eq("bundle_id",b.id);
      if (!count) issues.push({ title:`Bundle "${b.name}" CTA leads nowhere (no items)`, severity:"critical", component:"bundles", _issue_type:"bug" });
    }

    // Orphan notifications (deleted user)
    const { data: recentNotifs } = await supabase.from("notifications").select("id,user_id").order("created_at",{ascending:false}).limit(50);
    const uids = new Set((recentNotifs || []).map((n: any) => n.user_id).filter(Boolean));
    if (uids.size > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id").in("user_id",[...uids]);
      const existingIds = new Set((profiles || []).map((p: any) => p.user_id));
      for (const n of recentNotifs || [])
        if (n.user_id && !existingIds.has(n.user_id)) issues.push({ title:`Notis för borttagen användare`, severity:"medium", component:"notifications" });
    }

    // Incidents without valid orders
    const { data: incidents } = await supabase.from("order_incidents").select("id,title,order_id").in("status",["open","investigating","in_progress"]).limit(50);
    for (const inc of incidents || []) {
      const { data: order } = await supabase.from("orders").select("id").eq("id",inc.order_id).maybeSingle();
      if (!order) issues.push({ title:`Ärende "${inc.title}" → order finns ej`, severity:"high", component:"order_incidents" });
    }

    // Automation rules with empty config
    const { data: rules } = await supabase.from("automation_rules").select("id,rule_key,config").eq("is_active",true).limit(50);
    for (const r of rules || [])
      if (!r.config || (typeof r.config === "object" && Object.keys(r.config).length === 0))
        issues.push({ title:`Automationsregel utan config: "${r.rule_key}"`, severity:"medium", component:"automation_rules" });

    // Email templates missing subject/intro or CTA
    const { data: templates } = await supabase.from("email_templates").select("id,template_type,subject_sv,intro_sv,cta_text_sv,cta_text_en").eq("is_active",true).limit(20);
    for (const t of templates || []) {
      if (!t.subject_sv || !t.intro_sv) issues.push({ title:`E-postmall "${t.template_type}" saknar ämne/intro`, severity:"high", component:"email_templates" });
      if (!t.cta_text_sv && !t.cta_text_en) issues.push({ title:`E-postmall "${t.template_type}" har ingen CTA`, severity:"high", component:"email_templates", _issue_type:"bug" });
    }

    // Products visible but no handle
    const { data: noHandleProd } = await supabase.from("products").select("id,title_sv").eq("is_visible",true).is("handle",null).limit(50);
    for (const p of noHandleProd || [])
      issues.push({ title:`Product "${p.title_sv || p.id.slice(0,8)}" har ingen URL-handle`, severity:"critical", component:"products", _issue_type:"bug" });

    // Affiliate applications with missing required fields
    const { data: affiliateApps } = await supabase.from("affiliate_applications").select("id,name,email").eq("status","pending").limit(50);
    for (const app of affiliateApps || [])
      if (!app.email || !app.name)
        issues.push({ title:`Affiliate-ansökan saknar obligatoriska fält`, severity:"critical", component:"affiliate_applications", _issue_type:"bug" });

  } catch (e: any) {
    issues.push({ title:`Interaction QA error: ${e.message}`, severity:"critical", component:"interaction_qa" });
  }
  const normalized = issues.map(i => normalizeIssue({ ...i, type:i.type || i._issue_type || "broken_flow" }));
  return { issues:normalized, issues_found:normalized.length, input_size:INTERACTION_RULES.length, rules_applied:INTERACTION_RULES, ...(normalized.length === 0 ? { _empty_reason:"no_detection" } : {}), duration_ms:Date.now()-startMs, scanned_at:new Date().toISOString() };
}

// ── COMPONENT MAP SCAN ───────────────────────────────────────────────────
async function runRealComponentMapScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();
  let componentsScanned = 0;
  try {
    const { data: sections } = await supabase.from("page_sections").select("id,section_key,page,title_sv,title_en").eq("is_visible",true).limit(200);
    componentsScanned += (sections || []).length;
    for (const s of sections || [])
      if (!s.title_sv && !s.title_en) issues.push({ title:`Missing label: section "${s.section_key}" on ${s.page}`, severity:"medium", component:s.section_key, entity_id:s.id });

    const { data: products } = await supabase.from("products").select("id,title_sv,title_en,description_sv,description_en,image_urls,handle").eq("is_visible",true).limit(200);
    componentsScanned += (products || []).length;
    for (const p of products || []) {
      if (!p.title_sv && !p.title_en) issues.push({ title:`Missing label: product "${p.handle || p.id.slice(0,8)}"`, severity:"high", component:"products", entity_id:p.id });
      if (!p.description_sv && !p.description_en) issues.push({ title:`Missing description: product "${p.handle || p.id.slice(0,8)}"`, severity:"medium", component:"products", entity_id:p.id });
    }

    const { data: categories } = await supabase.from("categories").select("id,name_sv,name_en,slug").eq("is_visible",true).limit(100);
    componentsScanned += (categories || []).length;
    for (const c of categories || [])
      if (!c.name_sv && !c.name_en) issues.push({ title:`Missing label: category "${c.slug}"`, severity:"high", component:"categories", entity_id:c.id });

    const { data: activeBundles } = await supabase.from("bundles").select("id,name").eq("is_active",true).limit(50);
    componentsScanned += (activeBundles || []).length;
    for (const b of activeBundles || []) {
      const { count } = await supabase.from("bundle_items").select("id", { count:"exact", head:true }).eq("bundle_id",b.id);
      if (!count) issues.push({ title:`Dead interaction: bundle "${b.name}" active but empty`, severity:"high", component:"bundles", entity_id:b.id });
    }

    if (products && products.length > 0) {
      const withImg = products.filter((p: any) => p.image_urls && p.image_urls.length > 0).length;
      const noImg   = products.filter((p: any) => !p.image_urls || p.image_urls.length === 0).length;
      if (withImg > 0 && noImg > 0) issues.push({ title:`Inconsistent UI: ${noImg} products without images vs ${withImg} with`, severity:"medium", component:"products" });
    }

    const { data: emailTemplates } = await supabase.from("email_templates").select("id,template_type,cta_text_sv,cta_text_en").eq("is_active",true).limit(20);
    componentsScanned += (emailTemplates || []).length;
    for (const t of emailTemplates || [])
      if (!t.cta_text_sv && !t.cta_text_en) issues.push({ title:`Dead interaction: email "${t.template_type}" has no CTA`, severity:"medium", component:"email_templates", entity_id:t.id });

    const { data: tags } = await supabase.from("product_tags").select("id,name_sv,color").limit(100);
    componentsScanned += (tags || []).length;
    if (tags && tags.length > 1) {
      const withColor = tags.filter((t: any) => t.color).length;
      const noColor   = tags.filter((t: any) => !t.color).length;
      if (withColor > 0 && noColor > 0) issues.push({ title:`Inconsistent UI: ${noColor} tags without color vs ${withColor} with`, severity:"low", component:"product_tags" });
    }
  } catch (e: any) {
    issues.push({ title:`Component map scan error: ${e.message}`, severity:"critical", component:"component_map" });
  }
  const normalized = issues.map(i => normalizeIssue({ ...i, type:i.type || "missing_data" }));
  return { issues:normalized, issues_found:normalized.length, components_scanned:componentsScanned, input_size:componentsScanned, rules_applied:COMPONENT_RULES, ...(normalized.length === 0 ? { _empty_reason:"no_detection" } : {}), duration_ms:Date.now()-startMs, scanned_at:new Date().toISOString() };
}

// ── UI FLOW INTEGRITY SCAN ───────────────────────────────────────────────
async function runUiFlowIntegrityScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();
  let flowsScanned = 0;
  const KNOWN_FLOWS = [
    { name:"Checkout",         steps:["product_view","add_to_cart","checkout","payment","confirmation"], route:"/shop" },
    { name:"Login",            steps:["open_auth","enter_credentials","authenticated"],                  route:"/" },
    { name:"Registration",     steps:["open_auth","enter_details","verify_email","profile_created"],     route:"/" },
    { name:"Track Order",      steps:["enter_email_order","lookup","display_status"],                    route:"/track-order" },
    { name:"Affiliate Signup", steps:["landing","apply","confirmation"],                                 route:"/affiliate" },
    { name:"Donation",         steps:["select_amount","checkout","confirmation"],                         route:"/donations" },
  ];
  try {
    const { data: products } = await supabase.from("products").select("id,handle,title_sv").eq("is_visible",true).limit(200);
    flowsScanned += (products || []).length;
    for (const p of products || [])
      if (!p.handle) issues.push({ title:`Broken flow: product "${p.title_sv || p.id.slice(0,8)}" has no URL handle`, severity:"high", component:"products", _issue_type:"bug" });

    const { data: categories } = await supabase.from("categories").select("id,name_sv,slug").eq("is_visible",true).limit(100);
    flowsScanned += (categories || []).length;
    for (const c of categories || [])
      if (!c.slug || c.slug.trim() === "") issues.push({ title:`Broken flow: category "${c.name_sv || c.id.slice(0,8)}" has no slug`, severity:"high", component:"categories", _issue_type:"bug" });

    const { data: recentEvents } = await supabase.from("analytics_events").select("event_type").order("created_at",{ascending:false}).limit(500);
    const eventTypes = new Set((recentEvents || []).map((e: any) => e.event_type));
    flowsScanned += KNOWN_FLOWS.length;
    for (const flow of KNOWN_FLOWS) {
      const missing = flow.steps.filter(s => !eventTypes.has(s) && !eventTypes.has(`${s}_start`) && !eventTypes.has(`${s}_complete`));
      if (missing.length === flow.steps.length) issues.push({ title:`Broken flow: "${flow.name}" has no tracked events`, severity:"medium", component:flow.name, route:flow.route, _issue_type:"bug" });
      else if (missing.length > 0) issues.push({ title:`Broken flow: "${flow.name}" incomplete tracking (${missing.length}/${flow.steps.length} missing)`, severity:"low", component:flow.name, route:flow.route, _issue_type:"bug" });
    }

    const { data: activeBundles } = await supabase.from("bundles").select("id,name").eq("is_active",true).limit(50);
    flowsScanned += (activeBundles || []).length;
    for (const b of activeBundles || []) {
      const { count } = await supabase.from("bundle_items").select("id", { count:"exact", head:true }).eq("bundle_id",b.id);
      if (!count) issues.push({ title:`Broken flow: bundle "${b.name}" has no products (dead CTA)`, severity:"high", component:"bundles", _issue_type:"bug" });
    }

    const { data: legalDocs } = await supabase.from("legal_documents").select("id,document_type,is_active").limit(20);
    for (const reqType of ["privacy_policy","terms_conditions","return_policy"])
      if (!(legalDocs || []).find((d: any) => d.document_type === reqType && d.is_active))
        issues.push({ title:`Broken flow: required legal document "${reqType}" missing or inactive`, severity:"high", component:"legal_documents", _issue_type:"bug" });

    for (const { name, filter, requires } of [
      { name:"Header",     filter:{ page:"home", section_key:"header" },     requires:["title_sv"] },
      { name:"Hero",       filter:{ page:"home", section_key:"hero" },       requires:["title_sv","content_sv"] },
      { name:"Footer",     filter:{ page:"home", section_key:"footer" },     requires:["content_sv"] },
      { name:"Newsletter", filter:{ page:"home", section_key:"newsletter" }, requires:["title_sv"] },
    ]) {
      try {
        let q = supabase.from("page_sections").select("*");
        for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
        const { data: row } = await q.limit(1).maybeSingle();
        flowsScanned++;
        if (!row) issues.push({ title:`UI element not found: "${name}" section missing`, severity:"high", component:name, _issue_type:"bug" });
        else if (requires.some((f: string) => !row[f] || String(row[f]).trim() === "")) issues.push({ title:`UI element missing text: "${name}" (${requires.join(",")})`, severity:"medium", component:name, _issue_type:"bug" });
      } catch (_) {}
    }

    const { data: sellable } = await supabase.from("products").select("id,title_sv,price").eq("is_visible",true).eq("is_sellable",true).limit(100);
    for (const p of sellable || []) {
      flowsScanned++;
      if (!p.price || p.price <= 0) issues.push({ title:`Product "${p.title_sv || p.id.slice(0,8)}" visible+sellable but no valid price`, severity:"high", component:"products", _issue_type:"bug" });
    }
  } catch (e: any) {
    issues.push({ title:`UI flow scan error: ${e.message}`, severity:"critical", component:"ui_flow_integrity" });
  }
  const normalized = issues.map(i => normalizeIssue({ ...i, type:i.type || i._issue_type || "broken_flow" }));
  return { issues:normalized, issues_found:normalized.length, flows_scanned:flowsScanned, input_size:flowsScanned, rules_applied:FLOW_RULES, ...(normalized.length === 0 ? { _empty_reason:"no_detection" } : {}), duration_ms:Date.now()-startMs, scanned_at:new Date().toISOString() };
}

// ── SCANNER DISPATCH ─────────────────────────────────────────────────────
const REAL_DB_SCANNERS: Record<string, (supabase: any, scanRunId: string) => Promise<any>> = {
  data_integrity:      runDataIntegrityScan,
  functional_behavior: runFunctionalBehaviorScan,
  sync_scan:           runRealSyncScan,
  system_scan:         runRealSystemScan,
  feature_detection:   runRealFeatureDetection,
  interaction_qa:      runRealInteractionQA,
  component_map:       runRealComponentMapScan,
  ui_flow_integrity:   runUiFlowIntegrityScan,
};

// ── CONSISTENCY GUARD ────────────────────────────────────────────────────
async function runConsistencyGuard(supabase: any, currentFingerprints: Map<string, { title: string; priority: string; item_type: string }>) {
  const { data: activeItems } = await supabase.from("work_items")
    .select("id,title,issue_fingerprint").eq("source_type","ai_scan")
    .not("issue_fingerprint","is",null)
    .in("status",["open","claimed","in_progress","escalated","new","pending","detected"]).limit(500);
  const existingByFp = new Map<string, any>();
  for (const item of activeItems || []) if (item.issue_fingerprint) existingByFp.set(item.issue_fingerprint, item);
  let resolved = 0;
  for (const [fp, item] of existingByFp) {
    if (!currentFingerprints.has(fp)) {
      await supabase.from("work_items").update({ status:"done", updated_at:new Date().toISOString() }).eq("id",item.id);
      resolved++;
    }
  }
  if (resolved > 0) console.log(`[consistency-guard] Marked ${resolved} disappeared issues as resolved`);
  return existingByFp;
}

// ── ISSUE TYPE CLASSIFIER ────────────────────────────────────────────────
function classifyIssueType(issue: any, category: string): "bug" | "improvement" | "upgrade" {
  const text = `${issue.title || ""} ${issue.description || ""} ${issue.type || ""} ${issue.failure_type || ""}`.toLowerCase();
  if (category === "fake_features") return "upgrade";
  if (/fake.?feature|not.?implemented|placeholder|outdated|deprecated|missing.?feature|wip|coming.?soon/.test(text)) return "upgrade";
  if (/spacing|layout|overflow|responsive|mobile|unclear|cta|inconsisten|alignment|truncat|padding|style|visual|css/.test(text)) return "improvement";
  return "bug";
}

// ── CREATE WORK ITEMS ────────────────────────────────────────────────────
async function createWorkItems(supabase: any, unified: any): Promise<number> {
  let created = 0;
  const allIssues: any[] = [
    ...groupSimilarIssues(unified.broken_flows        || []).slice(0, 15).map((i: any) => ({ ...i, _category:"broken_flows" })),
    ...groupSimilarIssues(unified.fake_features       || []).slice(0, 10).map((i: any) => ({ ...i, _category:"fake_features" })),
    ...groupSimilarIssues(unified.interaction_failures || []).slice(0, 15).map((i: any) => ({ ...i, _category:"interaction_failures" })),
    ...groupSimilarIssues(unified.data_issues         || []).slice(0, 20).map((i: any) => ({ ...i, _category:"data_issues" })),
  ];

  for (const issue of allIssues) {
    const fp    = generateFingerprint(issue);
    const title = (issue.title || issue.description || "Unknown issue").slice(0, 120).trim();
    if (!title) continue;
    const { data: existing } = await supabase.from("work_items").select("id,created_at")
      .eq("issue_fingerprint",fp).in("status",["open","claimed","in_progress","escalated","new","pending","detected"]).limit(1);
    if (existing?.length) {
      if (Date.now() - new Date(existing[0].created_at).getTime() <= DEDUP_WINDOW_MS) {
        await supabase.from("work_items").update({ last_seen_at:new Date().toISOString() }).eq("id",existing[0].id);
        continue;
      }
    }
    const priority  = issue.severity === "critical" ? "critical" : issue.severity === "high" ? "high" : "medium";
    const item_type = classifyIssueType(issue, issue._category || "");
    const now       = new Date().toISOString();
    const { error } = await supabase.from("work_items").insert({
      title, description:issue.description || issue.fix_suggestion || "Auto-generated from scan",
      status:"open", priority, item_type, source_type:"ai_scan",
      ai_detected:true, issue_fingerprint:fp, first_seen_at:now, last_seen_at:now,
    });
    if (!error) { created++; console.log(`[create-work-item] created: "${title.slice(0,60)}"`); }
  }
  return created;
}

// ── RUN STEP ─────────────────────────────────────────────────────────────
async function runStep(step: { id: string; label: string; scanType: string }, supabase: any, scan_run_id: string): Promise<any> {
  const start = Date.now();
  console.log(`[SCAN START] ${step.id}`);
  let result: any = { issues:[], _executed:false, _empty_reason:"", _input_size:0, _duration_ms:0 };
  try {
    const scanner = REAL_DB_SCANNERS[step.scanType];
    if (scanner) {
      result = { ...await scanner(supabase, scan_run_id), ai_suggestions:[], ai_summary:null };
    } else if (!AI_ENABLED) {
      console.log(`[AI DISABLED] Skipping: ${step.id}`);
      result = { issues:[], skipped:true, _reason:"AI_DISABLED" };
    }
    if (!Array.isArray(result.issues)) result.issues = result.issues ?? [];
    const duration_ms = Date.now() - start;
    const inputSize   = result.input_size ?? result.components_scanned ?? result.flows_scanned ?? result.items_scanned ?? 0;
    if (result.issues.length === 0 && !result._empty_reason)
      result._empty_reason = (result.failed || result.error) ? "scanner_failed" : inputSize === 0 ? "no_data" : "no_detection";
    result._executed   = !(result.failed || result.error);
    result._input_size = inputSize;
    result._duration_ms = duration_ms;
    console.log(`[SCAN END] ${step.id}: issues=${result.issues.length} ${duration_ms}ms`);
    return result;
  } catch (e: any) {
    result.issues = []; result._empty_reason = "scanner_failed"; result._executed = false;
    result._duration_ms = Date.now() - start; result.error = e.message; result.failed = true;
    console.log(`[SCAN END] ${step.id}: error=${e.message}`);
    return result;
  }
}

// ── SERVE HANDLER ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase    = createClient(supabaseUrl, serviceKey);
    const body        = await req.json();
    const { action, scan_run_id } = body;

    if (action === "status") {
      let q = supabase.from("scan_runs").select("*");
      if (scan_run_id) q = q.eq("id", scan_run_id);
      else q = q.order("created_at", { ascending: false }).limit(1);
      const { data } = await q.single();
      return new Response(JSON.stringify({ success:true, ...(data || {}) }), { headers:{ ...corsHeaders, "Content-Type":"application/json" }, status:200 });
    }

    if (action !== "start")
      return new Response(JSON.stringify({ success:false, error:"Invalid action" }), { status:200, headers:{ ...corsHeaders, "Content-Type":"application/json" } });

    const authHeader = req.headers.get("authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ success:false, error:"Unauthorized" }), { status:200, headers:{ ...corsHeaders, "Content-Type":"application/json" } });

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global:{ headers:{ Authorization:authHeader } } });
    const { data:{ user }, error:userError } = await anonClient.auth.getUser();
    if (userError || !user?.id)
      return new Response(JSON.stringify({ success:false, error:"Unauthorized" }), { status:200, headers:{ ...corsHeaders, "Content-Type":"application/json" } });

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = roles?.some((r: any) => ["admin","founder","it","support","moderator"].includes(r.role));
    if (!isStaff)
      return new Response(JSON.stringify({ success:false, error:"Unauthorized" }), { status:200, headers:{ ...corsHeaders, "Content-Type":"application/json" } });

    // ── RUNNING-SCAN LOCK ────────────────────────────────────────────────
    const { data: running } = await supabase.from("scan_runs").select("id,started_at").eq("status","running").limit(1);
    if (running?.length) {
      const age = Date.now() - new Date(running[0].started_at).getTime();
      if (age > 5 * 60 * 1000) await supabase.from("scan_runs").update({ status:"error", completed_at:new Date().toISOString() }).eq("id", running[0].id);
      else return new Response(JSON.stringify({ success:false, error:"En skanning körs redan", running_scan:running[0] }), { status:200, headers:{ ...corsHeaders, "Content-Type":"application/json" } });
    }

    // ── CREATE SCAN_RUN ──────────────────────────────────────────────────
    const { data: scanRun, error: insertError } = await supabase.from("scan_runs").insert({
      status:"running", started_by:user.id, current_step:0, total_steps:STEPS.length,
      current_step_label:STEPS[0].label, steps_results:{}, scan_mode:"full",
    }).select("id").single();
    if (insertError || !scanRun)
      return new Response(JSON.stringify({ success:false, error:insertError?.message || "Failed to create scan run" }), { status:200, headers:{ ...corsHeaders, "Content-Type":"application/json" } });

    // ── LOOP STEPS ───────────────────────────────────────────────────────
    const stepsResults: Record<string, any> = {};
    for (const step of STEPS) {
      await supabase.from("scan_runs").update({ current_step_label:step.label, current_step:STEPS.indexOf(step) }).eq("id", scanRun.id);
      stepsResults[step.id] = await runStep(step, supabase, scanRun.id);
      await supabase.from("scan_runs").update({ steps_results:stepsResults }).eq("id", scanRun.id);
    }

    // ── BUILD UNIFIED RESULT ─────────────────────────────────────────────
    const totalDuration    = Object.values(stepsResults).reduce((s: number, r: any) => s + (r?._duration_ms || 0), 0);
    const unified          = buildUnifiedResult(stepsResults, totalDuration);
    const issuesCount      = unified.all_issues.length;
    const workItemsCreated = await createWorkItems(supabase, unified);
    const execSummary      = `${unified.system_health_score}/100 — ${issuesCount} issues — ${workItemsCreated} tasks created`;
    console.log("[SCAN DONE]", execSummary);

    // ── SAVE FINAL RESULT ────────────────────────────────────────────────
    await supabase.from("scan_runs").update({
      status:"done", completed_at:new Date().toISOString(), steps_results:stepsResults,
      unified_result:unified, system_health_score:unified.system_health_score,
      executive_summary:execSummary, work_items_created:workItemsCreated,
      current_step:STEPS.length, current_step_label:"Klar ✓",
    }).eq("id", scanRun.id);

    // Fetch the completed scan_run row for the response
    const { data: scanRunRow } = await supabase.from("scan_runs").select("*").eq("id", scanRun.id).single();

    return new Response(JSON.stringify({
      success:           true,
      scan_id:           scanRun.id,
      scan_run:          scanRunRow || null,
      unified_result:    unified,
      total_new_issues:  issuesCount,
      work_items_created: workItemsCreated,
    }), { headers:{ ...corsHeaders, "Content-Type":"application/json" }, status:200 });

  } catch (e: any) {
    console.error("[run-full-scan error]:", e?.message || e);
    return new Response(JSON.stringify({ success:false, error:e?.message || "Unknown error" }), { status:200, headers:{ ...corsHeaders, "Content-Type":"application/json" } });
  }
});
