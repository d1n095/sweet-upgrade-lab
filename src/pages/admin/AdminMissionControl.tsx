import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { toast } from "sonner";

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
    setInsights(i.data ?? []);
    setActions(a.data ?? []);
    setAnomalies(an.data ?? []);
  };

  useEffect(() => { if (isStaff) load(); }, [isStaff]);

  const ack = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("insights").update({ status: "acknowledged", acknowledged_by: user?.id, acknowledged_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  if (isLoading) return <div className="p-8">Laddar…</div>;
  if (!isStaff) return <div className="p-8">Endast personal.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Helmet><title>Mission Control – Business OS</title><meta name="description" content="Vad hände, varför, och vad du bör göra." /></Helmet>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mission Control</h1>
        <p className="text-muted-foreground mt-1">Vad hände · Varför · Vad göra · Vad inte göra.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Insikter ({insights.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
            {insights.length === 0 ? <p className="text-sm text-muted-foreground">Inga insikter ännu.</p> :
              insights.map(i => (
                <div key={i.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-medium text-sm">{i.title}</div>
                      <div className="text-xs text-muted-foreground">{i.summary}</div>
                    </div>
                    <Badge variant={i.severity === "critical" ? "destructive" : "secondary"}>{i.severity}</Badge>
                  </div>
                  {i.status === "new" && <Button size="sm" variant="outline" className="mt-2" onClick={() => ack(i.id)}>Bekräfta</Button>}
                </div>
              ))
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rekommenderade åtgärder ({actions.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {actions.length === 0 ? <p className="text-sm text-muted-foreground">Inga öppna åtgärder.</p> :
              actions.map(a => (
                <div key={a.id} className="p-3 border rounded-lg">
                  <div className="font-medium text-sm">{a.title}</div>
                  {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                  <Badge variant="outline" className="mt-2">Prio {a.priority}</Badge>
                </div>
              ))
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Avvikelser ({anomalies.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {anomalies.length === 0 ? <p className="text-sm text-muted-foreground">Inga aktiva avvikelser.</p> :
              anomalies.map(a => (
                <div key={a.id} className="p-3 border rounded-lg">
                  <div className="font-medium text-sm">{a.event_type} · {a.metric_key}</div>
                  <div className="text-xs text-muted-foreground">Förväntat {a.expected} · Faktisk {a.actual}</div>
                  <Badge variant={a.severity === "high" ? "destructive" : "secondary"}>{a.severity}</Badge>
                </div>
              ))
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
