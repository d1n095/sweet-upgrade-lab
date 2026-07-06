import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, TrendingDown } from "lucide-react";
import PremiumPageShell, { StatCard, SectionCard } from "@/components/premium/PremiumPageShell";

export default function AdminMissionControl() {
  const { hasAccess: isStaff, isLoading } = useStaffAccess();
  const [insights, setInsights] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  const load = async () => {
    const [i, a, an] = await Promise.all([
      supabase.from("insights").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("recommended_actions").select("*").eq("status", "pending").order("priority").limit(50),
      supabase.from("anomaly_events").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(50),
    ]);
    setInsights(i.data ?? []); setActions(a.data ?? []); setAnomalies(an.data ?? []);
  };
  useEffect(() => { if (isStaff) load(); }, [isStaff]);

  const ack = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("insights").update({ status: "acknowledged", acknowledged_by: user?.id, acknowledged_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  if (isLoading) return <PremiumPageShell title="Mission Control"><div>Laddar…</div></PremiumPageShell>;
  if (!isStaff) return <PremiumPageShell title="Mission Control"><div className="premium-card">Endast personal.</div></PremiumPageShell>;

  return (
    <PremiumPageShell
      eyebrow="Sprint 04 · Del 11+12"
      title="Mission Control"
      description="Vad hände · Varför · Vad göra · Vad inte göra."
      breadcrumbs={[{ to: "/admin", label: "Admin" }, { to: "/admin/business-os", label: "Business OS" }, { label: "Mission Control" }]}
    >
      <div className="grid gap-3 grid-cols-3 mb-8">
        <StatCard label="Insikter" value={insights.length} hint="totalt" />
        <StatCard label="Öppna åtgärder" value={actions.length} tone="gold" />
        <StatCard label="Aktiva avvikelser" value={anomalies.length} tone={anomalies.length > 0 ? "warning" : "success"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Insikter" subtitle="Automatgenererade observationer">
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {insights.length === 0 ? <p className="text-sm text-muted-foreground">Inga insikter ännu.</p> :
              insights.map((i: any) => (
                <div key={i.id} className="p-4 rounded-xl border border-border bg-secondary/30 hover:border-gold/40 transition">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="font-medium text-sm">{i.title}</div>
                    <Badge variant={i.severity === "critical" ? "destructive" : i.severity === "warning" ? "outline" : "secondary"}>{i.severity}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{i.summary}</p>
                  {i.status === "new" && <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs" onClick={() => ack(i.id)}><CheckCircle2 className="w-3 h-3 mr-1" /> Bekräfta</Button>}
                </div>
              ))
            }
          </div>
        </SectionCard>

        <SectionCard title="Rekommenderade åtgärder">
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {actions.length === 0 ? <p className="text-sm text-muted-foreground">Inga öppna åtgärder.</p> :
              actions.map((a: any) => (
                <div key={a.id} className="p-4 rounded-xl border border-border bg-secondary/30">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{a.title}</div>
                      {a.description && <div className="text-xs text-muted-foreground mt-1">{a.description}</div>}
                    </div>
                    <span className="chip-gold text-[10px]">P{a.priority}</span>
                  </div>
                </div>
              ))
            }
          </div>
        </SectionCard>

        <SectionCard title="Avvikelser">
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {anomalies.length === 0 ? <p className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Inga aktiva avvikelser.</p> :
              anomalies.map((a: any) => (
                <div key={a.id} className="p-4 rounded-xl border border-border bg-secondary/30">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4 text-warning" /></div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{a.event_type} · {a.metric_key}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <TrendingDown className="w-3 h-3" /> Förväntat <span className="tabular-nums">{a.expected}</span> · Faktisk <span className="tabular-nums">{a.actual}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </SectionCard>
      </div>
    </PremiumPageShell>
  );
}
