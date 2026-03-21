import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, User, Clock, CheckCircle2, Circle, Play, X, Zap, UserCheck, Bot,
  AlertTriangle, Package, Headphones, RotateCcw, FileText, Wrench, ShieldAlert,
  FastForward, Pause, ArrowRight, Sparkles, Timer, ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { getOrderDisplayId } from '@/utils/orderDisplay';
import { useNavigate } from 'react-router-dom';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  claimed_by: string | null;
  task_type: string;
  due_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  related_order_id: string | null;
  related_incident_id: string | null;
}

const STATUS_COLUMNS = [
  { key: 'open', label: 'Öppna', icon: Circle, color: 'text-muted-foreground' },
  { key: 'claimed', label: 'Tagna', icon: User, color: 'text-blue-600' },
  { key: 'in_progress', label: 'Pågående', icon: Play, color: 'text-orange-600' },
  { key: 'escalated', label: 'Eskalerade', icon: AlertTriangle, color: 'text-destructive' },
  { key: 'done', label: 'Klara', icon: CheckCircle2, color: 'text-green-600' },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  low: 'bg-green-500/10 text-green-700 border-green-500/20',
};

const TASK_TYPE_META: Record<string, { label: string; icon: typeof Package; color: string }> = {
  pack_order: { label: 'Packning', icon: Package, color: 'text-orange-600 bg-orange-600/10' },
  packing: { label: 'Packning', icon: Package, color: 'text-orange-600 bg-orange-600/10' },
  shipping: { label: 'Frakt', icon: Package, color: 'text-blue-600 bg-blue-600/10' },
  support_case: { label: 'Support', icon: Headphones, color: 'text-cyan-600 bg-cyan-600/10' },
  support: { label: 'Support', icon: Headphones, color: 'text-cyan-600 bg-cyan-600/10' },
  refund_request: { label: 'Återbetalning', icon: RotateCcw, color: 'text-purple-600 bg-purple-600/10' },
  refund: { label: 'Återbetalning', icon: RotateCcw, color: 'text-purple-600 bg-purple-600/10' },
  incident: { label: 'Incident', icon: ShieldAlert, color: 'text-destructive bg-destructive/10' },
  review: { label: 'Recension', icon: FileText, color: 'text-pink-600 bg-pink-600/10' },
  manual_task: { label: 'Manuell', icon: Wrench, color: 'text-muted-foreground bg-secondary' },
  general: { label: 'Allmänt', icon: FileText, color: 'text-muted-foreground bg-secondary' },
  other: { label: 'Övrigt', icon: FileText, color: 'text-muted-foreground bg-secondary' },
};

const TASK_TYPES = [
  { key: 'general', label: 'Allmänt' },
  { key: 'pack_order', label: 'Packning' },
  { key: 'shipping', label: 'Frakt' },
  { key: 'support_case', label: 'Support' },
  { key: 'refund_request', label: 'Återbetalning' },
  { key: 'incident', label: 'Incident' },
  { key: 'manual_task', label: 'Manuell' },
  { key: 'other', label: 'Övrigt' },
];

type ViewFilter = 'all' | 'mine' | 'escalated' | 'open' | 'done';

interface Props {
  initialFilter?: string;
}

// Task Snapshot: shows order info inline
const TaskSnapshot = ({ orderId }: { orderId: string }) => {
  const { data: order } = useQuery({
    queryKey: ['task-snapshot', orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('order_email, total_amount, items, shipping_address, created_at')
        .eq('id', orderId)
        .maybeSingle();
      return data;
    },
    staleTime: 60000,
  });

  if (!order) return null;
  const items = Array.isArray(order.items) ? order.items : [];
  const addr = order.shipping_address as any;

  return (
    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
      <div>
        <span className="font-medium text-foreground">{order.order_email}</span>
        <p>{order.total_amount?.toLocaleString('sv-SE')} kr</p>
      </div>
      <div>
        {addr && <p>{addr.name} — {addr.city}</p>}
        <p>{items.length} artikel{items.length !== 1 ? 'er' : ''}: {items.slice(0, 2).map((i: any) => i.title).join(', ')}{items.length > 2 ? '…' : ''}</p>
      </div>
    </div>
  );
};

const WorkbenchBoard = ({ initialFilter }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newType, setNewType] = useState('general');
  const [creating, setCreating] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [escalating, setEscalating] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [sessionStart] = useState(Date.now());
  const workModeRef = useRef(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  workModeRef.current = workMode;

  const { data: automationLogs = [] } = useQuery({
    queryKey: ['automation-logs-recent'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('automation_logs')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const getTaskAutomationBadge = (taskId: string) => {
    const log = automationLogs.find(l => l.target_id === taskId);
    if (!log) return null;
    return log.action_type;
  };

  const runAutomation = async () => {
    setRunningAutomation(true);
    try {
      const { data, error } = await supabase.functions.invoke('automation-engine');
      if (error) throw error;
      const r = data?.results;
      toast.success(`Automation klar: ${r?.escalated || 0} eskalerade, ${r?.reassigned || 0} omfördelade`);
      queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['automation-logs-recent'] });
    } catch (e: any) {
      toast.error('Automation misslyckades: ' + e.message);
    } finally {
      setRunningAutomation(false);
    }
  };

  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['staff-profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'founder', 'moderator', 'warehouse', 'support', 'finance', 'it', 'manager', 'marketing'] as any[]);
      if (!data?.length) return [];
      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', userIds);
      return profiles || [];
    },
  });

  const getStaffName = (userId: string | null) => {
    if (!userId) return null;
    const p = staffProfiles.find(s => s.user_id === userId);
    return p?.username || userId.slice(0, 6);
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['staff-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_tasks')
        .select('*')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Task[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('staff-tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['workbench-stats'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Fetch user skills for filtering
  const { data: userSkills = [] } = useQuery({
    queryKey: ['user-skills', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('staff_permissions')
        .select('skill_categories')
        .eq('user_id', user.id)
        .maybeSingle();
      return (data?.skill_categories as string[]) || [];
    },
    enabled: !!user?.id,
  });

  // Filter tasks based on view
  const filteredTasks = tasks.filter(t => {
    if (viewFilter === 'mine') {
      const isMine = t.assigned_to === user?.id || t.claimed_by === user?.id;
      if (isMine) return t.status !== 'done';
      return false;
    }
    if (viewFilter === 'done') return (t.assigned_to === user?.id || t.claimed_by === user?.id) && t.status === 'done';
    if (viewFilter === 'escalated') return t.status === 'escalated';
    if (viewFilter === 'open') return t.status === 'open';
    // Default 'all' - exclude done
    return t.status !== 'done';
  });

  // Auto-fallback: if "mine" is empty (no active tasks), show all open
  const myActiveCount = tasks.filter(t => (t.assigned_to === user?.id || t.claimed_by === user?.id) && t.status !== 'done' && t.status !== 'cancelled').length;
  const effectiveFilter = viewFilter === 'mine' && myActiveCount === 0 ? 'open' : viewFilter;

  // Sort: escalated first, then high priority, then oldest
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === 'escalated' && b.status !== 'escalated') return -1;
    if (b.status === 'escalated' && a.status !== 'escalated') return 1;
    const pOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const pDiff = (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
    if (pDiff !== 0) return pDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const escalateTask = async (taskId: string) => {
    if (!user) return;
    setEscalating(taskId);
    try {
      // Set task to escalated + high priority
      await supabase.from('staff_tasks').update({
        status: 'escalated',
        priority: 'high',
        updated_at: new Date().toISOString(),
      } as any).eq('id', taskId);

      // Auto-assign to admin/founder
      const { data: adminUser } = await supabase.rpc('auto_assign_task', { p_task_type: 'support' });
      if (adminUser) {
        await supabase.from('staff_tasks').update({
          assigned_to: adminUser,
        } as any).eq('id', taskId);
      }

      // Notify admins
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'founder'] as any[]);

      const task = tasks.find(t => t.id === taskId);
      for (const a of admins || []) {
        await supabase.from('notifications').insert({
          user_id: a.user_id,
          type: 'urgent',
          message: `🚨 Eskalerad: ${task?.title || 'Uppgift'}`,
          related_id: taskId,
          related_type: 'task',
        });
      }

      // Log
      await supabase.from('automation_logs').insert({
        action_type: 'escalate',
        target_type: 'task',
        target_id: taskId,
        reason: `Manuellt eskalerad av ${getStaffName(user.id) || 'personal'}`,
        details: { escalated_by: user.id },
      });

      toast.success('Uppgift eskalerad → admins notifierade');
      queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['automation-logs-recent'] });
    } catch {
      toast.error('Kunde inte eskalera');
    } finally {
      setEscalating(null);
    }
  };

  const autoAssignSingle = async (taskId: string, taskType: string) => {
    const { data, error } = await supabase.rpc('auto_assign_task', { p_task_type: taskType });
    if (error || !data) { toast.error('Ingen tillgänglig personal'); return; }
    await supabase.from('staff_tasks').update({ assigned_to: data, status: 'claimed', claimed_by: data } as any).eq('id', taskId);
    toast.success(`Tilldelad till ${getStaffName(data as string) || 'personal'}`);
    queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
  };

  const autoAssignAll = async () => {
    const openTasks = tasks.filter(t => t.status === 'open' && !t.assigned_to);
    if (!openTasks.length) { toast.info('Inga öppna uppgifter'); return; }
    setAutoAssigning(true);
    let assigned = 0;
    for (const task of openTasks) {
      const { data } = await supabase.rpc('auto_assign_task', { p_task_type: task.task_type });
      if (data) {
        await supabase.from('staff_tasks').update({ assigned_to: data, status: 'claimed', claimed_by: data } as any).eq('id', task.id);
        assigned++;
      }
    }
    toast.success(`${assigned} av ${openTasks.length} fördelade`);
    queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
    setAutoAssigning(false);
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !user) return;
    setCreating(true);
    try {
      const { data: bestUser } = await supabase.rpc('auto_assign_task', { p_task_type: newType });
      await supabase.from('staff_tasks').insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        priority: newPriority,
        task_type: newType,
        created_by: user.id,
        ...(bestUser ? { assigned_to: bestUser, status: 'claimed', claimed_by: bestUser } : {}),
      } as any);
      toast.success(bestUser ? `Skapad → tilldelad ${getStaffName(bestUser as string)}` : 'Skapad (ingen tillgänglig)');
      setNewTitle(''); setNewDesc(''); setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
    } catch (err: any) {
      toast.error(err?.message || 'Fel');
    } finally {
      setCreating(false);
    }
  };

  const unclaimTask = async (taskId: string) => {
    if (!user) return;
    await supabase.from('staff_tasks').update({
      status: 'open', assigned_to: null, claimed_by: null, claimed_at: null, updated_at: new Date().toISOString(),
    } as any).eq('id', taskId);
    toast.success('Uppdrag släppt');
    queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
  };

  const hasOpenedLabelCheckpoint = (statusHistory: any): boolean => {
    if (!Array.isArray(statusHistory)) return false;
    return statusHistory.some((entry: any) => entry?.status === 'label_opened' || entry?.label_opened === true);
  };

  const openOrderFromTask = (task: Task) => {
    if (!task.related_order_id) return;
    navigate(`/admin/orders?tab=to_pack&focus=${task.related_order_id}`);
  };

  const moveTask = async (taskId: string, newStatus: string) => {
    if (!user) return;

    if (newStatus === 'done') {
      const currentTask = tasks.find((t) => t.id === taskId);
      if (currentTask?.related_order_id && ['pack_order', 'packing'].includes(currentTask.task_type)) {
        const { data: order } = await supabase
          .from('orders')
          .select('payment_status, fulfillment_status, status_history')
          .eq('id', currentTask.related_order_id)
          .maybeSingle();

        if (!order || order.payment_status !== 'paid') {
          toast.error('Ordern måste vara betald innan uppgiften kan slutföras');
          return;
        }

        if (!hasOpenedLabelCheckpoint(order.status_history)) {
          toast.error('Öppna fraktsedeln minst en gång innan du markerar klar');
          return;
        }

        if (!['ready_to_ship', 'packed', 'shipped'].includes(order.fulfillment_status)) {
          toast.error('Markera ordern som packad först');
          return;
        }
      }
    }

    const now = new Date().toISOString();
    const updates: Record<string, any> = { status: newStatus, updated_at: now };
    if (newStatus === 'claimed') { updates.claimed_by = user.id; updates.claimed_at = now; }
    if (newStatus === 'in_progress') { updates.claimed_by = user.id; if (!updates.claimed_at) updates.claimed_at = now; }
    if (newStatus === 'done') updates.completed_at = now;
    await supabase.from('staff_tasks').update(updates).eq('id', taskId);
    queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });

    if (newStatus === 'done') {
      setCompletedCount(prev => prev + 1);
      setJustCompleted(taskId);
      toast.success('Klar ✓');
      setTimeout(() => {
        setJustCompleted(null);
        // Auto-advance in work mode
        if (workModeRef.current && autoNext) {
          const next = getNextAction();
          if (next) {
            if (next.status === 'open') {
              moveTask(next.id, 'claimed');
            } else if (next.status === 'claimed') {
              moveTask(next.id, 'in_progress');
            }
          } else {
            setWorkMode(false);
            toast.info('Inga fler uppgifter – arbetsläge avslutat');
          }
        }
      }, 1200);
    }
  };

  const getNextStatus = (current: string) => {
    if (current === 'escalated') return 'in_progress';
    const order = ['open', 'claimed', 'in_progress', 'done'];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : null;
  };

  const getPrevStatus = (current: string) => {
    if (current === 'escalated') return 'open';
    const order = ['open', 'claimed', 'in_progress', 'done'];
    const idx = order.indexOf(current);
    return idx > 0 ? order[idx - 1] : null;
  };

  // Compute "next action" task: escalated > high prio > oldest open/claimed for current user
  const getNextAction = useCallback((): Task | null => {
    const activeTasks = tasks.filter(t => 
      t.status !== 'done' && t.status !== 'cancelled' &&
      (t.assigned_to === user?.id || t.claimed_by === user?.id || t.status === 'open')
    );
    // Escalated first
    const escalated = activeTasks.filter(t => t.status === 'escalated');
    if (escalated.length) return escalated[0];
    // My in_progress
    const myInProgress = activeTasks.filter(t => t.status === 'in_progress' && (t.claimed_by === user?.id || t.assigned_to === user?.id));
    if (myInProgress.length) return myInProgress[0];
    // My claimed
    const myClaimed = activeTasks.filter(t => t.status === 'claimed' && (t.claimed_by === user?.id || t.assigned_to === user?.id));
    if (myClaimed.length) return myClaimed[0];
    // High prio open
    const highOpen = activeTasks.filter(t => t.status === 'open' && t.priority === 'high');
    if (highOpen.length) return highOpen[0];
    // Any open
    const anyOpen = activeTasks.filter(t => t.status === 'open');
    if (anyOpen.length) return anyOpen[0];
    return null;
  }, [tasks, user?.id]);

  const nextAction = getNextAction();

  const startWorkMode = async () => {
    setWorkMode(true);
    const next = getNextAction();
    if (next) {
      if (next.status === 'open') {
        await moveTask(next.id, 'claimed');
      } else if (next.status === 'claimed') {
        await moveTask(next.id, 'in_progress');
      }
      toast.success('Arbetsläge aktiverat – kör på!');
    } else {
      toast.info('Inga uppgifter att starta');
      setWorkMode(false);
    }
  };

  const escalatedCount = tasks.filter(t => t.status === 'escalated').length;
  const myCount = tasks.filter(t => (t.assigned_to === user?.id || t.claimed_by === user?.id) && t.status !== 'done').length;
  const doneCount = tasks.filter(t => (t.assigned_to === user?.id || t.claimed_by === user?.id) && t.status === 'done').length;
  const openCount = tasks.filter(t => t.status === 'open' && !t.assigned_to).length;

  const toggleBulkSelect = (taskId: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const bulkClaimAll = async () => {
    if (!user || bulkSelected.size === 0) return;
    const now = new Date().toISOString();
    for (const taskId of bulkSelected) {
      await supabase.from('staff_tasks').update({
        status: 'claimed', claimed_by: user.id, assigned_to: user.id, claimed_at: now, updated_at: now,
      } as any).eq('id', taskId);
    }
    toast.success(`${bulkSelected.size} uppgifter tagna`);
    setBulkSelected(new Set());
    setBulkMode(false);
    queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
  };

  const renderTaskCard = (task: Task) => {
    const typeMeta = TASK_TYPE_META[task.task_type] || TASK_TYPE_META.general;
    const TypeIcon = typeMeta.icon;
    const isEscalated = task.status === 'escalated';

    return (
      <Card key={task.id} className={cn(
        'border-border hover:shadow-sm transition-shadow',
        isEscalated && 'border-destructive/40 bg-destructive/5',
        bulkSelected.has(task.id) && 'ring-2 ring-primary/50'
      )}>
        <CardContent className="pt-3 pb-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {bulkMode && task.status === 'open' && (
                <button onClick={() => toggleBulkSelect(task.id)} className="shrink-0 mt-0.5">
                  {bulkSelected.has(task.id)
                    ? <CheckCircle2 className="w-4 h-4 text-primary" />
                    : <Circle className="w-4 h-4 text-muted-foreground" />}
                </button>
              )}
              <div className={cn('w-5 h-5 rounded flex items-center justify-center shrink-0', typeMeta.color)}>
                <TypeIcon className="w-3 h-3" />
              </div>
              <h4 className="text-sm font-medium leading-tight truncate">{task.title}</h4>
            </div>
            <Badge variant="outline" className={cn('text-[9px] shrink-0', PRIORITY_COLORS[task.priority])}>
              {task.priority === 'high' ? 'HÖG' : task.priority === 'medium' ? 'MED' : 'LÅG'}
            </Badge>
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className={cn('text-[9px] gap-0.5', typeMeta.color)}>
              <TypeIcon className="w-2.5 h-2.5" />
              {typeMeta.label}
            </Badge>
            {isEscalated && (
              <Badge variant="destructive" className="text-[9px] gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> Eskalerad
              </Badge>
            )}
            {getTaskAutomationBadge(task.id) && (
              <Badge variant="outline" className="text-[9px] gap-0.5 bg-purple-100 text-purple-700 border-purple-200">
                <Bot className="w-2.5 h-2.5" />
                {getTaskAutomationBadge(task.id) === 'escalate' ? 'Auto-eskalerad' :
                 getTaskAutomationBadge(task.id) === 'reassign' ? 'Omfördelad' : 'Auto'}
              </Badge>
            )}
            {task.assigned_to && (
              <Badge variant="outline" className="text-[9px] gap-0.5">
                <UserCheck className="w-2.5 h-2.5" />
                {getStaffName(task.assigned_to)}
              </Badge>
            )}
            {task.due_at && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {format(new Date(task.due_at), 'dd/MM HH:mm')}
              </span>
            )}
          </div>

          <div className="flex gap-1 pt-1 flex-wrap">
            {task.related_order_id && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] h-6 px-2"
                onClick={() => openOrderFromTask(task)}
              >
                Öppna order
              </Button>
            )}
            {task.status === 'open' && !task.assigned_to && (
              <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 gap-0.5"
                onClick={() => autoAssignSingle(task.id, task.task_type)}>
                <Zap className="w-3 h-3" /> Tilldela
              </Button>
            )}
            {/* Unclaim – release task back to open */}
            {['claimed', 'in_progress'].includes(task.status) && (task.claimed_by === user?.id || task.assigned_to === user?.id) && (
              <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 gap-0.5 text-muted-foreground"
                onClick={() => unclaimTask(task.id)}>
                <X className="w-3 h-3" /> Släpp
              </Button>
            )}
            {/* Escalate button */}
            {['open', 'claimed', 'in_progress'].includes(task.status) && (
              <Button variant="outline" size="sm"
                className="text-[10px] h-6 px-2 gap-0.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => escalateTask(task.id)}
                disabled={escalating === task.id}>
                <AlertTriangle className="w-3 h-3" /> Eskalera
              </Button>
            )}
            {getPrevStatus(task.status) && (
              <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => moveTask(task.id, getPrevStatus(task.status)!)}>
                ← Tillbaka
              </Button>
            )}
            {getNextStatus(task.status) && (
              <Button variant="default" size="sm" className="text-[10px] h-6 px-2 ml-auto" onClick={() => moveTask(task.id, getNextStatus(task.status)!)}>
                {getNextStatus(task.status) === 'claimed' ? 'Ta' :
                 getNextStatus(task.status) === 'in_progress' ? 'Starta' : 'Klar'} →
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Next Action Engine */}
      {nextAction && (
        <Card className={cn(
          'border-2 overflow-hidden',
          nextAction.status === 'escalated' ? 'border-destructive/50 bg-destructive/5' : 'border-primary/30 bg-primary/5'
        )}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  nextAction.status === 'escalated' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'
                )}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Nästa att göra</p>
                  <p className="text-sm font-semibold truncate">{nextAction.title}</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    <Badge variant="outline" className={cn('text-[9px]', PRIORITY_COLORS[nextAction.priority])}>
                      {nextAction.priority === 'high' ? 'HÖG' : nextAction.priority === 'medium' ? 'MED' : 'LÅG'}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px]">
                      {(TASK_TYPE_META[nextAction.task_type] || TASK_TYPE_META.general).label}
                    </Badge>
                    {nextAction.related_order_id && (
                      <Badge variant="outline" className="text-[9px] gap-0.5">
                        <Package className="w-2.5 h-2.5" /> Order
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 shrink-0 items-center">
                {workMode && (
                  <div className="flex items-center gap-2 mr-2">
                    <label className="text-[10px] text-muted-foreground">Auto-nästa</label>
                    <Switch checked={autoNext} onCheckedChange={setAutoNext} />
                  </div>
                )}
                {!workMode ? (
                  <>
                    {nextAction.related_order_id && (
                      <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => openOrderFromTask(nextAction)}>
                        Öppna order
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                      if (nextAction.status === 'open') moveTask(nextAction.id, 'claimed');
                      else if (nextAction.status === 'claimed') moveTask(nextAction.id, 'in_progress');
                      else if (['in_progress', 'escalated'].includes(nextAction.status)) moveTask(nextAction.id, 'done');
                    }}>
                      {nextAction.status === 'open' ? 'Ta' : nextAction.status === 'claimed' ? 'Starta' : 'Klar'} <ArrowRight className="w-3 h-3" />
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={startWorkMode}>
                      <FastForward className="w-4 h-4" /> Arbetsläge
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="default" className="gap-1.5" onClick={() => moveTask(nextAction.id, 'done')}>
                      <CheckCircle2 className="w-4 h-4" /> Klar → Nästa
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setWorkMode(false); toast.info('Arbetsläge avslutat'); }}>
                      <Pause className="w-4 h-4" /> Pausa
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Task snapshot – order info */}
            {nextAction.related_order_id && (
              <TaskSnapshot orderId={nextAction.related_order_id} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Done feedback */}
      <AnimatePresence>
        {justCompleted && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-accent/10 border border-accent/30 rounded-lg p-3 flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 text-accent" />
            <span className="text-sm font-medium text-accent">Klar ✓ — {autoNext && workMode ? 'laddar nästa…' : 'bra jobbat!'}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live speed stats */}
      {completedCount > 0 && (
        <div className="flex items-center gap-4 bg-secondary/30 rounded-xl px-4 py-2">
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="w-4 h-4 text-accent" />
            <span className="font-semibold">{completedCount}</span>
            <span className="text-muted-foreground">klara</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Timer className="w-4 h-4" />
            ~{Math.round((completedCount / Math.max(1, (Date.now() - sessionStart) / 60000)) * 60)}/h
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <Tabs value={viewFilter} onValueChange={v => setViewFilter(v as ViewFilter)}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            Alla <Badge variant="secondary" className="text-[9px] ml-1">{tasks.filter(t => t.status !== 'done').length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="mine" className="gap-1.5">
            Mina {myCount > 0 && <Badge variant="secondary" className="text-[9px] ml-1">{myCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="escalated" className={cn('gap-1.5', escalatedCount > 0 && 'text-destructive')}>
            <AlertTriangle className="w-3.5 h-3.5" /> Eskalerade
            {escalatedCount > 0 && <Badge variant="destructive" className="text-[9px] ml-1">{escalatedCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="open" className="gap-1.5">
            Öppna {openCount > 0 && <Badge variant="secondary" className="text-[9px] ml-1">{openCount}</Badge>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{sortedTasks.filter(t => t.status !== 'done').length} uppgifter</p>
        <div className="flex gap-2">
          {openCount > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={autoAssignAll} disabled={autoAssigning}>
              <Zap className="w-4 h-4" /> Auto-fördela ({openCount})
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={runAutomation} disabled={runningAutomation}>
            <Bot className="w-4 h-4" /> {runningAutomation ? 'Kör...' : 'Automation'}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showCreate ? 'Stäng' : 'Ny uppgift'}
          </Button>
        </div>
      </div>

      {showCreate && (
        <Card className="border-primary/20">
          <CardContent className="pt-4 pb-4 space-y-3">
            <Input placeholder="Uppgiftsnamn..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            <Textarea placeholder="Beskrivning (valfritt)..." value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} />
            <div className="flex gap-2 flex-wrap">
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Låg</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">Hög</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>Skapa</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {STATUS_COLUMNS.map(col => {
          const colTasks = sortedTasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <col.icon className={cn('w-4 h-4', col.color)} />
                <span className="text-sm font-semibold">{col.label}</span>
                <Badge variant={col.key === 'escalated' && colTasks.length > 0 ? 'destructive' : 'secondary'} className="text-[10px] ml-auto">
                  {colTasks.length}
                </Badge>
              </div>
              <div className={cn(
                'space-y-2 min-h-[100px] rounded-lg p-2',
                col.key === 'escalated' && colTasks.length > 0 ? 'bg-destructive/5' : 'bg-secondary/20'
              )}>
                {colTasks.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Inga uppgifter</p>
                )}
                {colTasks.map(renderTaskCard)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkbenchBoard;
