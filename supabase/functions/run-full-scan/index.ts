import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ── AI kill-switch (set to true to re-enable once credits are available) ──
const AI_ENABLED = false;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STEPS = [
  { id: "data_flow_validation",    scanType: "data_integrity",    label: "Validerar dataflöden..." },
  { id: "component_map",           scanType: "component_map",     label: "Kartlägger komponenter..." },
  { id: "ui_data_binding",         scanType: "sync_scan",         label: "Validerar UI-databindning..." },
  { id: "interaction_qa",          scanType: "interaction_qa",    label: "Testar interaktioner..." },
  { id: "human_test",              scanType: "human_test",        label: "Simulerar användarbeteende..." },
  { id: "navigation_verification", scanType: "nav_scan",          label: "Verifierar navigering..." },
  { id: "feature_detection",       scanType: "feature_detection", label: "Klassificerar funktioner..." },
  { id: "regression_detection",    scanType: "system_scan",       label: "Detekterar regressioner..." },
  { id: "decision_engine",         scanType: "decision_engine",   label: "Kör beslutsmotor..." },
  { id: "blocker_detection",       scanType: "blocker_detection", label: "Söker blockerare..." },
  { id: "ui_flow_integrity",       scanType: "ui_flow_integrity", label: "Verifierar UI-flödesintegritet..." },
];

// ── Fingerprint ────────────────────────────────────────────────────────────
function generateFingerprint(issue: any): string {
  const component = (issue.component || issue.element || issue.table || issue.entity || issue.chain || "unknown").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);
  const type      = (issue.type || issue.failure_type || issue.category || issue.item_type || issue._source || "general").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20);
  const location  = (issue.route || issue.page || issue.field || issue.step || "global").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);
  const descRaw   = (issue.description || issue.title || issue.fix_suggestion || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const descPat   = descRaw.split(/\s+/).slice(0, 5).join("_").slice(0, 30);
  return `${component}::${type}::${location}::${descPat}`;
}

// ── Group similar issues by fingerprint prefix ─────────────────────────────
function groupSimilarIssues(issues: any[]): any[] {
  const groups: Map<string, any[]> = new Map();
  for (const issue of issues) {
    const fp = generateFingerprint(issue);
    const key = fp.split("::").slice(0, 2).join("::");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ ...issue, _fingerprint: fp });
  }
  const result: any[] = [];
  for (const [, items] of groups) {
    if (items.length === 1) { result.push(items[0]); continue; }
    const sorted = [...items].sort((a, b) => {
      const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (o[a.severity] ?? 2) - (o[b.severity] ?? 2);
    });
    const rep = { ...sorted[0], _similar_count: items.length - 1, _similar_issues: items.slice(1).map((i: any) => i.title || i.description || "").filter(Boolean).slice(0, 5) };
    result.push(rep);
  }
  return result;
}

// ── Build unified result ───────────────────────────────────────────────────
function buildUnifiedResult(stepResults: Record<string, any>, totalDuration: number) {
  const blocker = stepResults.blocker_detection?.primary_blocker || stepResults.blocker_detection?.detected_blockers?.[0] || null;

  const broken_flows: any[] = [];
  if (stepResults.data_flow_validation?.issues)       broken_flows.push(...stepResults.data_flow_validation.issues);
  if (stepResults.data_flow_validation?.broken_links) broken_flows.push(...stepResults.data_flow_validation.broken_links);
  if (stepResults.navigation_verification?.issues)    broken_flows.push(...stepResults.navigation_verification.issues);
  if (stepResults.navigation_verification?.broken_routes) broken_flows.push(...stepResults.navigation_verification.broken_routes);

  const fake_features: any[] = [];
  if (stepResults.feature_detection?.features) {
    fake_features.push(...stepResults.feature_detection.features.filter((f: any) => f.status === "fake" || f.classification === "fake"));
  }

  const interaction_failures: any[] = [];
  if (stepResults.interaction_qa?.issues)     interaction_failures.push(...stepResults.interaction_qa.issues);
  if (stepResults.human_test?.issues)         interaction_failures.push(...stepResults.human_test.issues);
  if (stepResults.human_test?.test_failures)  interaction_failures.push(...stepResults.human_test.test_failures);

  const data_issues: any[] = [];
  if (stepResults.ui_data_binding?.issues)    data_issues.push(...stepResults.ui_data_binding.issues);
  if (stepResults.ui_data_binding?.mismatches) data_issues.push(...stepResults.ui_data_binding.mismatches);
  // Merge data integrity issues
  if (stepResults.data_flow_validation?.integrity_issues) data_issues.push(...stepResults.data_flow_validation.integrity_issues);

  const scores: number[] = [];
  for (const r of Object.values(stepResults)) {
    if ((r as any)?.overall_score != null) scores.push((r as any).overall_score);
    if ((r as any)?.system_score  != null) scores.push((r as any).system_score);
    if ((r as any)?.health_score  != null) scores.push((r as any).health_score);
    if ((r as any)?.score         != null) scores.push((r as any).score);
  }
  const system_health_score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return { blocker, broken_flows, fake_features, interaction_failures, data_issues, system_health_score, step_results: stepResults, completed_at: new Date().toISOString(), total_duration_ms: totalDuration };
}

const DATA_INTEGRITY_RULES = ["work_items_without_source", "orphan_work_items_bug", "orphan_work_items_incident", "duplicate_work_items", "work_items_deleted_order", "status_mismatch_bug_resolved", "stale_claimed_items", "entity_required_fields", "id_trace_entities", "frontend_backend_mismatch"];
const BEHAVIOR_RULES = ["create_work_item_verify", "bug_to_work_item", "incident_to_work_item", "status_sync_done_resolved", "dismiss_no_reappear", "order_lifecycle_closed", "incident_notification"];
const SYNC_RULES = ["product_missing_title", "product_invalid_price", "active_product_no_image", "active_product_no_handle", "order_shipped_no_timestamp", "order_delivered_no_timestamp", "order_paid_cancelled", "affiliate_no_code", "duplicate_discount_codes"];
const SYSTEM_RULES = ["open_bugs_threshold", "escalated_items_threshold", "errors_last_24h_threshold", "unread_notifications_threshold", "stale_escalated_items", "score_trend_regression"];
const FEATURE_RULES = ["table_accessible", "row_count_detected", "write_access_round_trip"];
const INTERACTION_RULES = ["bundle_items_orphan_bundle", "orphan_notifications_deleted_user", "incidents_missing_order", "automation_rules_empty_config", "email_templates_missing_subject", "bundles_no_items_dead_cta", "products_no_handle_unnavigable", "affiliate_applications_missing_fields", "email_templates_no_cta"];
const COMPONENT_RULES = ["page_sections_missing_label", "products_missing_title", "products_missing_description", "categories_missing_label", "active_bundles_no_items", "inconsistent_product_images", "duplicate_section_display_order", "email_templates_no_cta", "product_tags_inconsistent_color"];
const FLOW_RULES = ["products_missing_handle", "categories_missing_slug", "flows_analytics_events", "bundles_no_products_dead_cta", "required_legal_documents", "flow_chain_complete", "data_trace_pipeline", "ui_components_text_visible", "sellable_products_valid_price"];
// ──────────────────────────────────────────────────────────────────────────

// ── Helper: Normalize raw scanner issue to the standard active-detection structure ──
// Guarantees every issue has: type, severity, location, description, expected_state, actual_state
function normalizeIssue(raw: any, defaults: { type?: string; location?: string } = {}): any {
  const type = raw.type || raw._issue_type || defaults.type || "invalid_state";
  const location = raw.location || raw.component || raw.entity || raw.table || defaults.location || "unknown";
  const description = raw.description || raw.title || raw.message || "Unknown issue";
  const expected_state = raw.expected_state ?? raw.expected ?? undefined;
  const actual_state = raw.actual_state ?? raw.actual ?? undefined;
  return {
    ...raw,
    type,
    severity: raw.severity || "medium",
    location,
    description,
    ...(expected_state !== undefined ? { expected_state } : {}),
    ...(actual_state !== undefined ? { actual_state } : {}),
  };
}

// ── DATA INTEGRITY SCAN ──
async function runDataIntegrityScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const traceId = `integrity-${scanRunId.slice(0, 8)}`;
  const startMs = Date.now();

  try {
    // 1. Work items created but missing source
    const { data: sourceless } = await supabase
      .from("work_items").select("id, title, item_type, source_type, source_id, created_at")
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .is("source_id", null)
      .not("item_type", "in", '("manual","manual_task","general")')
      .limit(100);

    for (const wi of sourceless || []) {
      issues.push({ type: "failed_insert", severity: "high", entity: "work_item", entity_id: wi.id, title: `Work item utan källa: "${wi.title}"`, description: `item_type=${wi.item_type} men source_id saknas`, step: "create → database", root_cause: "source_id ej satt vid INSERT", component: "work_items" });
    }

    // 2. Orphan work items — source references non-existent rows
    const { data: bugSourced } = await supabase
      .from("work_items").select("id, title, source_id")
      .eq("source_type", "bug_report").not("source_id", "is", null)
      .in("status", ["open", "claimed", "in_progress", "escalated"]).limit(200);

    for (const wi of bugSourced || []) {
      const { data: bug } = await supabase.from("bug_reports").select("id").eq("id", wi.source_id).maybeSingle();
      if (!bug) {
        issues.push({ type: "data_loss", severity: "critical", entity: "work_item", entity_id: wi.id, title: `Orphan: "${wi.title}" → bug ${wi.source_id} finns ej`, step: "database → fetch", root_cause: "Källa raderad utan cleanup", component: "work_items" });
      }
    }

    const { data: incidentSourced } = await supabase
      .from("work_items").select("id, title, source_id")
      .eq("source_type", "order_incident").not("source_id", "is", null)
      .in("status", ["open", "claimed", "in_progress", "escalated"]).limit(200);

    for (const wi of incidentSourced || []) {
      const { data: inc } = await supabase.from("order_incidents").select("id").eq("id", wi.source_id).maybeSingle();
      if (!inc) {
        issues.push({ type: "data_loss", severity: "critical", entity: "work_item", entity_id: wi.id, title: `Orphan: "${wi.title}" → incident ${wi.source_id} finns ej`, step: "database → fetch", root_cause: "Källa raderad utan cleanup", component: "work_items" });
      }
    }

    // 3. Duplicate active work items
    const { data: activeItems } = await supabase
      .from("work_items").select("id, source_type, source_id, title, created_at")
      .in("status", ["open", "claimed", "in_progress", "escalated"])
      .not("source_id", "is", null).limit(500);

    const sourceMap = new Map<string, any[]>();
    for (const wi of activeItems || []) {
      const key = `${wi.source_type}:${wi.source_id}`;
      if (!sourceMap.has(key)) sourceMap.set(key, []);
      sourceMap.get(key)!.push(wi);
    }
    for (const [key, items] of sourceMap) {
      if (items.length > 1) {
        issues.push({ type: "stale_state", severity: "high", entity: "work_item", entity_id: items.map((i: any) => i.id).join(", "), title: `${items.length} duplicerade work items för ${key}`, step: "create → database", root_cause: "Dedup-logik missade", component: "work_items" });
      }
    }

    // 4. Work items linked to deleted/cancelled orders
    const { data: orderLinked } = await supabase
      .from("work_items").select("id, title, related_order_id, status")
      .not("related_order_id", "is", null).in("status", ["open", "claimed", "in_progress"]).limit(200);

    for (const wi of orderLinked || []) {
      const { data: order } = await supabase.from("orders").select("id, status, deleted_at").eq("id", wi.related_order_id).maybeSingle();
      if (!order) {
        issues.push({ type: "data_loss", severity: "high", entity: "work_item", entity_id: wi.id, title: `"${wi.title}" → order finns ej`, step: "database → fetch", root_cause: "Order raderad utan cleanup", component: "work_items" });
      } else if (order.deleted_at) {
        issues.push({ type: "incorrect_filtering", severity: "high", entity: "work_item", entity_id: wi.id, title: `"${wi.title}" → order soft-deleted`, step: "database → UI", root_cause: "Cleanup missade denna work_item", component: "work_items" });
      } else if (["cancelled", "delivered", "completed"].includes(order.status)) {
        issues.push({ type: "stale_state", severity: "medium", entity: "work_item", entity_id: wi.id, title: `"${wi.title}" → order redan ${order.status}`, step: "database → UI", root_cause: "Status-synk bruten", component: "work_items" });
      }
    }

    // 5. Status mismatch: bug resolved but work_item still open
    const { data: resolvedBugs } = await supabase.from("bug_reports").select("id").eq("status", "resolved").limit(100);
    for (const bug of resolvedBugs || []) {
      const { data: activeWi } = await supabase.from("work_items").select("id, title").eq("source_type", "bug_report").eq("source_id", bug.id).in("status", ["open", "claimed", "in_progress", "escalated"]).limit(1);
      if (activeWi?.length) {
        issues.push({ type: "stale_state", severity: "high", entity: "work_item", entity_id: activeWi[0].id, title: `"${activeWi[0].title}" aktiv trots löst bug`, step: "database → UI", root_cause: "Statussynk misslyckades", component: "work_items" });
      }
    }

    // 6. Stale claimed items
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: staleClaimed } = await supabase
      .from("work_items").select("id, title, claimed_by, claimed_at")
      .eq("status", "claimed").not("claimed_at", "is", null).lt("claimed_at", thirtyMinAgo).limit(50);

    for (const wi of staleClaimed || []) {
      issues.push({ type: "stale_state", severity: "medium", entity: "work_item", entity_id: wi.id, title: `"${wi.title}" claimad >30min utan progress`, step: "UI → database", root_cause: "Uppgift övergiven", component: "work_items" });
    }

    // 7. Entity validation: check required fields on key entities
    const ENTITY_VALIDATIONS: { table: string; entity: string; required: string[]; limit: number }[] = [
      { table: "orders", entity: "order", required: ["id", "user_id", "order_email", "status", "payment_status", "total_amount"], limit: 200 },
      { table: "profiles", entity: "user", required: ["id", "user_id"], limit: 200 },
      { table: "products", entity: "product", required: ["id", "title_sv", "price", "status"], limit: 200 },
    ];

    for (const ev of ENTITY_VALIDATIONS) {
      try {
        const { data: rows } = await supabase.from(ev.table).select(ev.required.join(", ")).limit(ev.limit);
        for (const row of rows || []) {
          const missingFields: string[] = [];
          const nullFields: string[] = [];
          for (const field of ev.required) {
            if (!(field in row)) missingFields.push(field);
            else if (row[field] === null || row[field] === undefined) nullFields.push(field);
          }
          if (missingFields.length > 0 || nullFields.length > 0) {
            issues.push({
              type: "data_validation",
              severity: missingFields.includes("id") ? "critical" : nullFields.length > 2 ? "high" : "medium",
              entity: ev.entity,
              entity_id: row.id || "unknown",
              title: `${ev.entity} ${(row.id || "?").toString().slice(0, 8)}: ${missingFields.length > 0 ? `missing [${missingFields.join(",")}]` : ""} ${nullFields.length > 0 ? `null [${nullFields.join(",")}]` : ""}`.trim(),
              step: "database → validation",
              root_cause: "Required field missing or null",
              component: ev.table,
              validation_fields: {
                id: row.id ? "present" : "missing",
                required_fields_missing: missingFields,
                null_fields: nullFields,
              },
            });
          }
        }
      } catch (_) {}
    }

    // 8. ID Trace: verify IDs are generated, persisted, and returned for key entities
    const ID_TRACE_ENTITIES = [
      { table: "orders", entity: "order", id_field: "id", return_fields: ["id", "order_number", "payment_intent_id"], limit: 100 },
      { table: "profiles", entity: "user", id_field: "user_id", return_fields: ["user_id", "username"], limit: 100 },
      { table: "products", entity: "product", id_field: "id", return_fields: ["id", "handle"], limit: 100 },
      { table: "work_items", entity: "work_item", id_field: "id", return_fields: ["id", "source_id"], limit: 100 },
    ];

    for (const ent of ID_TRACE_ENTITIES) {
      try {
        const { data: rows } = await supabase.from(ent.table).select(ent.return_fields.join(", ")).order("created_at", { ascending: false }).limit(ent.limit);
        for (const row of rows || []) {
          const generated = row[ent.id_field] !== null && row[ent.id_field] !== undefined && row[ent.id_field] !== "";
          const persisted = generated; // if we fetched it from DB, it's persisted
          // returned = all return_fields have values (ID made it through the full chain)
          const missingReturns = ent.return_fields.filter(f => row[f] === null || row[f] === undefined || row[f] === "");
          const returned = missingReturns.length === 0;

          const id_trace = { generated, persisted, returned };

          if (!generated) {
            issues.push({
              type: "id_trace",
              severity: "critical",
              entity: ent.entity,
              entity_id: row[ent.id_field] || "unknown",
              title: `ID lost at: generated in "${ent.entity}"`,
              step: "create → ID generation",
              root_cause: `${ent.id_field} is null/empty`,
              component: ent.table,
              id_trace,
            });
          } else if (!returned) {
            // ID exists but downstream fields are missing
            const lostAt = missingReturns.join(", ");
            issues.push({
              type: "id_trace",
              severity: "high",
              entity: ent.entity,
              entity_id: (row[ent.id_field] || "").toString().slice(0, 8),
              title: `ID lost at: returned in "${ent.entity}" (missing: ${lostAt})`,
              step: "database → UI return",
              root_cause: `Fields [${lostAt}] null/empty despite ID present`,
              component: ent.table,
              id_trace,
            });
          }
        }
      } catch (_) {}
    }

    // 9. Frontend vs Backend data mismatch: check fields frontend expects but backend may not have
    const FRONTEND_EXPECTS: { table: string; entity: string; fields: { name: string; label: string }[]; limit: number }[] = [
      { table: "orders", entity: "order", fields: [
        { name: "id", label: "order.id" },
        { name: "user_id", label: "order.user_id" },
        { name: "total_amount", label: "order.total" },
        { name: "status", label: "order.status" },
        { name: "payment_status", label: "order.payment_status" },
        { name: "order_email", label: "order.email" },
        { name: "items", label: "order.items" },
        { name: "shipping_address", label: "order.shipping_address" },
        { name: "payment_intent_id", label: "order.payment_intent_id" },
      ], limit: 100 },
      { table: "profiles", entity: "user", fields: [
        { name: "user_id", label: "user.user_id" },
        { name: "username", label: "user.username" },
        { name: "is_member", label: "user.is_member" },
        { name: "level", label: "user.level" },
        { name: "xp", label: "user.xp" },
      ], limit: 100 },
      { table: "products", entity: "product", fields: [
        { name: "id", label: "product.id" },
        { name: "title_sv", label: "product.title" },
        { name: "price", label: "product.price" },
        { name: "status", label: "product.status" },
        { name: "handle", label: "product.handle" },
        { name: "image_url", label: "product.image_url" },
      ], limit: 100 },
      { table: "work_items", entity: "work_item", fields: [
        { name: "id", label: "work_item.id" },
        { name: "title", label: "work_item.title" },
        { name: "status", label: "work_item.status" },
        { name: "priority", label: "work_item.priority" },
        { name: "item_type", label: "work_item.item_type" },
      ], limit: 50 },
    ];

    for (const fe of FRONTEND_EXPECTS) {
      try {
        const selectFields = fe.fields.map(f => f.name).join(", ");
        const { data: rows } = await supabase.from(fe.table).select(selectFields).order("created_at", { ascending: false }).limit(fe.limit);
        for (const row of rows || []) {
          for (const field of fe.fields) {
            const val = row[field.name];
            if (val === null || val === undefined) {
              issues.push({
                type: "data_mismatch",
                severity: ["user_id", "id", "total_amount", "price", "status"].includes(field.name) ? "critical" : "high",
                entity: fe.entity,
                entity_id: (row.id || row.user_id || "unknown").toString().slice(0, 8),
                title: `Data mismatch: frontend vs backend — ${field.label} expected → ${val === null ? "null" : "undefined"}`,
                step: "backend → frontend",
                root_cause: `Frontend expects ${field.label} but backend returns ${val === null ? "null" : "undefined"}`,
                component: fe.table,
                _issue_type: "bug",
                _impact_score: 4,
                _impact_label: ["user_id", "id", "total_amount", "price"].includes(field.name) ? "critical" : "high",
              });
            }
          }
        }
      } catch (_) {}
    }

    // 10. Empty table detection: tables system expects to have data
    const EXPECTED_DATA_TABLES = [
      { table: "profiles", label: "users", severity: "critical" as const },
      { table: "orders", label: "orders", severity: "high" as const },
      { table: "products", label: "products", severity: "critical" as const },
      { table: "categories", label: "categories", severity: "high" as const },
      { table: "user_roles", label: "user_roles", severity: "critical" as const },
      { table: "work_items", label: "work_items", severity: "medium" as const },
      { table: "legal_documents", label: "legal_documents", severity: "high" as const },
      { table: "email_templates", label: "email_templates", severity: "medium" as const },
      { table: "store_settings", label: "store_settings", severity: "high" as const },
      { table: "role_module_permissions", label: "role_permissions", severity: "critical" as const },
    ];

    for (const et of EXPECTED_DATA_TABLES) {
      try {
        const { count } = await supabase.from(et.table).select("id", { count: "exact", head: true });
        if (count === 0 || count === null) {
          issues.push({
            type: "empty_table",
            severity: et.severity,
            entity: et.label,
            entity_id: et.table,
            title: `No data found where expected: ${et.label} = 0`,
            step: "database → pipeline",
            root_cause: "Table empty — broken pipeline or failed creation",
            component: et.table,
            _issue_type: "bug",
            _impact_score: et.severity === "critical" ? 5 : 4,
            _impact_label: et.severity,
          });
        }
      } catch (_) {}
    }

    // ── REQUEST FAILED BEFORE PERSISTENCE CHECK ──
    try {
      const traceCutoff = new Date(Date.now() - 300_000).toISOString(); // last 5 min
      const { data: recentTraces } = await supabase
        .from("runtime_traces")
        .select("id, function_name, endpoint, error_message, payload_snapshot, request_trace_id, created_at")
        .gte("created_at", traceCutoff)
        .order("created_at", { ascending: false })
        .limit(50);

      for (const trace of recentTraces || []) {
        // Has a request_trace_id (came from frontend) but errored (has error_message)
        if (!trace.request_trace_id) continue;
        const snap = trace.payload_snapshot || {};
        const hasSavedToDb = snap.saved_to_db === true;
        const hasSuccess = snap.success === true;
        if (!hasSavedToDb && !hasSuccess && trace.error_message) {
          issues.push({
            type: "request_failed_before_persistence",
            severity: "critical" as const,
            title: `Request failed before persistence: ${trace.function_name} ${trace.endpoint || ""}`.trim(),
            entity: trace.function_name,
            step: "request → backend",
            root_cause: trace.error_message,
            component: trace.function_name,
            _issue_type: "bug",
            _impact_score: 5,
            runtime_trace_id: trace.id,
            request_trace_id: trace.request_trace_id,
          });
        }
      }
    } catch (_) {}

  } catch (e: any) {
    console.error("Data integrity scan error:", e);
    issues.push({ type: "scan_error", severity: "critical", entity: "integrity_scan", title: `Integrity scan fel: ${e.message}`, step: "scan", root_cause: e.message, component: "integrity_scan" });
  }

  const durationMs = Date.now() - startMs;
  const normalizedIssues = issues.map(i => normalizeIssue(i));
  const rulesApplied = DATA_INTEGRITY_RULES;
  const emptyReason = normalizedIssues.length === 0 ? "no_detection" : undefined;
  await supabase.from("system_observability_log").insert({
    event_type: "scan_step", severity: normalizedIssues.filter(i => i.severity === "critical").length > 0 ? "warning" : "info",
    source: "scanner", message: `Data integrity scan: ${normalizedIssues.length} problem`,
    details: { total_issues: normalizedIssues.length, input_size: rulesApplied.length, rules_applied: rulesApplied, by_type: { data_loss: normalizedIssues.filter(i => i.type === "data_loss").length, failed_insert: normalizedIssues.filter(i => i.type === "failed_insert").length, stale_state: normalizedIssues.filter(i => i.type === "stale_state").length, incorrect_filtering: normalizedIssues.filter(i => i.type === "incorrect_filtering").length, data_validation: normalizedIssues.filter(i => i.type === "data_validation").length, id_trace: normalizedIssues.filter(i => i.type === "id_trace").length, data_mismatch: normalizedIssues.filter(i => i.type === "data_mismatch").length, empty_table: normalizedIssues.filter(i => i.type === "empty_table").length, request_failed_before_persistence: normalizedIssues.filter(i => i.type === "request_failed_before_persistence").length } },
    scan_id: scanRunId, trace_id: traceId, component: "data_integrity_scan", duration_ms: durationMs,
  }).catch(() => {});

  return {
    issues: normalizedIssues, issues_found: normalizedIssues.length, total_issues: normalizedIssues.length,
    by_type: { data_loss: normalizedIssues.filter(i => i.type === "data_loss").length, failed_insert: normalizedIssues.filter(i => i.type === "failed_insert").length, stale_state: normalizedIssues.filter(i => i.type === "stale_state").length, incorrect_filtering: normalizedIssues.filter(i => i.type === "incorrect_filtering").length, data_validation: normalizedIssues.filter(i => i.type === "data_validation").length, id_trace: normalizedIssues.filter(i => i.type === "id_trace").length, data_mismatch: normalizedIssues.filter(i => i.type === "data_mismatch").length, empty_table: normalizedIssues.filter(i => i.type === "empty_table").length, request_failed_before_persistence: normalizedIssues.filter(i => i.type === "request_failed_before_persistence").length },
    input_size: rulesApplied.length, rules_applied: rulesApplied,
    ...(emptyReason ? { _empty_reason: emptyReason } : {}),
    duration_ms: durationMs, scanned_at: new Date().toISOString(),
  };
}

// ── FUNCTIONAL BEHAVIOR SCAN ──
async function runFunctionalBehaviorScan(supabase: any, scanRunId: string): Promise<any> {
  const failures: any[] = [];
  const startMs = Date.now();
  const traceId = `behavior-${scanRunId.slice(0, 8)}`;

  try {
    // ACTION CHAIN 1: Create work item → verify
    const probeTitle = `__behavior_probe_${Date.now()}`;
    const { data: probeInsert, error: insertErr } = await supabase.from("work_items").insert({ title: probeTitle, status: "cancelled", priority: "low", item_type: "general", source_type: "behavior_scan", description: "Temporary probe — auto-deleted" }).select("id, title, status").single();

    if (insertErr || !probeInsert) {
      failures.push({ chain: "create_work_item", action: "INSERT work_item", expected: "Row created", actual: insertErr ? `Error: ${insertErr.message}` : "No data returned", failure_type: "action_failed", step: "action → backend → database", severity: "critical" });
    } else {
      const { data: fetched } = await supabase.from("work_items").select("id, title").eq("id", probeInsert.id).maybeSingle();
      if (!fetched) {
        failures.push({ chain: "create_work_item", action: "VERIFY work_item", expected: `Row ${probeInsert.id} retrievable`, actual: "Row not found", failure_type: "lost_state", step: "database → fetch", severity: "critical", entity_id: probeInsert.id });
      } else if (fetched.title !== probeTitle) {
        failures.push({ chain: "create_work_item", action: "COMPARE title", expected: probeTitle, actual: fetched.title, failure_type: "silent_failure", step: "database → compare", severity: "high", entity_id: probeInsert.id });
      }
      await supabase.from("work_items").delete().eq("id", probeInsert.id);
    }

    // ACTION CHAIN 2: Bug → work_item trigger
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentBugs } = await supabase.from("bug_reports").select("id, description, created_at").gte("created_at", fiveMinAgo).order("created_at", { ascending: false }).limit(10);
    for (const bug of recentBugs || []) {
      const { data: linkedWi } = await supabase.from("work_items").select("id").eq("source_type", "bug_report").eq("source_id", bug.id).limit(1);
      if (!linkedWi?.length) {
        failures.push({ chain: "bug_to_work_item", action: "Bug trigger → create work_item", expected: `Work item for bug ${bug.id.slice(0, 8)}`, actual: "No work_item found", failure_type: "action_failed", step: "database trigger → work_items", severity: "high", entity_id: bug.id });
      }
    }

    // ACTION CHAIN 3: Incident → work_item
    const { data: recentIncidents } = await supabase.from("order_incidents").select("id, title, created_at").gte("created_at", fiveMinAgo).order("created_at", { ascending: false }).limit(10);
    for (const inc of recentIncidents || []) {
      const { data: linkedWi } = await supabase.from("work_items").select("id").eq("source_type", "order_incident").eq("source_id", inc.id).limit(1);
      if (!linkedWi?.length) {
        failures.push({ chain: "incident_to_work_item", action: "Incident trigger → create work_item", expected: `Work item for incident ${inc.id.slice(0, 8)}`, actual: "No work_item found", failure_type: "action_failed", step: "database trigger → work_items", severity: "high", entity_id: inc.id });
      }
    }

    // ACTION CHAIN 4: Status sync
    const { data: doneWiFromBugs } = await supabase.from("work_items").select("id, title, source_id").eq("status", "done").eq("source_type", "bug_report").not("source_id", "is", null).order("completed_at", { ascending: false }).limit(20);
    for (const wi of doneWiFromBugs || []) {
      const { data: bug } = await supabase.from("bug_reports").select("id, status").eq("id", wi.source_id).maybeSingle();
      if (bug && bug.status !== "resolved") {
        failures.push({ chain: "status_sync", action: "Work item done → bug resolved", expected: `Bug status = resolved`, actual: `Bug status = ${bug.status}`, failure_type: "partial_execution", step: "work_item → sync → bug_reports", severity: "high", entity_id: wi.id });
      }
    }

    // ACTION CHAIN 5: Dismiss → no reappear
    const { data: dismissals } = await supabase.from("scan_dismissals").select("issue_key, scan_type, dismissed_at").order("dismissed_at", { ascending: false }).limit(50);
    const { data: activeWorkItems } = await supabase.from("work_items").select("id, title, source_type").in("status", ["open", "claimed", "in_progress"]).eq("source_type", "scan").limit(200);
    for (const d of dismissals || []) {
      const reappeared = (activeWorkItems || []).find((wi: any) => wi.title?.includes(d.issue_key));
      if (reappeared) {
        failures.push({ chain: "dismiss_reappear", action: "Dismiss → should not reappear", expected: `"${d.issue_key}" stays dismissed`, actual: `Reappeared as ${reappeared.id.slice(0, 8)}`, failure_type: "silent_failure", step: "scan_dismissals → work_items", severity: "medium", entity_id: reappeared.id });
      }
    }

    // ACTION CHAIN 6: Order → lifecycle
    const { data: paidOrders } = await supabase.from("orders").select("id, status, payment_status, fulfillment_status").eq("payment_status", "paid").in("fulfillment_status", ["shipped", "delivered"]).is("deleted_at", null).limit(50);
    for (const order of paidOrders || []) {
      const { data: activeWi } = await supabase.from("work_items").select("id, title, item_type").eq("related_order_id", order.id).in("status", ["open", "claimed", "in_progress"]).in("item_type", ["pack_order", "packing", "shipping"]).limit(1);
      if (activeWi?.length) {
        failures.push({ chain: "order_lifecycle", action: "Order shipped → close tasks", expected: "No active packing tasks", actual: `Active: "${activeWi[0].title}"`, failure_type: "stale_state", step: "order status → work_items", severity: "medium", entity_id: activeWi[0].id });
      }
    }

    // ACTION CHAIN 7: Notification on incident
    const { data: recentNotifIncidents } = await supabase.from("order_incidents").select("id, title, created_at").gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString()).order("created_at", { ascending: false }).limit(10);
    for (const inc of recentNotifIncidents || []) {
      const { data: notifs } = await supabase.from("notifications").select("id").eq("related_id", inc.id).eq("related_type", "incident").limit(1);
      if (!notifs?.length) {
        failures.push({ chain: "incident_notification", action: "Incident → notification", expected: `Notification for ${inc.id.slice(0, 8)}`, actual: "No notification found", failure_type: "action_failed", step: "incident trigger → notifications", severity: "medium", entity_id: inc.id });
      }
    }

  } catch (e: any) {
    console.error("Functional behavior scan error:", e);
    failures.push({ chain: "scan_error", action: "Run behavior scan", expected: "Scan completes", actual: `Error: ${e.message}`, failure_type: "action_failed", step: "scan execution", severity: "critical" });
  }

  const durationMs = Date.now() - startMs;
  const byType = {
    action_failed: failures.filter(f => f.failure_type === "action_failed").length,
    partial_execution: failures.filter(f => f.failure_type === "partial_execution").length,
    silent_failure: failures.filter(f => f.failure_type === "silent_failure").length,
    lost_state: failures.filter(f => f.failure_type === "lost_state").length,
    stale_state: failures.filter(f => f.failure_type === "stale_state").length,
  };

  // Failure memory
  const retestResults: any[] = [];
  try {
    for (const f of failures) {
      const patternKey = `${(f.chain || "").toLowerCase()}::${(f.action || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}::${(f.step || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}`;
      const { data: existing } = await supabase.from("functional_failure_memory").select("id, occurrence_count").eq("pattern_key", patternKey).limit(1);
      if (existing?.length) {
        await supabase.from("functional_failure_memory").update({ occurrence_count: (existing[0].occurrence_count || 1) + 1, last_seen_at: new Date().toISOString(), fail_reason: f.actual?.slice(0, 500), is_resolved: false, resolved_at: null, last_scan_retest_at: new Date().toISOString(), last_retest_passed: false }).eq("id", existing[0].id);
      } else {
        await supabase.from("functional_failure_memory").insert({ action_type: f.chain || "unknown", component: f.chain || "behavior_scan", entity_type: f.chain || "system", failed_step: f.step || "unknown", fail_reason: f.actual?.slice(0, 500), pattern_key: patternKey, severity: f.severity || "medium", occurrence_count: 1, last_scan_retest_at: new Date().toISOString(), last_retest_passed: false });
      }
    }

    const { data: knownFailures } = await supabase.from("functional_failure_memory").select("id, pattern_key, action_type, failed_step, occurrence_count").eq("is_resolved", false).order("occurrence_count", { ascending: false }).limit(100);
    const failureKeys = new Set(failures.map(f => `${(f.chain || "").toLowerCase()}::${(f.action || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}::${(f.step || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}`));
    for (const kf of knownFailures || []) {
      if (!failureKeys.has(kf.pattern_key)) {
        await supabase.from("functional_failure_memory").update({ last_scan_retest_at: new Date().toISOString(), last_retest_passed: true, is_resolved: true, resolved_at: new Date().toISOString() }).eq("id", kf.id);
        retestResults.push({ pattern_key: kf.pattern_key, action_type: kf.action_type, result: "passed", was_occurrence_count: kf.occurrence_count });
      }
    }
  } catch (memErr: any) { console.warn("Failure memory error:", memErr.message); }

  const behaviorRules = BEHAVIOR_RULES;
  await supabase.from("system_observability_log").insert({
    event_type: "scan_step", severity: failures.filter(f => f.severity === "critical").length > 0 ? "warning" : "info",
    source: "scanner", message: `Functional behavior scan: ${failures.length} failures, ${retestResults.length} retests passed`,
    details: { total_failures: failures.length, by_type: byType, retests_passed: retestResults.length },
    scan_id: scanRunId, trace_id: traceId, component: "functional_behavior_scan", duration_ms: durationMs,
  }).catch(() => {});

  return { failures, total_failures: failures.length, by_type: byType, retests_passed: retestResults,
    issues: failures.map(f => normalizeIssue({ ...f, type: f.failure_type || "broken_flow", location: f.chain || f.component || "behavior", description: f.action || f.chain || "Behavior failure", expected_state: f.expected, actual_state: f.actual })),
    issues_found: failures.length,
    input_size: behaviorRules.length,
    rules_applied: behaviorRules,
    ...(failures.length === 0 ? { _empty_reason: "no_detection" } : {}),
    duration_ms: durationMs, scanned_at: new Date().toISOString() };
}

// ── REAL DB SCAN: Sync Scanner ──
async function runRealSyncScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();

  try {
    const { data: products } = await supabase.from("products").select("id, title_sv, price, status, image_urls, handle, category").limit(500);
    for (const p of products || []) {
      if (!p.title_sv || p.title_sv.trim() === "") issues.push({ title: `Produkt utan titel (id: ${p.id?.slice(0, 8)})`, severity: "high", field: "title_sv", component: "products" });
      if (p.price == null || p.price <= 0) issues.push({ title: `Produkt utan giltigt pris: "${p.title_sv}" (${p.price})`, severity: "high", field: "price", component: "products" });
      if (p.status === "active" && (!p.image_urls || p.image_urls.length === 0)) issues.push({ title: `Aktiv produkt utan bild: "${p.title_sv}"`, severity: "medium", field: "image_urls", component: "products" });
      if (p.status === "active" && !p.handle) issues.push({ title: `Aktiv produkt utan handle: "${p.title_sv}"`, severity: "high", field: "handle", component: "products" });
    }

    // Orders: status consistency
    const { data: orders } = await supabase.from("orders").select("id, status, payment_status, fulfillment_status, shipped_at, delivered_at, packed_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
    for (const o of orders || []) {
      if (o.fulfillment_status === "shipped" && !o.shipped_at) issues.push({ title: `Order ${o.id.slice(0, 8)} status=shipped utan shipped_at`, severity: "high", field: "shipped_at", component: "orders" });
      if (o.fulfillment_status === "delivered" && !o.delivered_at) issues.push({ title: `Order ${o.id.slice(0, 8)} status=delivered utan delivered_at`, severity: "high", field: "delivered_at", component: "orders" });
      if (o.payment_status === "paid" && o.status === "cancelled") issues.push({ title: `Order ${o.id.slice(0, 8)} betalad men avbruten`, severity: "critical", field: "status", component: "orders" });
    }

    // Affiliates
    const { data: affiliates } = await supabase.from("affiliates").select("id, name, code, is_active, email").eq("is_active", true).limit(100);
    for (const a of affiliates || []) {
      if (!a.code || a.code.trim() === "") issues.push({ title: `Aktiv affiliate utan kod: "${a.name}"`, severity: "high", field: "code", component: "affiliates" });
    }

    // Duplicate codes
    const { data: allCodes } = await supabase.from("affiliates").select("code").eq("is_active", true);
    const { data: influencerCodes } = await supabase.from("influencers").select("code").eq("is_active", true);
    const codeMap = new Map<string, number>();
    for (const a of [...(allCodes || []), ...(influencerCodes || [])]) {
      const c = (a.code || "").toLowerCase();
      if (c) codeMap.set(c, (codeMap.get(c) || 0) + 1);
    }
    for (const [code, count] of codeMap) {
      if (count > 1) issues.push({ title: `Duplikat rabattkod: "${code}" (${count} st)`, severity: "critical", field: "code", component: "affiliates" });
    }

  } catch (e: any) { issues.push({ title: `Sync scan error: ${e.message}`, severity: "critical", component: "sync_scan" }); }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 5);
  const syncRules = SYNC_RULES;
  const normalizedSyncIssues = issues.map(i => normalizeIssue({ ...i, type: i.type || (i.field ? "missing_data" : "mismatch"), expected_state: `${i.field || "field"} present and valid`, actual_state: i.title }, { location: i.component || "sync" }));
  return { issues: normalizedSyncIssues, mismatches: normalizedSyncIssues, total_issues: normalizedSyncIssues.length, sync_score: score, overall_score: score, issues_found: normalizedSyncIssues.length, input_size: syncRules.length, rules_applied: syncRules, ...(normalizedSyncIssues.length === 0 ? { _empty_reason: "no_detection" } : {}), duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── REAL DB SCAN: System scan ──
async function runRealSystemScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const metrics: Record<string, number> = {};
  const startMs = Date.now();

  try {
    const tables = [
      { table: "orders", filter: { deleted_at: null }, key: "total_orders" },
      { table: "products", filter: {}, key: "total_products" },
      { table: "bug_reports", filter: { status: "open" }, key: "open_bugs" },
      { table: "work_items", filter: {}, key: "total_work_items" },
      { table: "affiliates", filter: { is_active: true }, key: "active_affiliates" },
      { table: "reviews", filter: {}, key: "total_reviews" },
      { table: "notifications", filter: { read: false }, key: "unread_notifications" },
    ];

    for (const t of tables) {
      let query = supabase.from(t.table).select("*", { count: "exact", head: true });
      for (const [k, v] of Object.entries(t.filter)) {
        if (v === null) query = query.is(k, null);
        else query = query.eq(k, v);
      }
      const { count } = await query;
      metrics[t.key] = count || 0;
    }

    for (const status of ["open", "claimed", "in_progress", "escalated", "done"]) {
      const { count } = await supabase.from("work_items").select("*", { count: "exact", head: true }).eq("status", status);
      metrics[`work_items_${status}`] = count || 0;
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentOrders } = await supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", oneDayAgo).is("deleted_at", null);
    metrics.orders_last_24h = recentOrders || 0;

    const { count: recentErrors } = await supabase.from("activity_logs").select("*", { count: "exact", head: true }).eq("log_type", "error").gte("created_at", oneDayAgo);
    metrics.errors_last_24h = recentErrors || 0;

    // Only flag these in production or when thresholds are genuinely concerning
    if (metrics.open_bugs > 20) issues.push({ title: `${metrics.open_bugs} öppna buggar`, severity: "high", component: "bug_reports" });
    if (metrics.work_items_escalated > 5) issues.push({ title: `${metrics.work_items_escalated} eskalerade ärenden`, severity: "critical", component: "work_items" });
    if (metrics.errors_last_24h > 50) issues.push({ title: `${metrics.errors_last_24h} fel senaste 24h`, severity: "high", component: "activity_logs" });
    if (metrics.unread_notifications > 100) issues.push({ title: `${metrics.unread_notifications} olästa notiser`, severity: "medium", component: "notifications" });

    // Stale escalated items
    const { data: staleEscalated } = await supabase.from("work_items").select("id, title, updated_at").eq("status", "escalated").lt("updated_at", oneDayAgo).limit(20);
    for (const wi of staleEscalated || []) {
      issues.push({ title: `Eskalerat ärende >24h: "${wi.title}"`, severity: "high", component: "work_items", entity_id: wi.id });
    }

    // Score trend
    const { data: recentScans } = await supabase.from("ai_scan_results").select("overall_score, created_at, scan_type").eq("scan_type", "full_orchestrated").order("created_at", { ascending: false }).limit(3);
    if (recentScans?.length >= 2) {
      const current = recentScans[0].overall_score || 0;
      const previous = recentScans[1].overall_score || 0;
      if (current < previous - 10) issues.push({ title: `Systempoäng sjunkit: ${previous} → ${current}`, severity: "high", component: "system_health" });
      metrics.previous_score = previous;
      metrics.score_delta = current - previous;
    }

  } catch (e: any) { issues.push({ title: `System scan error: ${e.message}`, severity: "critical", component: "system_scan" }); }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 8);
  const systemRules = SYSTEM_RULES;
  const normalizedSystemIssues = issues.map(i => normalizeIssue({ ...i, type: i.type || "invalid_state", expected_state: `threshold not exceeded`, actual_state: i.title }, { location: i.component || "system" }));
  return { issues: normalizedSystemIssues, issues_found: normalizedSystemIssues.length, metrics, system_score: score, overall_score: score, input_size: Object.keys(metrics).length, rules_applied: systemRules, ...(normalizedSystemIssues.length === 0 ? { _empty_reason: "no_detection" } : {}), duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── REAL DB SCAN: Feature Detection ──
async function runRealFeatureDetection(supabase: any, scanRunId: string): Promise<any> {
  const features: any[] = [];
  const startMs = Date.now();

  const featureTests = [
    { name: "Produkter", table: "products", query: "id, title_sv, status" },
    { name: "Ordrar", table: "orders", query: "id, status, created_at" },
    { name: "Kategorier", table: "categories", query: "id, name_sv, slug" },
    { name: "Recensioner", table: "reviews", query: "id, rating, product_id" },
    { name: "Affiliates", table: "affiliates", query: "id, name, code" },
    { name: "Influencers", table: "influencers", query: "id, name, code" },
    { name: "Bugrapporter", table: "bug_reports", query: "id, description, status" },
    { name: "Work Items", table: "work_items", query: "id, title, status" },
    { name: "Donationer", table: "donations", query: "id, amount, source" },
    { name: "E-postmallar", table: "email_templates", query: "id, template_type, is_active" },
    { name: "Bundles", table: "bundles", query: "id, name, is_active" },
    { name: "Aktivitetsloggar", table: "activity_logs", query: "id, log_type, message" },
    { name: "Notiser", table: "notifications", query: "id, type, read" },
  ];

  for (const ft of featureTests) {
    try {
      const { error, count } = await supabase.from(ft.table).select(ft.query, { count: "exact" }).limit(1);
      if (error) features.push({ name: ft.name, status: "broken", classification: "broken", reason: error.message, component: ft.table });
      else features.push({ name: ft.name, status: "working", classification: "real", row_count: count || 0, component: ft.table });
    } catch (e: any) { features.push({ name: ft.name, status: "error", classification: "broken", reason: e.message, component: ft.table }); }
  }

  // Test write
  try {
    const probeId = `__feature_probe_${Date.now()}`;
    const { data: inserted, error: insertErr } = await supabase.from("activity_logs").insert({ message: probeId, log_type: "probe", category: "feature_detection" }).select("id").single();
    if (insertErr) { features.push({ name: "Skrivåtkomst", status: "broken", classification: "broken", reason: insertErr.message }); }
    else {
      const { data: fetched } = await supabase.from("activity_logs").select("id").eq("id", inserted.id).maybeSingle();
      features.push({ name: "Skrivåtkomst", status: fetched ? "working" : "broken", classification: fetched ? "real" : "broken" });
      if (fetched) await supabase.from("activity_logs").delete().eq("id", inserted.id);
    }
  } catch (e: any) { features.push({ name: "Skrivåtkomst", status: "error", classification: "broken", reason: e.message }); }

  const durationMs = Date.now() - startMs;
  const working = features.filter(f => f.status === "working").length;
  const broken = features.filter(f => f.status !== "working").length;
  const score = Math.round((working / Math.max(1, features.length)) * 100);
  const featureRules = FEATURE_RULES;
  const brokenFeatureIssues = features
    .filter(f => f.status !== "working")
    .map(f => normalizeIssue({ type: "invalid_state", severity: "high", location: f.component || f.name, description: `Feature "${f.name}" is ${f.status}: ${f.reason || "query failed"}`, expected_state: "working", actual_state: f.status, component: f.component || f.name, title: `Feature not working: "${f.name}"` }));
  return { features, working_count: working, broken_count: broken, total_features: features.length, overall_score: score, score, issues_found: broken, issues: brokenFeatureIssues, input_size: features.length, rules_applied: featureRules, ...(brokenFeatureIssues.length === 0 ? { _empty_reason: "no_detection" } : {}), duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── REAL DB SCAN: Interaction QA ──
async function runRealInteractionQA(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();

  try {
    // Bundles referencing non-existent products
    const { data: bundleItems } = await supabase.from("bundle_items").select("id, bundle_id, shopify_product_id").limit(200);
    const { data: bundles } = await supabase.from("bundles").select("id, name, is_active").eq("is_active", true).limit(50);
    const activeBundleIds = new Set((bundles || []).map((b: any) => b.id));
    for (const bi of bundleItems || []) {
      if (!activeBundleIds.has(bi.bundle_id)) {
        const { data: b } = await supabase.from("bundles").select("id").eq("id", bi.bundle_id).maybeSingle();
        if (!b) issues.push({ title: `Bundle item → borttaget bundle ${bi.bundle_id.slice(0, 8)}`, severity: "high", component: "bundles", element: "bundle_items" });
      }
    }

    // Orphan notifications
    const { data: recentNotifs } = await supabase.from("notifications").select("id, user_id, type, created_at").order("created_at", { ascending: false }).limit(50);
    const userIds = new Set((recentNotifs || []).map((n: any) => n.user_id).filter(Boolean));
    if (userIds.size > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id").in("user_id", [...userIds]);
      const existingUserIds = new Set((profiles || []).map((p: any) => p.user_id));
      for (const n of recentNotifs || []) {
        if (n.user_id && !existingUserIds.has(n.user_id)) issues.push({ title: `Notis för borttagen användare`, severity: "medium", component: "notifications", entity_id: n.id });
      }
    }

    // Incidents without valid orders
    const { data: incidents } = await supabase.from("order_incidents").select("id, title, order_id, status").in("status", ["open", "investigating", "in_progress"]).limit(50);
    for (const inc of incidents || []) {
      const { data: order } = await supabase.from("orders").select("id").eq("id", inc.order_id).maybeSingle();
      if (!order) issues.push({ title: `Ärende "${inc.title}" → order finns ej`, severity: "high", component: "order_incidents", entity_id: inc.id });
    }

    // Active automation rules with empty config
    const { data: rules } = await supabase.from("automation_rules").select("id, rule_key, config, is_active").eq("is_active", true).limit(50);
    for (const r of rules || []) {
      if (!r.config || (typeof r.config === "object" && Object.keys(r.config).length === 0)) issues.push({ title: `Automationsregel utan config: "${r.rule_key}"`, severity: "medium", component: "automation_rules", entity_id: r.id });
    }

    // Email templates missing fields
    const { data: templates } = await supabase.from("email_templates").select("*").eq("is_active", true).limit(20);
    for (const t of templates || []) {
      if (!t.subject_sv || !t.intro_sv) issues.push({ title: `E-postmall "${t.template_type}" saknar ämne/intro`, severity: "high", component: "email_templates", entity_id: t.id });
    }

    // Buttons without action: active bundles with no items (dead CTA)
    for (const b of bundles || []) {
      const { count } = await supabase.from("bundle_items").select("id", { count: "exact", head: true }).eq("bundle_id", b.id);
      if (!count || count === 0) {
        issues.push({ title: `Broken interaction: button without action — bundle "${b.name}" CTA leads nowhere`, severity: "critical", component: "bundles", element: "BundleCTA", category: "interaction", _issue_type: "bug", _impact_score: 5, _impact_label: "critical" });
      }
    }

    // Links without route: products visible but no handle (unnavigable)
    const { data: noHandleProducts } = await supabase.from("products").select("id, title_sv, handle").eq("is_visible", true).is("handle", null).limit(50);
    for (const p of noHandleProducts || []) {
      issues.push({ title: `Broken interaction: link without route — product "${p.title_sv || p.id.slice(0,8)}" has no URL`, severity: "critical", component: "ProductCard", element: "ProductLink", category: "interaction", _issue_type: "bug", _impact_score: 5, _impact_label: "critical" });
    }

    // Forms without submit: affiliate applications with required fields missing config
    const { data: affiliateApps } = await supabase.from("affiliate_applications").select("id, name, email, status").eq("status", "pending").limit(50);
    for (const app of affiliateApps || []) {
      if (!app.email || !app.name) {
        issues.push({ title: `Broken interaction: form without submit — affiliate application missing required fields`, severity: "critical", component: "AffiliateForm", element: "SubmitButton", category: "interaction", _issue_type: "bug", _impact_score: 5, _impact_label: "critical" });
      }
    }

    // Email templates without CTA (form/button without action)
    for (const t of templates || []) {
      if (!t.cta_text_sv || t.cta_text_sv.trim() === "") {
        issues.push({ title: `Broken interaction: button without action — email "${t.template_type}" has no CTA text`, severity: "high", component: "email_templates", element: "EmailCTA", category: "interaction", _issue_type: "bug", _impact_score: 5, _impact_label: "critical" });
      }
    }

  } catch (e: any) { issues.push({ title: `Interaction QA error: ${e.message}`, severity: "critical", component: "interaction_qa" }); }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 6);
  const interactionRules = INTERACTION_RULES;
  const normalizedInteractionIssues = issues.map(i => normalizeIssue({ ...i, type: i.type || i._issue_type || "broken_flow", expected_state: `interaction element valid and linked`, actual_state: i.title }, { location: i.component || "interaction" }));
  return { issues: normalizedInteractionIssues, issues_found: normalizedInteractionIssues.length, dead_elements: normalizedInteractionIssues, interaction_score: score, overall_score: score, input_size: interactionRules.length, rules_applied: interactionRules, ...(normalizedInteractionIssues.length === 0 ? { _empty_reason: "no_detection" } : {}), duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── REAL DB SCAN: Component Map (UI Visual) ──
async function runRealComponentMapScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();
  let componentsScanned = 0;

  try {
    // 1. Missing visible label: page_sections without title
    const { data: sections } = await supabase.from("page_sections").select("id, section_key, page, title_sv, title_en, is_visible").eq("is_visible", true).limit(200);
    componentsScanned += (sections || []).length;
    for (const s of sections || []) {
      if (!s.title_sv && !s.title_en) {
        issues.push({ title: `Missing visible label: section "${s.section_key}" on ${s.page}`, severity: "medium", component: s.section_key, element: "page_sections", category: "ui_visual", page: s.page, entity_id: s.id });
      }
    }

    // 2. Products missing title/description (label check)
    const { data: products } = await supabase.from("products").select("id, title_sv, title_en, description_sv, description_en, is_visible, image_urls, handle").eq("is_visible", true).limit(200);
    componentsScanned += (products || []).length;
    for (const p of products || []) {
      if (!p.title_sv && !p.title_en) {
        issues.push({ title: `Missing visible label: product "${p.handle || p.id.slice(0,8)}"`, severity: "high", component: "products", element: "ProductCard", category: "ui_visual", entity_id: p.id });
      }
      if (!p.description_sv && !p.description_en) {
        issues.push({ title: `Missing visible label: product description "${p.handle || p.id.slice(0,8)}"`, severity: "medium", component: "products", element: "ProductDetail", category: "ui_visual", entity_id: p.id });
      }
    }

    // 3. Categories missing label
    const { data: categories } = await supabase.from("categories").select("id, name_sv, name_en, slug, is_visible").eq("is_visible", true).limit(100);
    componentsScanned += (categories || []).length;
    for (const c of categories || []) {
      if (!c.name_sv && !c.name_en) {
        issues.push({ title: `Missing visible label: category "${c.slug}"`, severity: "high", component: "categories", element: "CategoryFilter", category: "ui_visual", entity_id: c.id });
      }
    }

    // 4. Dead interaction: bundles active but no items (clickable but no handler)
    const { data: activeBundles } = await supabase.from("bundles").select("id, name, is_active").eq("is_active", true).limit(50);
    componentsScanned += (activeBundles || []).length;
    for (const b of activeBundles || []) {
      const { count } = await supabase.from("bundle_items").select("id", { count: "exact", head: true }).eq("bundle_id", b.id);
      if (!count || count === 0) {
        issues.push({ title: `Dead interaction: bundle "${b.name}" active but empty`, severity: "high", component: "bundles", element: "ProductBundles", category: "ui_visual", entity_id: b.id });
      }
    }

    // 5. Inconsistent UI: products with mixed image counts (some have images, some don't)
    if (products && products.length > 0) {
      const withImages = products.filter((p: any) => p.image_urls && p.image_urls.length > 0).length;
      const withoutImages = products.filter((p: any) => !p.image_urls || p.image_urls.length === 0).length;
      if (withImages > 0 && withoutImages > 0) {
        issues.push({ title: `Inconsistent UI: ${withoutImages} products without images vs ${withImages} with images`, severity: "medium", component: "products", element: "ProductGrid", category: "ui_visual" });
      }
    }

    // 6. Layout compression: sections with same display_order (stacked/overlapping)
    if (sections && sections.length > 1) {
      const orderMap: Record<string, any[]> = {};
      for (const s of sections) {
        const pageKey = s.page;
        if (!orderMap[pageKey]) orderMap[pageKey] = [];
        orderMap[pageKey].push(s);
      }
      for (const [page, pageSections] of Object.entries(orderMap)) {
        const orders = pageSections.map((s: any) => s.display_order);
        const duplicateOrders = orders.filter((o: number, i: number) => orders.indexOf(o) !== i);
        if (duplicateOrders.length > 0) {
          issues.push({ title: `Layout compression: ${duplicateOrders.length} sections share display_order on "${page}"`, severity: "medium", component: "page_sections", element: "PageLayout", category: "ui_visual", page });
        }
      }
    }

    // 7. Dead interaction: email templates active but missing CTA
    const { data: emailTemplates } = await supabase.from("email_templates").select("id, template_type, cta_text_sv, cta_text_en, is_active").eq("is_active", true).limit(20);
    componentsScanned += (emailTemplates || []).length;
    for (const t of emailTemplates || []) {
      if (!t.cta_text_sv && !t.cta_text_en) {
        issues.push({ title: `Dead interaction: email "${t.template_type}" has no CTA`, severity: "medium", component: "email_templates", element: "EmailTemplate", category: "ui_visual", entity_id: t.id });
      }
    }

    // 8. Inconsistent UI: product_tags with mixed colors (some have color, some don't)
    const { data: tags } = await supabase.from("product_tags").select("id, name_sv, color, tag_type").limit(100);
    componentsScanned += (tags || []).length;
    if (tags && tags.length > 1) {
      const withColor = tags.filter((t: any) => t.color).length;
      const withoutColor = tags.filter((t: any) => !t.color).length;
      if (withColor > 0 && withoutColor > 0) {
        issues.push({ title: `Inconsistent UI: ${withoutColor} tags without color vs ${withColor} with color`, severity: "low", component: "product_tags", element: "TagBadge", category: "ui_visual" });
      }
    }

  } catch (e: any) { issues.push({ title: `Component map scan error: ${e.message}`, severity: "critical", component: "component_map", category: "ui_visual" }); }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 5);
  const componentRules = COMPONENT_RULES;
  const normalizedComponentIssues = issues.map(i => normalizeIssue({ ...i, type: i.type || (i.category === "ui_visual" ? "missing_data" : "invalid_state"), expected_state: `UI component valid and fully configured`, actual_state: i.title }, { location: i.component || "ui" }));
  return { issues: normalizedComponentIssues, issues_found: normalizedComponentIssues.length, components_scanned: componentsScanned, overall_score: score, input_size: componentsScanned, rules_applied: componentRules, ...(normalizedComponentIssues.length === 0 ? { _empty_reason: "no_detection" } : {}), duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── REAL DB SCAN: UI Flow Integrity ──
async function runUiFlowIntegrityScan(supabase: any, scanRunId: string): Promise<any> {
  const issues: any[] = [];
  const startMs = Date.now();
  let flowsScanned = 0;

  // Known application routes
  const KNOWN_ROUTES = [
    "/", "/shop", "/produkter", "/about", "/contact", "/checkout",
    "/donations", "/cbd", "/business", "/whats-new", "/track-order",
    "/suggest-product", "/affiliate", "/balance", "/member",
    "/admin", "/privacy-policy", "/terms", "/returns-policy", "/shipping-policy",
  ];

  // Known flows: start → end
  const KNOWN_FLOWS = [
    { name: "Checkout", steps: ["product_view", "add_to_cart", "checkout", "payment", "confirmation"], startRoute: "/shop", endRoute: "/order-confirmation" },
    { name: "Login", steps: ["open_auth", "enter_credentials", "authenticated"], startRoute: "/", endRoute: "/" },
    { name: "Registration", steps: ["open_auth", "enter_details", "verify_email", "profile_created"], startRoute: "/", endRoute: "/member" },
    { name: "Track Order", steps: ["enter_email_order", "lookup", "display_status"], startRoute: "/track-order", endRoute: "/track-order" },
    { name: "Affiliate Signup", steps: ["landing", "apply", "confirmation"], startRoute: "/affiliate", endRoute: "/affiliate" },
    { name: "Donation", steps: ["select_amount", "checkout", "confirmation"], startRoute: "/donations", endRoute: "/donations" },
  ];

  try {
    // 1. Check routes have corresponding page_sections (content exists)
    const { data: sections } = await supabase.from("page_sections").select("page, section_key, is_visible").limit(500);
    const pagesWithContent = new Set((sections || []).map((s: any) => s.page));
    flowsScanned += KNOWN_ROUTES.length;

    for (const route of KNOWN_ROUTES) {
      const pageName = route === "/" ? "home" : route.replace(/^\//, "").replace(/-/g, "_");
      // Skip admin and policy routes (they don't use page_sections)
      if (route.startsWith("/admin") || route.includes("policy") || route.includes("terms")) continue;
      if (!pagesWithContent.has(pageName) && !pagesWithContent.has(route.replace(/^\//, ""))) {
        // Not necessarily broken, but flag if no content at all
      }
    }

    // 2. Check navigation paths: products should be navigable (have handles)
    const { data: products } = await supabase.from("products").select("id, handle, title_sv, is_visible").eq("is_visible", true).limit(200);
    flowsScanned += (products || []).length;
    for (const p of products || []) {
      if (!p.handle) {
        issues.push({ title: `Broken flow: product "${p.title_sv || p.id.slice(0,8)}" has no URL handle`, severity: "high", component: "products", element: "ProductDetail", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection" });
      }
    }

    // 3. Check categories have valid slugs (navigation targets)
    const { data: categories } = await supabase.from("categories").select("id, name_sv, slug, is_visible").eq("is_visible", true).limit(100);
    flowsScanned += (categories || []).length;
    for (const c of categories || []) {
      if (!c.slug || c.slug.trim() === "") {
        issues.push({ title: `Broken flow: category "${c.name_sv || c.id.slice(0,8)}" has no slug`, severity: "high", component: "categories", element: "CategoryFilter", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection" });
      }
    }

    // 4. Check flows have start → end: verify analytics events exist for flow steps
    const { data: recentEvents } = await supabase.from("analytics_events").select("event_type").order("created_at", { ascending: false }).limit(500);
    const eventTypes = new Set((recentEvents || []).map((e: any) => e.event_type));
    flowsScanned += KNOWN_FLOWS.length;

    for (const flow of KNOWN_FLOWS) {
      const missingSteps = flow.steps.filter(step => {
        // Check if any event matches this step pattern
        const patterns = [step, `${step}_start`, `${step}_complete`, flow.name.toLowerCase() + "_" + step];
        return !patterns.some(p => eventTypes.has(p));
      });

      if (missingSteps.length === flow.steps.length) {
        issues.push({ title: `Broken flow: "${flow.name}" has no tracked events (${flow.steps.length} steps missing)`, severity: "medium", component: flow.name, element: "FlowTracking", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection", route: flow.startRoute });
      } else if (missingSteps.length > 0 && missingSteps.length < flow.steps.length) {
        issues.push({ title: `Broken flow: "${flow.name}" incomplete tracking (${missingSteps.length}/${flow.steps.length} steps missing)`, severity: "low", component: flow.name, element: "FlowTracking", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection", route: flow.startRoute });
      }
    }

    // 5. Buttons point somewhere: bundles/promotions with no linked products
    const { data: activeBundles } = await supabase.from("bundles").select("id, name, is_active").eq("is_active", true).limit(50);
    flowsScanned += (activeBundles || []).length;
    for (const b of activeBundles || []) {
      const { count } = await supabase.from("bundle_items").select("id", { count: "exact", head: true }).eq("bundle_id", b.id);
      if (!count || count === 0) {
        issues.push({ title: `Broken flow: bundle "${b.name}" has no products (dead CTA)`, severity: "high", component: "bundles", element: "ProductBundles", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection" });
      }
    }

    // 6. Legal documents should be accessible (active)
    const { data: legalDocs } = await supabase.from("legal_documents").select("id, document_type, is_active, title_sv").limit(20);
    flowsScanned += (legalDocs || []).length;
    const requiredTypes = ["privacy_policy", "terms_conditions", "return_policy"];
    for (const reqType of requiredTypes) {
      const found = (legalDocs || []).find((d: any) => d.document_type === reqType && d.is_active);
      if (!found) {
        issues.push({ title: `Broken flow: required legal document "${reqType}" missing or inactive`, severity: "high", component: "legal_documents", element: "LegalPage", category: "flow_ui", _issue_type: "bug", _suggested_fix: "Fix broken logic or missing connection" });
      }
    }

    // 7. Flow chain analysis: check each known flow for complete chain coverage
    const productHandles = new Set((products || []).filter((p: any) => p.handle).map((p: any) => p.handle));
    const categorySlugs = new Set((categories || []).filter((c: any) => c.slug).map((c: any) => c.slug));
    const hasDbWrites = eventTypes.has("checkout_complete") || eventTypes.has("payment") || eventTypes.has("confirmation");

    for (const flow of KNOWN_FLOWS) {
      const chain = {
        has_ui: KNOWN_ROUTES.includes(flow.startRoute) || KNOWN_ROUTES.includes(flow.endRoute),
        has_action: flow.steps.some(step => eventTypes.has(step) || eventTypes.has(`${step}_start`) || eventTypes.has(`${step}_complete`)),
        has_flow: flow.steps.length >= 2,
        has_data: eventTypes.has(flow.steps[0]) || eventTypes.has(`${flow.name.toLowerCase()}_${flow.steps[0]}`),
        has_db: flow.name === "Checkout" ? hasDbWrites : eventTypes.has(flow.steps[flow.steps.length - 1]),
      };

      // ── Data Trace: track data through each pipeline stage ──
      const flowKey = flow.name.toLowerCase();
      const input_detected = chain.has_ui || flow.steps.some(step => eventTypes.has(step) || eventTypes.has(`${step}_start`));
      const mapped = chain.has_action || flow.steps.some(step => eventTypes.has(`${step}_complete`) || eventTypes.has(`${flowKey}_${step}`));
      const transformed = flow.steps.length >= 2 && flow.steps.slice(1).some(step => eventTypes.has(step) || eventTypes.has(`${step}_start`) || eventTypes.has(`${step}_complete`));
      const saved_to_db = chain.has_db;

      const data_trace = { input_detected, mapped, transformed, saved_to_db };

      // Detect data loss point
      const traceSteps = [
        { key: "input_detected", ok: input_detected },
        { key: "mapped", ok: mapped },
        { key: "transformed", ok: transformed },
        { key: "saved_to_db", ok: saved_to_db },
      ];
      let prevOk: string | null = null;
      for (const ts of traceSteps) {
        if (ts.ok) {
          prevOk = ts.key;
        } else if (prevOk) {
          issues.push({
            title: `Data lost at: ${prevOk} → ${ts.key} in "${flow.name}"`,
            severity: ts.key === "saved_to_db" ? "critical" : "high",
            component: flow.name,
            element: "DataTrace",
            category: "flow_data",
            _issue_type: "bug",
            _suggested_fix: `Verify data pipeline from ${prevOk} to ${ts.key}`,
            route: flow.startRoute,
            data_trace,
          });
          break; // report first break only
        }
      }

      // Attach chain + data_trace to existing issues for this flow
      const flowIssues = issues.filter((i: any) => i.component === flow.name);
      for (const fi of flowIssues) {
        fi._flow_chain = chain;
        fi.data_trace = data_trace;
      }

      // Detect broken chain links
      const chainParts = [
        { key: "UI", ok: chain.has_ui },
        { key: "Action", ok: chain.has_action },
        { key: "Flow", ok: chain.has_flow },
        { key: "Data", ok: chain.has_data },
        { key: "DB", ok: chain.has_db },
      ];
      const brokenLinks = chainParts.filter(p => !p.ok);
      if (brokenLinks.length > 0 && brokenLinks.length < chainParts.length) {
        const from = chainParts.find(p => p.ok)?.key || "UI";
        const to = chainParts.find(p => !p.ok)?.key || "DATA";
        issues.push({
          title: `Broken chain: ${from} → ${to} in "${flow.name}" (missing: ${brokenLinks.map(b => b.key).join(", ")})`,
          severity: brokenLinks.length >= 3 ? "high" : "medium",
          component: flow.name,
          element: "FlowChain",
          category: "flow_ui",
          _issue_type: "bug",
          _suggested_fix: "Fix broken logic or missing connection",
          route: flow.startRoute,
          _flow_chain: chain,
          data_trace,
        });
      }
    }

    // 8. UI element functional checks: has_text, has_click_handler, visible_in_viewport
    const UI_COMPONENTS = [
      { name: "Header", table: "page_sections", filter: { page: "home", section_key: "header" }, requires: ["title_sv"] },
      { name: "Hero", table: "page_sections", filter: { page: "home", section_key: "hero" }, requires: ["title_sv", "content_sv"] },
      { name: "Footer", table: "page_sections", filter: { page: "home", section_key: "footer" }, requires: ["content_sv"] },
      { name: "Newsletter", table: "page_sections", filter: { page: "home", section_key: "newsletter" }, requires: ["title_sv"] },
      { name: "FAQ", table: "page_sections", filter: { page: "home", section_key: "faq" }, requires: ["title_sv"] },
      { name: "Contact", table: "page_sections", filter: { page: "home", section_key: "contact" }, requires: ["title_sv"] },
    ];

    for (const comp of UI_COMPONENTS) {
      try {
        let query = supabase.from(comp.table).select("*");
        for (const [k, v] of Object.entries(comp.filter)) {
          query = query.eq(k, v);
        }
        const { data: rows } = await query.limit(1).maybeSingle();
        flowsScanned++;

        // has_text: check required text fields exist
        const has_text = comp.requires.every(field => rows?.[field] && String(rows[field]).trim().length > 0);
        if (!has_text) {
          issues.push({
            title: `UI element not functional or visible: "${comp.name}" missing text content (${comp.requires.join(", ")})`,
            severity: "medium",
            component: comp.name,
            element: comp.name,
            category: "ui_state",
            _issue_type: "bug",
            _suggested_fix: `Add content to ${comp.requires.join(", ")} for ${comp.name}`,
          });
        }

        // visible_in_viewport: check is_visible flag
        if (rows && rows.is_visible === false) {
          issues.push({
            title: `UI element not functional or visible: "${comp.name}" is hidden (is_visible=false)`,
            severity: "medium",
            component: comp.name,
            element: comp.name,
            category: "ui_state",
            _issue_type: "bug",
            _suggested_fix: `Set is_visible=true for ${comp.name} if it should be shown`,
          });
        }

        // has_click_handler: for interactive sections, check if they exist at all
        if (!rows) {
          issues.push({
            title: `UI element not functional or visible: "${comp.name}" section not found in database`,
            severity: "high",
            component: comp.name,
            element: comp.name,
            category: "ui_state",
            _issue_type: "bug",
            _suggested_fix: `Create page_section entry for ${comp.name}`,
          });
        }
      } catch (_) { /* skip individual component check errors */ }
    }

    // 9. Check interactive elements: buttons/CTAs in active bundles and products
    const { data: visibleProducts } = await supabase.from("products").select("id, title_sv, is_visible, is_sellable, price").eq("is_visible", true).eq("is_sellable", true).limit(100);
    for (const prod of visibleProducts || []) {
      flowsScanned++;
      if (!prod.price || prod.price <= 0) {
        issues.push({
          title: `UI element not functional or visible: product "${prod.title_sv || prod.id.slice(0,8)}" has no valid price (click handler broken)`,
          severity: "high",
          component: "ProductCard",
          element: "AddToCartButton",
          category: "ui_state",
          _issue_type: "bug",
          _suggested_fix: "Set a valid price for this product",
        });
      }
      if (!prod.title_sv || prod.title_sv.trim() === "") {
        issues.push({
          title: `UI element not functional or visible: product missing title text`,
          severity: "medium",
          component: "ProductCard",
          element: "ProductTitle",
          category: "ui_state",
          _issue_type: "bug",
          _suggested_fix: "Add title_sv for this product",
        });
      }
    }

  } catch (e: any) { issues.push({ title: `UI Flow Integrity error: ${e.message}`, severity: "critical", component: "ui_flow_integrity", category: "flow_ui" }); }

  const durationMs = Date.now() - startMs;
  const score = Math.max(0, 100 - issues.length * 6);
  const flowRules = FLOW_RULES;
  const normalizedFlowIssues = issues.map(i => normalizeIssue({ ...i, type: i.type || i._issue_type || "broken_flow", expected_state: `flow path valid and reachable`, actual_state: i.title }, { location: i.component || i.element || "flow" }));
  return { issues: normalizedFlowIssues, issues_found: normalizedFlowIssues.length, flows_scanned: flowsScanned, overall_score: score, input_size: flowsScanned, rules_applied: flowRules, ...(normalizedFlowIssues.length === 0 ? { _empty_reason: "no_detection" } : {}), duration_ms: durationMs, scanned_at: new Date().toISOString(), real_db_scan: true };
}

// ── Map scan types to real DB functions ──
const REAL_DB_SCANNERS: Record<string, (supabase: any, scanRunId: string) => Promise<any>> = {
  data_integrity: runDataIntegrityScan,
  sync_scan: runRealSyncScan,
  system_scan: runRealSystemScan,
  feature_detection: runRealFeatureDetection,
  interaction_qa: runRealInteractionQA,
  component_map: runRealComponentMapScan,
  ui_flow_integrity: runUiFlowIntegrityScan,
};

// ── SCAN CONSISTENCY GUARD ──
// Compares current scan fingerprints against existing work_items from previous scans.
// - Reappearing issue (same fingerprint, active): update existing, do NOT create new
// - Severity changed: update priority on existing item, log change
// - Issue disappeared (active work_item fingerprint not in current scan): mark resolved

async function runConsistencyGuard(supabase: any, currentFingerprints: Map<string, { title: string; priority: string; item_type: string; description?: string }>) {
  // Fetch all active scan-sourced work_items with fingerprints
  const { data: activeItems } = await supabase
    .from("work_items")
    .select("id, title, status, priority, issue_fingerprint, created_at")
    .eq("source_type", "ai_scan")
    .not("issue_fingerprint", "is", null)
    .in("status", ["open", "claimed", "in_progress", "escalated", "new", "pending", "detected"])
    .limit(500);

  const existingByFp = new Map<string, any>();
  for (const item of activeItems || []) {
    if (item.issue_fingerprint) existingByFp.set(item.issue_fingerprint, item);
  }

  let resolved = 0;
  // Issues that disappeared: active work_item fingerprint not in current scan
  for (const [fp, item] of existingByFp) {
    if (!currentFingerprints.has(fp)) {
      await supabase.from("work_items").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", item.id);
      console.log(`[consistency-guard] RESOLVED (disappeared): ${item.id.slice(0, 8)} "${item.title.slice(0, 40)}"`);
      resolved++;
    }
  }
  if (resolved > 0) console.log(`[consistency-guard] Marked ${resolved} disappeared issues as resolved`);

  return existingByFp;
}

// ── Create work items with CONSISTENCY GUARD ──
// ── Issue type classifier ──
function classifyIssueType(issue: any, category: string): "bug" | "improvement" | "upgrade" {
  const text = `${issue.title || ""} ${issue.description || ""} ${issue.fix_suggestion || ""} ${issue.type || ""} ${issue.failure_type || ""}`.toLowerCase();
  // Bug: broken flow, missing data, crash, error, data_loss, action_failed
  const bugPatterns = /broken|crash|error|missing data|data.?loss|action.?failed|lost.?state|orphan|saknas|finns ej|failed|duplicate|stale/;
  // Improvement: UI spacing, unclear CTA, layout, inconsistency
  const improvementPatterns = /spacing|layout|overflow|z-index|position|responsive|mobile|unclear|cta|inconsisten|alignment|truncat|padding|margin|style|visual|css/;
  // Upgrade: feature missing but expected, outdated pattern, fake feature
  const upgradePatterns = /fake.?feature|not.?implemented|placeholder|outdated|deprecated|missing.?feature|expected|wip|coming.?soon|icke.?funktionell/;

  if (category === "fake_features") return "upgrade";
  if (upgradePatterns.test(text)) return "upgrade";
  if (improvementPatterns.test(text)) return "improvement";
  if (bugPatterns.test(text)) return "bug";
  return "bug";
}

async function createWorkItems(supabase: any, unified: any, stage: SystemStage): Promise<{ created: number; createTrace: any[] }> {

async function createWorkItems(supabase: any, unified: any): Promise<number> {
  let created = 0;

  const allIssues: any[] = [
    ...(groupSimilarIssues(unified.broken_flows       || []).slice(0, 15).map((i: any) => ({ ...i, _category: "broken_flows" }))),
    ...(groupSimilarIssues(unified.fake_features      || []).slice(0, 10).map((i: any) => ({ ...i, _category: "fake_features" }))),
    ...(groupSimilarIssues(unified.interaction_failures || []).slice(0, 15).map((i: any) => ({ ...i, _category: "interaction_failures" }))),
    ...(groupSimilarIssues(unified.data_issues        || []).slice(0, 20).map((i: any) => ({ ...i, _category: "data_issues" }))),
  ];

  const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;

  for (const issue of allIssues) {
    const fp    = generateFingerprint(issue);
    const title = (issue.title || issue.description || "Unknown issue").slice(0, 120).trim();
    if (!title) continue;

    // Dedup: skip if an active item with the same fingerprint was created within 24 h
    const { data: existing } = await supabase
      .from("work_items")
      .select("id, created_at")
      .eq("issue_fingerprint", fp)
      .in("status", ["open", "claimed", "in_progress", "escalated", "new", "pending", "detected"])
      .limit(1);

    if (existing?.length) {
      const age = Date.now() - new Date(existing[0].created_at).getTime();
      if (age <= TWENTY_FOUR_H) {
        await supabase.from("work_items").update({ last_seen_at: new Date().toISOString() }).eq("id", existing[0].id);
        continue;
      }
    }

    const priority  = issue.severity === "critical" ? "critical" : issue.severity === "high" ? "high" : "medium";
    const item_type = classifyIssueType(issue, issue._category || "");
    const now       = new Date().toISOString();

    const { error } = await supabase.from("work_items").insert({
      title,
      description:       issue.description || issue.fix_suggestion || "Auto-generated from scan",
      status:            "open",
      priority,
      item_type,
      source_type:       "ai_scan",
      ai_detected:       true,
      issue_fingerprint: fp,
      first_seen_at:     now,
      last_seen_at:      now,
    });

    if (!error) {
      created++;
      console.log(`[create-work-item] ✅ created: "${title.slice(0, 60)}"`);
    } else {
      console.error(`[create-work-item] ❌ failed: "${title.slice(0, 60)}" — ${error.message}`);
    }
  }

  return created;
}

async function runStep(
  step: { id: string; label: string; scanType: string },
  supabase: any,
  scan_run_id: string,
): Promise<{
  issues: any[];
  _executed: boolean;
  _empty_reason: string;
  _input_size: number;
  _duration_ms: number;
  [key: string]: any;
}> {
  const stepStart = Date.now();
  console.log(`[SCAN START] ${step.id}`);
  let result: any = { issues: [], _executed: false, _empty_reason: "", _input_size: 0, _duration_ms: 0 };
  try {
    const realScanner = REAL_DB_SCANNERS[step.scanType];
    if (realScanner) {
      const dbResult = await realScanner(supabase, scan_run_id);
      result = { ...dbResult };
      // AI enrichment is intentionally skipped (AI_ENABLED = false).
      // To re-enable: wrap the fetch call below with `if (AI_ENABLED) { ... }`.
      result.ai_suggestions = result.ai_suggestions ?? [];
      result.ai_summary = result.ai_summary ?? null;
    } else {
      // No real DB scanner available; AI-only scanners are also disabled.
      if (!AI_ENABLED) {
        console.log(`[AI DISABLED] Skipping AI-only step: ${step.id}`);
        result = { issues: [], skipped: true, _reason: "AI_DISABLED" };
      } else {
        result._empty_reason = "no_scanner";
      }
    }
    if (!Array.isArray(result.issues)) {
      result.issues = result.issues ?? [];
    }
    const duration_ms = Date.now() - stepStart;
    const didExecute = !result.failed && !result.error;
    // Prefer scanner's own input_size, fall back to legacy scanner-specific fields
    const inputSize = result.input_size ??
      result.components_scanned ?? result.routes_scanned ?? result.records_scanned ??
      result.features_scanned ?? result.tables_scanned ?? result.flows_scanned ??
      result.items_scanned ?? result.total_checked ?? result.total_scanned ?? 0;

    // Log rules applied by the scanner
    if (result.rules_applied?.length) {
      result._rules_applied = result.rules_applied;
      console.log(`[scan] ${step.id} applied ${result.rules_applied.length} rules: ${result.rules_applied.slice(0, 5).join(", ")}${result.rules_applied.length > 5 ? "…" : ""}`);
    }

    // Respect scanner-set _empty_reason; only fill in if not already set
    if (result.issues.length === 0 && !result._empty_reason) {
      if (result.failed || result.error) {
        result._empty_reason = "scanner_failed";
      } else if (inputSize === 0) {
        result._empty_reason = "no_data";
      } else if (didExecute) {
        result._empty_reason = "no_detection";
      } else {
        result._empty_reason = "not_applicable";
      }
    }
    result._executed = didExecute;
    result._input_size = inputSize;
    result._duration_ms = duration_ms;
    result._step_id = step.id;
    console.log(`[SCAN RESULT] ${step.id}: issues=${result.issues.length} executed=${result._executed} empty_reason=${result._empty_reason || ""}`);
    console.log(`[SCAN END] ${step.id}: ${duration_ms}ms`);
    return result;
  } catch (e: any) {
    const duration_ms = Date.now() - stepStart;
    result.issues = Array.isArray(result.issues) ? result.issues : [];
    result._empty_reason = "scanner_failed";
    result._executed = false;
    result._duration_ms = duration_ms;
    result._step_id = step.id;
    result.error = e.message;
    result.failed = true;
    console.log(`[SCAN RESULT] ${step.id}: issues=0 executed=false empty_reason=scanner_failed`);
    console.log(`[SCAN END] ${step.id}: ${duration_ms}ms`);
    return result;
  }
}
// ──────────────────────────────────────────────────────────────────────────


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase    = createClient(supabaseUrl, serviceKey);

    const body   = await req.json();
    const { action, scan_run_id } = body;

    // ── STATUS ──────────────────────────────────────────────────────────────
    if (action === "status") {
      let q = supabase.from("scan_runs").select("*");
      if (scan_run_id) q = q.eq("id", scan_run_id);
      else             q = q.order("created_at", { ascending: false }).limit(1);
      const { data } = await q.single();
      return new Response(JSON.stringify({ success: true, ...(data || {}) }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    if (action !== "start") {
      return new Response(JSON.stringify({ success: false, error: "Invalid action" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── AUTH ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user?.id) return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = roles?.some((r: any) => ["admin", "founder", "it", "support", "moderator"].includes(r.role));
    if (!isStaff) return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ── RUNNING-SCAN LOCK ────────────────────────────────────────────────────
    const { data: running } = await supabase.from("scan_runs").select("id, started_at").eq("status", "running").limit(1);
    if (running?.length) {
      const age = Date.now() - new Date(running[0].started_at).getTime();
      if (age > 5 * 60 * 1000) {
        await supabase.from("scan_runs").update({ status: "error", completed_at: new Date().toISOString() }).eq("id", running[0].id);
      } else {
        return new Response(JSON.stringify({ success: false, error: "En skanning körs redan", running_scan: running[0] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ── CREATE SCAN_RUN ──────────────────────────────────────────────────────
    const { data: scanRun, error: insertError } = await supabase.from("scan_runs").insert({
      status:             "running",
      started_by:         user.id,
      current_step:       0,
      total_steps:        STEPS.length,
      current_step_label: STEPS[0].label,
      steps_results:      {},
      scan_mode:          "full",
    }).select("id").single();

    if (insertError || !scanRun) {
      return new Response(JSON.stringify({ success: false, error: insertError?.message || "Failed to create scan run" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LOOP STEPS ───────────────────────────────────────────────────────────
    const stepsResults: Record<string, any> = {};
    for (const step of STEPS) {
      await supabase.from("scan_runs").update({ current_step_label: step.label, current_step: STEPS.indexOf(step) }).eq("id", scanRun.id);
      const result = await runStep(step, supabase, scanRun.id);
      stepsResults[step.id] = result;
      await supabase.from("scan_runs").update({ steps_results: stepsResults }).eq("id", scanRun.id);
    }

    // ── BUILD RESULT ─────────────────────────────────────────────────────────
    const totalDuration = Object.values(stepsResults).reduce((sum: number, r: any) => sum + (r?._duration_ms || 0), 0);
    const unified       = buildUnifiedResult(stepsResults, totalDuration);

    const allIssues = [...unified.broken_flows, ...unified.fake_features, ...unified.interaction_failures, ...unified.data_issues];
    const issuesCount = allIssues.length;

    // ── CREATE WORK ITEMS ────────────────────────────────────────────────────
    const workItemsCreated = await createWorkItems(supabase, unified);

    const execSummary = `${unified.system_health_score}/100 — ${issuesCount} issues — ${workItemsCreated} tasks created`;
    console.log("[SCAN DONE]", execSummary);

    // ── SAVE FINAL RESULT ────────────────────────────────────────────────────
    await supabase.from("scan_runs").update({
      status:             "done",
      completed_at:       new Date().toISOString(),
      steps_results:      stepsResults,
      unified_result:     unified,
      system_health_score: unified.system_health_score,
      executive_summary:  execSummary,
      work_items_created: workItemsCreated,
      current_step:       STEPS.length,
      current_step_label: "Klar ✓",
    }).eq("id", scanRun.id);

    return new Response(JSON.stringify({ success: true, scan_id: scanRun.id, detected: issuesCount, created: workItemsCreated, unified_result: unified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });

  } catch (e: any) {
    console.error("[run-full-scan error]:", e?.message || e);
    return new Response(JSON.stringify({ success: false, error: e?.message || "Unknown error" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
