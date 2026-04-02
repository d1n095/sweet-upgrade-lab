import { useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, XCircle, Clock, Activity, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface StepLog {
  ts: string;
  msg: string;
  step: string;
}

interface ScanProgressData {
  id: string;
  status: string;
  progress: number;
  completed_steps: number;
  total_steps: number;
  current_step_label: string;
  eta_seconds: number | null;
  step_logs: StepLog[];
  started_at: string | null;
  completed_at: string | null;
  system_health_score: number | null;
  work_items_created: number | null;
  executive_summary: string | null;
  iteration: number;
  max_iterations: number;
}

interface ScanProgressProps {
  scanRunId: string | null;
  className?: string;
  /** Called once when the scan reaches a terminal state (done or error). */
  onComplete?: () => void;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '';
  if (seconds < 60) return `~${seconds}s kvar`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `~${mins}m ${secs}s kvar`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export default function ScanProgress({ scanRunId, className, onComplete }: ScanProgressProps) {
  const [data, setData] = useState<ScanProgressData | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const completedRef = useRef(false);

  // Poll for progress every 2 seconds when running
  useEffect(() => {
    if (!scanRunId) return;

    const fetchProgress = async () => {
      const { data: row } = await supabase
        .from('scan_runs' as any)
        .select('id, status, progress, completed_steps, total_steps, current_step_label, eta_seconds, step_logs, started_at, completed_at, system_health_score, work_items_created, executive_summary, iteration, max_iterations')
        .eq('id', scanRunId)
        .single();
      if (row) setData(row as any);
    };

    fetchProgress();
    const interval = setInterval(fetchProgress, 2000);

    // Also subscribe to realtime updates
    const channel = supabase
      .channel(`scan-progress-${scanRunId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scan_runs',
          filter: `id=eq.${scanRunId}`,
        },
        (payload: any) => {
          if (payload.new) setData(payload.new as any);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [scanRunId]);

  // Fire onComplete once when scan reaches a terminal state
  useEffect(() => {
    if (!data) return;
    const isTerminal = data.status === 'done' || data.status === 'error';
    if (isTerminal && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
  }, [data?.status, onComplete]);

  if (!scanRunId || !data) return null;

  const isRunning = data.status === 'running';
  const isDone = data.status === 'done';
  const isError = data.status === 'error';
  const logs: StepLog[] = Array.isArray(data.step_logs) ? data.step_logs : [];
  const progress = data.progress ?? 0;

  return (
    <Card className={cn('border-border', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {isRunning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {isDone && <CheckCircle className="h-4 w-4 text-green-500" />}
            {isError && <XCircle className="h-4 w-4 text-red-500" />}
            <Activity className="h-4 w-4" />
            Skanningsframsteg
          </CardTitle>
          <div className="flex items-center gap-2">
            {isRunning && data.eta_seconds != null && data.eta_seconds > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatEta(data.eta_seconds)}
              </span>
            )}
            <Badge
              variant={isDone ? 'default' : isError ? 'destructive' : 'secondary'}
              className="text-[10px]"
            >
              {isDone ? 'Klar' : isError ? 'Fel' : 'Körs'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate max-w-[65%]">
              {data.current_step_label || 'Initierar...'}
            </span>
            <span className="font-bold text-primary tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2.5" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              Steg {data.completed_steps ?? 0} / {data.total_steps ?? 0}
              {data.max_iterations > 1 && ` — Iteration ${data.iteration}/${data.max_iterations}`}
            </span>
            {isDone && data.system_health_score != null && (
              <span className={cn(
                'font-semibold',
                data.system_health_score >= 70 ? 'text-green-600' : data.system_health_score >= 40 ? 'text-yellow-600' : 'text-red-600'
              )}>
                Hälsa: {data.system_health_score}/100
              </span>
            )}
          </div>
        </div>

        {/* Done summary */}
        {isDone && data.executive_summary && (
          <div className="bg-muted/50 rounded-md p-2 text-[11px] text-foreground">
            {data.executive_summary}
            {data.work_items_created != null && data.work_items_created > 0 && (
              <span className="block mt-1 text-muted-foreground">
                📋 {data.work_items_created} nya uppgifter skapade
              </span>
            )}
          </div>
        )}

        {/* Activity log toggle */}
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Terminal className="h-3 w-3" />
          {showLogs ? 'Dölj' : 'Visa'} aktivitetslogg ({logs.length})
        </button>

        {/* Activity log */}
        {showLogs && logs.length > 0 && (
          <ScrollArea className="h-40 border border-border rounded-md bg-muted/20">
            <div className="p-2 space-y-0.5 font-mono text-[10px]">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2 text-muted-foreground leading-relaxed">
                  <span className="text-muted-foreground/60 shrink-0 tabular-nums">
                    {formatTime(log.ts)}
                  </span>
                  <span className={cn(
                    log.msg.startsWith('❌') ? 'text-red-500' :
                    log.msg.startsWith('✅') ? 'text-green-600' :
                    log.msg.startsWith('🏁') ? 'text-primary font-semibold' :
                    'text-foreground'
                  )}>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
