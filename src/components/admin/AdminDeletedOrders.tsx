import { useState, useEffect } from 'react';
import { Trash2, RotateCcw, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logActivity } from '@/utils/activityLogger';

interface DeletedOrder {
  id: string;
  order_email: string;
  order_number: string | null;
  status: string;
  payment_status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  deleted_at: string | null;
}

const AdminDeletedOrders = () => {
  const [orders, setOrders] = useState<DeletedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadDeleted(); }, []);

  const loadDeleted = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, order_email, order_number, status, payment_status, total_amount, currency, created_at, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  const handleRestore = async (order: DeletedOrder) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ deleted_at: null })
        .eq('id', order.id);
      if (error) throw error;
      setOrders(prev => prev.filter(o => o.id !== order.id));
      logActivity({
        log_type: 'info',
        category: 'order',
        message: `Order återställd: ${order.order_number || order.id.slice(0, 8)}`,
        details: { order_email: order.order_email },
        order_id: order.id,
      });
      toast.success('Order återställd');
    } catch (error) {
      console.error('Failed to restore order:', error);
      toast.error('Kunde inte återställa order');
    }
  };

  const filtered = orders.filter(o =>
    !search ||
    o.order_email.toLowerCase().includes(search.toLowerCase()) ||
    o.order_number?.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n: number, c: string) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: c, minimumFractionDigits: 0 }).format(n);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trash2 className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">Raderade ordrar ({filtered.length})</span>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Sök bland raderade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Inga raderade ordrar</p>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map((order) => (
            <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card text-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium font-mono text-xs">
                    {order.order_number || `#${order.id.slice(0, 8)}`}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5 border-destructive/30 text-destructive">
                    Raderad
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {order.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {order.order_email} · {fmt(order.total_amount, order.currency)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Raderad: {order.deleted_at ? new Date(order.deleted_at).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => handleRestore(order)}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Återställ
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDeletedOrders;
