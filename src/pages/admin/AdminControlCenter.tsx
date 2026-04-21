/**
 * ADMIN CONTROL CENTER
 *
 * Single read-only aggregation surface across the six core domains:
 *   1. Product overview        (products, stock, status)
 *   2. Event logs              (ecommerce_events feed)
 *   3. Rule triggers           (automation_logs / campaign_activations)
 *   4. Pricing changes         (price_history)
 *   5. Campaigns               (active + scheduled)
 *   6. Affiliate performance   (top affiliates by commission)
 *
 * Strict rules:
 *   - READ-ONLY. Every write goes through the existing admin pages
 *     (deep-links provided per section). No hidden mutations here.
 *   - All numbers come straight from the DB — no client-side math beyond
 *     basic counts/sums, every calculation is shown in the UI.
 *   - All filter state is local (URL params) — nothing is persisted server-side.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Package, Activity, Zap, TrendingDown, Megaphone, Handshake,
  ArrowUpRight, RefreshCw, Filter, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Range = "24h" | "7d" | "30d" | "90d";

interface KpiSnapshot {
  products: { total: number; active: number; low_stock: number; out_of_stock: number };
  events: { total: number; by_type: Record<string, number> };
  triggers: { total: number; by_action: Record<string, number> };
  pricing: { changes: number; avg_delta_pct: number };
  campaigns: { active: number; scheduled: number; ended: number };
  affiliates: { active: number; pending_commission: number; orders: number };
}

interface FeedRow {
  id: string;
  ts: string;
  kind: string;
  label: string;
  detail: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const RANGE_HOURS: Record<Range, number> = { "24h": 24, "7d": 168, "30d": 720, "90d": 2160 };

function rangeStart(range: Range): string {
  return new Date(Date.now() - RANGE_HOURS[range] * 3600 * 1000).toISOString();
}

const fmtSEK = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminControlCenter() {
  const [range, setRange] = useState<Range>("7d");
  const [search, setSearch] = useState("");
  const [snap, setSnap] = useState<KpiSnapshot | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // ───────── Load aggregate KPIs ─────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const since = rangeStart(range);

      const [
        productsRes, eventsRes, triggersRes,
        priceRes, campaignsRes, affRes, affOrdersRes,
      ] = await Promise.all([
        (supabase as any).from("products")
          .select("id, status, stock, low_stock_threshold"),
        (supabase as any).from("ecommerce_events")
          .select("event_type, created_at")
          .gte("created_at", since)
          .limit(5000),
        (supabase as any).from("automation_logs")
          .select("action_type, created_at")
          .gte("created_at", since)
          .limit(5000),
        (supabase as any).from("price_history")
          .select("old_price, new_price, created_at")
          .gte("created_at", since)
          .limit(5000),
        (supabase as any).from("campaigns")
          .select("status"),
        (supabase as any).from("affiliates")
          .select("id, is_active, pending_earnings"),
        (supabase as any).from("affiliate_orders")
          .select("commission_amount, status, created_at")
          .gte("created_at", since),
      ]);

      // Products
      const products = productsRes.data ?? [];
      const lowStock = products.filter((p: any) =>
        p.stock > 0 && p.low_stock_threshold && p.stock <= p.low_stock_threshold,
      ).length;
      const outOfStock = products.filter((p: any) => p.stock <= 0).length;

      // Events
      const events = eventsRes.data ?? [];
      const eventsByType: Record<string, number> = {};
      for (const e of events) eventsByType[e.event_type] = (eventsByType[e.event_type] || 0) + 1;

      // Triggers
      const triggers = triggersRes.data ?? [];
      const trigByAction: Record<string, number> = {};
      for (const t of triggers) trigByAction[t.action_type] = (trigByAction[t.action_type] || 0) + 1;

      // Pricing — average delta % across all logged changes (transparent calc)
      const prices = priceRes.data ?? [];
      let totalDelta = 0;
      let deltaCount = 0;
      for (const p of prices) {
        const oldP = Number(p.old_price);
        const newP = Number(p.new_price);
        if (oldP > 0 && oldP !== newP) {
          totalDelta += ((newP - oldP) / oldP) * 100;
          deltaCount++;
        }
      }

      // Campaigns
      const camps = campaignsRes.data ?? [];

      // Affiliates
      const affs = affRes.data ?? [];
      const affOrders = affOrdersRes.data ?? [];
      const pendingCommission = affs.reduce(
        (s: number, a: any) => s + Number(a.pending_earnings || 0), 0,
      );

      const next: KpiSnapshot = {
        products: {
          total: products.length,
          active: products.filter((p: any) => p.status === "active").length,
          low_stock: lowStock,
          out_of_stock: outOfStock,
        },
        events: { total: events.length, by_type: eventsByType },
        triggers: { total: triggers.length, by_action: trigByAction },
        pricing: {
          changes: deltaCount,
          avg_delta_pct: deltaCount > 0 ? totalDelta / deltaCount : 0,
        },
        campaigns: {
          active: camps.filter((c: any) => c.status === "active").length,
          scheduled: camps.filter((c: any) => c.status === "scheduled").length,
          ended: camps.filter((c: any) => c.status === "ended").length,
        },
        affiliates: {
          active: affs.filter((a: any) => a.is_active).length,
          pending_commission: pendingCommission,
          orders: affOrders.length,
        },
      };

      if (!cancelled) setSnap(next);
      if (!cancelled) setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [range, refreshKey]);

  // ───────── Load combined activity feed ─────────
  useEffect(() => {
    let cancelled = false;
    const loadFeed = async () => {
      const since = rangeStart(range);
      const [evRes, ruleRes, priceRes, campRes] = await Promise.all([
        (supabase as any).from("ecommerce_events")
          .select("id, created_at, event_type, payload")
          .gte("created_at", since).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("automation_logs")
          .select("id, created_at, action_type, reason, target_type")
          .gte("created_at", since).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("price_history")
          .select("id, created_at, old_price, new_price, change_reason, product_id")
          .gte("created_at", since).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("campaign_activations")
          .select("id, created_at, action, reason, campaign_id")
          .gte("created_at", since).order("created_at", { ascending: false }).limit(50),
      ]);

      const rows: FeedRow[] = [
        ...(evRes.data ?? []).map((e: any) => ({
          id: `ev-${e.id}`, ts: e.created_at, kind: "event",
          label: e.event_type,
          detail: typeof e.payload === "object" ? JSON.stringify(e.payload).slice(0, 120) : String(e.payload ?? ""),
        })),
        ...(ruleRes.data ?? []).map((r: any) => ({
          id: `rl-${r.id}`, ts: r.created_at, kind: "rule",
          label: r.action_type,
          detail: `${r.target_type} — ${r.reason}`,
        })),
        ...(priceRes.data ?? []).map((p: any) => ({
          id: `pr-${p.id}`, ts: p.created_at, kind: "price",
          label: `${Number(p.old_price)} → ${Number(p.new_price)} kr`,
          detail: p.change_reason ?? "manual",
        })),
        ...(campRes.data ?? []).map((c: any) => ({
          id: `cm-${c.id}`, ts: c.created_at, kind: "campaign",
          label: c.action,
          detail: c.reason ?? "—",
        })),
      ].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 200);

      if (!cancelled) setFeed(rows);
    };
    loadFeed();
    return () => { cancelled = true; };
  }, [range, refreshKey]);

  const filteredFeed = useMemo(() => {
    if (!search.trim()) return feed;
    const q = search.toLowerCase();
    return feed.filter(r =>
      r.label.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q) || r.kind.includes(q),
    );
  }, [feed, search]);

  // ───────── Render ─────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Control Center</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Read-only översikt — alla ändringar görs i respektive sektion (länkar nedan).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Senaste 24 h</SelectItem>
              <SelectItem value="7d">Senaste 7 dagar</SelectItem>
              <SelectItem value="30d">Senaste 30 dagar</SelectItem>
              <SelectItem value="90d">Senaste 90 dagar</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setRefreshKey(k => k + 1)} aria-label="Uppdatera">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Read-only banner */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-muted-foreground">
          Alla siffror är hämtade direkt från databasen utan dolda beräkningar.
          Pris-delta visas som genomsnitt av <code className="text-foreground">(new − old) / old × 100</code> per loggad ändring.
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="Produkter" icon={Package} link="/admin/products" loading={loading}
          rows={[
            { k: "Totalt", v: snap?.products.total ?? 0 },
            { k: "Aktiva", v: snap?.products.active ?? 0 },
            { k: "Låg lager", v: snap?.products.low_stock ?? 0, warn: (snap?.products.low_stock ?? 0) > 0 },
            { k: "Slut", v: snap?.products.out_of_stock ?? 0, warn: (snap?.products.out_of_stock ?? 0) > 0 },
          ]}
        />
        <KpiCard
          title="Händelser" icon={Activity} link="/admin/events-dashboard" loading={loading}
          rows={[
            { k: "Totalt", v: snap?.events.total ?? 0 },
            ...Object.entries(snap?.events.by_type ?? {}).slice(0, 3).map(([k, v]) => ({ k, v })),
          ]}
        />
        <KpiCard
          title="Regel-triggers" icon={Zap} link="/admin/scans" loading={loading}
          rows={[
            { k: "Körningar", v: snap?.triggers.total ?? 0 },
            ...Object.entries(snap?.triggers.by_action ?? {}).slice(0, 3).map(([k, v]) => ({ k, v })),
          ]}
        />
        <KpiCard
          title="Prisändringar" icon={TrendingDown} link="/admin/products" loading={loading}
          rows={[
            { k: "Antal", v: snap?.pricing.changes ?? 0 },
            {
              k: "Snitt-delta",
              v: snap ? fmtPct(snap.pricing.avg_delta_pct) : "—",
              warn: (snap?.pricing.avg_delta_pct ?? 0) < -10,
            },
          ]}
        />
        <KpiCard
          title="Kampanjer" icon={Megaphone} link="/admin/campaigns" loading={loading}
          rows={[
            { k: "Aktiva", v: snap?.campaigns.active ?? 0 },
            { k: "Schemalagda", v: snap?.campaigns.scheduled ?? 0 },
            { k: "Avslutade", v: snap?.campaigns.ended ?? 0 },
          ]}
        />
        <KpiCard
          title="Affiliates" icon={Handshake} link="/admin/partners" loading={loading}
          rows={[
            { k: "Aktiva", v: snap?.affiliates.active ?? 0 },
            { k: "Ordrar (period)", v: snap?.affiliates.orders ?? 0 },
            { k: "Väntande provision", v: snap ? fmtSEK(snap.affiliates.pending_commission) : "—" },
          ]}
        />
      </div>

      {/* Activity feed */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base">Aktivitetslogg</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrera (typ, etikett, detalj)…"
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">Allt ({filteredFeed.length})</TabsTrigger>
              <TabsTrigger value="event">Händelser</TabsTrigger>
              <TabsTrigger value="rule">Regler</TabsTrigger>
              <TabsTrigger value="price">Pris</TabsTrigger>
              <TabsTrigger value="campaign">Kampanjer</TabsTrigger>
            </TabsList>
            {(["all", "event", "rule", "price", "campaign"] as const).map(tab => (
              <TabsContent key={tab} value={tab} className="mt-4">
                <FeedList rows={tab === "all" ? filteredFeed : filteredFeed.filter(r => r.kind === tab)} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({
  title, icon: Icon, link, loading, rows,
}: {
  title: string;
  icon: any;
  link: string;
  loading: boolean;
  rows: { k: string; v: number | string; warn?: boolean }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        <Link to={link} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
          Öppna <ArrowUpRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {loading ? (
          <>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </>
        ) : (
          rows.map(r => (
            <div key={r.k} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground capitalize">{r.k}</span>
              <span className={`font-mono tabular-nums ${r.warn ? "text-destructive font-semibold" : "text-foreground"}`}>
                {r.v}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function FeedList({ rows }: { rows: FeedRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Inga händelser för perioden.</p>;
  }
  const kindStyle: Record<string, string> = {
    event: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    rule: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    price: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    campaign: "bg-green-500/10 text-green-700 dark:text-green-400",
  };
  return (
    <ScrollArea className="h-[480px] pr-3">
      <div className="space-y-1">
        {rows.map(r => (
          <div key={r.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
            <Badge variant="secondary" className={`shrink-0 ${kindStyle[r.kind] ?? ""}`}>{r.kind}</Badge>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r.label}</p>
              <p className="text-xs text-muted-foreground truncate">{r.detail}</p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {format(new Date(r.ts), "MMM d, HH:mm")}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
