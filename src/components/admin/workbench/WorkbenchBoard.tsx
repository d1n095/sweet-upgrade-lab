import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, User, Clock, CheckCircle2, Circle, Play, X, Zap, UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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

const COLUMNS = [
  { key: 'open', label: 'Öppna', icon: Circle, color: 'text-muted-foreground' },
  { key: 'claimed', label: 'Tagna', icon: User, color: 'text-blue-600' },
  { key: 'in_progress', label: 'Pågående', icon: Play, color: 'text-orange-600' },
  { key: 'done', label: 'Klara', icon: CheckCircle2, color: 'text-green-600' },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  low: 'bg-green-500/10 text-green-700 border-green-500/20',
};

const TASK_TYPES = [
  { key: 'general', label: 'Allmänt' },
  { key: 'packing', label: 'Packning' },
  { key: 'shipping', label: 'Frakt' },
  { key: 'support', label: 'Support' },
  { key: 'review', label: 'Recension' },
  { key: 'refund', label: 'Återbetalning' },
  { key: 'other', label: 'Övrigt' },
];

interface Props {
  initialFilter?: string;
}

const WorkbenchBoard = ({ initialFilter }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newType, setNewType] = useState('general');
  const [creating, setCreating] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  // Fetch staff profiles for displaying assigned names
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

  // Auto-assign a single task using the DB function
  const autoAssignSingle = async (taskId: string, taskType: string) => {
    const { data, error } = await supabase.rpc('auto_assign_task', { p_task_type: taskType });
    if (error || !data) {
      toast.error('Ingen tillgänglig personal hittades');
      return;
    }
    const { error: updateErr } = await supabase
      .from('staff_tasks')
      .update({ assigned_to: data, status: 'claimed', claimed_by: data } as any)
      .eq('id', taskId);
    if (updateErr) { toast.error('Kunde inte tilldela'); return; }
    const name = getStaffName(data as string) || 'personal';
    toast.success(`Auto-tilldelad till ${name}`);
    queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
  };

  // Auto-assign ALL open tasks
  const autoAssignAll = async () => {
    const openTasks = tasks.filter(t => t.status === 'open' && !t.assigned_to);
    if (!openTasks.length) { toast.info('Inga öppna uppgifter att fördela'); return; }
    setAutoAssigning(true);
    let assigned = 0;
    for (const task of openTasks) {
      const { data } = await supabase.rpc('auto_assign_task', { p_task_type: task.task_type });
      if (data) {
        await supabase.from('staff_tasks')
          .update({ assigned_to: data, status: 'claimed', claimed_by: data } as any)
          .eq('id', task.id);
        assigned++;
      }
    }
    toast.success(`${assigned} av ${openTasks.length} uppgifter fördelade`);
    queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
    setAutoAssigning(false);
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !user) return;
    setCreating(true);
    try {
      // Auto-assign on creation
      const { data: bestUser } = await supabase.rpc('auto_assign_task', { p_task_type: newType });
      const { error } = await supabase.from('staff_tasks').insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        priority: newPriority,
        task_type: newType,
        created_by: user.id,
        ...(bestUser ? { assigned_to: bestUser, status: 'claimed', claimed_by: bestUser } : {}),
      } as any);
      if (error) throw error;
      const name = bestUser ? getStaffName(bestUser as string) : null;
      toast.success(name ? `Uppgift skapad → tilldelad ${name}` : 'Uppgift skapad (ingen tillgänglig)');
      setNewTitle(''); setNewDesc(''); setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
    } catch (err: any) {
      toast.error(err?.message || 'Fel');
    } finally {
      setCreating(false);
    }
  };

  const moveTask = async (taskId: string, newStatus: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === 'claimed') { updates.claimed_by = user.id; updates.claimed_at = now; }
    if (newStatus === 'in_progress') { updates.claimed_by = user.id; if (!updates.claimed_at) updates.claimed_at = now; }
    if (newStatus === 'done') updates.completed_at = now;
    const { error } = await supabase.from('staff_tasks').update(updates).eq('id', taskId);
    if (error) { toast.error('Kunde inte flytta uppgift'); return; }
    queryClient.invalidateQueries({ queryKey: ['staff-tasks'] });
  };

  const getNextStatus = (current: string) => {
    const order = ['open', 'claimed', 'in_progress', 'done'];
    const idx = order.indexOf(current);
    return idx < order.length - 1 ? order[idx + 1] : null;
  };

  const getPrevStatus = (current: string) => {
    const order = ['open', 'claimed', 'in_progress', 'done'];
    const idx = order.indexOf(current);
    return idx > 0 ? order[idx - 1] : null;
  };

  const openCount = tasks.filter(t => t.status === 'open' && !t.assigned_to).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{tasks.filter(t => t.status !== 'done').length} aktiva uppgifter</p>
        <div className="flex gap-2">
          {openCount > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={autoAssignAll} disabled={autoAssigning}>
              <Zap className="w-4 h-4" />
              Auto-fördela ({openCount})
            </Button>
          )}
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
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Zap className="w-3 h-3" /> Uppgiften auto-tilldelas vid skapande
            </p>
          </CardContent>
        </Card>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <col.icon className={cn('w-4 h-4', col.color)} />
                <span className="text-sm font-semibold">{col.label}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">{colTasks.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[100px] bg-secondary/20 rounded-lg p-2">
                {colTasks.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Inga uppgifter</p>
                )}
                {colTasks.map(task => (
                  <Card key={task.id} className="border-border hover:shadow-sm transition-shadow">
                    <CardContent className="pt-3 pb-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium leading-tight">{task.title}</h4>
                        <Badge variant="outline" className={cn('text-[9px] shrink-0', PRIORITY_COLORS[task.priority])}>
                          {task.priority === 'high' ? 'HÖG' : task.priority === 'medium' ? 'MED' : 'LÅG'}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-[9px]">
                          {TASK_TYPES.find(t => t.key === task.task_type)?.label || task.task_type}
                        </Badge>
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
                      <div className="flex gap-1 pt-1">
                        {task.status === 'open' && !task.assigned_to && (
                          <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 gap-0.5"
                            onClick={() => autoAssignSingle(task.id, task.task_type)}>
                            <Zap className="w-3 h-3" /> Tilldela
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
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkbenchBoard;
