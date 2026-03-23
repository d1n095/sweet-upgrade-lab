import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, AlertTriangle, Package, Clock, ArrowRight, Bug, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  onNavigate: (tab: string, filter?: string) => void;
}

const WorkbenchOverview = ({ onNavigate }: Props) => {
  const { data: stats } = useQuery({
    queryKey: ['workbench-stats'],
    queryFn: async () => {
      const [itemsRes, ordersRes] = await Promise.all([
        supabase.from('work_items' as any).select('status, priority, item_type, source_type').neq('status', 'cancelled'),
        supabase
          .from('orders')
          .select('status, payment_status, fulfillment_status')
          .is('deleted_at', null)
          .neq('status', 'cancelled')
          .eq('payment_status', 'paid'),
      ]);

      const items = (itemsRes.data || []) as any[];
      const orders = ordersRes.data || [];

      return {
        openItems: items.filter(t => !['done', 'cancelled'].includes(t.status)).length,
        inProgressItems: items.filter(t => t.status === 'in_progress').length,
        escalatedItems: items.filter(t => t.status === 'escalated' || t.priority === 'critical').length,
        bugItems: items.filter(t => t.item_type === 'bug' && t.status !== 'done').length,
        incidentItems: items.filter(t => t.item_type === 'incident' && t.status !== 'done').length,
        ordersToPack: orders.filter(o => ['pending', 'unfulfilled', 'packing'].includes((o as any).fulfillment_status)).length,
        readyToShip: orders.filter(o => ['ready_to_ship', 'packed'].includes((o as any).fulfillment_status)).length,
      };
    },
    refetchInterval: 30000,
  });

  const cards = [
    {
      label: 'Aktiva uppgifter',
      value: stats?.openItems ?? 0,
      icon: ClipboardList,
      color: 'text-blue-600 bg-blue-600/10',
      onClick: () => onNavigate('workboard'),
    },
    {
      label: 'Eskalerade',
      value: stats?.escalatedItems ?? 0,
      icon: AlertTriangle,
      color: 'text-destructive bg-destructive/10',
      onClick: () => onNavigate('workboard', 'escalated'),
    },
    {
      label: 'Buggar',
      value: stats?.bugItems ?? 0,
      icon: Bug,
      color: 'text-red-600 bg-red-600/10',
      onClick: () => onNavigate('workboard', 'bugs'),
    },
    {
      label: 'Incidents',
      value: stats?.incidentItems ?? 0,
      icon: ShieldAlert,
      color: 'text-amber-600 bg-amber-600/10',
      onClick: () => onNavigate('workboard', 'incidents'),
    },
    {
      label: 'Orders att packa',
      value: stats?.ordersToPack ?? 0,
      icon: Package,
      color: 'text-orange-600 bg-orange-600/10',
      onClick: () => onNavigate('workboard', 'packing'),
    },
    {
      label: 'Väntar på postning',
      value: stats?.readyToShip ?? 0,
      icon: Clock,
      color: 'text-green-600 bg-green-600/10',
      onClick: () => onNavigate('workboard'),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
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
