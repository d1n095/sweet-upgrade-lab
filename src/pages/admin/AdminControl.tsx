/**
 * ADMIN CONTROL DASHBOARD — read-only ecommerce overview
 *
 * 6 sections, all data from the database, NO AI insights:
 *  1. Product overview
 *  2. Event logs (ecommerce_events)
 *  3. Rule triggers (campaign_activations driven by events)
 *  4. Pricing changes (price_history)
 *  5. Affiliate performance
 *  6. Campaign status
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Package, Activity, Zap, TrendingDown, Users, Megaphone, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", minimumFractionDigits: 0 }).format(n || 0);

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "—";

const statusColor = (s: string): string => {
  switch (s) {
    case "active":
    case "paid":
    case "info":
      return "bg-primary/10 text-primary border-primary/20";
    case "scheduled":
    case "draft":
      return "bg-muted text-muted-foreground border-border";
    case "ended":
    case "expired":
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "warning":
    case "paused":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
    case "critical":
      return "bg-destructive/15 text-destructive border-destructive/30";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRODUCT OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
interface ProductRow {
  id: string;
  title_sv: string;
  price: number;
  cost_price: number | null;
  stock: number | null;
  status: string | null;
  is_visible: boolean | null;
  views: number;
  sales: number;
  cart_adds: number;
}

function ProductOverview() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data: products } = await (supabase as any)
      .from("products")
      .select("id, title_sv, price, cost_price, stock, status, is_visible")
      .order("created_at", { ascending: false })
      .limit(500);

    const { data: stats } = await (supabase as any)
      .from("product_stats")
      .select("product_id, views, sales, cart_adds");

    const statsMap = new Map<string, { views: number; sales: number; cart_adds: number }>();
    (stats ?? []).forEach((s: any) =>
      statsMap.set(s.product_id, { views: s.views ?? 0, sales: s.sales ?? 0, cart_adds: s.cart_adds ?? 0 })
    );

    setRows(
      (products ?? []).map((p: any) => ({
        ...p,
        ...(statsMap.get(p.id) ?? { views: 0, sales: 0, cart_adds: 0 }),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && (r.status ?? "active") !== statusFilter) return false;
      if (search && !r.title_sv?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök produkt..." className="pl-8 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla statusar</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="draft">Utkast</SelectItem>
            <SelectItem value="archived">Arkiverad</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} className="h-9">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Uppdatera
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produkt</TableHead>
              <TableHead className="text-right">Pris</TableHead>
              <TableHead className="text-right">Kostnad</TableHead>
              <TableHead className="text-right">Lager</TableHead>
              <TableHead className="text-right">Visningar</TableHead>
              <TableHead className="text-right">Köp</TableHead>
              <TableHead className="text-right">I varukorg</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">Inga produkter</TableCell></TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title_sv}</TableCell>
                  <TableCell className="text-right">{fmtCurrency(r.price)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.cost_price != null ? fmtCurrency(r.cost_price) : "—"}</TableCell>
                  <TableCell className="text-right">{r.stock ?? 0}</TableCell>
                  <TableCell className="text-right">{r.views}</TableCell>
                  <TableCell className="text-right">{r.sales}</TableCell>
                  <TableCell className="text-right">{r.cart_adds}</TableCell>
                  <TableCell><Badge variant="outline" className={statusColor(r.status ?? "active")}>{r.status ?? "active"}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Visar {filtered.length} av {rows.length} produkter.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EVENT LOGS
// ─────────────────────────────────────────────────────────────────────────────
interface EventRow {
  id: string;
  event_type: string;
  severity: string;
  source: string;
  product_id: string | null;
  emitted_at: string;
  payload: any;
}

function EventLogs() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("ecommerce_events")
      .select("id, event_type, severity, source, product_id, emitted_at, payload")
      .order("emitted_at", { ascending: false })
      .limit(300);
    setRows((data ?? []) as EventRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.event_type))).sort(), [rows]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (typeFilter === "all" || r.event_type === typeFilter) &&
          (severityFilter === "all" || r.severity === severityFilter)
      ),
    [rows, typeFilter, severityFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla händelser</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla nivåer</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} className="h-9">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Uppdatera
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tid</TableHead>
              <TableHead>Händelse</TableHead>
              <TableHead>Nivå</TableHead>
              <TableHead>Källa</TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead>Payload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Inga händelser</TableCell></TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{fmtDate(r.emitted_at)}</TableCell>
                  <TableCell className="font-medium">{r.event_type}</TableCell>
                  <TableCell><Badge variant="outline" className={statusColor(r.severity)}>{r.severity}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
                  <TableCell className="text-xs font-mono">{r.product_id?.slice(0, 8) ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{JSON.stringify(r.payload ?? {})}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Visar {filtered.length} av {rows.length} händelser (senaste 300).</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RULE TRIGGERS — campaign activations from events
// ─────────────────────────────────────────────────────────────────────────────
interface RuleTriggerRow {
  id: string;
  campaign_id: string;
  campaign_name: string;
  action: string;
  reason: string;
  triggered_by_event_id: string | null;
  created_at: string;
}

function RuleTriggers() {
  const [rows, setRows] = useState<RuleTriggerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: activations } = await (supabase as any)
      .from("campaign_activations")
      .select("id, campaign_id, action, reason, triggered_by_event_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    const ids = Array.from(new Set((activations ?? []).map((a: any) => a.campaign_id)));
    const { data: campaigns } = ids.length
      ? await (supabase as any).from("campaigns").select("id, name").in("id", ids)
      : { data: [] };
    const nameMap = new Map((campaigns ?? []).map((c: any) => [c.id, c.name]));

    setRows(
      (activations ?? []).map((a: any) => ({
        ...a,
        campaign_name: nameMap.get(a.campaign_id) ?? "—",
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} className="h-9">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Uppdatera
        </Button>
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tid</TableHead>
              <TableHead>Kampanj</TableHead>
              <TableHead>Åtgärd</TableHead>
              <TableHead>Anledning</TableHead>
              <TableHead>Händelse</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Inga regelaktiveringar</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                  <TableCell className="font-medium">{r.campaign_name}</TableCell>
                  <TableCell><Badge variant="outline" className={statusColor(r.action)}>{r.action}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.reason}</TableCell>
                  <TableCell className="text-xs font-mono">{r.triggered_by_event_id?.slice(0, 8) ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PRICING CHANGES
// ─────────────────────────────────────────────────────────────────────────────
interface PriceChangeRow {
  id: string;
  product_id: string;
  product_title: string;
  old_price: number | null;
  new_price: number | null;
  old_cost: number | null;
  new_cost: number | null;
  source: string;
  created_at: string;
}

function PricingChanges() {
  const [rows, setRows] = useState<PriceChangeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data: history } = await (supabase as any)
      .from("price_history")
      .select("id, product_id, old_price, new_price, old_cost, new_cost, source, created_at")
      .order("created_at", { ascending: false })
      .limit(300);

    const ids = Array.from(new Set((history ?? []).map((h: any) => h.product_id)));
    const { data: products } = ids.length
      ? await (supabase as any).from("products").select("id, title_sv").in("id", ids)
      : { data: [] };
    const nameMap = new Map((products ?? []).map((p: any) => [p.id, p.title_sv]));

    setRows(
      (history ?? []).map((h: any) => ({ ...h, product_title: nameMap.get(h.product_id) ?? "—" }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sources = useMemo(() => Array.from(new Set(rows.map((r) => r.source))).sort(), [rows]);
  const filtered = useMemo(
    () => rows.filter((r) => sourceFilter === "all" || r.source === sourceFilter),
    [rows, sourceFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla källor</SelectItem>
            {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} className="h-9">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Uppdatera
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tid</TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead className="text-right">Gammalt pris</TableHead>
              <TableHead className="text-right">Nytt pris</TableHead>
              <TableHead className="text-right">Δ</TableHead>
              <TableHead>Källa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Inga prisändringar</TableCell></TableRow>
            ) : (
              filtered.map((r) => {
                const delta = (r.new_price ?? 0) - (r.old_price ?? 0);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                    <TableCell className="font-medium">{r.product_title}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.old_price != null ? fmtCurrency(r.old_price) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{r.new_price != null ? fmtCurrency(r.new_price) : "—"}</TableCell>
                    <TableCell className={`text-right text-sm font-mono ${delta < 0 ? "text-destructive" : delta > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {delta > 0 ? "+" : ""}{fmtCurrency(delta)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. AFFILIATE PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────
interface AffiliateRow {
  id: string;
  name: string;
  code: string;
  commission_percent: number;
  is_active: boolean;
  total_orders: number;
  total_sales: number;
  total_earnings: number;
  pending_earnings: number;
  paid_earnings: number;
  clicks: number;
  conversions: number;
}

function AffiliatePerformance() {
  const [rows, setRows] = useState<AffiliateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: affiliates } = await (supabase as any)
      .from("affiliates")
      .select("id, name, code, commission_percent, is_active, total_orders, total_sales, total_earnings, pending_earnings, paid_earnings")
      .order("total_earnings", { ascending: false })
      .limit(200);

    const ids = (affiliates ?? []).map((a: any) => a.id);
    const { data: clicks } = ids.length
      ? await (supabase as any).from("affiliate_clicks").select("affiliate_id, converted_order_id").in("affiliate_id", ids)
      : { data: [] };

    const clickMap = new Map<string, { clicks: number; conversions: number }>();
    (clicks ?? []).forEach((c: any) => {
      const cur = clickMap.get(c.affiliate_id) ?? { clicks: 0, conversions: 0 };
      cur.clicks += 1;
      if (c.converted_order_id) cur.conversions += 1;
      clickMap.set(c.affiliate_id, cur);
    });

    setRows(
      (affiliates ?? []).map((a: any) => ({
        ...a,
        ...(clickMap.get(a.id) ?? { clicks: 0, conversions: 0 }),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          !search ||
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.code.toLowerCase().includes(search.toLowerCase())
      ),
    [rows, search]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök affiliate..." className="pl-8 h-9" />
        </div>
        <Button variant="outline" size="sm" onClick={load} className="h-9">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Uppdatera
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Affiliate</TableHead>
              <TableHead>Kod</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Klick</TableHead>
              <TableHead className="text-right">Konv.</TableHead>
              <TableHead className="text-right">Conv. rate</TableHead>
              <TableHead className="text-right">Ordrar</TableHead>
              <TableHead className="text-right">Försäljning</TableHead>
              <TableHead className="text-right">Provision</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">Inga affiliates</TableCell></TableRow>
            ) : (
              filtered.map((r) => {
                const rate = r.clicks > 0 ? (r.conversions / r.clicks) * 100 : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="text-right">{r.commission_percent}%</TableCell>
                    <TableCell className="text-right">{r.clicks}</TableCell>
                    <TableCell className="text-right">{r.conversions}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{rate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{r.total_orders}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(r.total_sales)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtCurrency(r.total_earnings)}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor(r.is_active ? "active" : "ended")}>{r.is_active ? "Aktiv" : "Inaktiv"}</Badge></TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CAMPAIGN STATUS
// ─────────────────────────────────────────────────────────────────────────────
interface CampaignRow {
  id: string;
  name: string;
  campaign_type: string;
  status: string;
  priority: number;
  start_at: string;
  end_at: string;
  discount_pct: number;
  trigger_event_type: string | null;
}

function CampaignStatus() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("campaigns")
      .select("id, name, campaign_type, status, priority, start_at, end_at, discount_pct, trigger_event_type")
      .order("start_at", { ascending: false })
      .limit(200);
    setRows((data ?? []) as CampaignRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => rows.filter((r) => statusFilter === "all" || r.status === statusFilter),
    [rows, statusFilter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla statusar</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="scheduled">Schemalagd</SelectItem>
            <SelectItem value="draft">Utkast</SelectItem>
            <SelectItem value="paused">Pausad</SelectItem>
            <SelectItem value="ended">Avslutad</SelectItem>
            <SelectItem value="cancelled">Avbruten</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} className="h-9">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Uppdatera
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kampanj</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Rabatt</TableHead>
              <TableHead className="text-right">Prio</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Slut</TableHead>
              <TableHead>Trigger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">Inga kampanjer</TableCell></TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.campaign_type}</TableCell>
                  <TableCell><Badge variant="outline" className={statusColor(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">{(r.discount_pct * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-right">{r.priority}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.start_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.end_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.trigger_event_type ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "products", label: "Produkter", icon: Package, component: ProductOverview },
  { id: "events", label: "Händelser", icon: Activity, component: EventLogs },
  { id: "rules", label: "Regelutfall", icon: Zap, component: RuleTriggers },
  { id: "pricing", label: "Prisändringar", icon: TrendingDown, component: PricingChanges },
  { id: "affiliates", label: "Affiliates", icon: Users, component: AffiliatePerformance },
  { id: "campaigns", label: "Kampanjer", icon: Megaphone, component: CampaignStatus },
] as const;

export default function AdminControl() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kontrollpanel</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Skrivskyddad översikt — alla data direkt från databasen, inga AI-insikter.
        </p>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="w-full justify-start overflow-x-auto">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="gap-1.5">
              <s.icon className="w-3.5 h-3.5" />
              <span>{s.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {SECTIONS.map((s) => (
          <TabsContent key={s.id} value={s.id} className="mt-6">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <s.icon className="w-4 h-4 text-primary" />
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <s.component />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
