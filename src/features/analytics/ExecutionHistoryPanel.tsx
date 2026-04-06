import React, { useEffect, useState } from 'react';
import { CheckCircle2, History, RotateCcw, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  created_at: string;
  change_type: string;
  description: string;
  affected_components: string[] | null;
  metadata: any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExecutionHistoryPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('change_log')
        .select('id, created_at, change_type, description, affected_components, metadata')
        .in('change_type', ['fix_execution', 'fix_reverted'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (!cancelled) {
        setLogs((data as LogEntry[]) ?? []);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const executions = logs.filter((l) => l.change_type === 'fix_execution');
  const reverts = logs.filter((l) => l.change_type === 'fix_reverted');

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Execution History</span>
          {loading && <span className="w-3 h-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />}
        </div>
        <div className="flex gap-1.5">
          <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-700 border-green-400/20">
            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
            {executions.length} fixes
          </Badge>
          <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-400/20">
            <RotateCcw className="w-2.5 h-2.5 mr-0.5" />
            {reverts.length} reverts
          </Badge>
        </div>
      </div>

      {/* Log list */}
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-md border border-border animate-pulse bg-muted/20" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
          No executions recorded yet.
        </div>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
          {logs.map((log) => {
            const isExec = log.change_type === 'fix_execution';
            const fixType = log.metadata?.fix_type as string | undefined;
            const severity = log.metadata?.issue_severity as string | undefined;
            return (
              <div
                key={log.id}
                className="flex items-start gap-2 rounded-md border border-border px-2.5 py-1.5 bg-card text-xs"
              >
                <div className="mt-0.5 shrink-0">
                  {isExec ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-foreground leading-snug">{log.description}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {severity && (
                      <Badge variant="outline" className={cn('text-[9px] px-1 py-0', {
                        'bg-destructive/10 text-destructive border-destructive/20': severity === 'critical',
                        'bg-orange-500/10 text-orange-600 border-orange-400/20': severity === 'high',
                        'bg-yellow-500/10 text-yellow-700 border-yellow-400/20': severity === 'medium',
                      })}>
                        {severity}
                      </Badge>
                    )}
                    {fixType && (
                      <span className="text-[10px] text-muted-foreground font-mono">{fixType}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                      {relativeTime(log.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
