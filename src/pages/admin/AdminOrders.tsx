import { useState, useEffect } from 'react';
import { ClipboardList, Clock, Truck, DollarSign, RotateCcw, PackageX, CheckCircle2, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import AdminOrderManager from '@/components/admin/AdminOrderManager';
import AdminOrderAuditLog from '@/components/admin/AdminOrderAuditLog';
import AdminDeletedOrders from '@/components/admin/AdminDeletedOrders';
import AdminOrdersByStatus from '@/components/admin/AdminOrdersByStatus';
import AdminRefundRequests from '@/components/admin/AdminRefundRequests';

const AdminOrders = () => {
  const [stats, setStats] = useState({ total: 0, pending: 0, shipped: 0, revenue: 0, delivered: 0, returned: 0, lost: 0, readyToShip: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('orders')
        .select('status, total_amount, payment_status, deleted_at')
        .is('deleted_at', null);
      const ords = data || [];
      setStats({
        total: ords.length,
        pending: ords.filter(o => o.status === 'pending').length,
        shipped: ords.filter(o => o.status === 'shipped' || o.status === 'delivered').length,
        revenue: ords.filter(o => o.payment_status === 'paid').reduce((s, o) => s + (o.total_amount || 0), 0),
        delivered: ords.filter(o => o.status === 'delivered').length,
        returned: ords.filter(o => o.status === 'returned').length,
        lost: ords.filter(o => o.status === 'lost').length,
      });
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel('admin-orders-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orderhantering</h1>
        <p className="text-muted-foreground text-sm mt-1">Hantera, spåra och granska alla ordrar</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Totalt ordrar', value: stats.total, icon: ClipboardList, color: 'text-primary' },
          { label: 'Väntande', value: stats.pending, icon: Clock, color: 'text-amber-600' },
          { label: 'Skickade/Levererade', value: stats.shipped, icon: Truck, color: 'text-green-600' },
          { label: 'Total intäkt', value: fmt(stats.revenue), icon: DollarSign, color: 'text-emerald-600' },
        ].map(s => (
          <Card key={s.label} className="border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold">{loading ? '–' : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="orders">Alla ordrar</TabsTrigger>
          <TabsTrigger value="delivered" className="gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Levererade {stats.delivered > 0 && `(${stats.delivered})`}
          </TabsTrigger>
          <TabsTrigger value="returned" className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Returer {stats.returned > 0 && `(${stats.returned})`}
          </TabsTrigger>
          <TabsTrigger value="lost" className="gap-1.5">
            <PackageX className="w-3.5 h-3.5" />
            Borttappade {stats.lost > 0 && `(${stats.lost})`}
          </TabsTrigger>
          <TabsTrigger value="refunds" className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Återbetalningar
          </TabsTrigger>
          <TabsTrigger value="deleted">Raderade</TabsTrigger>
          <TabsTrigger value="audit">Ändringslogg</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <AdminOrderManager />
        </TabsContent>
        <TabsContent value="delivered">
          <AdminOrdersByStatus
            status="delivered"
            title="Levererade ordrar"
            icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
            emptyMessage="Inga levererade ordrar ännu"
          />
        </TabsContent>
        <TabsContent value="returned">
          <AdminOrdersByStatus
            status="returned"
            title="Returer"
            icon={<RotateCcw className="w-5 h-5 text-orange-600" />}
            emptyMessage="Inga returer"
          />
        </TabsContent>
        <TabsContent value="lost">
          <AdminOrdersByStatus
            status="lost"
            title="Borttappade försändelser"
            icon={<PackageX className="w-5 h-5 text-rose-600" />}
            emptyMessage="Inga borttappade försändelser"
          />
        </TabsContent>
        <TabsContent value="refunds">
          <AdminRefundRequests />
        </TabsContent>
        <TabsContent value="deleted">
          <AdminDeletedOrders />
        </TabsContent>
        <TabsContent value="audit">
          <AdminOrderAuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOrders;
