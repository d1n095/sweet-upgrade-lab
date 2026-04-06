import React from 'react';
import { Play, Loader2, CheckCircle, XCircle, Clock, AlertTriangle, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useScanRunner, type ScanStep } from './useScanRunner';

function StepIcon({ status }: { status: ScanStep['status'] }) {
  if (status === 'done') return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (status === 'error') return <XCircle className="w-4 h-4 text-red-500" />;
  if (status === 'running') return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
  if (status === 'skipped') return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

function formatTs(iso: string | null | undefined): string {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

export function ScanControls() {
  const { running, steps, lastResult, scanRunId, startedAt, completedAt, run } = useScanRunner();

  const done = steps.filter(s => s.status === 'done').length;
  const total = steps.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={run} disabled={running} size="sm">
          {running ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Skannar...</>
          ) : (
            <><Play className="w-4 h-4 mr-2" />Kör skanning</>
          )}
        </Button>
        {!running && lastResult && (
          <Badge variant="outline">
            {lastResult.systemHealthScore}/100 · {lastResult.workItemsCreated} uppgifter
          </Badge>
        )}
      </div>

      {/* Scan identification — shown when not running */}
      {!running && completedAt && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground border border-border rounded-md px-2 py-1.5 bg-muted/30 w-fit">
          <CalendarClock className="w-3 h-3 shrink-0" />
          <span>Visar resultat från: <span className="font-medium text-foreground">{formatTs(completedAt)}</span></span>
          {scanRunId && (
            <span className="ml-2 font-mono text-muted-foreground/70">id:{scanRunId.slice(0, 8)}</span>
          )}
        </div>
      )}

      {/* Fallback when no completed scan exists */}
      {!running && !completedAt && !lastResult && (
        <p className="text-xs text-muted-foreground">Inga slutförda skanningar tillgängliga</p>
      )}

      {running && total > 0 && (
        <div className="space-y-2">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">{done}/{total} steg klara</p>
        </div>
      )}

      {/* Only show step list when running or when it's the current scan's steps */}
      {steps.length > 0 && (
        <div className="space-y-1">
          {steps.map(step => (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-2 text-sm px-2 py-1 rounded',
                step.status === 'running' && 'bg-blue-50 dark:bg-blue-950',
              )}
            >
              <StepIcon status={step.status} />
              <span className={cn('flex-1', step.status === 'pending' && 'text-muted-foreground')}>
                {step.status === 'running' ? (step.progressLabel ?? step.label) : step.label}
              </span>
              {step.duration_ms && (
                <span className="text-xs text-muted-foreground">{step.duration_ms}ms</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScanControls;
