import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, RefreshCw, AlertTriangle, Bug, ShieldAlert, ChevronRight, ChevronDown, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import AdminBreadcrumbs from '@/components/admin/AdminBreadcrumbs';
import { toast } from 'sonner';

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-muted text-muted-foreground',
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  escalated: 'bg-red-100 text-red-800',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-muted text-muted-foreground',
};

interface WorkItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  item_type: string;
  source_type: string | null;
  created_at: string;
  updated_at: string;
  related_order_id: string | null;
  due_at: string | null;
  ignored: boolean;
}

const AdminIssues = () => {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const markAsDone = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('work_items').update({ status: 'done' } as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['admin-issues-list'] });
    toast.success('Markerad som klar');
  };

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-issues-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('work_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      return (data || []) as WorkItem[];
    },
  });

  const filtered = useMemo(() => {
    return items
      .filter(i => !i.ignored)
      .filter(i => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'active') return !['done', 'cancelled', 'completed'].includes(i.status);
        if (statusFilter === 'open') return i.status === 'open';
        return i.status === statusFilter;
      })
      .filter(i => typeFilter === 'all' || i.item_type === typeFilter)
      .filter(i =>
        !search ||
        i.title?.toLowerCase().includes(search.toLowerCase()) ||
        i.description?.toLowerCase().includes(search.toLowerCase())
      );
  }, [items, search, statusFilter, typeFilter]);

  const counts = useMemo(() => {
    const active = items.filter(i => !i.ignored);
    return {
      total: active.length,
      open: active.filter(i => !['done', 'cancelled'].includes(i.status)).length,
      done: active.filter(i => i.status === 'done').length,
      bugs: active.filter(i => i.item_type === 'bug' && i.status !== 'done').length,
      incidents: active.filter(i => i.item_type === 'incident' && i.status !== 'done').length,
    };
  }, [items]);

  return (
    <div className="space-y-4">
      <AdminBreadcrumbs items={[{ label: 'Issues', href: '/admin/issues' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Issues ({counts.total})</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Uppdatera
        </Button>
      </div>

      {/* Quick stats */}
      <div className="flex gap-2 flex-wrap text-xs">
        <Badge variant="outline" className="cursor-pointer" onClick={() => setStatusFilter('all')}>
          Alla: {counts.total}
        </Badge>
        <Badge variant="outline" className="cursor-pointer bg-blue-50" onClick={() => setStatusFilter('open')}>
          Aktiva: {counts.open}
        </Badge>
        <Badge variant="outline" className="cursor-pointer bg-green-50" onClick={() => setStatusFilter('done')}>
          Klara: {counts.done}
        </Badge>
        <Badge variant="outline" className="cursor-pointer bg-red-50" onClick={() => setTypeFilter('bug')}>
          <Bug className="w-3 h-3 mr-1" /> Buggar: {counts.bugs}
        </Badge>
        <Badge variant="outline" className="cursor-pointer bg-amber-50" onClick={() => setTypeFilter('incident')}>
          <ShieldAlert className="w-3 h-3 mr-1" /> Incidents: {counts.incidents}
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Sök ärenden..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            <SelectItem value="active">Aktiva</SelectItem>
            <SelectItem value="open">Öppen</SelectItem>
            <SelectItem value="in_progress">Pågår</SelectItem>
            <SelectItem value="escalated">Eskalerad</SelectItem>
            <SelectItem value="done">Klar</SelectItem>
            <SelectItem value="cancelled">Avbruten</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla typer</SelectItem>
            <SelectItem value="bug">Bugg</SelectItem>
            <SelectItem value="incident">Incident</SelectItem>
            <SelectItem value="task">Uppgift</SelectItem>
            <SelectItem value="improvement">Förbättring</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <ScrollArea className="h-[65vh]">
        <div className="space-y-1.5">
          {isLoading && <p className="text-sm text-muted-foreground p-4">Laddar...</p>}
          {!isLoading && filtered.length === 0 && <p className="text-sm text-muted-foreground p-4">Inga ärenden hittade.</p>}
          {filtered.map(item => {
            const isOpen = expandedId === item.id;
            return (
              <Card
                key={item.id}
                className="border-border/50 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => setExpandedId(isOpen ? null : item.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    {item.item_type === 'bug' ? (
                      <Bug className="h-4 w-4 text-red-500 shrink-0" />
                    ) : item.item_type === 'incident' ? (
                      <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-medium flex-1 truncate">{item.title}</span>
                    <Badge variant="outline" className={cn('text-[10px]', statusColors[item.status] || '')}>{item.status}</Badge>
                    <Badge variant="outline" className={cn('text-[10px]', severityColors[item.priority] || '')}>{item.priority}</Badge>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(item.created_at), 'dd MMM')}</span>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2 text-sm">
                      {item.description && <p className="text-muted-foreground">{item.description}</p>}
                      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                        <span>Typ: {item.item_type}</span>
                        {item.source_type && <span>Källa: {item.source_type}</span>}
                        {item.related_order_id && <span>Order: {item.related_order_id.slice(0, 8)}</span>}
                        {item.due_at && <span>Deadline: {format(new Date(item.due_at), 'dd MMM HH:mm')}</span>}
                        <span>ID: {item.id.slice(0, 8)}</span>
                      </div>
                      {item.status !== 'done' && (
                        <Button size="sm" variant="outline" className="gap-1.5 mt-2" onClick={(e) => markAsDone(item.id, e)}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Markera som klar
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AdminIssues;
