import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, Heart, Wallet, RefreshCw,
  ArrowUpRight, ArrowDownRight, CreditCard, Users, Clock,
  ChevronRight, RotateCcw, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAdminRevenue, useAdminDonations, computeDonationMetrics,
  useAdminAffiliates, computeAffiliateMetrics, useAdminPayoutRequests,
} from '@/hooks/useAdminData';

const AdminFinance = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: orders = [], metrics, isLoading: ordersLoading } = useAdminRevenue();
  const { data: donations = [], isLoading: donationsLoading } = useAdminDonations();
  const { data: affiliates = [], isLoading: affiliatesLoading } = useAdminAffiliates();
  const { data: payoutRequests = [], isLoading: payoutsLoading } = useAdminPayoutRequests();

  const loading = ordersLoading || donationsLoading || affiliatesLoading || payoutsLoading;

  const donationMetrics = useMemo(() => computeDonationMetrics(donations), [donations]);
  const affiliateMetrics = useMemo(() => computeAffiliateMetrics(affiliates), [affiliates]);
  const pendingPayouts = useMemo(() => payoutRequests.filter((p: any) => p.status === 'pending'), [payoutRequests]);
  const pendingPayoutAmount = useMemo(() => pendingPayouts.reduce((s: number, p: any) => s + (p.amount || 0), 0), [pendingPayouts]);

  const recentPaidOrders = useMemo(() =>
    orders.filter((o: any) => o.payment_status === 'paid').slice(0, 8),
    [orders]
  );

  const recentPayouts = useMemo(() => payoutRequests.slice(0, 5), [payoutRequests]);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just nu';
    if (diffMins < 60) return `${diffMins} min sedan`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h sedan`;
    return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  };

  const handleResetDonations = async () => {
    if (!confirm('Är du säker på att du vill nollställa alla donationer? Detta kan inte ångras.')) return;
    const { error } = await supabase.from('donations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      toast.error('Kunde inte nollställa donationer');
      return;
    }
    toast.success('Donationer nollställda');
    queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
    queryClient.invalidateQueries({ queryKey: ['admin-affiliates'] });
    queryClient.invalidateQueries({ queryKey: ['admin-payout-requests'] });
  };

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const topCards = [
    {
      label: 'Total intäkt', value: fmt(metrics.grossRevenue), sub: `${metrics.paidCount} betalda ordrar`,
      icon: DollarSign, color: 'text-green-600', bg: 'bg-green-500/10',
      onClick: () => navigate('/admin/orders'),
    },
    {
      label: 'Idag', value: fmt(metrics.revenueToday), sub: `Denna månad: ${fmt(metrics.revenueThisMonth)}`,
      icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-500/10',
      onClick: () => navigate('/admin/stats'),
    },
    {
      label: 'Donationer', value: fmt(donationMetrics.totalAmount), sub: `Denna månad: ${fmt(donationMetrics.monthAmount)}`,
      icon: Heart, color: 'text-pink-600', bg: 'bg-pink-500/10',
      onClick: () => navigate('/admin/donations'),
    },
    {
      label: 'Affiliate', value: fmt(affiliateMetrics.totalEarnings), sub: `Väntande: ${fmt(affiliateMetrics.pendingEarnings)}`,
      icon: Users, color: 'text-amber-600', bg: 'bg-amber-500/10',
      onClick: () => navigate('/admin/partners'),
    },
  ];

  const secondaryCards = [
    { icon: CreditCard, title: `${metrics.paidCount} betalda`, sub: `${orders.filter((o: any) => o.payment_status === 'unpaid').length} obetalda`, onClick: () => navigate('/admin/orders') },
    { icon: Wallet, title: `${fmt(affiliateMetrics.paidEarnings)} utbetalt`, sub: 'till affiliates', onClick: () => navigate('/admin/partners') },
    { icon: Clock, title: `${pendingPayouts.length} väntande`, sub: `${fmt(pendingPayoutAmount)} att betala`, onClick: () => navigate('/admin/partners'), accent: true },
    { icon: Heart, title: fmt(donationMetrics.monthAmount), sub: 'donationer denna månad', onClick: () => navigate('/admin/donations') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Betalning & Ekonomi</h1>
          <p className="text-muted-foreground text-sm mt-1">Intäkter, donationer och affiliate-utbetalningar</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleResetDonations} variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
            <RotateCcw className="w-4 h-4" /> Nollställ donationer
          </Button>
          <Button onClick={refreshAll} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Uppdatera
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border cursor-pointer hover:shadow-md hover:border-primary/20 transition-all group" onClick={card.onClick}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">{card.sub}</p>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryCards.map((card, i) => (
          <Card key={i} className="border-border bg-secondary/20 cursor-pointer hover:bg-secondary/40 transition-colors group" onClick={card.onClick}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <card.icon className={`w-5 h-5 ${card.accent ? 'text-amber-500' : 'text-muted-foreground'}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">{card.title}</p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Ordrar', to: '/admin/orders' },
          { label: 'Partners & Affiliates', to: '/admin/partners' },
          { label: 'Donationer', to: '/admin/donations' },
          { label: 'Inställningar', to: '/admin/settings' },
          { label: 'Statistik', to: '/admin/stats' },
          { label: 'Kampanjer', to: '/admin/campaigns' },
        ].map(link => (
          <Button key={link.to} variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => navigate(link.to)}>
            <ExternalLink className="w-3 h-3" /> {link.label}
          </Button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-green-500" />
                Senaste betalningar
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => navigate('/admin/orders')}>
                Visa alla <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPaidOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Inga betalda ordrar ännu</p>
            ) : (
              recentPaidOrders.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors" onClick={() => navigate('/admin/orders')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{order.payment_intent_id ? '#' + order.payment_intent_id.slice(-8).toUpperCase() : order.order_email}</p>
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-amber-500" />
                Senaste utbetalningsförfrågningar
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => navigate('/admin/partners')}>
                Visa alla <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPayouts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Inga utbetalningsförfrågningar</p>
            ) : (
              recentPayouts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors" onClick={() => navigate('/admin/partners')}>
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
