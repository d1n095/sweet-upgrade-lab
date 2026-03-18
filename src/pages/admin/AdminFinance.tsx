import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, Heart, Wallet, RefreshCw,
  ArrowUpRight, ArrowDownRight, CreditCard, Users, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface FinanceData {
  totalRevenue: number;
  revenueToday: number;
  revenueThisMonth: number;
  totalOrders: number;
  paidOrders: number;
  unpaidOrders: number;
  donationsTotal: number;
  donationsThisMonth: number;
  affiliateCommissionsTotal: number;
  affiliatePending: number;
  affiliatePaid: number;
  pendingPayoutRequests: number;
  pendingPayoutAmount: number;
  recentPayouts: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
    payout_type: string;
  }>;
  recentPaidOrders: Array<{
    id: string;
    order_email: string;
    total_amount: number;
    created_at: string;
    order_number: string | null;
  }>;
}

const AdminFinance = () => {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        ordersRes,
        todayOrdersRes,
        monthOrdersRes,
        donationsRes,
        monthDonationsRes,
        affiliatesRes,
        payoutRequestsRes,
        recentPayoutsRes,
        recentPaidRes,
      ] = await Promise.all([
        supabase.from('orders').select('id, total_amount, payment_status, status'),
        supabase.from('orders').select('total_amount, payment_status').gte('created_at', todayStart.toISOString()),
        supabase.from('orders').select('total_amount, payment_status').gte('created_at', monthStart.toISOString()),
        supabase.from('donations').select('amount'),
        supabase.from('donations').select('amount').gte('created_at', monthStart.toISOString()),
        supabase.from('affiliates').select('pending_earnings, paid_earnings, total_earnings'),
        supabase.from('affiliate_payout_requests').select('amount, status').eq('status', 'pending'),
        supabase.from('affiliate_payout_requests').select('id, amount, status, created_at, payout_type').order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select('id, order_email, total_amount, created_at, order_number').eq('payment_status', 'paid').order('created_at', { ascending: false }).limit(8),
      ]);

      const orders = ordersRes.data || [];
      const todayOrders = todayOrdersRes.data || [];
      const monthOrders = monthOrdersRes.data || [];
      const donations = donationsRes.data || [];
      const monthDonations = monthDonationsRes.data || [];
      const affiliates = affiliatesRes.data || [];
      const payoutReqs = payoutRequestsRes.data || [];

      const paidFilter = (o: any) => o.payment_status === 'paid';

      setData({
        totalRevenue: orders.filter(paidFilter).reduce((s, o) => s + Number(o.total_amount || 0), 0),
        revenueToday: todayOrders.filter(paidFilter).reduce((s, o) => s + Number(o.total_amount || 0), 0),
        revenueThisMonth: monthOrders.filter(paidFilter).reduce((s, o) => s + Number(o.total_amount || 0), 0),
        totalOrders: orders.length,
        paidOrders: orders.filter(paidFilter).length,
        unpaidOrders: orders.filter(o => o.payment_status === 'unpaid').length,
        donationsTotal: donations.reduce((s, d) => s + Number(d.amount || 0), 0),
        donationsThisMonth: monthDonations.reduce((s, d) => s + Number(d.amount || 0), 0),
        affiliateCommissionsTotal: affiliates.reduce((s, a) => s + Number(a.total_earnings || 0), 0),
        affiliatePending: affiliates.reduce((s, a) => s + Number(a.pending_earnings || 0), 0),
        affiliatePaid: affiliates.reduce((s, a) => s + Number(a.paid_earnings || 0), 0),
        pendingPayoutRequests: payoutReqs.length,
        pendingPayoutAmount: payoutReqs.reduce((s, p) => s + Number(p.amount || 0), 0),
        recentPayouts: (recentPayoutsRes.data || []) as any,
        recentPaidOrders: (recentPaidRes.data || []) as any,
      });
    } catch (e) {
      console.error('Failed to load finance data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just nu';
    if (diffMins < 60) return `${diffMins} min sedan`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h sedan`;
    return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Betalning & Ekonomi</h1>
          <p className="text-muted-foreground text-sm mt-1">Intäkter, donationer och affiliate-utbetalningar</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Uppdatera
        </Button>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total intäkt</span>
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
              </div>
              <p className="text-2xl font-bold">{fmt(data.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{data.paidOrders} betalda ordrar</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Idag</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold">{fmt(data.revenueToday)}</p>
              <p className="text-xs text-muted-foreground mt-1">Denna månad: {fmt(data.revenueThisMonth)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Donationer</span>
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-pink-600" />
                </div>
              </div>
              <p className="text-2xl font-bold">{fmt(data.donationsTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">Denna månad: {fmt(data.donationsThisMonth)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Affiliate</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-amber-600" />
                </div>
              </div>
              <p className="text-2xl font-bold">{fmt(data.affiliateCommissionsTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">Väntande: {fmt(data.affiliatePending)}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-secondary/20">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{data.paidOrders} betalda</p>
              <p className="text-xs text-muted-foreground">{data.unpaidOrders} obetalda</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-secondary/20">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Wallet className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{fmt(data.affiliatePaid)} utbetalt</p>
              <p className="text-xs text-muted-foreground">till affiliates</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-secondary/20">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium">{data.pendingPayoutRequests} väntande</p>
              <p className="text-xs text-muted-foreground">{fmt(data.pendingPayoutAmount)} att betala</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-secondary/20">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Heart className="w-5 h-5 text-pink-500" />
            <div>
              <p className="text-sm font-medium">{fmt(data.donationsThisMonth)}</p>
              <p className="text-xs text-muted-foreground">donationer denna månad</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent paid orders & payout requests */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-green-500" />
              Senaste betalningar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentPaidOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Inga betalda ordrar ännu</p>
            ) : (
              data.recentPaidOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{order.order_number || order.order_email}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(order.created_at)}</p>
                  </div>
                  <span className="text-sm font-bold text-green-600">+{fmt(order.total_amount)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-amber-500" />
              Senaste utbetalningsförfrågningar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentPayouts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Inga utbetalningsförfrågningar</p>
            ) : (
              data.recentPayouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.payout_type === 'cash' ? 'Kontant' : 'Butikskredit'}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{fmt(p.amount)}</span>
                    <Badge variant={p.status === 'pending' ? 'outline' : 'secondary'} className="text-[10px]">
                      {p.status === 'pending' ? 'Väntande' : p.status === 'approved' ? 'Godkänd' : p.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminFinance;
