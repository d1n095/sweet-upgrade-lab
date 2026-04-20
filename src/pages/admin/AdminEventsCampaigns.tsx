/**
 * EVENTS & CAMPAIGNS DASHBOARD
 *
 * READ-ONLY display of system state.
 * - Active events       (from autoCampaignTrigger.active_campaigns)
 * - Triggered rules     (from priorityResolver / autoCampaignTrigger logs)
 * - Active discounts    (from discountEngine.last report)
 * - Campaign performance (from autoCampaignTrigger.campaign_impact)
 * - Product impact      (per-product aggregate)
 *
 * No mutations. No AI calls. State is sourced from window.__godmode and
 * refreshed via the command layer's reactive store (commandLog updates).
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Zap, Percent, TrendingUp, Package, RefreshCw } from "lucide-react";
import { useCommandLayerStore } from "@/core/scanner/commandLayer";
import type { AutoTriggerReport } from "@/core/business/autoCampaignTrigger";
import type { DiscountEngineReport } from "@/core/business/discountEngine";
import type { PriorityResolverReport } from "@/core/business/priorityResolver";

interface DashboardState {
  auto: AutoTriggerReport | null;
  discount: DiscountEngineReport | null;
  priority: PriorityResolverReport | null;
  refreshed_at: string;
}

const empty: DashboardState = {
  auto: null,
  discount: null,
  priority: null,
  refreshed_at: new Date().toISOString(),
};

function readState(): DashboardState {
  if (typeof window === "undefined" || !window.__godmode) return empty;
  return {
    auto: window.__godmode.lastAutoCampaignReport?.() ?? null,
    discount: window.__godmode.lastDiscountReport?.() ?? null,
    priority: window.__godmode.lastPriorityResolution?.() ?? null,
    refreshed_at: new Date().toISOString(),
  };
}

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtMoney = (n: number) => `${n.toFixed(2)} kr`;
const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
};

export default function AdminEventsCampaigns() {
  // Subscribe to command layer — every dispatched command bumps the log,
  // which we use as a reactivity signal to re-read state.
  const logLength = useCommandLayerStore((s) => s.log.length);
  const [state, setState] = useState<DashboardState>(empty);

  useEffect(() => {
    setState(readState());
  }, [logLength]);

  // Derived: per-product impact aggregation
  const productImpact = useMemo(() => {
    const map = new Map<string, {
      product_id: string;
      title?: string;
      campaigns: number;
      discounts: number;
      revenue_delta: number;
      effective_discount_pct: number;
      final_price: number | null;
    }>();

    for (const c of state.auto?.active_campaigns ?? []) {
      const e = map.get(c.product_id) ?? {
        product_id: c.product_id, title: c.product_title,
        campaigns: 0, discounts: 0, revenue_delta: 0,
        effective_discount_pct: 0, final_price: null,
      };
      e.campaigns += 1;
      if (!e.title && c.product_title) e.title = c.product_title;
      map.set(c.product_id, e);
    }
    for (const i of state.auto?.campaign_impact ?? []) {
      const e = map.get(i.product_id);
      if (e) e.revenue_delta += i.expected_revenue_delta;
    }
    for (const a of state.discount?.active_discounts ?? []) {
      const e = map.get(a.product_id) ?? {
        product_id: a.product_id, title: undefined,
        campaigns: 0, discounts: 0, revenue_delta: 0,
        effective_discount_pct: 0, final_price: null,
      };
      e.discounts += 1;
      map.set(a.product_id, e);
    }
    for (const r of state.priority?.resolved_actions ?? []) {
      const e = map.get(r.product_id) ?? {
        product_id: r.product_id, title: undefined,
        campaigns: 0, discounts: 0, revenue_delta: 0,
        effective_discount_pct: 0, final_price: null,
      };
      e.effective_discount_pct = r.applied_discount_pct;
      e.final_price = r.final_price;
      map.set(r.product_id, e);
    }
    return [...map.values()].sort((a, b) => b.revenue_delta - a.revenue_delta);
  }, [state]);

  const summary = {
    active_events: state.auto?.active_campaigns.length ?? 0,
    triggered_rules:
      (state.auto?.triggered_campaigns.length ?? 0) +
      (state.priority?.summary.resolved_count ?? 0),
    active_discounts: state.discount?.active_discounts.length ?? 0,
    expected_revenue: state.auto?.summary.total_expected_revenue_delta ?? 0,
    margin_clamps: state.priority?.summary.margin_clamps ?? 0,
    overridden: state.priority?.summary.overridden_count ?? 0,
  };

  const noState =
    !state.auto && !state.discount && !state.priority;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold">Events & Kampanjer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only systemtillstånd. Visar enbart vad event-systemet rapporterar.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <RefreshCw className="w-3 h-3" />
          {fmtTime(state.refreshed_at)}
        </Badge>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryTile icon={Zap} label="Aktiva events" value={summary.active_events} />
        <SummaryTile icon={Activity} label="Triggade regler" value={summary.triggered_rules} />
        <SummaryTile icon={Percent} label="Aktiva rabatter" value={summary.active_discounts} />
        <SummaryTile icon={TrendingUp} label="Förv. intäkt Δ" value={fmtMoney(summary.expected_revenue)} />
        <SummaryTile icon={Package} label="Margin-clamps" value={summary.margin_clamps} />
        <SummaryTile icon={Activity} label="Överridna regler" value={summary.overridden} />
      </div>

      {noState && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Inga rapporter tillgängliga ännu. Kör <code className="font-mono">__godmode.runAutoCampaignTrigger(...)</code>,
            <code className="font-mono"> __godmode.runDiscountEngine(...)</code> eller
            <code className="font-mono"> __godmode.resolvePriorities(...)</code> i konsolen.
          </CardContent>
        </Card>
      )}

      {!noState && (
        <Tabs defaultValue="events">
          <TabsList>
            <TabsTrigger value="events">Aktiva events</TabsTrigger>
            <TabsTrigger value="rules">Triggade regler</TabsTrigger>
            <TabsTrigger value="discounts">Rabatter</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="impact">Produktpåverkan</TabsTrigger>
          </TabsList>

          {/* ── Active events ── */}
          <TabsContent value="events">
            <Card>
              <CardHeader><CardTitle className="text-base">Aktiva kampanjer & events</CardTitle></CardHeader>
              <CardContent>
                {!state.auto || state.auto.active_campaigns.length === 0 ? (
                  <EmptyRow>Inga aktiva events.</EmptyRow>
                ) : (
                  <ScrollArea className="max-h-[420px]">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b">
                        <tr>
                          <th className="text-left py-2 font-medium">Typ</th>
                          <th className="text-left py-2 font-medium">Produkt</th>
                          <th className="text-right py-2 font-medium">Rabatt</th>
                          <th className="text-left py-2 font-medium">Start</th>
                          <th className="text-left py-2 font-medium">Slut</th>
                          <th className="text-left py-2 font-medium">Anledning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.auto.active_campaigns.map((c) => (
                          <tr key={c.id} className="border-b border-border/50">
                            <td className="py-2"><Badge variant="secondary" className="font-mono text-[10px]">{c.type}</Badge></td>
                            <td className="py-2">{c.product_title || c.product_id}</td>
                            <td className="py-2 text-right font-mono">{fmtPct(c.discount_pct)}</td>
                            <td className="py-2 text-xs text-muted-foreground">{fmtTime(c.start_at)}</td>
                            <td className="py-2 text-xs text-muted-foreground">{fmtTime(c.end_at)}</td>
                            <td className="py-2 text-xs text-muted-foreground">{c.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Triggered rules (priority + auto-trigger logs) ── */}
          <TabsContent value="rules">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Auto-trigger logg</CardTitle></CardHeader>
                <CardContent>
                  {!state.auto || state.auto.triggered_campaigns.length === 0 ? (
                    <EmptyRow>Inga loggar.</EmptyRow>
                  ) : (
                    <ScrollArea className="max-h-[380px]">
                      <ul className="text-sm space-y-1.5">
                        {state.auto.triggered_campaigns.map((t) => (
                          <li key={t.id + t.product_id} className="flex items-center justify-between gap-2 py-1 border-b border-border/40">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge
                                variant={t.status === "applied" ? "default" : "outline"}
                                className="text-[10px]"
                              >
                                {t.status}
                              </Badge>
                              <span className="font-mono text-xs truncate">{t.type}</span>
                              <span className="text-xs text-muted-foreground truncate">{t.product_id}</span>
                            </div>
                            {t.conflict && (
                              <span className="text-[10px] text-muted-foreground shrink-0">{t.conflict}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Prioritetsresolution</CardTitle></CardHeader>
                <CardContent>
                  {!state.priority || state.priority.overridden_rules.length === 0 ? (
                    <EmptyRow>Inga overrides.</EmptyRow>
                  ) : (
                    <ScrollArea className="max-h-[380px]">
                      <ul className="text-sm space-y-1.5">
                        {state.priority.overridden_rules.map((o, i) => (
                          <li key={`${o.rule_id}-${i}`} className="py-1 border-b border-border/40">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline" className="text-[10px]">{o.kind}</Badge>
                              <span className="text-[10px] text-muted-foreground">→ {o.overridden_by_kind}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{o.reason}</p>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Active discounts ── */}
          <TabsContent value="discounts">
            <Card>
              <CardHeader><CardTitle className="text-base">Aktiva rabatter</CardTitle></CardHeader>
              <CardContent>
                {!state.discount || state.discount.active_discounts.length === 0 ? (
                  <EmptyRow>Inga aktiva rabatter.</EmptyRow>
                ) : (
                  <ScrollArea className="max-h-[420px]">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b">
                        <tr>
                          <th className="text-left py-2 font-medium">Produkt</th>
                          <th className="text-left py-2 font-medium">Källa</th>
                          <th className="text-right py-2 font-medium">Rabatt</th>
                          <th className="text-right py-2 font-medium">Slutpris</th>
                          <th className="text-left py-2 font-medium">Anledning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.discount.active_discounts.map((d, i) => (
                          <tr key={`${d.product_id}-${i}`} className="border-b border-border/50">
                            <td className="py-2 font-mono text-xs">{d.product_id}</td>
                            <td className="py-2"><Badge variant="secondary" className="text-[10px]">{d.event_type}</Badge></td>
                            <td className="py-2 text-right font-mono">{fmtPct(d.discount_pct)}</td>
                            <td className="py-2 text-right font-mono">{fmtMoney(d.final_price)}</td>
                            <td className="py-2 text-xs text-muted-foreground">{d.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Campaign performance ── */}
          <TabsContent value="performance">
            <Card>
              <CardHeader><CardTitle className="text-base">Förväntad kampanjpåverkan</CardTitle></CardHeader>
              <CardContent>
                {!state.auto || state.auto.campaign_impact.length === 0 ? (
                  <EmptyRow>Ingen prognosdata.</EmptyRow>
                ) : (
                  <ScrollArea className="max-h-[420px]">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b">
                        <tr>
                          <th className="text-left py-2 font-medium">Kampanj</th>
                          <th className="text-left py-2 font-medium">Produkt</th>
                          <th className="text-right py-2 font-medium">Uplift</th>
                          <th className="text-right py-2 font-medium">Intäkt Δ</th>
                          <th className="text-right py-2 font-medium">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.auto.campaign_impact.map((p) => (
                          <tr key={p.campaign_id} className="border-b border-border/50">
                            <td className="py-2"><Badge variant="secondary" className="text-[10px] font-mono">{p.type}</Badge></td>
                            <td className="py-2 font-mono text-xs">{p.product_id}</td>
                            <td className="py-2 text-right font-mono">{fmtPct(p.expected_uplift_pct)}</td>
                            <td className="py-2 text-right font-mono">{fmtMoney(p.expected_revenue_delta)}</td>
                            <td className="py-2 text-right font-mono">{fmtPct(p.confidence)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Product impact ── */}
          <TabsContent value="impact">
            <Card>
              <CardHeader><CardTitle className="text-base">Aggregerad produktpåverkan</CardTitle></CardHeader>
              <CardContent>
                {productImpact.length === 0 ? (
                  <EmptyRow>Ingen produktpåverkan registrerad.</EmptyRow>
                ) : (
                  <ScrollArea className="max-h-[460px]">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground border-b">
                        <tr>
                          <th className="text-left py-2 font-medium">Produkt</th>
                          <th className="text-right py-2 font-medium">Kampanjer</th>
                          <th className="text-right py-2 font-medium">Rabatter</th>
                          <th className="text-right py-2 font-medium">Effektiv rabatt</th>
                          <th className="text-right py-2 font-medium">Slutpris</th>
                          <th className="text-right py-2 font-medium">Förv. Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productImpact.map((p) => (
                          <tr key={p.product_id} className="border-b border-border/50">
                            <td className="py-2">
                              <div className="text-xs">{p.title || p.product_id}</div>
                              {p.title && <div className="font-mono text-[10px] text-muted-foreground">{p.product_id}</div>}
                            </td>
                            <td className="py-2 text-right font-mono">{p.campaigns}</td>
                            <td className="py-2 text-right font-mono">{p.discounts}</td>
                            <td className="py-2 text-right font-mono">{fmtPct(p.effective_discount_pct)}</td>
                            <td className="py-2 text-right font-mono">{p.final_price !== null ? fmtMoney(p.final_price) : "—"}</td>
                            <td className="py-2 text-right font-mono">{fmtMoney(p.revenue_delta)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SummaryTile({
  icon: Icon, label, value,
}: { icon: typeof Activity; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />
          <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
        </div>
        <div className="text-2xl font-display font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">{children}</div>
  );
}
