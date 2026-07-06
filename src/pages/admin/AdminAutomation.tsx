import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { toast } from "sonner";

export default function AdminAutomation() {
  const { hasAccess: isStaff, isLoading } = useStaffAccess();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);

  const load = async () => {
    const [w, r] = await Promise.all([
      supabase.from("automation_workflows").select("*").order("created_at", { ascending: false }),
      supabase.from("workflow_runs").select("*").order("started_at", { ascending: false }).limit(30),
    ]);
    setWorkflows(w.data ?? []);
    setRuns(r.data ?? []);
  };
  useEffect(() => { if (isStaff) load(); }, [isStaff]);

  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("automation_workflows").update({ is_active: !active }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  if (isLoading) return <div className="p-8">Laddar…</div>;
  if (!isStaff) return <div className="p-8">Endast personal.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Helmet><title>Automation – Admin</title><meta name="description" content="Arbetsflöden och autonomi-nivåer." /></Helmet>
      <div><h1 className="text-3xl font-bold tracking-tight">Automation</h1><p className="text-muted-foreground">Nivå 1–3 autonomi. Nivå 4 kräver aktivering av founder.</p></div>

      <Card>
        <CardHeader><CardTitle>Arbetsflöden ({workflows.length})</CardTitle></CardHeader>
        <CardContent>
          {workflows.length === 0 ? <p className="text-sm text-muted-foreground">Inga arbetsflöden ännu. Skapa via API/backend.</p> : (
            <ul className="divide-y">
              {workflows.map(w => (
                <li key={w.id} className="py-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-muted-foreground">Trigger: {w.trigger_type} · Autonomi nivå {w.autonomy_level}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {w.requires_approval && <Badge variant="secondary">Kräver godkännande</Badge>}
                    <Switch checked={w.is_active} onCheckedChange={() => toggle(w.id, w.is_active)} disabled={w.autonomy_level >= 4} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Senaste körningar</CardTitle></CardHeader>
        <CardContent>
          {runs.length === 0 ? <p className="text-sm text-muted-foreground">Inga körningar ännu.</p> : (
            <ul className="divide-y">
              {runs.map(r => (
                <li key={r.id} className="py-2 flex justify-between text-sm">
                  <span className="font-mono text-xs">{r.id.slice(0, 8)}</span>
                  <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>{r.status}</Badge>
                  <span className="text-muted-foreground">{new Date(r.started_at).toLocaleString("sv-SE")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
