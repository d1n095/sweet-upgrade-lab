import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AlertTriangle, Clock, CheckCircle, Plus, User } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Incident {
  id: string;
  order_id: string;
  reported_by: string | null;
  assigned_to: string | null;
  type: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  resolution: string | null;
  sla_deadline: string | null;
  sla_status: string;
  escalated_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

const priorityConfig: Record<string, { label: string; color: string; icon: any }> = {
  high: { label: 'Hög', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle },
  medium: { label: 'Medium', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
  low: { label: 'Låg', color: 'bg-muted text-muted-foreground border-border', icon: CheckCircle },
};

const slaColors: Record<string, string> = {
  ok: 'text-emerald-600',
  warning: 'text-amber-500',
  overdue: 'text-destructive font-bold',
};

const statusLabels: Record<string, string> = {
  open: 'Öppen',
  in_progress: 'Pågår',
  escalated: 'Eskalerad',
  resolved: 'Löst',
  closed: 'Stängd',
};

interface Props {
  orderId?: string;
}

const AdminIncidentManager = ({ orderId }: Props) => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('open');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'other', priority: 'medium', order_id: orderId || '' });

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('order_incidents').select('*').order('created_at', { ascending: false });
    if (orderId) q = q.eq('order_id', orderId);
    if (filter && filter !== 'all') {
      if (filter === 'overdue') q = q.eq('sla_status', 'overdue').in('status', ['open', 'in_progress']);
      else q = q.eq('status', filter);
    }
    const { data } = await q.limit(100);
    setIncidents((data || []) as Incident[]);
    setLoading(false);
  }, [filter, orderId]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  const createIncident = async () => {
    if (!form.title || !form.order_id) { toast.error('Titel och order krävs'); return; }
    const { error } = await supabase.from('order_incidents').insert({
      title: form.title,
      description: form.description || null,
      type: form.type,
      priority: form.priority,
      order_id: form.order_id,
      reported_by: user?.id,
      status: 'open',
    });
    if (error) { toast.error('Kunde inte skapa ärende'); return; }
    toast.success('Ärende skapat');
    setShowCreate(false);
    setForm({ title: '', description: '', type: 'other', priority: 'medium', order_id: orderId || '' });
    fetchIncidents();
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();
    if (status === 'escalated') updates.escalated_at = new Date().toISOString();
    await supabase.from('order_incidents').update(updates).eq('id', id);
    toast.success('Status uppdaterad');
    fetchIncidents();
  };

  const stats = {
    open: incidents.filter(i => i.status === 'open').length,
    overdue: incidents.filter(i => i.sla_status === 'overdue' && !['resolved', 'closed'].includes(i.status)).length,
    high: incidents.filter(i => i.priority === 'high' && !['resolved', 'closed'].includes(i.status)).length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Öppna', value: stats.open, onClick: () => setFilter('open') },
          { label: 'Försenade', value: stats.overdue, onClick: () => setFilter('overdue'), urgent: stats.overdue > 0 },
          { label: 'Hög prio', value: stats.high, onClick: () => setFilter('all') },
          { label: 'Alla', value: incidents.length, onClick: () => setFilter('all') },
        ].map(s => (
          <button key={s.label} onClick={s.onClick} className={cn(
            'rounded-xl border p-3 text-left hover:bg-secondary/50 transition-colors',
            s.urgent && 'border-destructive/30 bg-destructive/5'
          )}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('text-xl font-bold', s.urgent && 'text-destructive')}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            <SelectItem value="open">Öppna</SelectItem>
            <SelectItem value="in_progress">Pågår</SelectItem>
            <SelectItem value="escalated">Eskalerade</SelectItem>
            <SelectItem value="resolved">Lösta</SelectItem>
            <SelectItem value="overdue">Försenade</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Nytt ärende</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Skapa ärende</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Titel" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              {!orderId && (
                <Input placeholder="Order ID (UUID)" value={form.order_id} onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))} />
              )}
              <Textarea placeholder="Beskrivning" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivery">Leverans</SelectItem>
                    <SelectItem value="payment">Betalning</SelectItem>
                    <SelectItem value="product">Produkt</SelectItem>
                    <SelectItem value="refund">Retur/Refund</SelectItem>
                    <SelectItem value="other">Övrigt</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Hög (4h SLA)</SelectItem>
                    <SelectItem value="medium">Medium (24h SLA)</SelectItem>
                    <SelectItem value="low">Låg (48h SLA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createIncident} className="w-full">Skapa</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-4">Laddar...</p>
      ) : incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Inga ärenden</p>
      ) : (
        <div className="space-y-2">
          {incidents.map(inc => {
            const prio = priorityConfig[inc.priority] || priorityConfig.medium;
            const PrioIcon = prio.icon;
            return (
              <Card key={inc.id} className={cn('border', inc.sla_status === 'overdue' && 'border-destructive/40')}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-sm font-semibold">{inc.title}</h4>
                        <Badge variant="outline" className={cn('text-[10px]', prio.color)}>
                          <PrioIcon className="w-3 h-3 mr-1" />{prio.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{statusLabels[inc.status] || inc.status}</Badge>
                      </div>
                      {inc.description && <p className="text-xs text-muted-foreground line-clamp-2">{inc.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span>{format(new Date(inc.created_at), 'dd MMM HH:mm', { locale: sv })}</span>
                        {inc.sla_deadline && (
                          <span className={slaColors[inc.sla_status]}>
                            SLA: {formatDistanceToNow(new Date(inc.sla_deadline), { locale: sv, addSuffix: true })}
                          </span>
                        )}
                        <span className="capitalize">{inc.type}</span>
                      </div>
                    </div>
                    {!['resolved', 'closed'].includes(inc.status) && (
                      <div className="flex gap-1 shrink-0">
                        {inc.status === 'open' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(inc.id, 'in_progress')}>
                            Starta
                          </Button>
                        )}
                        {inc.status !== 'escalated' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-warning" onClick={() => updateStatus(inc.id, 'escalated')}>
                            Eskalera
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600" onClick={() => updateStatus(inc.id, 'resolved')}>
                          Lös
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminIncidentManager;
