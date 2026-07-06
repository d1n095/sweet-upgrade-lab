import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Trash2, ShieldAlert } from "lucide-react";
import PremiumPageShell, { SectionCard } from "@/components/premium/PremiumPageShell";

export default function AdminGDPR() {
  const { hasAccess: isStaff, isLoading } = useStaffAccess();
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);

  const runExport = async () => {
    if (!userId) return; setBusy(true);
    const { data, error } = await supabase.functions.invoke("gdpr-export-user", { body: { user_id: userId } });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `gdpr-export-${userId}.json`; a.click(); URL.revokeObjectURL(url);
      toast.success("Export klar");
    }
  };

  const runDelete = async () => {
    if (!userId) return;
    if (!confirm(`Radera all data för ${userId}? Ej ångerbart.`)) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("gdpr-delete-user", { body: { user_id: userId } });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Data raderad");
  };

  if (isLoading) return <PremiumPageShell title="GDPR"><div>Laddar…</div></PremiumPageShell>;
  if (!isStaff) return <PremiumPageShell title="GDPR"><div className="premium-card">Endast personal.</div></PremiumPageShell>;

  return (
    <PremiumPageShell
      eyebrow="Sprint 06 · Del 16"
      title="GDPR"
      description="Registerutdrag och rätten att bli glömd."
      breadcrumbs={[{ to: "/admin", label: "Admin" }, { to: "/admin/business-os", label: "Business OS" }, { label: "GDPR" }]}
    >
      <div className="max-w-2xl mx-auto space-y-4">
        <SectionCard title="Användar-ID" subtitle="Ange UUID för användaren.">
          <div className="space-y-4">
            <Input placeholder="00000000-0000-0000-0000-000000000000" value={userId} onChange={e => setUserId(e.target.value)} className="font-mono" />
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={runExport} disabled={busy || !userId} variant="outline">
                <Download className="w-4 h-4 mr-2" /> Exportera
              </Button>
              <Button variant="destructive" onClick={runDelete} disabled={busy || !userId}>
                <Trash2 className="w-4 h-4 mr-2" /> Radera
              </Button>
            </div>
          </div>
        </SectionCard>

        <div className="premium-card border-warning/30 bg-warning/5">
          <div className="flex gap-3">
            <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-foreground mb-1">Radering är permanent</div>
              <p className="text-muted-foreground">Ordrar anonymiseras (behålls för bokföring); allt annat personligt raderas kaskad. Endast founder får radera.</p>
            </div>
          </div>
        </div>
      </div>
    </PremiumPageShell>
  );
}
