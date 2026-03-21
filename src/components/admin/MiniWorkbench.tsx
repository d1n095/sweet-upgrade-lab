import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClipboardList, ChevronDown, ChevronUp, X, Play, CheckCircle2, Loader2,
  AlertTriangle, Package, Headphones, RotateCcw, ShieldAlert, FileText, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-accent/10 text-accent border-accent/20',
};

const TYPE_ICONS: Record<string, typeof Package> = {
  pack_order: Package,
  packing: Package,
  shipping: Package,
  support_case: Headphones,
  support: Headphones,
  refund_request: RotateCcw,
  refund: RotateCcw,
  incident: ShieldAlert,
  manual_task: Wrench,
  general: FileText,
  other: FileText,
};

type MiniFilter = 'mine' | 'escalated' | 'all';

const MiniWorkbench = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [filter, setFilter] = useState<MiniFilter>('mine');

  const { data: allTasks = [] } = useQuery({
    queryKey: ['mini-workbench-all-tasks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('staff_tasks')
        .select('id, title, status, priority, task_type, related_order_id, created_at, assigned_to, claimed_by')
        .in('status', ['open', 'claimed', 'in_progress', 'escalated'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(30);
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const displayTasks = allTasks.filter(task => {
    if (filter === 'mine') return task.assigned_to === user?.id || task.claimed_by === user?.id;
    if (filter === 'escalated') return task.status === 'escalated';
    return true;
  });

  const escalatedCount = allTasks.filter(t => t.status === 'escalated').length;
  const myCount = allTasks.filter(t => t.assigned_to === user?.id || t.claimed_by === user?.id).length;

  const handleClaim = async (taskId: string) => {
    if (!user) return;
    setActing(taskId);
    try {
      await supabase.from('staff_tasks').update({
        claimed_by: user.id, claimed_at: new Date().toISOString(), status: 'claimed',
      }).eq('id', taskId);
      toast.success('Task claimad');
      queryClient.invalidateQueries({ queryKey: ['mini-workbench-all-tasks'] });
    } catch { toast.error('Kunde inte claima'); }
    finally { setActing(null); }
  };

  const handleStart = async (taskId: string) => {
    setActing(taskId);
    try {
      await supabase.from('staff_tasks').update({ status: 'in_progress' }).eq('id', taskId);
      toast.success('Task startad');
      queryClient.invalidateQueries({ queryKey: ['mini-workbench-all-tasks'] });
    } catch { toast.error('Fel'); }
    finally { setActing(null); }
  };

  const handleDone = async (taskId: string) => {
    setActing(taskId);
    try {
      await supabase.from('staff_tasks').update({
        status: 'done', completed_at: new Date().toISOString(),
      }).eq('id', taskId);
      toast.success('Task klar ✓');
      queryClient.invalidateQueries({ queryKey: ['mini-workbench-all-tasks'] });
    } catch { toast.error('Fel'); }
    finally { setActing(null); }
  };

  const handleEscalate = async (taskId: string) => {
    if (!user) return;
    setActing(taskId);
    try {
      await supabase.from('staff_tasks').update({
        status: 'escalated', priority: 'high', updated_at: new Date().toISOString(),
      } as any).eq('id', taskId);

      const { data: admins } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'founder'] as any[]);
      const task = allTasks.find(t => t.id === taskId);
      for (const a of admins || []) {
        await supabase.from('notifications').insert({
          user_id: a.user_id, type: 'urgent',
          message: `🚨 Eskalerad: ${task?.title || 'Uppgift'}`,
          related_id: taskId, related_type: 'task',
        });
      }
      toast.success('Eskalerad → admins notifierade');
      queryClient.invalidateQueries({ queryKey: ['mini-workbench-all-tasks'] });
    } catch { toast.error('Kunde inte eskalera'); }
    finally { setActing(null); }
  };

  const totalBadge = allTasks.length;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105',
          escalatedCount > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
        )}
      >
        <ClipboardList className="w-5 h-5" />
        <span className="text-sm font-semibold">Workbench</span>
        {totalBadge > 0 && <Badge variant="secondary" className="ml-1 text-xs">{totalBadge}</Badge>}
        {escalatedCount > 0 && (
          <Badge variant="outline" className="ml-0.5 text-[9px] border-destructive-foreground/30">
            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />{escalatedCount}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 right-6 z-50 w-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Mini Workbench</span>
            {escalatedCount > 0 && (
              <Badge variant="destructive" className="text-[9px]">
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />{escalatedCount}
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMinimized(!minimized)}>
              {minimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {!minimized && (
          <>
            <div className="px-3 pt-2">
              <Tabs value={filter} onValueChange={v => setFilter(v as MiniFilter)}>
                <TabsList className="w-full h-8">
                  <TabsTrigger value="mine" className="text-[10px] flex-1">Mina ({myCount})</TabsTrigger>
                  <TabsTrigger value="escalated" className={cn('text-[10px] flex-1', escalatedCount > 0 && 'text-destructive')}>
                    🚨 ({escalatedCount})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="text-[10px] flex-1">Alla ({allTasks.length})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <ScrollArea className="max-h-80">
              <div className="p-3 space-y-2">
                {displayTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Inga uppgifter</p>
                ) : (
                  displayTasks.map(task => {
                    const TypeIcon = TYPE_ICONS[task.task_type] || FileText;
                    const isEscalated = task.status === 'escalated';
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'rounded-lg border p-2.5 space-y-1.5',
                          isEscalated ? 'border-destructive/40 bg-destructive/5' : (PRIORITY_COLORS[task.priority] || 'border-border')
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <TypeIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            <p className="text-xs font-medium leading-tight truncate">{task.title}</p>
                          </div>
                          {isEscalated ? (
                            <Badge variant="destructive" className="text-[8px] shrink-0">ESKALERAD</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] shrink-0">{task.status}</Badge>
                          )}
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {task.status === 'open' && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleClaim(task.id)} disabled={acting === task.id}>
                              {acting === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Claim'}
                            </Button>
                          )}
                          {(task.status === 'claimed' || task.status === 'escalated') && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => handleStart(task.id)} disabled={acting === task.id}>
                              <Play className="w-3 h-3" /> Starta
                            </Button>
                          )}
                          {['claimed', 'in_progress', 'escalated'].includes(task.status) && (
                            <Button size="sm" variant="default" className="h-6 text-[10px] px-2 gap-1" onClick={() => handleDone(task.id)} disabled={acting === task.id}>
                              <CheckCircle2 className="w-3 h-3" /> Klar
                            </Button>
                          )}
                          {['open', 'claimed', 'in_progress'].includes(task.status) && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-destructive hover:bg-destructive/10" onClick={() => handleEscalate(task.id)} disabled={acting === task.id}>
                              <AlertTriangle className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default MiniWorkbench;
