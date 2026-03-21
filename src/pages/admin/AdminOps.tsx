import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Package, Truck, CheckCircle2, Clock, AlertTriangle, Search,
  ArrowRight, Eye, ScanLine,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  order_email: string;
  order_number: string | null;
  total_amount: number;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
  tracking_number: string | null;
  payment_intent_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  packing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ready_to_ship: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  shipped: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  delivered: 'bg-green-200 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  pending: 'Väntar',
  unfulfilled: 'Ej packad',
  packing: 'Packas',
  ready_to_ship: 'Redo att skicka',
  shipped: 'Skickad',
  delivered: 'Levererad',
};

type Tab = 'all' | 'to_pack' | 'to_ship' | 'shipped';

const AdminOps = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState({ all: 0, toPack: 0, toShip: 0, shipped: 0 });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('id, order_email, order_number, total_amount, status, payment_status, fulfillment_status, created_at, tracking_number, payment_intent_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);

    const all = (data || []) as Order[];
    setOrders(all);
    setCounts({
      all: all.length,
      toPack: all.filter(o => o.payment_status === 'paid' && ['pending', 'unfulfilled'].includes(o.fulfillment_status)).length,
      toShip: all.filter(o => o.fulfillment_status === 'ready_to_ship').length,
      shipped: all.filter(o => o.fulfillment_status === 'shipped').length,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = orders.filter(o => {
    if (tab === 'to_pack') return o.payment_status === 'paid' && ['pending', 'unfulfilled'].includes(o.fulfillment_status);
    if (tab === 'to_ship') return o.fulfillment_status === 'ready_to_ship';
    if (tab === 'shipped') return o.fulfillment_status === 'shipped';
    return true;
  }).filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (o.order_email?.toLowerCase().includes(s)) ||
      (o.order_number?.toLowerCase().includes(s)) ||
      (o.payment_intent_id?.toLowerCase().includes(s)) ||
      (o.tracking_number?.toLowerCase().includes(s));
  });

  const formatCurrency = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(n);
  const formatTime = (d: string) => {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return new Date(d).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  };

  const tabs: { key: Tab; label: string; count: number; icon: any }[] = [
    { key: 'all', label: 'Alla', count: counts.all, icon: Eye },
    { key: 'to_pack', label: 'Att packa', count: counts.toPack, icon: Package },
    { key: 'to_ship', label: 'Redo att skicka', count: counts.toShip, icon: Truck },
    { key: 'shipped', label: 'Skickade', count: counts.shipped, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Operations</h1>
          <p className="text-sm text-muted-foreground">Ordrar, packning & leverans</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate('/admin/warehouse')}>
            <ScanLine className="w-4 h-4" /> Scan & Pack
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => navigate('/admin/orders')}>
            <ArrowRight className="w-4 h-4" /> Fullständig ordervy
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <Button
            key={t.key}
            size="sm"
            variant={tab === t.key ? 'default' : 'outline'}
            className="gap-2 text-xs"
            onClick={() => setTab(t.key)}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{t.count}</Badge>
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Sök email, ordernr, spårning..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Orders table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Order</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Belopp</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Betalning</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Fulfillment</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Tid</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Laddar...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Inga ordrar hittade</td></tr>
                ) : filtered.slice(0, 50).map(o => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => navigate('/admin/orders')}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium truncate max-w-[200px]">
                        {o.payment_intent_id ? '#' + o.payment_intent_id.slice(-8).toUpperCase() : o.order_email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{o.order_email}</p>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell font-medium">{formatCurrency(o.total_amount)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[o.payment_status])}>
                        {o.payment_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[o.fulfillment_status])}>
                        {FULFILLMENT_LABELS[o.fulfillment_status] || o.fulfillment_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs hidden md:table-cell">{formatTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOps;
