import { useMemo, useState } from 'react';
import { useActionVerificationStore, type ActionRecord, type VerifyStep } from '@/utils/actionVerificationEngine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Search, ShieldCheck, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEP_LABELS: Record<VerifyStep, string> = {
  action_start: 'Start',
  backend_call: 'Backend',
  db_write: 'DB Write',
  db_confirm: 'DB Verify',
  ui_update: 'UI Update',
};

const STEP_ORDER: VerifyStep[] = ['action_start', 'backend_call', 'db_write', 'db_confirm', 'ui_update'];

const ActionVerificationPanel = () => {
  const { enabled, actions, toggle, clear } = useActionVerificationStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'failed'>('all');

  const filtered = useMemo(() => {
    let list = actions;
    if (filterStatus !== 'all') list = list.filter(a => a.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.action.toLowerCase().includes(q) ||
        a.component.toLowerCase().includes(q) ||
        a.entityId?.toLowerCase().includes(q) ||
        a.failReason?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [actions, search, filterStatus]);

  const failedCount = actions.filter(a => a.status === 'failed').length;
  const okCount = actions.filter(a => a.status === 'ok').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Action Verification Engine</span>
          <Switch checked={enabled} onCheckedChange={toggle} />
          {enabled && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary">AKTIV</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{okCount} ✓</Badge>
          {failedCount > 0 && <Badge variant="destructive" className="text-[10px]">{failedCount} ✗</Badge>}
          <Button variant="outline" size="sm" onClick={clear} disabled={!actions.length}>
            <Trash2 className="h-3 w-3 mr-1" /> Rensa
          </Button>
        </div>
      </div>

      {!enabled && (
        <p className="text-xs text-muted-foreground">
          Aktivera för att verifiera att varje åtgärd faktiskt slutförs: start → backend → DB → verify → UI
        </p>
      )}

      {enabled && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök åtgärd, komponent, ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'ok', 'failed'] as const).map(s => (
                <Button
                  key={s}
                  variant={filterStatus === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(s)}
                  className="text-xs h-9"
                >
                  {s === 'all' ? 'Alla' : s === 'ok' ? '✓ OK' : '✗ Fel'}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="h-[50vh]">
            <div className="space-y-1.5">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground p-4">
                  {actions.length === 0 ? 'Inga åtgärder spårade ännu.' : 'Inga resultat matchar filtret.'}
                </p>
              )}
              {[...filtered].reverse().map(action => (
                <ActionCard key={action.id} action={action} />
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
};

function ActionCard({ action }: { action: ActionRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={cn(
        'border-border/50 cursor-pointer',
        action.status === 'failed' && 'border-destructive/40',
        action.status === 'running' && 'border-primary/30'
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-2.5">
        <div className="space-y-1.5">
          {/* Header */}
          <div className="flex items-center gap-2">
            {action.status === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
            {action.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
            {action.status === 'running' && <Loader2 className="h-3.5 w-3.5 text-primary shrink-0 animate-spin" />}
            <span className="text-xs font-medium flex-1 min-w-0 truncate">{action.action}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{action.component}</span>
            {action.durationMs != null && <span className="text-[10px] text-muted-foreground tabular-nums">{action.durationMs}ms</span>}
          </div>

          {/* Step pipeline visualization */}
          <div className="flex items-center gap-0.5">
            {STEP_ORDER.map((step, i) => {
              const rec = action.steps.find(s => s.step === step);
              const isFailPoint = action.failedStep === step;
              return (
                <div key={step} className="flex items-center gap-0.5">
                  {i > 0 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />}
                  <div
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded font-mono',
                      rec?.status === 'ok' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                      rec?.status === 'failed' && 'bg-destructive/20 text-destructive font-bold',
                      !rec && !isFailPoint && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {STEP_LABELS[step]}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Failure info */}
          {action.status === 'failed' && (
            <div className="text-[10px] bg-destructive/10 rounded p-1.5 space-y-0.5">
              <span className="text-destructive font-medium">✗ Misslyckades vid: {action.failedStep && STEP_LABELS[action.failedStep]}</span>
              <p className="text-foreground">{action.failReason}</p>
            </div>
          )}

          {/* Expanded details */}
          {expanded && (
            <div className="space-y-1 pt-1 border-t border-border/50">
              {action.entityId && (
                <p className="text-[10px] text-muted-foreground font-mono">Entity: {action.entityType} / {action.entityId}</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                Started: {new Date(action.startedAt).toLocaleTimeString('sv-SE')}
                {action.completedAt && ` → Completed: ${new Date(action.completedAt).toLocaleTimeString('sv-SE')}`}
              </p>
              {action.steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    s.status === 'ok' ? 'bg-green-500' : s.status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground'
                  )} />
                  <span className="font-mono w-20">{STEP_LABELS[s.step]}</span>
                  <span className={s.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>
                    {s.status}{s.detail ? ` — ${s.detail}` : ''}
                  </span>
                  <span className="ml-auto text-muted-foreground/60 tabular-nums">
                    {new Date(s.ts).toLocaleTimeString('sv-SE')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ActionVerificationPanel;
