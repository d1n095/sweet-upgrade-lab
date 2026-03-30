import { useState } from 'react';
import { Loader2, CheckCircle, XCircle, Shield, Wrench, Radar, ShieldCheck, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const AccessControlTab = () => {
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const [autoFixing, setAutoFixing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [flowResult, setFlowResult] = useState<any>(null);
  const [flowFilter, setFlowFilter] = useState<string>('all');

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Ej inloggad'); return null; }
    return session;
  };

  const runScan = async () => {
    setLoading(true);
    const session = await getSession();
    if (!session) { setLoading(false); return; }
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/access-control-scan`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: '{}' }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Scan failed');
      setResult(data);
      toast.success(`Skanning klar: ${data.issues?.length || 0} problem hittade`);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const callFix = async (body: Record<string, any>) => {
    const session = await getSession();
    if (!session) return null;
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/permission-fix`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) }
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Fix failed');
    return data;
  };

  const fixIssue = async (issue: any, idx: number) => {
    const key = `${idx}`;
    setFixing(key);
    try {
      let body: Record<string, any> | null = null;
      switch (issue.type) {
        case 'duplicate_role':
          body = { action: 'fix_duplicate_role', user_id: issue.user_id };
          break;
        case 'insecure_access': {
          const m = issue.detail?.match(/"([^"]+)".*"([^"]+)"/);
          if (m) body = { action: 'fix_insecure_delete', role: m[1], module: m[2] };
          break;
        }
        case 'over_permissioned':
          if (issue.detail?.includes('finance') && issue.detail?.includes('warehouse')) {
            body = { action: 'fix_role_conflict', user_id: issue.user_id, role: 'warehouse' };
          } else {
            body = { action: 'fix_over_permissioned', user_id: issue.user_id };
          }
          break;
        case 'orphan_role':
          body = { action: 'fix_orphan_role', role: issue.role };
          break;
        default:
          toast.info('Kräver manuell granskning');
          setFixing(null);
          return;
      }
      if (body) {
        const res = await callFix(body);
        if (res?.success) {
          toast.success(`Åtgärdat: ${res.results?.[0]?.detail || 'OK'}`);
          await runScan(); // Re-scan to update
        }
      }
    } catch (e: any) { toast.error(e.message); }
    setFixing(null);
  };

  const autoFixAll = async () => {
    if (!result?.issues?.length) return;
    setAutoFixing(true);
    try {
      const fixableTypes = ['duplicate_role', 'insecure_access', 'orphan_role'];
      const fixable = result.issues.filter((i: any) => fixableTypes.includes(i.type));
      if (fixable.length === 0) {
        toast.info('Inga automatiskt åtgärdbara problem');
        setAutoFixing(false);
        return;
      }
      const res = await callFix({ action: 'auto_fix_all', issues: fixable });
      if (res?.success) {
        const fixed = res.results?.filter((r: any) => r.success).length || 0;
        toast.success(`Auto-fix klar: ${fixed} problem åtgärdade`);
        await runScan();
      }
    } catch (e: any) { toast.error(e.message); }
    setAutoFixing(false);
  };

  const isFixable = (type: string) => ['duplicate_role', 'insecure_access', 'over_permissioned', 'orphan_role'].includes(type);

  const riskColor = (risk: string) => {
    if (risk === 'critical') return 'text-red-600 bg-red-500/10 border-red-500/30';
    if (risk === 'high') return 'text-orange-600 bg-orange-500/10 border-orange-500/30';
    if (risk === 'medium') return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30';
    return 'text-muted-foreground bg-muted/50 border-border';
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      over_permissioned: '⚠️ Överprivilegierad',
      under_permissioned: '📉 Underprivilegierad',
      orphan_role: '👻 Oanvänd roll',
      broken_access: '🔴 Bruten åtkomst',
      insecure_access: '🔓 Osäker åtkomst',
      no_role: '❓ Saknar roll',
      duplicate_role: '📋 Duplicerad roll',
      stale_access: '⏰ Inaktiv admin',
    };
    return map[type] || type;
  };

  const fixableCount = result?.issues?.filter((i: any) => isFixable(i.type)).length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2"><Shield className="w-4 h-4" /> Åtkomstkontroll</h3>
          <p className="text-xs text-muted-foreground">Skanna och åtgärda behörighetsproblem automatiskt</p>
        </div>
        <div className="flex gap-2">
          {fixableCount > 0 && (
            <Button onClick={autoFixAll} disabled={autoFixing} size="sm" variant="destructive" className="gap-1">
              {autoFixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
              {autoFixing ? 'Fixar...' : `Auto-fix (${fixableCount})`}
            </Button>
          )}
          <Button onClick={runScan} disabled={loading} size="sm" className="gap-1">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />}
            {loading ? 'Skannar...' : 'Kör skanning'}
          </Button>
        </div>
      </div>

      {result && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Användare', value: result.summary?.total_users, icon: '👥' },
              { label: 'Med roller', value: result.summary?.users_with_roles, icon: '🔑' },
              { label: 'Roller', value: result.summary?.total_roles, icon: '🏷️' },
              { label: 'Problem', value: result.summary?.issues_found, icon: result.summary?.critical_issues > 0 ? '🔴' : '✅' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="py-3 px-3">
                  <p className="text-[10px] text-muted-foreground">{s.icon} {s.label}</p>
                  <p className="text-lg font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Risk breakdown */}
          {result.summary?.issues_found > 0 && (
            <div className="flex gap-2 flex-wrap">
              {result.summary.critical_issues > 0 && <Badge variant="destructive" className="text-[10px]">🔴 {result.summary.critical_issues} kritiska</Badge>}
              {result.summary.high_issues > 0 && <Badge variant="destructive" className="text-[10px] bg-orange-500">🟠 {result.summary.high_issues} höga</Badge>}
              {result.summary.medium_issues > 0 && <Badge variant="secondary" className="text-[10px]">🟡 {result.summary.medium_issues} medel</Badge>}
              {result.summary.low_issues > 0 && <Badge variant="outline" className="text-[10px]">⚪ {result.summary.low_issues} låga</Badge>}
            </div>
          )}

          {/* Role overview */}
          {result.roles?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs">Rollöversikt</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {result.roles.map((r: any) => (
                    <div key={r.role} className="text-xs border rounded-md p-2 bg-muted/30">
                      <p className="font-medium">{r.role}</p>
                      <p className="text-muted-foreground">{r.user_count} användare · {r.modules.length} moduler</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Issues list */}
          {result.issues?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs">Hittade problem ({result.issues.length})</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {result.issues.map((issue: any, idx: number) => (
                      <div key={idx} className={cn('text-xs border rounded-md p-3 space-y-1', riskColor(issue.risk))}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{typeLabel(issue.type)}</span>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[8px]">{issue.risk}</Badge>
                            {isFixable(issue.type) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5 px-2 text-[9px] gap-1"
                                disabled={fixing === `${idx}`}
                                onClick={() => fixIssue(issue, idx)}
                              >
                                {fixing === `${idx}` ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Wrench className="w-2.5 h-2.5" />}
                                Åtgärda
                              </Button>
                            )}
                          </div>
                        </div>
                        <p>{issue.detail}</p>
                        {issue.username && <p className="text-muted-foreground">Användare: {issue.username} {issue.user_email ? `(${issue.user_email})` : ''}</p>}
                        {issue.role && !issue.username && <p className="text-muted-foreground">Roll: {issue.role}</p>}
                        <p className="text-muted-foreground italic">💡 {issue.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {result.issues?.length === 0 && (
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <p className="text-xs font-medium">Inga problem hittade — åtkomstsystemet ser bra ut!</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Access Flow Validation ── */}
      <Separator className="my-4" />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Flödesvalidering</h3>
          <p className="text-xs text-muted-foreground">Testa att roller har korrekt åtkomst till rutter, API, UI och RLS</p>
        </div>
        <Button onClick={async () => {
          setValidating(true);
          const session = await getSession();
          if (!session) { setValidating(false); return; }
          try {
            const resp = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/access-flow-validate`,
              { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: '{}' }
            );
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Validation failed');
            setFlowResult(data);
            toast.success(`Validering klar: ${data.summary?.passed}/${data.summary?.total_tests} godkända`);
          } catch (e: any) { toast.error(e.message); }
          setValidating(false);
        }} disabled={validating} size="sm" variant="outline" className="gap-1">
          {validating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {validating ? 'Validerar...' : 'Kör validering'}
        </Button>
      </div>

      {flowResult && (
        <>
          {/* Score bar */}
          <div className="flex items-center gap-3">
            <div className={cn('text-2xl font-bold', flowResult.summary?.failed === 0 ? 'text-green-600' : flowResult.summary?.critical_failures > 0 ? 'text-red-600' : 'text-yellow-600')}>
              {Math.round((flowResult.summary?.passed / flowResult.summary?.total_tests) * 100)}%
            </div>
            <div className="flex-1">
              <Progress value={(flowResult.summary?.passed / flowResult.summary?.total_tests) * 100} className="h-2" />
            </div>
            <div className="text-xs text-muted-foreground">
              {flowResult.summary?.passed}/{flowResult.summary?.total_tests} godkända
            </div>
          </div>

          {/* Category breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(flowResult.summary?.by_category || {}).map(([cat, counts]: [string, any]) => (
              <Card key={cat}>
                <CardContent className="py-2 px-3">
                  <p className="text-[10px] text-muted-foreground uppercase">{cat === 'route' ? '🛤️ Rutter' : cat === 'api' ? '🔌 API' : cat === 'ui' ? '👁️ UI' : '🔒 RLS'}</p>
                  <p className="text-sm font-medium">
                    <span className="text-green-600">{counts.passed}✓</span>
                    {counts.failed > 0 && <span className="text-red-600 ml-1">{counts.failed}✗</span>}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {['all', 'failures', 'route', 'api', 'ui', 'rls'].map(f => (
              <Button key={f} size="sm" variant={flowFilter === f ? 'default' : 'ghost'} className="h-6 text-[10px] px-2" onClick={() => setFlowFilter(f)}>
                {f === 'all' ? 'Alla' : f === 'failures' ? `Misslyckade (${flowResult.summary?.failed})` : f.toUpperCase()}
              </Button>
            ))}
          </div>

          {/* Test results */}
          <Card>
            <CardContent className="py-3">
              <ScrollArea className="max-h-[350px]">
                <div className="space-y-1.5">
                  {(flowResult.tests || [])
                    .filter((t: any) => {
                      if (flowFilter === 'all') return true;
                      if (flowFilter === 'failures') return !t.passed;
                      return t.category === flowFilter;
                    })
                    .map((test: any, idx: number) => (
                    <div key={idx} className={cn('text-xs border rounded p-2 flex items-start gap-2', test.passed ? 'border-border bg-muted/20' : 'border-red-500/30 bg-red-500/5')}>
                      <span className="mt-0.5">{test.passed ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[8px] px-1 py-0">{test.category}</Badge>
                          <span className="font-medium">{test.role}</span>
                          <span className="text-muted-foreground">→ {test.target}</span>
                        </div>
                        <p className="text-muted-foreground mt-0.5">{test.detail}</p>
                      </div>
                      {!test.passed && <Badge variant="destructive" className="text-[8px] shrink-0">{test.risk}</Badge>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

