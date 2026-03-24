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
  FastForward, Pause, ArrowRight, Sparkles, Timer, ToggleRight, Bug, Link2,
  GitBranch, Copy, Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { getOrderDisplayId } from '@/utils/orderDisplay';
import WorkItemDetail from './WorkItemDetail';
import { useNavigate } from 'react-router-dom';

interface WorkItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  claimed_by: string | null;
  item_type: string;
  source_type: string | null;
  source_id: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  related_order_id: string | null;
  related_incident_id: string | null;
  claimed_at: string | null;
  depends_on?: string[];
  blocks?: string[];
  duplicate_of?: string;
  conflict_flag?: boolean;
  execution_order?: number;
  orchestrator_result?: any;
  ai_type_classification?: string;
  ai_type_reason?: string;
  ai_review_status?: string;
  ai_review_result?: any;
  ai_review_at?: string;
  resolution_notes?: string;
}

const STATUS_COLUMNS = [
  { key: 'open', label: 'Öppna', icon: Circle, color: 'text-muted-foreground' },
  { key: 'claimed', label: 'Tagna', icon: User, color: 'text-blue-600' },
  { key: 'in_progress', label: 'Pågående', icon: Play, color: 'text-orange-600' },
  { key: 'escalated', label: 'Eskalerade', icon: AlertTriangle, color: 'text-destructive' },
  { key: 'done', label: 'Klara', icon: CheckCircle2, color: 'text-green-600' },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-destructive/20 text-destructive border-destructive/30',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  low: 'bg-green-500/10 text-green-700 border-green-500/20',
};

const ITEM_TYPE_META: Record<string, { label: string; icon: typeof Package; color: string }> = {
  pack_order: { label: 'Packning', icon: Package, color: 'text-orange-600 bg-orange-600/10' },
  packing: { label: 'Packning', icon: Package, color: 'text-orange-600 bg-orange-600/10' },
  shipping: { label: 'Frakt', icon: Package, color: 'text-blue-600 bg-blue-600/10' },
  support_case: { label: 'Support', icon: Headphones, color: 'text-cyan-600 bg-cyan-600/10' },
  support: { label: 'Support', icon: Headphones, color: 'text-cyan-600 bg-cyan-600/10' },
  refund_request: { label: 'Återbetalning', icon: RotateCcw, color: 'text-purple-600 bg-purple-600/10' },
  refund: { label: 'Återbetalning', icon: RotateCcw, color: 'text-purple-600 bg-purple-600/10' },
  incident: { label: 'Incident', icon: ShieldAlert, color: 'text-destructive bg-destructive/10' },
  bug: { label: 'Bugg', icon: Bug, color: 'text-red-600 bg-red-600/10' },
  sla: { label: 'SLA', icon: Clock, color: 'text-amber-600 bg-amber-600/10' },
  review: { label: 'Recension', icon: FileText, color: 'text-pink-600 bg-pink-600/10' },
  manual: { label: 'Manuell', icon: Wrench, color: 'text-muted-foreground bg-secondary' },
  manual_task: { label: 'Manuell', icon: Wrench, color: 'text-muted-foreground bg-secondary' },
  general: { label: 'Allmänt', icon: FileText, color: 'text-muted-foreground bg-secondary' },
  other: { label: 'Övrigt', icon: FileText, color: 'text-muted-foreground bg-secondary' },
};

const ITEM_TYPES = [
  { key: 'general', label: 'Allmänt' },
  { key: 'pack_order', label: 'Packning' },
  { key: 'shipping', label: 'Frakt' },
  { key: 'support_case', label: 'Support' },
  { key: 'refund_request', label: 'Återbetalning' },
  { key: 'incident', label: 'Incident' },
  { key: 'bug', label: 'Bugg' },
  { key: 'manual', label: 'Manuell' },
  { key: 'other', label: 'Övrigt' },
];

const AI_CLASSIFICATION_META: Record<string, { label: string; icon: typeof Bug; color: string }> = {
  bug: { label: 'Bugg', icon: Bug, color: 'text-red-600 bg-red-600/10' },
  improvement: { label: 'Förbättring', icon: Zap, color: 'text-amber-600 bg-amber-600/10' },
  feature: { label: 'Feature', icon: Sparkles, color: 'text-blue-600 bg-blue-600/10' },
  upgrade: { label: 'Upgrade', icon: ShieldAlert, color: 'text-purple-600 bg-purple-600/10' },
  task: { label: 'Uppgift', icon: Wrench, color: 'text-muted-foreground bg-secondary' },
};

type ViewFilter = 'active' | 'mine' | 'review' | 'done' | 'escalated' | 'bugs' | 'improvements' | 'features';

interface Props {
  initialFilter?: string;
}

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
  const [runningOrchestrator, setRunningOrchestrator] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('active');
  const [escalating, setEscalating] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [sessionStart] = useState(Date.now());
  const workModeRef = useRef(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [detailItem, setDetailItem] = useState<WorkItem | null>(null);
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

  const getItemAutomationBadge = (itemId: string) => {
    const log = automationLogs.find(l => l.target_id === itemId);
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
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['automation-logs-recent'] });
    } catch (e: any) {
      toast.error('Automation misslyckades: ' + e.message);
    } finally {
      setRunningAutomation(false);
    }
  };

  const runOrchestrator = async () => {
    setRunningOrchestrator(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-task-manager', { body: { action: 'orchestrate' } });
      if (error) throw error;
      const r = data?.results;
      toast.success(`Orchestrator klar: ${r?.orchestrated || 0} uppgifter analyserade`);
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    } catch (e: any) {
      toast.error('Orchestrator misslyckades: ' + e.message);
    } finally {
      setRunningOrchestrator(false);
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

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['work-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items' as any)
        .select('*')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as WorkItem[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('work-items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['work-items'] });
        queryClient.invalidateQueries({ queryKey: ['workbench-stats'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

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

  const getClassification = (item: WorkItem) => item.ai_type_classification || (item.item_type === 'bug' ? 'bug' : null);

  const filteredItems = items.filter(t => {
    if (viewFilter === 'active') return !['done', 'cancelled'].includes(t.status);
    if (viewFilter === 'mine') {
      const isMine = t.assigned_to === user?.id || t.claimed_by === user?.id;
      if (isMine) return t.status !== 'done';
      return false;
    }
    if (viewFilter === 'review') return t.status === 'done' && (t as any).ai_review_status !== 'verified';
    if (viewFilter === 'done') return t.status === 'done';
    if (viewFilter === 'escalated') return t.status === 'escalated';
    if (viewFilter === 'bugs') return getClassification(t) === 'bug' && t.status !== 'done';
    if (viewFilter === 'improvements') return getClassification(t) === 'improvement' && t.status !== 'done';
    if (viewFilter === 'features') {
      const c = getClassification(t);
      return (c === 'feature' || c === 'upgrade') && t.status !== 'done';
    }
    return t.status !== 'done';
  });

  const myActiveCount = items.filter(t => (t.assigned_to === user?.id || t.claimed_by === user?.id) && t.status !== 'done' && t.status !== 'cancelled').length;

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.status === 'escalated' && b.status !== 'escalated') return -1;
    if (b.status === 'escalated' && a.status !== 'escalated') return 1;
    const aOrder = a.execution_order ?? 999;
    const bOrder = b.execution_order ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const pOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const pDiff = (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
    if (pDiff !== 0) return pDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const escalateItem = async (itemId: string) => {
    if (!user) return;
    setEscalating(itemId);
    try {
      await supabase.from('work_items' as any).update({
        status: 'escalated',
        priority: 'high',
        updated_at: new Date().toISOString(),
      }).eq('id', itemId);

      const { data: adminUser } = await supabase.rpc('auto_assign_work_item', { p_item_type: 'support' });
      if (adminUser) {
        await supabase.from('work_items' as any).update({ assigned_to: adminUser }).eq('id', itemId);
      }

      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'founder'] as any[]);

      const item = items.find(t => t.id === itemId);
      for (const a of admins || []) {
        await supabase.from('notifications').insert({
          user_id: a.user_id,
          type: 'urgent',
          message: `🚨 Eskalerad: ${item?.title || 'Uppgift'}`,
          related_id: itemId,
          related_type: 'work_item',
        });
      }

      await supabase.from('automation_logs').insert({
        action_type: 'escalate',
        target_type: 'work_item',
        target_id: itemId,
        reason: `Manuellt eskalerad av ${getStaffName(user.id) || 'personal'}`,
        details: { escalated_by: user.id },
      });

      toast.success('Uppgift eskalerad → admins notifierade');
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['automation-logs-recent'] });
    } catch {
      toast.error('Kunde inte eskalera');
    } finally {
      setEscalating(null);
    }
  };

  const autoAssignSingle = async (itemId: string, itemType: string) => {
    const { data, error } = await supabase.rpc('auto_assign_work_item', { p_item_type: itemType });
    if (error || !data) { toast.error('Ingen tillgänglig personal'); return; }
    await supabase.from('work_items' as any).update({ assigned_to: data, status: 'claimed', claimed_by: data, claimed_at: new Date().toISOString() }).eq('id', itemId);
    toast.success(`Tilldelad till ${getStaffName(data as string) || 'personal'}`);
    queryClient.invalidateQueries({ queryKey: ['work-items'] });
  };

  const autoAssignAll = async () => {
    const openItems = items.filter(t => t.status === 'open' && !t.assigned_to);
    if (!openItems.length) { toast.info('Inga öppna uppgifter'); return; }
    setAutoAssigning(true);
    let assigned = 0;
    for (const item of openItems) {
      const { data } = await supabase.rpc('auto_assign_work_item', { p_item_type: item.item_type });
      if (data) {
        await supabase.from('work_items' as any).update({ assigned_to: data, status: 'claimed', claimed_by: data, claimed_at: new Date().toISOString() }).eq('id', item.id);
        assigned++;
      }
    }
    toast.success(`${assigned} av ${openItems.length} fördelade`);
    queryClient.invalidateQueries({ queryKey: ['work-items'] });
    setAutoAssigning(false);
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !user) return;
    setCreating(true);
    try {
      const { data: bestUser } = await supabase.rpc('auto_assign_work_item', { p_item_type: newType });
      await supabase.from('work_items' as any).insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        priority: newPriority,
        item_type: newType,
        source_type: 'manual',
        created_by: user.id,
        ...(bestUser ? { assigned_to: bestUser, status: 'claimed', claimed_by: bestUser, claimed_at: new Date().toISOString() } : {}),
      });
      toast.success(bestUser ? `Skapad → tilldelad ${getStaffName(bestUser as string)}` : 'Skapad (ingen tillgänglig)');
      setNewTitle(''); setNewDesc(''); setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    } catch (err: any) {
      toast.error(err?.message || 'Fel');
    } finally {
      setCreating(false);
    }
  };

  const unclaimItem = async (itemId: string) => {
    if (!user) return;
    await supabase.from('work_items' as any).update({
      status: 'open', assigned_to: null, claimed_by: null, claimed_at: null, updated_at: new Date().toISOString(),
    }).eq('id', itemId);
    toast.success('Uppdrag släppt');
    queryClient.invalidateQueries({ queryKey: ['work-items'] });
  };

  const hasOpenedLabelCheckpoint = (statusHistory: any): boolean => {
    if (!Array.isArray(statusHistory)) return false;
    return statusHistory.some((entry: any) => entry?.status === 'label_opened' || entry?.label_opened === true);
  };

  const openOrderFromItem = (item: WorkItem) => {
    if (!item.related_order_id) return;
    navigate(`/admin/orders?tab=to_pack&focus=${item.related_order_id}`);
  };

  const moveItem = async (itemId: string, newStatus: string) => {
    if (!user) return;

    if (newStatus === 'done') {
      const currentItem = items.find((t) => t.id === itemId);
      if (currentItem?.related_order_id && ['pack_order', 'packing'].includes(currentItem.item_type)) {
        const { data: order } = await supabase
          .from('orders')
          .select('payment_status, fulfillment_status, status_history')
          .eq('id', currentItem.related_order_id)
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
    await supabase.from('work_items' as any).update(updates).eq('id', itemId);
    queryClient.invalidateQueries({ queryKey: ['work-items'] });

    if (newStatus === 'done') {
      setCompletedCount(prev => prev + 1);
      setJustCompleted(itemId);
      toast.success('Klar ✓ — AI granskar...');
      // Trigger AI review — await and handle result
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('ai-review-fix', { body: { work_item_id: itemId } });
          if (error) {
            console.error('AI review error:', error);
            toast.error('AI-granskning misslyckades — manuell granskning krävs');
            // Set fallback status
            await supabase.from('work_items' as any).update({
              ai_review_status: 'needs_review',
              ai_review_result: { status: 'needs_review', verdict: 'AI-granskning misslyckades', confidence: 0 },
              ai_review_at: new Date().toISOString(),
            }).eq('id', itemId);
          } else if (data?.review) {
            const reviewStatus = data.review.status;
            if (reviewStatus === 'verified') {
              toast.success('AI: ✅ Verifierad');
            } else if (reviewStatus === 'needs_review') {
              toast.warning('AI: ⚠️ Behöver granskning');
            } else {
              toast.error('AI: ❌ Ofullständig');
            }
          }
          queryClient.invalidateQueries({ queryKey: ['work-items'] });
        } catch (e) {
          console.error('AI review failed:', e);
          toast.error('AI-granskning misslyckades');
        }
      })();
      setTimeout(() => {
        setJustCompleted(null);
        if (workModeRef.current && autoNext) {
          const next = getNextAction();
          if (next) {
            if (next.status === 'open') {
              moveItem(next.id, 'claimed');
            } else if (next.status === 'claimed') {
              moveItem(next.id, 'in_progress');
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

  const getNextAction = useCallback((): WorkItem | null => {
    const activeItems = items.filter(t =>
      t.status !== 'done' && t.status !== 'cancelled' &&
      (t.assigned_to === user?.id || t.claimed_by === user?.id || t.status === 'open')
    );
    const escalated = activeItems.filter(t => t.status === 'escalated');
    if (escalated.length) return escalated[0];
    const myInProgress = activeItems.filter(t => t.status === 'in_progress' && (t.claimed_by === user?.id || t.assigned_to === user?.id));
    if (myInProgress.length) return myInProgress[0];
    const myClaimed = activeItems.filter(t => t.status === 'claimed' && (t.claimed_by === user?.id || t.assigned_to === user?.id));
    if (myClaimed.length) return myClaimed[0];
    const highOpen = activeItems.filter(t => t.status === 'open' && (t.priority === 'high' || t.priority === 'critical'));
    if (highOpen.length) return highOpen[0];
    const anyOpen = activeItems.filter(t => t.status === 'open');
    if (anyOpen.length) return anyOpen[0];
    return null;
  }, [items, user?.id]);

  const nextAction = getNextAction();

  const startWorkMode = async () => {
    setWorkMode(true);
    const next = getNextAction();
    if (next) {
      if (next.status === 'open') {
        await moveItem(next.id, 'claimed');
      } else if (next.status === 'claimed') {
        await moveItem(next.id, 'in_progress');
      }
      toast.success('Arbetsläge aktiverat – kör på!');
    } else {
      toast.info('Inga uppgifter att starta');
      setWorkMode(false);
    }
  };

  const escalatedCount = items.filter(t => t.status === 'escalated').length;
  const myCount = items.filter(t => (t.assigned_to === user?.id || t.claimed_by === user?.id) && t.status !== 'done').length;
  const doneCount = items.filter(t => t.status === 'done').length;
  const reviewCount = items.filter(t => t.status === 'done' && (t as any).ai_review_status !== 'verified').length;
  const activeCount = items.filter(t => !['done', 'cancelled'].includes(t.status)).length;
  const openCount = items.filter(t => t.status === 'open' && !t.assigned_to).length;
  const bugCount = items.filter(t => getClassification(t) === 'bug' && t.status !== 'done').length;
  const improvementCount = items.filter(t => getClassification(t) === 'improvement' && t.status !== 'done').length;
  const featureCount = items.filter(t => {
    const c = getClassification(t);
    return (c === 'feature' || c === 'upgrade') && t.status !== 'done';
  }).length;

  const toggleBulkSelect = (itemId: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const bulkClaimAll = async () => {
    if (!user || bulkSelected.size === 0) return;
    const now = new Date().toISOString();
    for (const itemId of bulkSelected) {
      await supabase.from('work_items' as any).update({
        status: 'claimed', claimed_by: user.id, assigned_to: user.id, claimed_at: now, updated_at: now,
      }).eq('id', itemId);
    }
    toast.success(`${bulkSelected.size} uppgifter tagna`);
    setBulkSelected(new Set());
    setBulkMode(false);
    queryClient.invalidateQueries({ queryKey: ['work-items'] });
  };

  const renderItemCard = (item: WorkItem) => {
    const typeMeta = ITEM_TYPE_META[item.item_type] || ITEM_TYPE_META.general;
    const TypeIcon = typeMeta.icon;
    const isEscalated = item.status === 'escalated';
    const hasSource = item.source_type && item.source_type !== 'manual';

    return (
      <Card key={item.id} className={cn(
        'border-border hover:shadow-sm transition-shadow cursor-pointer',
        isEscalated && 'border-destructive/40 bg-destructive/5',
        bulkSelected.has(item.id) && 'ring-2 ring-primary/50'
      )} onClick={() => setDetailItem(item)}>
        <CardContent className="pt-3 pb-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {bulkMode && item.status === 'open' && (
                <button onClick={() => toggleBulkSelect(item.id)} className="shrink-0 mt-0.5">
                  {bulkSelected.has(item.id)
                    ? <CheckCircle2 className="w-4 h-4 text-primary" />
                    : <Circle className="w-4 h-4 text-muted-foreground" />}
                </button>
              )}
              <div className={cn('w-5 h-5 rounded flex items-center justify-center shrink-0', typeMeta.color)}>
                <TypeIcon className="w-3 h-3" />
              </div>
              <h4 className="text-sm font-medium leading-tight truncate">{item.title}</h4>
            </div>
            <Badge variant="outline" className={cn('text-[9px] shrink-0', PRIORITY_COLORS[item.priority])}>
              {item.priority === 'critical' ? 'KRIT' : item.priority === 'high' ? 'HÖG' : item.priority === 'medium' ? 'MED' : 'LÅG'}
            </Badge>
          </div>

          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className={cn('text-[9px] gap-0.5', typeMeta.color)}>
              <TypeIcon className="w-2.5 h-2.5" />
              {typeMeta.label}
            </Badge>
            {item.ai_type_classification && AI_CLASSIFICATION_META[item.ai_type_classification] && (() => {
              const cls = AI_CLASSIFICATION_META[item.ai_type_classification!];
              const ClsIcon = cls.icon;
              return (
                <Badge variant="outline" className={cn('text-[9px] gap-0.5', cls.color)}>
                  <ClsIcon className="w-2.5 h-2.5" />
                  {cls.label}
                </Badge>
              );
            })()}
            {hasSource && (
              <Badge variant="outline" className="text-[9px] gap-0.5 bg-blue-50 text-blue-600 border-blue-200">
                <Link2 className="w-2.5 h-2.5" />
                {item.source_type === 'bug_report' ? 'Bug' : item.source_type === 'order_incident' ? 'Incident' : item.source_type}
              </Badge>
            )}
            {isEscalated && (
              <Badge variant="destructive" className="text-[9px] gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> Eskalerad
              </Badge>
            )}
            {getItemAutomationBadge(item.id) && (
              <Badge variant="outline" className="text-[9px] gap-0.5 bg-purple-100 text-purple-700 border-purple-200">
                <Bot className="w-2.5 h-2.5" />
                {getItemAutomationBadge(item.id) === 'escalate' ? 'Auto-eskalerad' :
                 getItemAutomationBadge(item.id) === 'reassign' ? 'Omfördelad' : 'Auto'}
              </Badge>
            )}
            {item.depends_on && item.depends_on.length > 0 && (
              <Badge variant="outline" className="text-[9px] gap-0.5 bg-amber-50 text-amber-700 border-amber-200">
                <GitBranch className="w-2.5 h-2.5" /> Blockerad av {item.depends_on.length}
              </Badge>
            )}
            {item.blocks && item.blocks.length > 0 && (
              <Badge variant="outline" className="text-[9px] gap-0.5 bg-red-50 text-red-600 border-red-200">
                <GitBranch className="w-2.5 h-2.5" /> Blockerar {item.blocks.length}
              </Badge>
            )}
            {item.duplicate_of && (
              <Badge variant="outline" className="text-[9px] gap-0.5 bg-gray-100 text-gray-600 border-gray-300">
                <Copy className="w-2.5 h-2.5" /> Duplikat
              </Badge>
            )}
            {item.conflict_flag && (
              <Badge variant="outline" className="text-[9px] gap-0.5 bg-destructive/10 text-destructive border-destructive/30">
                <AlertTriangle className="w-2.5 h-2.5" /> Konflikt
              </Badge>
            )}
            {item.execution_order != null && item.execution_order < 10 && (
              <Badge variant="outline" className="text-[9px] gap-0.5 bg-primary/10 text-primary border-primary/30">
                <Layers className="w-2.5 h-2.5" /> #{item.execution_order}
              </Badge>
            )}
            {item.assigned_to && (
              <Badge variant="outline" className="text-[9px] gap-0.5">
                <UserCheck className="w-2.5 h-2.5" />
                {getStaffName(item.assigned_to)}
              </Badge>
            )}
            {item.due_at && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {format(new Date(item.due_at), 'dd/MM HH:mm')}
              </span>
            )}
          </div>

          <div className="flex gap-1 pt-1 flex-wrap" onClick={e => e.stopPropagation()}>
            {item.related_order_id && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] h-6 px-2"
                onClick={() => openOrderFromItem(item)}
              >
                Öppna order
              </Button>
            )}
            {item.status === 'open' && !item.assigned_to && (
              <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 gap-0.5"
                onClick={() => autoAssignSingle(item.id, item.item_type)}>
                <Zap className="w-3 h-3" /> Tilldela
              </Button>
            )}
            {['claimed', 'in_progress'].includes(item.status) && (item.claimed_by === user?.id || item.assigned_to === user?.id) && (
              <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 gap-0.5 text-muted-foreground"
                onClick={() => unclaimItem(item.id)}>
                <X className="w-3 h-3" /> Släpp
              </Button>
            )}
            {['open', 'claimed', 'in_progress'].includes(item.status) && (
              <Button variant="outline" size="sm"
                className="text-[10px] h-6 px-2 gap-0.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => escalateItem(item.id)}
                disabled={escalating === item.id}>
                <AlertTriangle className="w-3 h-3" /> Eskalera
              </Button>
            )}
            {getPrevStatus(item.status) && (
              <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => moveItem(item.id, getPrevStatus(item.status)!)}>
                ← Tillbaka
              </Button>
            )}
            {getNextStatus(item.status) && (
              <Button variant="default" size="sm" className="text-[10px] h-6 px-2 ml-auto" onClick={() => moveItem(item.id, getNextStatus(item.status)!)}>
                {getNextStatus(item.status) === 'claimed' ? 'Ta' :
                 getNextStatus(item.status) === 'in_progress' ? 'Starta' : 'Klar'} →
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
                      {nextAction.priority === 'critical' ? 'KRIT' : nextAction.priority === 'high' ? 'HÖG' : nextAction.priority === 'medium' ? 'MED' : 'LÅG'}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px]">
                      {(ITEM_TYPE_META[nextAction.item_type] || ITEM_TYPE_META.general).label}
                    </Badge>
                    {nextAction.related_order_id && (
                      <Badge variant="outline" className="text-[9px] gap-0.5">
                        <Package className="w-2.5 h-2.5" /> Order
                      </Badge>
                    )}
                    {nextAction.source_type && nextAction.source_type !== 'manual' && (
                      <Badge variant="outline" className="text-[9px] gap-0.5 bg-blue-50 text-blue-600 border-blue-200">
                        <Link2 className="w-2.5 h-2.5" />
                        {nextAction.source_type === 'bug_report' ? 'Bug' : nextAction.source_type === 'order_incident' ? 'Incident' : nextAction.source_type}
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
                      <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => openOrderFromItem(nextAction)}>
                        Öppna order
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                      if (nextAction.status === 'open') moveItem(nextAction.id, 'claimed');
                      else if (nextAction.status === 'claimed') moveItem(nextAction.id, 'in_progress');
                      else if (['in_progress', 'escalated'].includes(nextAction.status)) moveItem(nextAction.id, 'done');
                    }}>
                      {nextAction.status === 'open' ? 'Ta' : nextAction.status === 'claimed' ? 'Starta' : 'Klar'} <ArrowRight className="w-3 h-3" />
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={startWorkMode}>
                      <FastForward className="w-4 h-4" /> Arbetsläge
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="default" className="gap-1.5" onClick={() => moveItem(nextAction.id, 'done')}>
                      <CheckCircle2 className="w-4 h-4" /> Klar → Nästa
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setWorkMode(false); toast.info('Arbetsläge avslutat'); }}>
                      <Pause className="w-4 h-4" /> Pausa
                    </Button>
                  </>
                )}
              </div>
            </div>

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
      <Tabs value={viewFilter} onValueChange={v => { setViewFilter(v as ViewFilter); setBulkMode(false); setBulkSelected(new Set()); }}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="active" className="gap-1.5">
            Aktiva <Badge variant="secondary" className="text-[9px] ml-1">{activeCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="mine" className="gap-1.5">
            Mina {myCount > 0 ? <Badge variant="secondary" className="text-[9px] ml-1">{myCount}</Badge> : <span className="text-[9px] text-muted-foreground ml-1">(visar öppna)</span>}
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5">
            Granskning {reviewCount > 0 && <Badge variant="outline" className="text-[9px] ml-1 bg-amber-100 text-amber-700 border-amber-200">{reviewCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="bugs" className="gap-1.5">
            <Bug className="w-3.5 h-3.5" /> Buggar
            {bugCount > 0 && <Badge variant="destructive" className="text-[9px] ml-1">{bugCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="improvements" className="gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Förbättringar
            {improvementCount > 0 && <Badge variant="secondary" className="text-[9px] ml-1">{improvementCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Features
            {featureCount > 0 && <Badge variant="secondary" className="text-[9px] ml-1">{featureCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="escalated" className={cn('gap-1.5', escalatedCount > 0 && 'text-destructive')}>
            <AlertTriangle className="w-3.5 h-3.5" /> Eskalerade
            {escalatedCount > 0 && <Badge variant="destructive" className="text-[9px] ml-1">{escalatedCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="done" className="gap-1.5">
            Historik {doneCount > 0 && <Badge variant="secondary" className="text-[9px] ml-1">{doneCount}</Badge>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{sortedItems.length} uppgifter{viewFilter === 'mine' && myActiveCount === 0 ? ' (visar öppna – du har inga aktiva)' : ''}</p>
        <div className="flex gap-2">
          {viewFilter === 'active' && openCount > 0 && (
            <Button size="sm" variant={bulkMode ? 'default' : 'outline'} className="gap-1.5" onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }}>
              {bulkMode ? <X className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {bulkMode ? 'Avbryt' : 'Markera'}
            </Button>
          )}
          {bulkMode && bulkSelected.size > 0 && (
            <Button size="sm" className="gap-1.5" onClick={bulkClaimAll}>
              <UserCheck className="w-4 h-4" /> Ta alla ({bulkSelected.size})
            </Button>
          )}
          {openCount > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={autoAssignAll} disabled={autoAssigning}>
              <Zap className="w-4 h-4" /> Auto-fördela ({openCount})
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={runAutomation} disabled={runningAutomation}>
            <Bot className="w-4 h-4" /> {runningAutomation ? 'Kör...' : 'Automation'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={runOrchestrator} disabled={runningOrchestrator}>
            <Layers className="w-4 h-4" /> {runningOrchestrator ? 'Analyserar...' : 'AI Orchestrator'}
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
                  <SelectItem value="critical">Kritisk</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
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
          const colItems = sortedItems.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <col.icon className={cn('w-4 h-4', col.color)} />
                <span className="text-sm font-semibold">{col.label}</span>
                <Badge variant={col.key === 'escalated' && colItems.length > 0 ? 'destructive' : 'secondary'} className="text-[10px] ml-auto">
                  {colItems.length}
                </Badge>
              </div>
              <div className={cn(
                'space-y-2 min-h-[100px] rounded-lg p-2',
                col.key === 'escalated' && colItems.length > 0 ? 'bg-destructive/5' : 'bg-secondary/20'
              )}>
                {colItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Inga uppgifter</p>
                )}
                {colItems.map(renderItemCard)}
              </div>
            </div>
          );
        })}
      </div>

      <WorkItemDetail
        item={detailItem}
        open={!!detailItem}
        onOpenChange={(open) => { if (!open) setDetailItem(null); }}
        onStatusChange={async (itemId, newStatus) => {
          await moveItem(itemId, newStatus);
        }}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['work-items'] });
          // Re-fetch the detail item
          if (detailItem) {
            supabase.from('work_items' as any).select('*').eq('id', detailItem.id).maybeSingle().then(({ data }) => {
              if (data) setDetailItem(data as any);
            });
          }
        }}
      />
    </div>
  );
};

export default WorkbenchBoard;
