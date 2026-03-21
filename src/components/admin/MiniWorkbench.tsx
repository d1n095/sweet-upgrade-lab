import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ClipboardList, ChevronDown, ChevronUp, X, Play, CheckCircle2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-accent/10 text-accent border-accent/20',
};

const MiniWorkbench = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const { data: myTasks = [] } = useQuery({
    queryKey: ['mini-workbench-tasks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('staff_tasks')
        .select('id, title, status, priority, task_type, related_order_id, created_at')
        .or(`assigned_to.eq.${user.id},claimed_by.eq.${user.id}`)
        .in('status', ['open', 'claimed', 'in_progress'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(15);
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: openCount = 0 } = useQuery({
    queryKey: ['mini-workbench-open-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('staff_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const handleClaim = async (taskId: string) => {
    if (!user) return;
    setActing(taskId);
    try {
      await supabase.from('staff_tasks').update({
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
        status: 'claimed',
      }).eq('id', taskId);
      toast.success('Task claimad');
      queryClient.invalidateQueries({ queryKey: ['mini-workbench-tasks'] });
    } catch { toast.error('Kunde inte claima'); }
    finally { setActing(null); }
  };

  const handleStart = async (taskId: string) => {
    setActing(taskId);
    try {
      await supabase.from('staff_tasks').update({ status: 'in_progress' }).eq('id', taskId);
      toast.success('Task startad');
      queryClient.invalidateQueries({ queryKey: ['mini-workbench-tasks'] });
    } catch { toast.error('Fel'); }
    finally { setActing(null); }
  };

  const handleDone = async (taskId: string) => {
    setActing(taskId);
    try {
      await supabase.from('staff_tasks').update({
        status: 'done',
        completed_at: new Date().toISOString(),
      }).eq('id', taskId);
      toast.success('Task klar ✓');
      queryClient.invalidateQueries({ queryKey: ['mini-workbench-tasks'] });
    } catch { toast.error('Fel'); }
    finally { setActing(null); }
  };

  const totalBadge = myTasks.length + openCount;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105"
      >
        <ClipboardList className="w-5 h-5" />
        <span className="text-sm font-semibold">Workbench</span>
        {totalBadge > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs">{totalBadge}</Badge>
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
        className="fixed bottom-6 right-6 z-50 w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Mini Workbench</span>
            {totalBadge > 0 && <Badge variant="secondary" className="text-[10px]">{totalBadge}</Badge>}
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
          <ScrollArea className="max-h-80">
            <div className="p-3 space-y-2">
              {/* Open tasks available to claim */}
              {openCount > 0 && (
                <p className="text-[11px] text-muted-foreground font-medium">
                  {openCount} öppna tasks tillgängliga
                </p>
              )}

              {myTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Inga aktiva tasks</p>
              ) : (
                myTasks.map(task => (
                  <div
                    key={task.id}
                    className={cn(
                      'rounded-lg border p-2.5 space-y-1.5',
                      PRIORITY_COLORS[task.priority] || 'border-border'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium leading-tight flex-1">{task.title}</p>
                      <Badge variant="outline" className="text-[9px] shrink-0">{task.status}</Badge>
                    </div>
                    <div className="flex gap-1.5">
                      {task.status === 'open' && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleClaim(task.id)} disabled={acting === task.id}>
                          {acting === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Claim'}
                        </Button>
                      )}
                      {task.status === 'claimed' && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => handleStart(task.id)} disabled={acting === task.id}>
                          <Play className="w-3 h-3" /> Starta
                        </Button>
                      )}
                      {(task.status === 'claimed' || task.status === 'in_progress') && (
                        <Button size="sm" variant="default" className="h-6 text-[10px] px-2 gap-1" onClick={() => handleDone(task.id)} disabled={acting === task.id}>
                          <CheckCircle2 className="w-3 h-3" /> Klar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default MiniWorkbench;
