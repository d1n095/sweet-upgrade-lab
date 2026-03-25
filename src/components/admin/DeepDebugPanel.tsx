import { useState, useMemo } from 'react';
import { useDeepDebugStore, type TraceEntry, type TraceStep } from '@/utils/deepDebugTrace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Search, Bug, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEP_ICONS: Partial<Record<TraceStep, string>> = {
  issue_detected: '🔍',
  work_item_creating: '📝',
  db_insert_sent: '💾',
  db_insert_confirmed: '✅',
  db_insert_failed: '❌',
  db_verify_sent: '🔎',
  db_verify_confirmed: '✅',
  db_verify_failed: '❌',
  cache_invalidated: '🔄',
  ui_fetch_started: '📡',
  ui_fetch_complete: '📦',
  ui_item_rendered: '👁️',
  ui_item_missing: '⚠️',
  scan_update: '🔬',
  dedup_check: '🔗',
  dedup_merged: '🔀',
  dedup_kept: '✔️',
  filter_applied: '🪄',
  filter_removed: '🗑️',
  status_changed: '🔁',
  item_disappeared: '💀',
  data_loss: '🚨',
};

const SEV_COLORS: Record<string, string> = {
  debug: 'bg-muted text-muted-foreground',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  critical: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200',
};

const DeepDebugPanel = () => {
  const { enabled, traces, toggle, clear } = useDeepDebugStore();
  const [search, setSearch] = useState('');
  const [traceFilter, setTraceFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = traces;
    if (traceFilter) list = list.filter(t => t.traceId === traceFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.message.toLowerCase().includes(q) ||
        t.step.includes(q) ||
        t.component.toLowerCase().includes(q) ||
        t.entityId?.toLowerCase().includes(q) ||
        t.traceId.toLowerCase().includes(q)
      );
    }
    return list;
  }, [traces, search, traceFilter]);

  // Group by traceId for timeline view
  const traceIds = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(t => map.set(t.traceId, (map.get(t.traceId) || 0) + 1));
    return map;
  }, [filtered]);

  const hasErrors = filtered.some(t => t.severity === 'error' || t.severity === 'critical');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Deep Debug Mode</span>
          <Switch checked={enabled} onCheckedChange={toggle} />
          {enabled && <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">AKTIV</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{traces.length} traces</span>
          {hasErrors && <Badge variant="destructive" className="text-[10px]">Fel detekterade</Badge>}
          <Button variant="outline" size="sm" onClick={clear} disabled={!traces.length}>
            <Trash2 className="h-3 w-3 mr-1" /> Rensa
          </Button>
        </div>
      </div>

      {!enabled && (
        <p className="text-xs text-muted-foreground">
          Aktivera för att spåra fullständig livscykel: issue → work item → DB → UI → uppdatering
        </p>
      )}

      {enabled && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök trace, steg, komponent, ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            {traceFilter && (
              <Button variant="outline" size="sm" onClick={() => setTraceFilter(null)}>
                Alla traces
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
            <span>{filtered.length} poster</span>
            <span>•</span>
            <span>{traceIds.size} unika traces</span>
            <span>•</span>
            <span>{filtered.filter(t => t.severity === 'error' || t.severity === 'critical').length} fel</span>
            <span>•</span>
            <span>{filtered.filter(t => t.step === 'item_disappeared' || t.step === 'data_loss').length} dataförluster</span>
          </div>

          <ScrollArea className="h-[50vh]">
            <div className="space-y-1">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground p-4">
                  {traces.length === 0 ? 'Inga traces ännu. Skapa ett work item för att börja spåra.' : 'Inga resultat matchar filtret.'}
                </p>
              )}
              {[...filtered].reverse().map(entry => (
                <Card key={entry.id} className={cn('border-border/50', entry.severity === 'error' || entry.severity === 'critical' ? 'border-destructive/30' : '')}>
                  <CardContent className="p-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-sm shrink-0">{STEP_ICONS[entry.step] || '•'}</span>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className={cn('text-[10px] px-1 py-0', SEV_COLORS[entry.severity])}>
                            {entry.step}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">{entry.component}</span>
                          {entry.entityId && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              🆔 {entry.entityId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-tight">{entry.message}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <button
                            className="font-mono hover:underline cursor-pointer"
                            onClick={() => setTraceFilter(entry.traceId === traceFilter ? null : entry.traceId)}
                          >
                            🔗 {entry.traceId}
                            {traceIds.get(entry.traceId)! > 1 && <span className="bg-muted rounded px-1 ml-0.5">×{traceIds.get(entry.traceId)}</span>}
                          </button>
                          <span className="ml-auto tabular-nums">
                            {new Date(entry.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.{String(entry.timestamp % 1000).padStart(3, '0')}
                          </span>
                        </div>
                        {entry.details && Object.keys(entry.details).length > 0 && (
                          <pre className="text-[10px] font-mono bg-muted/50 rounded p-1 mt-1 overflow-x-auto max-h-20">
                            {JSON.stringify(entry.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
};

export default DeepDebugPanel;
