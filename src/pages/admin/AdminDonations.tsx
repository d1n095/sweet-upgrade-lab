import { useEffect, useState } from 'react';
import AdminDonationManager from '@/components/admin/AdminDonationManager';
import { useFounderRole } from '@/hooks/useFounderRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Shield, Download, ShieldAlert, FileText } from 'lucide-react';
import { toast } from 'sonner';

const AdminDonations = () => {
  const { user, loading: authLoading } = useAuth();
  const { isFounder, isLoading: roleLoading } = useFounderRole();
  const [isFinance, setIsFinance] = useState(false);
  const [checking, setChecking] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [retaining, setRetaining] = useState(false);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'finance')
      .then(({ data }) => {
        setIsFinance(!!data && data.length > 0);
        setChecking(false);
      });
  }, [user]);

  const hasAccess = isFounder || isFinance;

  if (authLoading || roleLoading || checking) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" /> Åtkomst nekad
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Donationshanteringen är låst till rollerna <strong>founder</strong> och
            <strong> finance</strong>. Detta är ett juridiskt krav för
            transparens och insynsskydd enligt GDPR och Bokföringslagen.
          </p>
          <p>Kontakta en founder om du behöver åtkomst.</p>
        </CardContent>
      </Card>
    );
  }

  const exportBookkeeping = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('id, created_at, amount, source, purpose, is_anonymous, project_id, order_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const header = 'id,created_at,amount,source,purpose,is_anonymous,project_id,order_id\n';
      const rows = (data || [])
        .map((r) =>
          [r.id, r.created_at, r.amount, r.source, r.purpose, r.is_anonymous, r.project_id ?? '', r.order_id ?? '']
            .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
            .join(','),
        )
        .join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `donations-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Bokföringsexport klar');
    } catch (e: any) {
      toast.error('Export misslyckades: ' + (e.message || 'okänt fel'));
    } finally {
      setExporting(false);
    }
  };

  const runRetention = async () => {
    if (!isFounder) {
      toast.error('Endast founder kan köra retention');
      return;
    }
    if (!confirm('Anonymisera donationer äldre än 7 år? Detta går inte att ångra.')) return;
    setRetaining(true);
    try {
      const { data, error } = await supabase.rpc('anonymise_old_donations');
      if (error) throw error;
      toast.success(`${data ?? 0} donationer anonymiserade`);
    } catch (e: any) {
      toast.error('Retention misslyckades: ' + (e.message || 'okänt fel'));
    } finally {
      setRetaining(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="w-6 h-6 text-success" /> Donationer
          </h1>
          <p className="text-sm text-muted-foreground">
            Insamlingshantering, bokföringsexport och GDPR-rutin. Låst till founder/finance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportBookkeeping} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? 'Exporterar…' : 'Bokföring (CSV)'}
          </Button>
          {isFounder && (
            <Button size="sm" variant="outline" onClick={runRetention} disabled={retaining}>
              <FileText className="w-4 h-4 mr-1.5" />
              {retaining ? 'Kör…' : 'Anonymisera >7 år'}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="manage">
        <TabsList>
          <TabsTrigger value="manage">Projekt & donationer</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>
        <TabsContent value="manage" className="mt-4">
          <AdminDonationManager />
        </TabsContent>
        <TabsContent value="compliance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regelefterlevnad — checklista</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>✅ Round-up är opt-in (ej förkryssad) — Konsumentverket / EU DSA.</p>
              <p>✅ Disclosure-text visas vid kassan — Marknadsföringslagen §10.</p>
              <p>✅ Anonyma donationer raderar user_id automatiskt — GDPR art. 5.</p>
              <p>✅ <code>current_amount</code> beräknas automatiskt — inget manuellt fusk möjligt.</p>
              <p>✅ Alla projektändringar loggas i activity_logs.</p>
              <p>✅ Bokföringsexport tillgänglig — Bokföringslagen §5 (7 års arkivering).</p>
              <p>⚠️ Om ni vill marknadsföra som välgörenhet — ansök om 90-konto hos Svensk Insamlingskontroll innan ni ändrar texten i kassan.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDonations;
