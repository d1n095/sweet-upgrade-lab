import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import PremiumPageShell, { SectionCard, StatCard } from "@/components/premium/PremiumPageShell";

export default function AdminAutomation() {
  const { hasAccess: isStaff, isLoading } = useStaffAccess();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);

  const load = async () => {
    const [w, r] = await Promise.all([
      supabase.from("automation_workflows").select("*").order("created_at", { ascending: false }),
      supabase.from("workflow_runs").select("*").order("started_at", { ascending: false }).limit(30),
    ]);
    setWorkflows(w.data ?? []); setRuns(r.data ?? []);
  };
  useEffect(() => { if (isStaff) load(); }, [isStaff]);

  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("automation_workflows").update({ is_active: !active }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  if (isLoading) return <PremiumPageShell title="Automation"><div>Laddar…</div></PremiumPageShell>;
  if (!isStaff) return <PremiumPageShell title="Automation"><div className="premium-card">Endast personal.</div></PremiumPageShell>;

  const active = workflows.filter(w => w.is_active).length;

  return (
    <PremiumPageShell
      eyebrow="Sprint 05 · Del 13+14"
      title="Automation"
      description="Arbetsflöden med nivå 1–3 autonomi. Nivå 4 kräver founder-frisläppning."
      breadcrumbs={[{ to: "/admin", label: "Admin" }, { to: "/admin/business-os", label: "Business OS" }, { label: "Automation" }]}
    >
      <div className="grid gap-3 grid-cols-3 mb-8">
        <StatCard label="Arbetsflöden" value={workflows.length} />
        <StatCard label="Aktiva" value={active} tone="gold" />
        <StatCard label="Körningar (30d)" value={runs.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Arbetsflöden" className="lg:col-span-2">
          {workflows.length === 0 ? <p className="text-sm text-muted-foreground">Inga arbetsflöden ännu.</p> : (
            <ul className="divide-y divide-border">
              {workflows.map((w: any) => (
                <li key={w.id} className="py-4 flex justify-between items-center gap-4">
                  <div className="min-w-0">
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Trigger: <span className="font-mono">{w.trigger_type}</span> · Autonomi nivå {w.autonomy_level}</div>
                  </div>
                  <div className="flex gap-2 items-center shrink-0">
                    {w.requires_approval && <Badge variant="secondary">Godkännande</Badge>}
                    <Switch checked={w.is_active} onCheckedChange={() => toggle(w.id, w.is_active)} disabled={w.autonomy_level >= 4} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Senaste körningar">
          {runs.length === 0 ? <p className="text-sm text-muted-foreground">Inga körningar ännu.</p> : (
            <ul className="space-y-2">
              {runs.map((r: any) => (
                <li key={r.id} className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-secondary/40">
                  <span className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}</span>
                  <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"} className={r.status === "completed" ? "bg-success text-success-foreground" : ""}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </PremiumPageShell>
  );
}
