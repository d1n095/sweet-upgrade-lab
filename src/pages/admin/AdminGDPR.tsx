import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { toast } from "sonner";

export default function AdminGDPR() {
  const { hasAccess: isStaff, isLoading } = useStaffAccess();
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);

  const runExport = async () => {
    if (!userId) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gdpr-export-user", { body: { user_id: userId } });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `gdpr-export-${userId}.json`; a.click();
      URL.revokeObjectURL(url);
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

  if (isLoading) return <div className="p-8">Laddar…</div>;
  if (!isStaff) return <div className="p-8">Endast personal.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Helmet><title>GDPR – Admin</title><meta name="description" content="Export och radering av användardata." /></Helmet>
      <div><h1 className="text-3xl font-bold tracking-tight">GDPR</h1><p className="text-muted-foreground">Registerutdrag och rätten att bli glömd.</p></div>

      <Card>
        <CardHeader><CardTitle>Användar-ID</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="UUID" value={userId} onChange={e => setUserId(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={runExport} disabled={busy || !userId}>Exportera</Button>
            <Button variant="destructive" onClick={runDelete} disabled={busy || !userId}>Radera</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
