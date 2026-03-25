import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Activity, AlertTriangle, CheckCircle, XCircle, Loader2,
  Link2, Unlink, ChevronDown, ChevronUp, Play, Trash2,
  ArrowRight, Database, FileSearch, Bug, ClipboardList, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FlowLink {
  from: string;
  fromId: string;
  to: string;
  toId: string | null;
  status: 'ok' | 'broken' | 'missing';
  detail: string;
}

interface FlowTrace {
  id: string;
  origin: string;
  originId: string;
  links: FlowLink[];
  status: 'intact' | 'broken' | 'partial';
  summary: string;
  checkedAt: string;
}

type ValidatorStatus = 'idle' | 'running' | 'done';

const STEPS = [
  { key: 'scans', label: 'Skanningar', icon: FileSearch },
  { key: 'bugs', label: 'Buggar', icon: Bug },
  { key: 'work_items', label: 'Work Items', icon: ClipboardList },
  { key: 'change_log', label: 'Ändringslogg', icon: Database },
  { key: 'verification', label: 'Verifiering', icon: ShieldCheck },
];

const TraceCard = ({ trace }: { trace: FlowTrace }) => {
  const [expanded, setExpanded] = useState(false);
  const broken = trace.links.filter(l => l.status !== 'ok').length;
  const ok = trace.links.filter(l => l.status === 'ok').length;

  return (
    <div className={cn(
      'border rounded-lg p-3 space-y-1',
      trace.status === 'intact' ? 'border-green-500/30 bg-green-500/5' :
      trace.status === 'broken' ? 'border-destructive/30 bg-destructive/5' :
      'border-orange-500/30 bg-orange-500/5'
    )}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {trace.status === 'intact' ? (
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            ) : trace.status === 'broken' ? (
              <XCircle className="w-4 h-4 text-destructive shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
            )}
            <span className="text-sm font-medium truncate">{trace.summary}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {broken > 0 && (
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                <Unlink className="w-2.5 h-2.5 mr-0.5" />{broken}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
              <Link2 className="w-2.5 h-2.5 mr-0.5" />{ok}
            </Badge>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="pt-2 border-t border-border/50 mt-1 space-y-1.5">
          <p className="text-[10px] text-muted-foreground">
            Start: {trace.origin} ({trace.originId.slice(0, 8)}…)
          </p>
          {trace.links.map((link, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {link.status === 'ok' ? (
                <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-3 h-3 text-destructive shrink-0" />
              )}
              <span className="text-muted-foreground">{link.from}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className={cn('font-medium', link.status === 'ok' ? 'text-foreground' : 'text-destructive')}>
                {link.to}
              </span>
              {link.status !== 'ok' && (
                <span className="text-destructive/80 text-[11px]">— {link.detail}</span>
              )}
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground/60">{new Date(trace.checkedAt).toLocaleString('sv-SE')}</p>
        </div>
      )}
    </div>
  );
};

const DataFlowValidator = () => {
  const [status, setStatus] = useState<ValidatorStatus>('idle');
  const [traces, setTraces] = useState<FlowTrace[]>([]);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, intact: 0, broken: 0, partial: 0 });

  const runValidation = async () => {
    setStatus('running');
    setTraces([]);
    setProgress(0);
    const allTraces: FlowTrace[] = [];
    const now = new Date().toISOString();

    try {
      // ─── 1. SCAN → WORK ITEMS (scans that should have created tasks) ───
      setProgress(10);
      const { data: scans } = await supabase
        .from('ai_scan_results')
        .select('id, scan_type, issues_count, tasks_created, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      for (const scan of scans || []) {
        const links: FlowLink[] = [];

        if ((scan.tasks_created || 0) > 0) {
          // Check if work items reference this scan
          const { data: linkedItems } = await supabase
            .from('work_items' as any)
            .select('id')
            .eq('source_type', 'scan')
            .eq('source_id', scan.id)
            .limit(1);

          const { data: linkedChanges } = await supabase
            .from('change_log')
            .select('id')
            .eq('scan_id', scan.id)
            .limit(1);

          links.push({
            from: 'scan', fromId: scan.id,
            to: 'work_items', toId: linkedItems?.[0]?.id || null,
            status: linkedItems?.length ? 'ok' : 'broken',
            detail: linkedItems?.length ? 'Koppling hittad' : `${scan.tasks_created} uppgifter skapades men ingen work_item refererar scan`,
          });

          links.push({
            from: 'scan', fromId: scan.id,
            to: 'change_log', toId: linkedChanges?.[0]?.id || null,
            status: linkedChanges?.length ? 'ok' : 'missing',
            detail: linkedChanges?.length ? 'Loggpost finns' : 'Ingen change_log-post för denna skanning',
          });
        }

        if (links.length > 0) {
          const broken = links.some(l => l.status === 'broken');
          const missing = links.some(l => l.status === 'missing');
          allTraces.push({
            id: scan.id, origin: 'scan', originId: scan.id,
            links,
            status: broken ? 'broken' : missing ? 'partial' : 'intact',
            summary: `Scan ${scan.scan_type} (${scan.id.slice(0, 8)}) → ${links.length} kopplingar`,
            checkedAt: now,
          });
        }
      }

      // ─── 2. BUG → WORK ITEM → CHANGE LOG → VERIFICATION ───
      setProgress(30);
      const { data: bugs } = await supabase
        .from('bug_reports')
        .select('id, description, status, resolved_by_change_id')
        .order('created_at', { ascending: false })
        .limit(100);

      for (const bug of bugs || []) {
        const links: FlowLink[] = [];

        // Bug → Work Item
        const { data: wiLinks } = await supabase
          .from('work_items' as any)
          .select('id, status, ai_review_status')
          .eq('source_type', 'bug_report')
          .eq('source_id', bug.id)
          .limit(5);

        const hasWorkItem = wiLinks && wiLinks.length > 0;
        links.push({
          from: 'bug_report', fromId: bug.id,
          to: 'work_items', toId: hasWorkItem ? wiLinks[0].id : null,
          status: hasWorkItem ? 'ok' : (bug.status === 'open' ? 'missing' : 'ok'),
          detail: hasWorkItem ? `${wiLinks.length} work item(s)` : (bug.status === 'open' ? 'Öppen bugg utan work_item' : 'Löst utan work_item (ok)'),
        });

        // Work Item → Change Log
        if (hasWorkItem) {
          const { data: clLinks } = await supabase
            .from('change_log')
            .select('id')
            .or(`work_item_id.eq.${wiLinks[0].id},bug_report_id.eq.${bug.id}`)
            .limit(1);

          links.push({
            from: 'work_items', fromId: wiLinks[0].id,
            to: 'change_log', toId: clLinks?.[0]?.id || null,
            status: clLinks?.length ? 'ok' : (wiLinks[0].status === 'done' ? 'missing' : 'ok'),
            detail: clLinks?.length ? 'Ändringslogg finns' : (wiLinks[0].status === 'done' ? 'Klar utan change_log' : 'Ej klar ännu'),
          });

          // Work Item → Verification (system_history)
          const { data: shLinks } = await supabase
            .from('system_history')
            .select('id, ai_review_status')
            .eq('work_item_id', wiLinks[0].id)
            .limit(1);

          links.push({
            from: 'work_items', fromId: wiLinks[0].id,
            to: 'verification', toId: shLinks?.[0]?.id || null,
            status: shLinks?.length ? 'ok' : (wiLinks[0].status === 'done' ? 'missing' : 'ok'),
            detail: shLinks?.length
              ? `Verifierad: ${shLinks[0].ai_review_status || 'pending'}`
              : (wiLinks[0].status === 'done' ? 'Klar men aldrig verifierad' : 'Ej klar'),
          });
        }

        // Bug → Change Log (direct link via resolved_by_change_id)
        if (bug.resolved_by_change_id) {
          const { data: directChange } = await supabase
            .from('change_log')
            .select('id')
            .eq('id', bug.resolved_by_change_id)
            .limit(1);

          links.push({
            from: 'bug_report', fromId: bug.id,
            to: 'change_log (direct)', toId: directChange?.[0]?.id || null,
            status: directChange?.length ? 'ok' : 'broken',
            detail: directChange?.length ? 'Direktlänk giltig' : `resolved_by_change_id ${bug.resolved_by_change_id.slice(0, 8)} saknas`,
          });
        }

        const broken = links.some(l => l.status === 'broken');
        const missing = links.some(l => l.status === 'missing');
        allTraces.push({
          id: bug.id, origin: 'bug_report', originId: bug.id,
          links,
          status: broken ? 'broken' : missing ? 'partial' : 'intact',
          summary: `Bug ${bug.id.slice(0, 8)} (${bug.status}) → ${links.length} kopplingar`,
          checkedAt: now,
        });
      }

      // ─── 3. WORK ITEMS → SOURCE VALIDATION ───
      setProgress(60);
      const { data: workItems } = await supabase
        .from('work_items' as any)
        .select('id, title, source_type, source_id, status, ai_review_status, related_order_id')
        .in('status', ['open', 'claimed', 'in_progress', 'done'])
        .limit(200);

      for (const wi of workItems || []) {
        const links: FlowLink[] = [];

        // Validate source exists
        if (wi.source_type && wi.source_id) {
          let sourceExists = false;
          if (wi.source_type === 'bug_report') {
            const { data } = await supabase.from('bug_reports').select('id').eq('id', wi.source_id).limit(1);
            sourceExists = !!data?.length;
          } else if (wi.source_type === 'order_incident') {
            const { data } = await supabase.from('order_incidents').select('id').eq('id', wi.source_id).limit(1);
            sourceExists = !!data?.length;
          } else if (wi.source_type === 'scan') {
            const { data } = await supabase.from('ai_scan_results').select('id').eq('id', wi.source_id).limit(1);
            sourceExists = !!data?.length;
          }

          if (['bug_report', 'order_incident', 'scan'].includes(wi.source_type)) {
            links.push({
              from: 'work_items', fromId: wi.id,
              to: wi.source_type, toId: sourceExists ? wi.source_id : null,
              status: sourceExists ? 'ok' : 'broken',
              detail: sourceExists ? 'Källa finns' : `Källa (${wi.source_type}) ${wi.source_id.slice(0, 8)} saknas`,
            });
          }
        }

        // Validate related order
        if (wi.related_order_id) {
          const { data: order } = await supabase
            .from('orders')
            .select('id, deleted_at')
            .eq('id', wi.related_order_id)
            .limit(1);

          links.push({
            from: 'work_items', fromId: wi.id,
            to: 'orders', toId: order?.[0]?.id || null,
            status: order?.[0] && !order[0].deleted_at ? 'ok' : 'broken',
            detail: !order?.[0] ? 'Order saknas' : order[0].deleted_at ? 'Order raderad' : 'Order finns',
          });
        }

        // Only include traces with checks
        if (links.length > 0) {
          const broken = links.some(l => l.status === 'broken');
          const missing = links.some(l => l.status === 'missing');
          allTraces.push({
            id: wi.id, origin: 'work_items', originId: wi.id,
            links,
            status: broken ? 'broken' : missing ? 'partial' : 'intact',
            summary: `WI "${(wi.title || '').slice(0, 40)}" (${wi.status}) → ${links.length} kopplingar`,
            checkedAt: now,
          });
        }
      }

      // ─── 4. CHANGE LOG → TARGETS ───
      setProgress(80);
      const { data: changes } = await supabase
        .from('change_log')
        .select('id, change_type, work_item_id, bug_report_id, scan_id, description')
        .order('created_at', { ascending: false })
        .limit(100);

      for (const cl of changes || []) {
        const links: FlowLink[] = [];

        if (cl.work_item_id) {
          const { data } = await supabase.from('work_items' as any).select('id').eq('id', cl.work_item_id).limit(1);
          links.push({
            from: 'change_log', fromId: cl.id,
            to: 'work_items', toId: data?.[0]?.id || null,
            status: data?.length ? 'ok' : 'broken',
            detail: data?.length ? 'Work item finns' : `work_item_id ${cl.work_item_id.slice(0, 8)} saknas`,
          });
        }

        if (cl.bug_report_id) {
          const { data } = await supabase.from('bug_reports').select('id').eq('id', cl.bug_report_id).limit(1);
          links.push({
            from: 'change_log', fromId: cl.id,
            to: 'bug_reports', toId: data?.[0]?.id || null,
            status: data?.length ? 'ok' : 'broken',
            detail: data?.length ? 'Bug finns' : `bug_report_id ${cl.bug_report_id.slice(0, 8)} saknas`,
          });
        }

        if (links.length > 0 && links.some(l => l.status !== 'ok')) {
          const broken = links.some(l => l.status === 'broken');
          allTraces.push({
            id: cl.id, origin: 'change_log', originId: cl.id,
            links,
            status: broken ? 'broken' : 'partial',
            summary: `Ändring ${cl.change_type} (${cl.id.slice(0, 8)}) → ${links.length} kopplingar`,
            checkedAt: now,
          });
        }
      }

      setProgress(100);

      // Sort: broken first
      allTraces.sort((a, b) => {
        const order = { broken: 0, partial: 1, intact: 2 };
        return order[a.status] - order[b.status];
      });

      setTraces(allTraces);
      setStats({
        total: allTraces.length,
        intact: allTraces.filter(t => t.status === 'intact').length,
        broken: allTraces.filter(t => t.status === 'broken').length,
        partial: allTraces.filter(t => t.status === 'partial').length,
      });
      setStatus('done');
      toast.success(`Dataflödesvalidering klar: ${allTraces.length} spår kontrollerade`);
    } catch (err) {
      console.error('Data flow validation error:', err);
      toast.error('Validering misslyckades');
      setStatus('done');
    }
  };

  return (
    <div className="space-y-4">
      {/* Pipeline visualization */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center gap-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/50 border">
                  <step.icon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium">{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {status === 'done' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Totalt', count: stats.total, color: 'text-foreground', icon: Activity },
            { label: 'Intakta', count: stats.intact, color: 'text-green-500', icon: CheckCircle },
            { label: 'Ofullständiga', count: stats.partial, color: 'text-orange-500', icon: AlertTriangle },
            { label: 'Brutna', count: stats.broken, color: 'text-destructive', icon: XCircle },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className={cn('w-4 h-4', s.color)} />
                <div>
                  <p className="text-lg font-bold leading-none">{s.count}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Progress */}
      {status === 'running' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Validerar dataflöden…
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant={status === 'idle' ? 'default' : 'outline'}
          onClick={runValidation}
          disabled={status === 'running'}
          className="gap-1.5 text-xs"
        >
          {status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {status === 'idle' ? 'Kör validering' : 'Kör igen'}
        </Button>
        {traces.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => { setTraces([]); setStatus('idle'); }} className="gap-1.5 text-xs">
            <Trash2 className="w-3.5 h-3.5" />
            Rensa
          </Button>
        )}
        <div className="ml-auto text-[10px] text-muted-foreground">
          Spårar: scan → bug → work_item → change_log → verifiering
        </div>
      </div>

      {/* Broken traces */}
      {traces.filter(t => t.status === 'broken').length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <Unlink className="w-4 h-4" />
              Brutna kopplingar ({traces.filter(t => t.status === 'broken').length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-2 pr-2">
                {traces.filter(t => t.status === 'broken').map(t => <TraceCard key={t.id} trace={t} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Partial traces */}
      {traces.filter(t => t.status === 'partial').length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-4 h-4" />
              Ofullständiga ({traces.filter(t => t.status === 'partial').length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[40vh]">
              <div className="space-y-2 pr-2">
                {traces.filter(t => t.status === 'partial').map(t => <TraceCard key={t.id} trace={t} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Intact traces */}
      {traces.filter(t => t.status === 'intact').length > 0 && (
        <Card className="border-green-500/20">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              Intakta ({traces.filter(t => t.status === 'intact').length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[30vh]">
              <div className="space-y-2 pr-2">
                {traces.filter(t => t.status === 'intact').map(t => <TraceCard key={t.id} trace={t} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {status === 'idle' && traces.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Dataflödesvalidering</p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-md mx-auto">
              Spårar varje datapunkt genom hela pipelinen — från skanning till verifiering.
              Hittar brutna kopplingar, saknad data och ID-missmatchningar för att säkerställa systemets integritet.
            </p>
            <Button size="sm" onClick={runValidation} className="mt-4 gap-1.5 text-xs">
              <Play className="w-3.5 h-3.5" />
              Starta validering
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DataFlowValidator;
