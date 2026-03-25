import { useMemo } from 'react';
import { useAdminWorkItems, useAdminOrders } from '@/hooks/useAdminData';
import { ClipboardList, AlertTriangle, Package, Clock, ArrowRight, Bug, ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  onNavigate: (tab: string, filter?: string) => void;
}

const WorkbenchOverview = ({ onNavigate }: Props) => {
  const { data: rawItems = [] } = useAdminWorkItems();
  const { data: allOrders = [] } = useAdminOrders();

  const stats = useMemo(() => {
    const items = (rawItems as any[]).filter(t => !t.ignored);
    const orders = allOrders.filter(o => o.payment_status === 'paid');

    return {
      openItems: items.filter(t => !['done', 'cancelled'].includes(t.status)).length,
      inProgressItems: items.filter(t => t.status === 'in_progress').length,
      escalatedItems: items.filter(t => t.status === 'escalated' || t.priority === 'critical').length,
      bugItems: items.filter(t => t.item_type === 'bug' && t.status !== 'done').length,
      incidentItems: items.filter(t => t.item_type === 'incident' && t.status !== 'done').length,
      ordersToPack: orders.filter(o => ['pending', 'unfulfilled', 'packing'].includes((o as any).fulfillment_status)).length,
      readyToShip: orders.filter(o => ['ready_to_ship', 'packed'].includes((o as any).fulfillment_status)).length,
    };
  }, [rawItems, allOrders]);

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
