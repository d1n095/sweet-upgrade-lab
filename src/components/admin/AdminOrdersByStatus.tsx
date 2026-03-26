import { useState, useEffect } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  status: string;
  title: string;
  icon: React.ReactNode;
  emptyMessage: string;
}

interface Order {
  id: string;
  order_email: string;
  order_number: string | null;
  status: string;
  payment_status: string;
  total_amount: number;
  currency: string;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
  notes: string | null;
}

const AdminOrdersByStatus = ({ status, title, icon, emptyMessage }: Props) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('orders')
        .select('id, order_email, order_number, status, payment_status, total_amount, currency, tracking_number, created_at, updated_at, notes')
        .eq('status', status)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      setOrders(data || []);
      setLoading(false);
    };
    load();
  }, [status]);

  const filtered = orders.filter(o =>
    !search ||
    o.order_email.toLowerCase().includes(search.toLowerCase()) ||
    o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
    o.tracking_number?.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n: number, c: string) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: c, minimumFractionDigits: 0 }).format(n);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-medium">{title} ({filtered.length})</span>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Sök på email, ordernr, spårning..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{emptyMessage}</p>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map((order) => (
            <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card text-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium font-mono text-xs">
                    {order.order_number || `#${order.id.slice(0, 8)}`}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {order.payment_status === 'paid' ? 'Betald' : order.payment_status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {order.order_email} · {fmt(order.total_amount, order.currency)}
                </p>
                {order.tracking_number && (
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Spårning: {order.tracking_number}
                  </p>
                )}
                {order.notes && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-xs">
                    {order.notes}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Uppdaterad: {fmtDate(order.updated_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminOrdersByStatus;
