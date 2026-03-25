import { useState, useEffect } from 'react';
import AdminActivityLog from '@/components/admin/AdminActivityLog';
import AdminBugReports from '@/components/admin/AdminBugReports';
import AdminObservabilityLog from '@/components/admin/AdminObservabilityLog';
import DeepDebugPanel from '@/components/admin/DeepDebugPanel';
import ActionVerificationPanel from '@/components/admin/ActionVerificationPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Shield, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Access Audit Log Tab ──
const AccessAuditLogTab = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('access_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setLogs(data || []);
    } catch (e) {
      console.error('Failed to load audit log:', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const actions = [...new Set(logs.map(l => l.action))];

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.actor_email?.toLowerCase().includes(search.toLowerCase()) ||
      l.target_email?.toLowerCase().includes(search.toLowerCase()) ||
      l.detail?.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'all' || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  const actionColor = (action: string) => {
    if (action.includes('deactivat')) return 'destructive';
    if (action.includes('removed') || action.includes('remove')) return 'destructive';
    if (action.includes('assign') || action.includes('reactivat')) return 'default';
    if (action.includes('fixed') || action.includes('reset')) return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4" /> Åtkomstrevision
          </h3>
          <p className="text-xs text-muted-foreground">Fullständig spårbarhet för alla roll- och behörighetsändringar</p>
        </div>
        <Button onClick={load} disabled={loading} size="sm" variant="outline" className="gap-1">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Uppdatera
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input placeholder="Sök email/detalj..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs pl-7 w-52" />
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant={actionFilter === 'all' ? 'default' : 'ghost'} className="h-6 text-[9px] px-1.5"
            onClick={() => setActionFilter('all')}>
            Alla ({logs.length})
          </Button>
          {actions.map(a => (
            <Button key={a} size="sm" variant={actionFilter === a ? 'default' : 'ghost'} className="h-6 text-[9px] px-1.5"
              onClick={() => setActionFilter(a)}>
              {a} ({logs.filter(l => l.action === a).length})
            </Button>
          ))}
        </div>
      </div>

      {/* Log entries */}
      <Card>
        <CardContent className="py-2">
          <ScrollArea className="max-h-[500px]">
            {filtered.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground text-center py-8">Inga loggposter hittade</p>
            )}
            <div className="space-y-1">
              {filtered.map(log => (
                <div key={log.id} className="text-xs border rounded p-2.5 space-y-1 bg-muted/10">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge variant={actionColor(log.action)} className="text-[8px] shrink-0">{log.action}</Badge>
                      <span className="font-medium truncate">{log.detail || 'Ingen detalj'}</span>
                    </div>
                    <span className="text-muted-foreground text-[9px] shrink-0">
                      {new Date(log.created_at).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>Utförare: <span className="text-foreground">{log.actor_email || 'system'}</span></span>
                    {log.target_email && <span>Mål: <span className="text-foreground">{log.target_email}</span></span>}
                    <span className="text-[9px]">Källa: {log.source}</span>
                  </div>
                  {(log.role_before || log.role_after) && (
                    <div className="flex items-center gap-2">
                      {log.role_before?.length > 0 && (
                        <span className="text-muted-foreground">Före: {log.role_before.join(', ')}</span>
                      )}
                      {log.role_after?.length > 0 && (
                        <span>→ Efter: <span className="font-medium">{log.role_after.join(', ')}</span></span>
                      )}
                    </div>
                  )}
                  {log.permission_changes && (
                    <pre className="text-[9px] bg-muted/30 rounded p-1 overflow-x-auto">{JSON.stringify(log.permission_changes, null, 2)}</pre>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

const AdminLogs = () => {
  return (
    <div className="flex h-full min-h-0 flex-col space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Logg & Säkerhet</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Full spårbarhet — alla händelser, inloggningar, orderändringar och säkerhetshändelser
        </p>
      </div>
      <Tabs defaultValue="activity" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="activity">Aktivitetslogg</TabsTrigger>
          <TabsTrigger value="access-audit">Åtkomstrevision</TabsTrigger>
          <TabsTrigger value="observability">Observability</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="deep-debug">Deep Debug</TabsTrigger>
          <TabsTrigger value="bugs">Buggrapporter</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto">
          <AdminActivityLog />
        </TabsContent>
        <TabsContent value="access-audit" className="min-h-0 flex-1 overflow-y-auto">
          <AccessAuditLogTab />
        </TabsContent>
        <TabsContent value="observability" className="min-h-0 flex-1 overflow-y-auto">
          <AdminObservabilityLog />
        </TabsContent>
        <TabsContent value="verification" className="min-h-0 flex-1 overflow-y-auto">
          <ActionVerificationPanel />
        </TabsContent>
        <TabsContent value="deep-debug" className="min-h-0 flex-1 overflow-y-auto">
          <DeepDebugPanel />
        </TabsContent>
        <TabsContent value="bugs" className="min-h-0 flex-1 overflow-y-auto">
          <AdminBugReports />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminLogs;
