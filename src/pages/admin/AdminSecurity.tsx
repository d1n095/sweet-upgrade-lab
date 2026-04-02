import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeInvoke } from '@/lib/safeInvoke';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, ShieldCheck, ShieldAlert, Lock, Users, Eye, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminSecurity() {
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    const [auditRes, logRes, rolesRes] = await Promise.all([
      supabase.from('access_audit_log').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('activity_logs').select('*').eq('category', 'security').order('created_at', { ascending: false }).limit(50),
      supabase.from('user_roles').select('*').order('user_id'),
    ]);
    setAuditLog(auditRes.data || []);
    setSecurityLogs(logRes.data || []);
    setUserRoles(rolesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const runAccessScan = async () => {
    setLoading(true);
    try {
      const { data, error } = await safeInvoke('access-control-scan', {
        isAdmin: true,
        body: { action: 'scan' },
      });
      if (error) throw error;
      setScanResult(data);
      toast.success('Säkerhetsskanning klar');
    } catch (e: any) {
      toast.error('Skanningsfel: ' + (e.message || 'Okänt'));
    }
    setLoading(false);
  };

  const runFlowValidation = async () => {
    setLoading(true);
    try {
      const { data, error } = await safeInvoke('access-flow-validate', {
        isAdmin: true,
        body: { action: 'validate' },
      });
      if (error) throw error;
      setScanResult(data);
      toast.success('Flödesvalidering klar');
    } catch (e: any) {
      toast.error('Valideringsfel: ' + (e.message || 'Okänt'));
    }
    setLoading(false);
  };

  // Count roles
  const roleCounts: Record<string, number> = {};
  userRoles.forEach(r => { roleCounts[r.role] = (roleCounts[r.role] || 0) + 1; });
  const uniqueUsers = new Set(userRoles.map(r => r.user_id)).size;

  return (
    <div className="flex flex-col min-h-0 h-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          Säkerhetscenter
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Åtkomstkontroll, säkerhetsloggar och rollhantering
        </p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Användare med roller</p>
                <p className="text-lg font-bold">{uniqueUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Aktiva roller</p>
                <p className="text-lg font-bold">{Object.keys(roleCounts).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Audit-händelser</p>
                <p className="text-lg font-bold">{auditLog.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Säkerhetshändelser</p>
                <p className="text-lg font-bold">{securityLogs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={runAccessScan} disabled={loading}>
          <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
          Kör åtkomstkontroll
        </Button>
        <Button size="sm" variant="outline" onClick={runFlowValidation} disabled={loading}>
          <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
          Validera åtkomstflöden
        </Button>
        <Button size="sm" variant="ghost" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Uppdatera
        </Button>
      </div>

      {/* Scan result */}
      {scanResult && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Skanningsresultat</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <pre className="bg-muted rounded p-2 overflow-auto max-h-60 text-[10px]">
              {JSON.stringify(scanResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="roles" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="roles">Roller ({userRoles.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit-logg ({auditLog.length})</TabsTrigger>
          <TabsTrigger value="security-events">Säkerhetshändelser ({securityLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="flex-1 min-h-0 overflow-auto">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Rollfördelning</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap mb-4">
                {Object.entries(roleCounts).map(([role, count]) => (
                  <Badge key={role} variant="secondary" className="text-xs">
                    {role}: {count}
                  </Badge>
                ))}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Användar-ID</TableHead>
                    <TableHead className="text-xs">Roll</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRoles.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-mono">{r.user_id?.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{r.role}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="flex-1 min-h-0 overflow-auto">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tid</TableHead>
                    <TableHead className="text-xs">Handling</TableHead>
                    <TableHead className="text-xs">Aktör</TableHead>
                    <TableHead className="text-xs">Mål</TableHead>
                    <TableHead className="text-xs">Detalj</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), 'MM-dd HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{log.actor_email || log.user_id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{log.target_email || '—'}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{log.detail || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {auditLog.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">Inga audit-händelser</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security-events" className="flex-1 min-h-0 overflow-auto">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tid</TableHead>
                    <TableHead className="text-xs">Typ</TableHead>
                    <TableHead className="text-xs">Meddelande</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {securityLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), 'MM-dd HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.log_type === 'error' ? 'destructive' : 'outline'} className="text-[10px]">
                          {log.log_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate">{log.message}</TableCell>
                    </TableRow>
                  ))}
                  {securityLogs.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">Inga säkerhetshändelser</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
