import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from '@/components/ui/drawer';
import {
  ClipboardList, ChevronDown, ChevronUp, X, Play, CheckCircle2, Loader2,
  AlertTriangle, Package, Headphones, RotateCcw, ShieldAlert, FileText, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-accent/10 text-accent border-accent/20',
};

const TYPE_ICONS: Record<string, typeof Package> = {
  pack_order: Package, packing: Package, shipping: Package,
  support_case: Headphones, support: Headphones,
  refund_request: RotateCcw, refund: RotateCcw,
  incident: ShieldAlert, manual_task: Wrench,
  general: FileText, other: FileText,
};

type MiniFilter = 'mine' | 'escalated' | 'all';

const MiniWorkbench = () => {
  const { user } = useAuth();
  const { hasAccess, isLoading: accessLoading } = useStaffAccess();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [filter, setFilter] = useState<MiniFilter>('mine');

  // Don't show on checkout
  const isCheckout = location.pathname === '/checkout';

  const { data: allTasks = [] } = useQuery({
    queryKey: ['mini-workbench-tasks', user?.id],
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
    enabled: !!user && hasAccess,
    refetchInterval: 15000,
  });

  // Realtime subscription for new tasks
  useEffect(() => {
    if (!user || !hasAccess) return;
    const channel = supabase
      .channel('workbench-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['mini-workbench-tasks'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, hasAccess, queryClient]);

  const displayTasks = allTasks.filter(task => {
    if (filter === 'mine') return task.assigned_to === user?.id || task.claimed_by === user?.id;
    if (filter === 'escalated') return task.status === 'escalated';
    return true;
  });

  const escalatedCount = allTasks.filter(t => t.status === 'escalated').length;
  const myCount = allTasks.filter(t => t.assigned_to === user?.id || t.claimed_by === user?.id).length;

  const handleAction = async (taskId: string, action: 'claim' | 'start' | 'done' | 'escalate' | 'unclaim') => {
    if (!user) return;
    setActing(taskId);
    try {
      const task = allTasks.find(t => t.id === taskId);

      const hasOpenedLabelCheckpoint = (statusHistory: any): boolean => {
        if (!Array.isArray(statusHistory)) return false;
        return statusHistory.some((entry: any) => entry?.status === 'label_opened' || entry?.label_opened === true);
      };

      if (action === 'claim') {
        await supabase.from('staff_tasks').update({
          claimed_by: user.id, claimed_at: new Date().toISOString(), status: 'claimed',
        }).eq('id', taskId);
        toast.success('Task claimad');
      } else if (action === 'unclaim') {
        await supabase.from('staff_tasks').update({
          claimed_by: null, assigned_to: null, claimed_at: null, status: 'open',
        } as any).eq('id', taskId);
        toast.success('Uppdrag släppt');
      } else if (action === 'start') {
        await supabase.from('staff_tasks').update({ status: 'in_progress' }).eq('id', taskId);
        if (task?.related_order_id && ['pack_order', 'packing'].includes(task.task_type)) {
          navigate(`/admin/orders?tab=to_pack&focus=${task.related_order_id}`);
        }
        toast.success('Task startad');
      } else if (action === 'done') {
        if (task?.related_order_id && ['pack_order', 'packing'].includes(task.task_type)) {
          const { data: order } = await supabase
            .from('orders')
            .select('payment_status, fulfillment_status, status_history')
            .eq('id', task.related_order_id)
            .maybeSingle();

          if (!order || order.payment_status !== 'paid') {
            toast.error('Ordern är inte betald');
            return;
          }

          if (!hasOpenedLabelCheckpoint(order.status_history)) {
            toast.error('Öppna fraktsedeln innan du markerar klar');
            return;
          }

          if (!['ready_to_ship', 'packed', 'shipped'].includes(order.fulfillment_status)) {
            toast.error('Markera ordern som packad först');
            return;
          }
        }

        await supabase.from('staff_tasks').update({
          status: 'done', completed_at: new Date().toISOString(),
        }).eq('id', taskId);
        toast.success('Task klar ✓');
      } else if (action === 'escalate') {
        await supabase.from('staff_tasks').update({
          status: 'escalated', priority: 'high', updated_at: new Date().toISOString(),
        } as any).eq('id', taskId);
        const { data: admins } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'founder'] as any[]);
        for (const a of admins || []) {
          await supabase.from('notifications').insert({
            user_id: a.user_id, type: 'urgent',
            message: `🚨 Eskalerad: ${task?.title || 'Uppgift'}`,
            related_id: taskId, related_type: 'task',
          });
        }
        toast.success('Eskalerad → admins notifierade');
      }
      queryClient.invalidateQueries({ queryKey: ['mini-workbench-tasks'] });
    } catch {
      toast.error('Något gick fel');
    } finally {
      setActing(null);
    }
  };

  // Don't render if no access, loading, or on checkout
  if (accessLoading || !hasAccess || isCheckout) return null;

  const totalBadge = allTasks.length;

  const taskListContent = (
    <>
      <div className="px-3 pt-2 pb-1">
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
      <ScrollArea className="flex-1 max-h-[60vh]">
        <div className="p-3 space-y-2">
          {displayTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Inga uppgifter</p>
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
                    {task.related_order_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] px-2"
                        onClick={() => navigate(`/admin/orders?tab=to_pack&focus=${task.related_order_id}`)}
                      >
                        Öppna order
                      </Button>
                    )}
                    {task.status === 'open' && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleAction(task.id, 'claim')} disabled={acting === task.id}>
                        {acting === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Claim'}
                      </Button>
                    )}
                    {(task.status === 'claimed' || task.status === 'in_progress') && (task.claimed_by === user?.id || task.assigned_to === user?.id) && (
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-muted-foreground" onClick={() => handleAction(task.id, 'unclaim')} disabled={acting === task.id}>
                        Släpp
                      </Button>
                    )}
                    {(task.status === 'claimed' || task.status === 'escalated') && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={() => handleAction(task.id, 'start')} disabled={acting === task.id}>
                        <Play className="w-3 h-3" /> Starta
                      </Button>
                    )}
                    {['claimed', 'in_progress', 'escalated'].includes(task.status) && (
                      <Button size="sm" variant="default" className="h-6 text-[10px] px-2 gap-1" onClick={() => handleAction(task.id, 'done')} disabled={acting === task.id}>
                        <CheckCircle2 className="w-3 h-3" /> Klar
                      </Button>
                    )}
                    {['open', 'claimed', 'in_progress'].includes(task.status) && (
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-destructive hover:bg-destructive/10" onClick={() => handleAction(task.id, 'escalate')} disabled={acting === task.id}>
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
  );

  // Mobile: bottom drawer
  if (isMobile) {
    return (
      <>
        {/* Floating button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(true)}
          className={cn(
            'fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors',
            escalatedCount > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
          )}
        >
          <ClipboardList className="w-5 h-5" />
          {totalBadge > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">
              {totalBadge}
            </span>
          )}
          {escalatedCount > 0 && (
            <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {escalatedCount}
            </span>
          )}
        </motion.button>

        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                Workbench
                {escalatedCount > 0 && (
                  <Badge variant="destructive" className="text-[9px]">
                    <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />{escalatedCount}
                  </Badge>
                )}
              </DrawerTitle>
            </DrawerHeader>
            {taskListContent}
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: floating button + sheet panel
  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg transition-colors',
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
      </motion.button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[380px] sm:w-[400px] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              Workbench
              {escalatedCount > 0 && (
                <Badge variant="destructive" className="text-[9px]">
                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />{escalatedCount}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          {taskListContent}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MiniWorkbench;
