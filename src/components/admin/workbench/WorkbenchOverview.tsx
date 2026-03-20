import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, AlertTriangle, Package, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  onNavigate: (tab: string, filter?: string) => void;
}

const WorkbenchOverview = ({ onNavigate }: Props) => {
  const { data: stats } = useQuery({
    queryKey: ['workbench-stats'],
    queryFn: async () => {
      const [tasksRes, incidentsRes, ordersRes] = await Promise.all([
        supabase.from('staff_tasks').select('status', { count: 'exact', head: false }),
        supabase.from('order_incidents').select('status, priority, sla_status'),
        supabase.from('orders').select('status').in('status', ['confirmed', 'processing']),
      ]);

      const tasks = tasksRes.data || [];
      const incidents = incidentsRes.data || [];
      const orders = ordersRes.data || [];

      return {
        openTasks: tasks.filter(t => t.status !== 'done').length,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
        escalatedIncidents: incidents.filter(i => i.sla_status === 'overdue' || i.priority === 'high').length,
        ordersToPack: orders.filter(o => o.status === 'confirmed' || o.status === 'processing').length,
      };
    },
    refetchInterval: 30000,
  });

  const cards = [
    {
      label: 'Aktiva uppgifter',
      value: stats?.openTasks ?? 0,
      icon: ClipboardList,
      color: 'text-blue-600 bg-blue-600/10',
      onClick: () => onNavigate('workboard'),
    },
    {
      label: 'Eskalerade ärenden',
      value: stats?.escalatedIncidents ?? 0,
      icon: AlertTriangle,
      color: 'text-destructive bg-destructive/10',
      onClick: () => onNavigate('workboard', 'high'),
    },
    {
      label: 'Orders att packa',
      value: stats?.ordersToPack ?? 0,
      icon: Package,
      color: 'text-orange-600 bg-orange-600/10',
      onClick: () => onNavigate('workboard', 'packing'),
    },
    {
      label: 'Pågående arbete',
      value: stats?.inProgressTasks ?? 0,
      icon: Clock,
      color: 'text-green-600 bg-green-600/10',
      onClick: () => onNavigate('workboard', 'in_progress'),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card
          key={card.label}
          className="border-border cursor-pointer hover:shadow-md transition-shadow group"
          onClick={card.onClick}
        >
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', card.color)}>
                <card.icon className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default WorkbenchOverview;
