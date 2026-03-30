import { useState, useEffect } from 'react';
import { Sparkles, Bug, BarChart3, Copy, Loader2, Send, AlertTriangle, CheckCircle, XCircle, Shield, Clock, TrendingUp, Wrench, Radar, ArrowRight, Layers, Eye, ArrowRightLeft, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logChange } from '@/utils/changeLogger';
import { createAndVerify } from '@/utils/createVerifyLoop';
import { trace, newTraceId } from '@/utils/deepDebugTrace';
import { copyToClipboard, applyFix, useDetailContext } from './_shared';

export const SystemScanTab = () => {
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<any>(null);
  const [dismissingIssue, setDismissingIssue] = useState<number | null>(null);
  const [dismissNote, setDismissNote] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);
  const { openDetail } = useDetailContext();
  const queryClient = useQueryClient();

  // Load dismissed issues
  const { data: dismissals, refetch: refetchDismissals } = useQuery({
    queryKey: ['scan-dismissals'],
    queryFn: async () => {
      const { data } = await supabase.from('scan_dismissals' as any).select('*').eq('scan_type', 'system_scan');
      return (data || []) as any[];
    },
  });

  const isDismissed = (issue: any) => {
    const key = (issue.title || '').toLowerCase().trim();
    return dismissals?.some(d => d.issue_key === key);
  };

  const handleDismiss = async (issue: any, index: number) => {
    const key = (issue.title || '').toLowerCase().trim();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('scan_dismissals' as any).upsert({
      issue_key: key,
      issue_title: issue.title,
      reason: dismissNote || 'Ignorerad utan kommentar',
      dismissed_by: session.user.id,
      scan_type: 'system_scan',
      dismissed_severity: issue.severity || 'unknown',
      escalation_note: null,
      escalated_at: null,
    } as any, { onConflict: 'issue_key,scan_type' });
    setDismissingIssue(null);
    setDismissNote('');
    refetchDismissals();
    toast.success('Issue ignorerad');
  };

  const handleUndismiss = async (issueKey: string) => {
    await supabase.from('scan_dismissals' as any).delete().eq('issue_key', issueKey).eq('scan_type', 'system_scan');
    refetchDismissals();
    toast.success('Issue återaktiverad');
  };

  const handleCreateWorkItem = async (issue: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const createTraceId = newTraceId('scan-wi');
    trace('issue_detected', 'AdminAI', `Creating WI from scan issue: ${issue.title}`, { traceId: createTraceId, details: { severity: issue.severity, category: issue.category } });
    trace('db_insert_sent', 'AdminAI', 'Sending INSERT via createAndVerify', { traceId: createTraceId });

    const result = await createAndVerify({
      table: 'work_items',
      payload: {
        title: `[Scan] ${issue.title}`,
        description: `${issue.description}\n\nFix-förslag: ${issue.fix_suggestion || 'Ingen'}\n\nSeverity: ${issue.severity}\nCategory: ${issue.category}`,
        priority: issue.severity === 'critical' ? 'critical' : issue.severity === 'high' ? 'high' : 'medium',
        status: 'open',
        item_type: 'bug',
        source_type: 'scan',
        ai_detected: true,
        source_id: currentScanId || lastScan?.id || null,
        created_by: session.user.id,
      },
      selectColumns: 'id, title, status, priority, item_type, ai_detected, ai_category, ai_type_classification, ai_confidence, execution_order, depends_on, blocks, conflict_flag, duplicate_of, created_at, ai_type_reason',
      traceContext: { component: 'AdminAI', scanId: currentScanId || lastScan?.id || undefined },
    });

    if (!result.success) {
      trace('db_insert_failed', 'AdminAI', `CREATE-VERIFY FAILED: ${result.error}`, { traceId: createTraceId, details: { attempts: result.attempts } });
      console.error('[AdminAI] CREATE-VERIFY FAILED:', result.error);
      toast.error(`Kunde inte skapa ärende: ${result.error}`);
      return;
    }

    const newItem = result.data as any;
    const wiId = newItem?.id || null;
    trace('db_verify_confirmed', 'AdminAI', `Work item verified: ${wiId}`, { traceId: createTraceId, entityId: wiId });
    console.log('[AdminAI] CREATED & VERIFIED:', newItem);
    logChange({ change_type: 'task_created', description: `Work item skapat från scan: ${issue.title}`, source: 'ai', affected_components: ['work_items', 'scan'], scan_id: currentScanId || lastScan?.id || null, work_item_id: wiId });

    // Remove issue from detected list and add to master list
    setScanResult((prev: any) => {
      if (!prev) return prev;
      const updatedIssues = (prev.issues || []).filter((i: any) => i.title !== issue.title);

      // Add the new work item into master list
      const masterList = prev.master_list || { must_do: [], next_up: [], optional: [], total: 0 };
      const prio = issue.severity === 'critical' ? 'critical' : issue.severity === 'high' ? 'high' : 'medium';
      const target = prio === 'critical' ? 'must_do' : prio === 'high' ? 'next_up' : 'optional';

      return {
        ...prev,
        issues: updatedIssues,
        issues_found: updatedIssues.length,
        master_list: {
          ...masterList,
          [target]: [...(masterList[target] || []), newItem || { id: wiId, title: `[Scan] ${issue.title}`, priority: prio, status: 'open' }],
          total: (masterList.total || 0) + 1,
        },
      };
    });

    // Force refetch work items from DB
    queryClient.invalidateQueries({ queryKey: ['work-items'] });
    queryClient.invalidateQueries({ queryKey: ['admin-work-items'] });
    queryClient.invalidateQueries({ queryKey: ['scan-work-items'] });

    setExpandedIssue(null);
    toast.success('Ärende skapat och flyttat till Master Task List');
  };

  // Load last scan on mount
  const { data: lastScan } = useQuery({
    queryKey: ['last-scan-result'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_scan_results' as any)
        .select('*')
        .eq('scan_type', 'system_scan')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  // Load scan history
  const { data: scanHistory = [] } = useQuery({
    queryKey: ['scan-history'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_scan_results' as any)
        .select('id, scan_type, overall_score, overall_status, executive_summary, issues_count, tasks_created, created_at')
        .eq('scan_type', 'system_scan')
        .order('created_at', { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
  });

  // Load work items created from scans to hydrate master list from DB
  const { data: scanWorkItems = [] } = useQuery({
    queryKey: ['scan-work-items', lastScan?.id],
    queryFn: async () => {
      if (!lastScan?.id) return [];
      const { data } = await supabase
        .from('work_items' as any)
        .select('id, title, status, priority, item_type, ai_detected, ai_category, ai_type_classification, ai_confidence, execution_order, depends_on, blocks, conflict_flag, duplicate_of, created_at, ai_type_reason, source_type, source_id')
        .or(`source_id.eq.${lastScan.id},source_type.eq.scan`)
        .in('status', ['open', 'claimed', 'in_progress', 'escalated', 'new', 'pending', 'detected'])
        .order('created_at', { ascending: false })
        .limit(200);
      return (data || []) as any[];
    },
    enabled: !!lastScan?.id,
  });

  // Set last scan as current if no active result — hydrate master_list from DB work items
  useEffect(() => {
    if (!scanResult && lastScan?.results) {
      const results = { ...lastScan.results };

      // Hydrate master_list from actual DB work items (not stale scan JSON)
      if (scanWorkItems.length > 0) {
        const must_do = scanWorkItems.filter((wi: any) => wi.priority === 'critical');
        const next_up = scanWorkItems.filter((wi: any) => wi.priority === 'high');
        const optional = scanWorkItems.filter((wi: any) => !['critical', 'high'].includes(wi.priority));
        results.master_list = {
          must_do,
          next_up,
          optional,
          total: scanWorkItems.length,
        };
        console.log('[MasterList] Hydrated from DB:', scanWorkItems.length, 'items');
      }

      setScanResult(results);
    }
  }, [lastScan, scanResult, scanWorkItems]);

  const runScan = async () => {
    setLoading(true);
    console.log('[SCAN TRIGGERED FROM]: AI_CENTER');
    try {
      // All scans go through run-full-scan — no ai-assistant calls
      const { data, error } = await supabase.functions.invoke('run-full-scan', {
        body: { action: 'start', scan_mode: 'full', source: 'AI_CENTER' },
      });
      if (error) throw error;
      const scanRunId = data?.scan_id || data?.scan_run_id;
      console.log('[SCAN TRIGGERED FROM]: AI_CENTER — scan_run_id:', scanRunId);
      toast.success('Skanning startad via run-full-scan');
      queryClient.invalidateQueries({ queryKey: ['last-scan-result'] });
      queryClient.invalidateQueries({ queryKey: ['scan-history'] });
    } catch (err: any) {
      toast.error(err?.message || 'Kunde inte starta skanning');
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryScan = async (id: string) => {
    const { data } = await supabase.from('ai_scan_results' as any).select('*').eq('id', id).maybeSingle();
    if (data) {
      if (compareId === id) {
        setCompareData((data as any).results);
      } else {
        setScanResult((data as any).results);
        setShowHistory(false);
      }
    }
  };

  const typeIcon = (t: string) => {
    if (t === 'bug') return <Bug className="w-3.5 h-3.5 text-destructive" />;
    if (t === 'improvement') return <TrendingUp className="w-3.5 h-3.5 text-blue-600" />;
    if (t === 'feature') return <Sparkles className="w-3.5 h-3.5 text-purple-600" />;
    if (t === 'upgrade') return <Shield className="w-3.5 h-3.5 text-orange-600" />;
    return <Wrench className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const urgencyStyle = (u: string) => {
    if (u === 'now') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (u === 'today') return 'bg-orange-50 text-orange-700 border-orange-200';
    if (u === 'this_week') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-muted text-muted-foreground border-border';
  };

  const urgencyLabel = (u: string) => {
    if (u === 'now') return '🔴 NU';
    if (u === 'today') return '🟠 Idag';
    if (u === 'this_week') return '🔵 Denna vecka';
    return '⚪ Backlog';
  };

  const renderTaskGroup = (title: string, items: any[], color: string) => {
    if (!items?.length) return null;
    return (
      <div className="space-y-2">
        <h4 className={cn('text-xs font-bold flex items-center gap-1.5', color)}>
          <Layers className="w-3.5 h-3.5" /> {title} ({items.length})
        </h4>
        <div className="space-y-1.5">
          {items.map((task: any, i: number) => (
            <div
              key={task.id || i}
              className={cn(
                "border rounded-lg p-2.5 flex items-start gap-2 transition-colors",
                task.id && "cursor-pointer hover:bg-muted/40"
              )}
              onClick={() => task.id && openDetail(task.id)}
            >
              <span className="text-[10px] font-mono text-muted-foreground mt-0.5 w-5 shrink-0">#{task.execution_order || '—'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium line-clamp-1">{task.title}</p>
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  <Badge variant={task.priority === 'critical' || task.priority === 'high' ? 'destructive' : 'secondary'} className="text-[8px]">{task.priority}</Badge>
                  {task.ai_type_classification && <Badge variant="outline" className="text-[8px]">{task.ai_type_classification}</Badge>}
                  {task.ai_category && <span className="text-[8px] bg-muted px-1 py-0.5 rounded">{task.ai_category}</span>}
                  {task.conflict_flag && <span className="text-[8px] text-destructive">⚠️ konflikt</span>}
                  {task.duplicate_of && <span className="text-[8px] text-muted-foreground">📎 dubblett</span>}
                </div>
              </div>
              {task.id && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderScoreComparison = () => {
    if (!compareData || !scanResult) return null;
    const diff = (scanResult.system_score || 0) - (compareData.system_score || 0);
    return (
      <div className="border rounded-xl p-4 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4" /> Jämförelse
          </h4>
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setCompareId(null); setCompareData(null); }}>
            Stäng
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">Nuvarande</p>
            <p className={cn('text-2xl font-bold', (scanResult.system_score || 0) >= 70 ? 'text-green-700' : (scanResult.system_score || 0) >= 40 ? 'text-yellow-700' : 'text-destructive')}>
              {scanResult.system_score || 0}
            </p>
          </div>
          <div className="flex items-center justify-center">
            <span className={cn('text-sm font-bold', diff > 0 ? 'text-green-700' : diff < 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {diff > 0 ? `+${diff}` : diff}
            </span>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Tidigare</p>
            <p className={cn('text-2xl font-bold', (compareData.system_score || 0) >= 70 ? 'text-green-700' : (compareData.system_score || 0) >= 40 ? 'text-yellow-700' : 'text-destructive')}>
              {compareData.system_score || 0}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="border rounded p-2">
            <p className="text-muted-foreground text-[10px]">Issues nu</p>
            <p className="font-bold">{scanResult.issues_found || 0}</p>
          </div>
          <div className="border rounded p-2">
            <p className="text-muted-foreground text-[10px]">Issues förr</p>
            <p className="font-bold">{compareData.issues_found || 0}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-4 bg-card space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Radar className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">Full Systemskanning</h3>
            <p className="text-[10px] text-muted-foreground">Skannar → Detekterar → Skapar uppgifter → Prioriterar → Ordnar</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1 text-xs shrink-0" onClick={() => setShowHistory(!showHistory)}>
            <Clock className="w-3.5 h-3.5" />
            Historik ({scanHistory.length})
          </Button>
        </div>
        <Button onClick={runScan} disabled={loading} className="w-full gap-2" size="lg">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          {loading ? 'Skannar hela systemet...' : 'Kör full systemskanning'}
        </Button>
        {loading && (
          <p className="text-[10px] text-center text-muted-foreground animate-pulse">
            AI analyserar alla datakällor, skapar uppgifter och prioriterar...
          </p>
        )}
        {lastScan?.created_at && !loading && (
          <p className="text-[10px] text-muted-foreground text-center">
            Senaste skanning: {new Date(lastScan.created_at).toLocaleString('sv-SE')}
          </p>
        )}
      </div>

      {/* Scan History Panel */}
      {showHistory && (
        <div className="border rounded-xl p-4 bg-card space-y-3">
          <h4 className="text-xs font-bold flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Skanningshistorik
          </h4>
          {scanHistory.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Ingen historik ännu</p>
          )}
          <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
              {scanHistory.map((scan: any) => (
                <div
                  key={scan.id}
                  className={cn(
                    "border rounded-lg p-2.5 flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition-colors",
                    compareId === scan.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => loadHistoryScan(scan.id)}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border shrink-0',
                    (scan.overall_score || 0) >= 70 ? 'border-green-400 text-green-700 bg-green-50' :
                    (scan.overall_score || 0) >= 40 ? 'border-yellow-400 text-yellow-700 bg-yellow-50' :
                    'border-red-400 text-destructive bg-red-50'
                  )}>
                    {scan.overall_score || '—'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{scan.executive_summary || 'Systemskanning'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(scan.created_at).toLocaleString('sv-SE')} · {scan.issues_count} issues · {scan.tasks_created} uppgifter
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[9px] shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompareId(scan.id);
                      loadHistoryScan(scan.id);
                    }}
                  >
                    Jämför
                  </Button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Score Comparison */}
      {renderScoreComparison()}

      {/* Trend Analysis */}
      <TrendAnalysisPanel />

      {scanResult && (
        <div className="space-y-4">
          {/* Score + Summary */}
          <div className={cn('border rounded-xl p-4 flex items-center gap-4',
            scanResult.system_score >= 70 ? 'border-green-300 bg-green-50/50' :
            scanResult.system_score >= 40 ? 'border-yellow-300 bg-yellow-50/50' :
            'border-red-300 bg-red-50/50'
          )}>
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-2',
              scanResult.system_score >= 70 ? 'border-green-500 text-green-700' :
              scanResult.system_score >= 40 ? 'border-yellow-500 text-yellow-700' :
              'border-red-500 text-red-700'
            )}>
              {scanResult.system_score}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold">Systemhälsa</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{scanResult.executive_summary}</p>
              <div className="flex gap-2 mt-2 text-[10px] flex-wrap">
                <span>⏱ {Math.round(scanResult.scan_duration_ms / 1000)}s</span>
                <span>🔍 {scanResult.issues_found} issues</span>
                {scanResult.dismissed_count > 0 && <span>🚫 {scanResult.dismissed_count} ignorerade</span>}
                {scanResult.escalated_dismissed?.length > 0 && <span className="text-destructive font-bold">⚠️ {scanResult.escalated_dismissed.length} eskalerade (var ignorerade)</span>}
                <span>✅ {scanResult.tasks_created} skapade</span>
                <span>📎 {scanResult.tasks_skipped_duplicate} dubbletter</span>
              </div>
            </div>
          </div>

          {/* Risk areas */}
          {scanResult.risk_areas?.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {scanResult.risk_areas.map((r: string, i: number) => (
                <Badge key={i} variant="destructive" className="text-[9px]">{r}</Badge>
              ))}
            </div>
          )}

          {/* Stats grid */}
          {scanResult.task_manager && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { key: 'prioritized', label: 'Prioriterade', icon: BarChart3 },
                { key: 'assigned', label: 'Tilldelade', icon: Send },
                { key: 'detected', label: 'Detekterade', icon: Shield },
                { key: 'orchestrated', label: 'Orkestrerade', icon: Layers },
                { key: 'resolved', label: 'Lösta', icon: CheckCircle },
              ].map(s => (
                <Card key={s.key} className="border-border">
                  <CardContent className="py-2 px-3 flex items-center gap-2">
                    <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-bold leading-none">{scanResult.task_manager[s.key] || 0}</p>
                      <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* AI-detected issues */}
          {scanResult.issues?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Radar className="w-3.5 h-3.5" /> Detekterade issues ({scanResult.issues.filter((i: any) => !isDismissed(i)).length})
                  {dismissals && dismissals.length > 0 && (
                    <Badge variant="outline" className="text-[8px] ml-1">{dismissals.length} ignorerade</Badge>
                  )}
                </h4>
                {dismissals && dismissals.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setShowDismissed(!showDismissed)}>
                    <Eye className="w-3 h-3" />
                    {showDismissed ? 'Dölj ignorerade' : 'Visa ignorerade'}
                  </Button>
                )}
              </div>

              {/* Dismissed issues */}
              {showDismissed && dismissals && dismissals.length > 0 && (
                <div className="space-y-1 border rounded-lg p-2 bg-muted/20">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Ignorerade issues</p>
                  {dismissals.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-xs line-through text-muted-foreground truncate">{d.issue_title}</p>
                        <p className="text-[10px] text-muted-foreground/60">{d.reason}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] shrink-0" onClick={() => handleUndismiss(d.issue_key)}>
                        Återaktivera
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
                  {scanResult.issues.filter((i: any) => !isDismissed(i)).map((issue: any, i: number) => (
                    <div key={`${issue.title}-${i}`} className="border rounded-lg p-2.5 space-y-1.5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedIssue(expandedIssue === i ? null : i)}>
                      <div className="flex items-start gap-2">
                        {typeIcon(issue.type)}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">{issue.title}</p>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full border', urgencyStyle(issue.urgency))}>
                              {urgencyLabel(issue.urgency)}
                            </span>
                            <Badge variant={issue.severity === 'critical' || issue.severity === 'high' ? 'destructive' : 'secondary'} className="text-[8px]">{issue.severity}</Badge>
                            <Badge variant="outline" className="text-[8px]">{issue.category}</Badge>
                            {issue._escalated_from_dismissed && (
                              <Badge variant="destructive" className="text-[8px] animate-pulse">⚠️ Eskalerad (var {issue._previous_severity})</Badge>
                            )}
                          </div>
                        </div>
                        <ArrowRight className={cn('w-3 h-3 text-muted-foreground transition-transform shrink-0', expandedIssue === i && 'rotate-90')} />
                      </div>
                      {expandedIssue === i && (
                        <div className="pt-2 border-t space-y-2 text-xs" onClick={(e) => e.stopPropagation()}>
                          <p className="text-muted-foreground">{issue.description}</p>
                          <div>
                             <div className="flex items-center justify-between">
                              <span className="font-medium text-muted-foreground">🔧 Fix-förslag:</span>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-6 text-[10px] gap-1"
                                  id={`apply-fix-${i}`}
                                  onClick={() => {
                                    const fixText = issue.lovable_prompt || issue.fix_suggestion || '';
                                    applyFix(fixText, issue.title, {
                                      category: issue.category,
                                      severity: issue.severity,
                                      buttonId: `apply-fix-${i}`,
                                    });
                                  }}
                                >
                                  ⚡ Apply Fix
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] gap-1"
                                  id={`copy-fix-${i}`}
                                  onClick={() => {
                                    const fixText = issue.lovable_prompt || issue.fix_suggestion || '';
                                    copyToClipboard(fixText, `copy-fix-${i}`);
                                  }}
                                >
                                  📋 Copy Fix
                                </Button>
                              </div>
                            </div>
                            <p className="mt-1">{issue.fix_suggestion}</p>
                          </div>
                          {issue.lovable_prompt && (
                            <div className="bg-muted/50 rounded-md p-2 font-mono text-[10px] whitespace-pre-wrap max-h-32 overflow-y-auto border">{issue.lovable_prompt}</div>
                          )}

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px] gap-1"
                              onClick={() => handleCreateWorkItem(issue)}
                            >
                              <AlertTriangle className="w-3 h-3" /> Skapa ärende
                            </Button>

                            {dismissingIssue === i ? (
                              <div className="flex items-center gap-1.5 flex-1">
                                <input
                                  type="text"
                                  value={dismissNote}
                                  onChange={(e) => setDismissNote(e.target.value)}
                                  placeholder="Varför ignorera?"
                                  className="flex-1 h-7 px-2 text-xs rounded border border-border bg-background"
                                  autoFocus
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleDismiss(issue, i); if (e.key === 'Escape') { setDismissingIssue(null); setDismissNote(''); } }}
                                />
                                <Button size="sm" variant="secondary" className="h-7 text-[10px]" onClick={() => handleDismiss(issue, i)}>
                                  OK
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setDismissingIssue(null); setDismissNote(''); }}>
                                  <XCircle className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px] gap-1 text-muted-foreground"
                                onClick={() => setDismissingIssue(i)}
                              >
                                <XCircle className="w-3 h-3" /> Ignorera
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                ))}
              </div>
            </div>
          )}

          {/* Master Task List */}
          {scanResult.master_list && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> Master Task List ({scanResult.master_list.total})
              </h4>
              {renderTaskGroup('🔴 MÅSTE GÖRAS NU', scanResult.master_list.must_do, 'text-destructive')}
              {renderTaskGroup('🟡 NÄSTA', scanResult.master_list.next_up, 'text-yellow-700')}
              {renderTaskGroup('🟢 VALFRITT', scanResult.master_list.optional, 'text-muted-foreground')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
// ── AI Action Engine Tab ──
