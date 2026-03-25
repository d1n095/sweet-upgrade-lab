import { useSafeModeStore } from '@/stores/safeModeStore';
import { useAiQueueStore } from '@/stores/aiQueueStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, GitBranch, Zap,
  Clock, Power, Trash2, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const reasonConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  multiple_failures: { label: 'Flera misslyckanden', color: 'text-destructive', icon: AlertTriangle },
  regression: { label: 'Regression', color: 'text-purple-500', icon: GitBranch },
  critical_error: { label: 'Kritiskt fel', color: 'text-destructive', icon: Zap },
};

/** Compact banner for embedding in admin layouts */
export const SafeModeBanner = () => {
  const { active, deactivate, activatedAt, isolatedAreas } = useSafeModeStore();

  if (!active) return null;

  return (
    <div className="border border-destructive/40 bg-destructive/5 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
      <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-destructive">Safe Mode aktiv</p>
        <p className="text-xs text-muted-foreground">
          Icke-kritiska uppgifter pausade sedan {activatedAt ? new Date(activatedAt).toLocaleTimeString('sv-SE') : '–'}
          {isolatedAreas.length > 0 && ` · Isolerade: ${isolatedAreas.join(', ')}`}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={deactivate} className="gap-1.5 text-xs border-destructive/30">
        <Power className="w-3.5 h-3.5" /> Avaktivera
      </Button>
    </div>
  );
};

/** Full Safe Mode dashboard tab */
const SafeModePanel = () => {
  const { active, activatedAt, events, isolatedAreas, deactivate, activate, clearEvents } = useSafeModeStore();
  const queueTasks = useAiQueueStore(s => s.tasks);

  const pausedTasks = active ? queueTasks.filter(t => t.status === 'queued' && t.priority !== 'critical') : [];
  const failedTasks = queueTasks.filter(t => t.status === 'failed');
  const regressedTasks = queueTasks.filter(t => t.status === 'regressed');

  return (
    <div className="space-y-4">
      {/* Status card */}
      <Card className={active ? 'border-destructive/40 bg-destructive/5' : 'border-green-500/30 bg-green-500/5'}>
        <CardContent className="py-5">
          <div className="flex items-center gap-3 flex-wrap">
            {active ? (
              <ShieldAlert className="w-8 h-8 text-destructive" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-green-500" />
            )}
            <div className="flex-1">
              <p className={cn('text-lg font-bold', active ? 'text-destructive' : 'text-green-600')}>
                {active ? 'Safe Mode AKTIV' : 'Normal drift'}
              </p>
              <p className="text-sm text-muted-foreground">
                {active
                  ? `Aktiverat ${activatedAt ? new Date(activatedAt).toLocaleString('sv-SE') : ''} — icke-kritiska uppgifter pausade`
                  : 'Systemet körs normalt. Safe Mode aktiveras automatiskt vid multipla fel eller regressioner.'
                }
              </p>
            </div>
            <div className="flex gap-2">
              {active ? (
                <Button size="sm" onClick={deactivate} className="gap-1.5">
                  <Power className="w-3.5 h-3.5" /> Avaktivera
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => activate('critical_error', 'Manuell aktivering', 'manual')} className="gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Aktivera manuellt
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pausade uppgifter', value: pausedTasks.length, icon: Clock, color: 'text-orange-500' },
          { label: 'Misslyckade', value: failedTasks.length, icon: AlertTriangle, color: 'text-destructive' },
          { label: 'Regressioner', value: regressedTasks.length, icon: GitBranch, color: 'text-purple-500' },
          { label: 'Isolerade områden', value: isolatedAreas.length, icon: ShieldAlert, color: 'text-blue-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-2">
              <s.icon className={cn('w-4 h-4', s.color)} />
              <div>
                <p className="text-lg font-bold leading-none">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Isolated areas */}
      {isolatedAreas.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-destructive" /> Isolerade problemområden
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {isolatedAreas.map(a => (
                <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paused tasks */}
      {pausedTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" /> Pausade uppgifter ({pausedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-[30vh]">
              <div className="space-y-1.5 pr-2">
                {pausedTasks.map(t => (
                  <div key={t.id} className="border rounded-lg p-2.5 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                    <span className="text-sm truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Event log */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" /> Händelselogg ({events.length})
            </CardTitle>
            {events.length > 0 && (
              <Button size="sm" variant="ghost" onClick={clearEvents} className="gap-1 text-xs h-7">
                <Trash2 className="w-3 h-3" /> Rensa
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Inga händelser registrerade</p>
          ) : (
            <ScrollArea className="max-h-[30vh]">
              <div className="space-y-1.5 pr-2">
                {[...events].reverse().map((e, i) => {
                  const rc = reasonConfig[e.reason] || reasonConfig.critical_error;
                  const RIcon = rc.icon;
                  return (
                    <div key={i} className="border rounded-lg p-2.5 flex items-start gap-2">
                      <RIcon className={cn('w-4 h-4 mt-0.5 shrink-0', rc.color)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={cn('text-[10px]', rc.color)}>{rc.label}</Badge>
                          <span className="text-[10px] text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString('sv-SE')}</span>
                        </div>
                        <p className="text-xs text-foreground mt-0.5">{e.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SafeModePanel;
