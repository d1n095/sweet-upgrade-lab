import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { patternMemory, type PatternMemoryState } from "@/core/scanner/patternMemory";
import {
  getLikelyRootCause,
  getTopCriticalEndpoints,
  getBreakpointClusters,
  getFieldTransitionTrace,
  type LikelyRootCause,
  type TopCriticalEndpoint,
  type BreakpointCluster,
  type FieldTransitionTrace,
} from "@/lib/failureMemory";

/**
 * Read-only unified scanner overview. Aggregates existing in-memory data
 * sources only — no polling, no fetching, no new logic. Refreshes by
 * re-reading the same getters on demand.
 *
 * Trace-to-Source: each displayed finding gets a "View Source" button that
 * uses static heuristic mapping (entity / field / endpoint → folder paths)
 * to suggest likely code locations. No validation, no file scanning.
 */

// ---------------------------------------------------------------------------
// Static heuristic mapping (entity / field / endpoint → likely source paths)
// ---------------------------------------------------------------------------

const ENTITY_PATHS: Record<string, string[]> = {
  order: ["src/services/order/", "src/api/orders/", "src/pages/admin/AdminOrders.tsx"],
  orders: ["src/services/order/", "src/api/orders/"],
  user: ["src/services/user/", "src/api/users/", "src/hooks/useAuth.ts"],
  users: ["src/services/user/", "src/api/users/"],
  profile: ["src/services/user/", "src/pages/MemberProfile.tsx"],
  work_item: ["src/services/work-item/", "src/lib/workItemReview.ts"],
  workitem: ["src/services/work-item/"],
  payment: ["src/services/payment/", "src/api/payments/"],
  cart: ["src/stores/cartStore.ts", "src/pages/Checkout.tsx"],
  checkout: ["src/pages/Checkout.tsx", "supabase/functions/create-checkout/index.ts"],
  shipment: ["supabase/functions/create-shipment/index.ts"],
};

const FIELD_PATHS: Record<string, string[]> = {
  payment_intent_id: [
    "src/services/payment/stripe.ts",
    "supabase/functions/stripe-webhook/index.ts",
    "supabase/functions/create-checkout/index.ts",
  ],
  stripe_session_id: ["supabase/functions/stripe-webhook/index.ts"],
  username: ["src/hooks/useAuth.ts", "src/services/user/profile.ts"],
  email: ["src/hooks/useAuth.ts", "src/services/user/"],
  source_id: ["src/services/integration/", "src/services/ingestion/"],
  order_number: ["src/services/order/numbering.ts", "src/utils/orderDisplay.ts"],
  order_id: ["src/services/order/", "src/api/orders/"],
  user_id: ["src/hooks/useAuth.ts", "src/services/user/"],
  amount: ["src/services/payment/", "src/core/business/pricingEngine.ts"],
  total: ["src/core/business/pricingEngine.ts"],
};

function mapEntity(entity: string | null | undefined): string[] {
  if (!entity) return [];
  const key = entity.toLowerCase().trim();
  return ENTITY_PATHS[key] ?? [];
}

function mapField(field: string | null | undefined): string[] {
  if (!field) return [];
  const key = field.toLowerCase().trim();
  return FIELD_PATHS[key] ?? [];
}

function mapEndpoint(endpoint: string | null | undefined): string[] {
  if (!endpoint) return [];
  const e = endpoint.trim();
  const out: string[] = [];

  // Supabase edge function routes: /functions/v1/<name> or just <name>
  const fnMatch = e.match(/(?:^|\/)functions\/v1\/([a-z0-9-]+)/i) ??
    e.match(/^([a-z0-9-]+)$/i);
  if (fnMatch) out.push(`supabase/functions/${fnMatch[1]}/index.ts`);

  // REST-ish API path: /api/<resource>
  const apiMatch = e.match(/\/api\/([a-z0-9-_]+)/i);
  if (apiMatch) out.push(`src/api/${apiMatch[1]}/route.ts`);

  // Admin route → admin page
  const adminMatch = e.match(/\/admin\/([a-z0-9-_]+)/i);
  if (adminMatch) {
    const seg = adminMatch[1];
    const cap = seg.charAt(0).toUpperCase() + seg.slice(1);
    out.push(`src/pages/admin/Admin${cap}.tsx`);
  }

  return out;
}

function dedupe(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean))];
}

type SourceOrigin = "endpoint" | "field" | "entity" | "pattern_key";

function suggestSources(opts: {
  entity?: string | null;
  field?: string | null;
  endpoint?: string | null;
}): { paths: string[]; origins: SourceOrigin[] } {
  const ep = mapEndpoint(opts.endpoint);
  const fl = mapField(opts.field);
  const en = mapEntity(opts.entity);
  const origins: SourceOrigin[] = [];
  if (ep.length) origins.push("endpoint");
  if (fl.length) origins.push("field");
  if (en.length) origins.push("entity");
  return { paths: dedupe([...ep, ...fl, ...en]), origins };
}

// Parse "entity.field" or "entity::field" → { entity, field }
function splitFieldPath(path: string): { entity: string; field: string } {
  const sep = path.includes("::") ? "::" : ".";
  const idx = path.indexOf(sep);
  if (idx === -1) return { entity: path, field: "" };
  return { entity: path.slice(0, idx), field: path.slice(idx + sep.length) };
}

// Parse pattern_key heuristically: usually contains entity/field/endpoint tokens.
function suggestFromPatternKey(key: string): string[] {
  const tokens = key.split(/[^a-zA-Z0-9_]+/).filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    out.push(...mapEntity(t));
    out.push(...mapField(t));
  }
  // If pattern looks like an endpoint, include endpoint mapping too.
  if (key.includes("/")) out.push(...mapEndpoint(key));
  return dedupe(out);
}

// ---------------------------------------------------------------------------
// View Source button
// ---------------------------------------------------------------------------

function ViewSourceButton({ paths }: { paths: string[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const onCopy = async (p: string) => {
    try {
      await navigator.clipboard.writeText(p);
      setCopied(p);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore clipboard errors
    }
  };

  if (paths.length === 0) {
    return <span className="text-[10px] text-muted-foreground italic">source unknown</span>;
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-[11px]"
        onClick={() => setOpen((o) => !o)}
      >
        View Source ({paths.length})
      </Button>
      {open && (
        <ul className="text-[11px] bg-muted/40 rounded-md p-2 space-y-1 max-w-[320px]">
          {paths.map((p) => (
            <li key={p} className="flex items-center justify-between gap-2">
              <span className="font-mono break-all">{p}</span>
              <button
                type="button"
                className="text-[10px] underline text-muted-foreground hover:text-foreground"
                onClick={() => onCopy(p)}
              >
                {copied === p ? "copied" : "copy"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ScannerOverview() {
  const [pattern, setPattern] = useState<PatternMemoryState | null>(null);
  const [topEndpoints, setTopEndpoints] = useState<TopCriticalEndpoint[]>([]);
  const [rootCause, setRootCause] = useState<LikelyRootCause | null>(null);
  const [trace, setTrace] = useState<FieldTransitionTrace | null>(null);
  const [clusters, setClusters] = useState<ReadonlyArray<BreakpointCluster>>([]);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const load = () => {
    const root = getLikelyRootCause();
    setPattern(patternMemory.getState());
    setTopEndpoints(getTopCriticalEndpoints(10));
    setRootCause(root);
    setTrace(
      root?.representative_cluster_id
        ? getFieldTransitionTrace(root.representative_cluster_id)
        : null,
    );
    setClusters(getBreakpointClusters());
    setLoadedAt(new Date().toLocaleTimeString());
  };

  useEffect(() => {
    load();
  }, []);

  const activePatterns = (pattern?.endpoint_mismatches ?? [])
    .slice()
    .sort((a, b) => b.occurrence_count - a.occurrence_count);

  const entityGroups = (() => {
    if (!trace) return [] as Array<{
      entity: string;
      transitions: Array<{ field_path: string; before: string; after: string; count: number }>;
    }>;
    const out: Array<{
      entity: string;
      transitions: Array<{ field_path: string; before: string; after: string; count: number }>;
    }> = [];
    for (const [entity, list] of Object.entries(trace.by_entity)) {
      const seen = new Map<string, { field_path: string; before: string; after: string; count: number }>();
      for (const t of list) {
        const key = `${t.field_path}|${t.before}->${t.after}`;
        const existing = seen.get(key);
        if (existing) existing.count += 1;
        else
          seen.set(key, {
            field_path: t.field_path,
            before: t.before,
            after: t.after,
            count: trace.frequency[t.field_path] ?? 1,
          });
      }
      const transitions = [...seen.values()].sort(
        (a, b) => b.count - a.count || a.field_path.localeCompare(b.field_path),
      );
      out.push({ entity, transitions });
    }
    out.sort((a, b) => (b.transitions[0]?.count ?? 0) - (a.transitions[0]?.count ?? 0));
    return out;
  })();

  const maxTransitionCount = entityGroups.reduce(
    (m, g) => Math.max(m, g.transitions[0]?.count ?? 0),
    0,
  );

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scanner Overview</h1>
          <p className="text-sm text-muted-foreground">
            Unified read-only view of all scanner outputs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loadedAt && (
            <span className="text-xs text-muted-foreground">Loaded {loadedAt}</span>
          )}
          <Button size="sm" variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </header>

      {/* A. Top Critical Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">A. Top Critical Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {topEndpoints.length === 0 ? (
            <p className="text-muted-foreground">No data available</p>
          ) : (
            <ul className="divide-y">
              {topEndpoints.map((e) => {
                const sources = suggestSources({ endpoint: e.endpoint });
                return (
                  <li
                    key={e.endpoint}
                    className="py-2 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs break-all">{e.endpoint}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        score <strong>{e.total_priority_score}</strong> ·{" "}
                        {e.number_of_flags} flag(s)
                      </div>
                    </div>
                    <ViewSourceButton paths={sources} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* B. Root Cause Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">B. Root Cause Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {!rootCause ? (
            <p className="text-muted-foreground">No data available</p>
          ) : (
            <>
              <div>
                <div className="text-muted-foreground">Top breakpoint cluster</div>
                <div className="font-mono text-xs break-all">
                  {rootCause.representative_cluster_id ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Affected entities</div>
                <div>{rootCause.affected_entities.join(", ") || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Most common missing fields</div>
                <ul className="space-y-1 pl-0 list-none">
                  {rootCause.most_common_missing_fields.map((f) => {
                    const { entity, field } = splitFieldPath(f);
                    const sources = suggestSources({ entity, field });
                    return (
                      <li
                        key={f}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="font-mono text-xs">{f}</span>
                        <ViewSourceButton paths={sources} />
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <div className="text-muted-foreground">Occurrence frequency</div>
                <div>{rootCause.cluster_occurrences}</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* C. Field Transition Trace */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">C. Field Transition Trace</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {entityGroups.length === 0 ? (
            <p className="text-muted-foreground">No data available</p>
          ) : (
            <div className="space-y-4">
              {entityGroups.map((g) => (
                <div key={g.entity}>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1">
                    {g.entity}
                  </div>
                  <ul className="space-y-2">
                    {g.transitions.map((t) => {
                      const isMostFrequent =
                        t.count === maxTransitionCount && maxTransitionCount > 0;
                      const { entity, field } = splitFieldPath(t.field_path);
                      const sources = suggestSources({
                        entity: entity || g.entity,
                        field,
                      });
                      return (
                        <li
                          key={`${t.field_path}|${t.before}->${t.after}`}
                          className={
                            "font-mono text-xs flex items-start justify-between gap-3 " +
                            (isMostFrequent
                              ? "border-l-2 border-foreground pl-2"
                              : "pl-2")
                          }
                        >
                          <div className="flex-1 min-w-0">
                            <div>{t.field_path}</div>
                            <div className="text-muted-foreground">
                              {t.before} → {t.after}
                              {t.count > 1 ? ` (×${t.count})` : ""}
                              {isMostFrequent ? " ★" : ""}
                            </div>
                          </div>
                          <ViewSourceButton paths={sources} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* D. Active Pattern Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">D. Active Pattern Log</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {activePatterns.length === 0 ? (
            <p className="text-muted-foreground">No data available</p>
          ) : (
            <ul className="divide-y">
              {activePatterns.map((p) => {
                const sources = suggestFromPatternKey(p.pattern_key);
                return (
                  <li
                    key={p.pattern_key}
                    className="py-2 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs break-all">{p.pattern_key}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        occurrences <strong>{p.occurrence_count}</strong>
                        {p.persistent ? " · persistent" : ""}
                      </div>
                    </div>
                    <ViewSourceButton paths={sources} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* E. Breakpoint Clusters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">E. Breakpoint Clusters</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {clusters.length === 0 ? (
            <p className="text-muted-foreground">No data available</p>
          ) : (
            <ul className="divide-y">
              {clusters.map((c) => {
                const entitySources = c.affected_entities.flatMap((e) => mapEntity(e));
                const sources = dedupe(entitySources);
                return (
                  <li key={c.breakpoint_cluster_id} className="py-2 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs break-all">
                          {c.breakpoint_cluster_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          frequency <strong>{c.occurrence_count}</strong> · entities:{" "}
                          {c.affected_entities.join(", ") || "—"}
                        </div>
                      </div>
                      <ViewSourceButton paths={sources} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
