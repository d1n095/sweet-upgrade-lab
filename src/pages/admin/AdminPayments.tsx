import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard, Wallet, Heart, Users, Shield, RotateCcw, RefreshCw,
  AlertTriangle, ChevronRight, ArrowUpRight, ArrowDownRight,
  DollarSign, TrendingUp, Clock, ExternalLink, Lock, Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFounderRole } from '@/hooks/useFounderRole';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { usePaymentMethodsStore } from '@/stores/paymentMethodsStore';
import { PAYMENT_ICON_MAP, GenericIcon } from '@/components/trust/PaymentMethodIcons';

// ─── Types ───
interface FinanceData {
  totalRevenue: number;
  revenueToday: number;
  revenueThisMonth: number;
  paidOrders: number;
  unpaidOrders: number;
  donationsTotal: number;
  donationsThisMonth: number;
  affiliateTotal: number;
  affiliatePending: number;
  affiliatePaid: number;
  pendingPayoutRequests: number;
  pendingPayoutAmount: number;
  recentPaidOrders: Array<{
    id: string;
    order_email: string;
    total_amount: number;
    created_at: string;
    order_number: string | null;
  }>;
  recentPayouts: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string;
    payout_type: string;
  }>;
}

// Stripe-supported checkout methods with activation status
const STRIPE_METHODS = [
  { id: 'card', name: 'Kort (Visa / Mastercard)', status: 'active' as const, note: 'Inkl. Apple Pay & Google Pay' },
  { id: 'klarna', name: 'Klarna', status: 'active' as const },
  { id: 'applepay', name: 'Apple Pay', status: 'active' as const, note: 'Automatiskt via kort' },
  { id: 'googlepay', name: 'Google Pay', status: 'active' as const, note: 'Automatiskt via kort' },
  { id: 'revolut_pay', name: 'Revolut Pay', status: 'active' as const },
  { id: 'paypal', name: 'PayPal', status: 'requires_action' as const, note: 'Kräver aktivering i Stripe' },
];

const AdminPayments = () => {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const { isFounder } = useFounderRole();
  const { checkoutEnabled, setCheckoutEnabled } = useStoreSettings();
  const { methods, isLoaded: paymentLoaded, load: loadPayments, toggle: togglePayment } = usePaymentMethodsStore();
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [ordersRes, todayRes, monthRes, donRes, monthDonRes, affRes, payoutReqRes, recentPayoutsRes, recentPaidRes] = await Promise.all([
        supabase.from('orders').select('id, total_amount, payment_status'),
        supabase.from('orders').select('total_amount, payment_status').gte('created_at', todayStart.toISOString()),
        supabase.from('orders').select('total_amount, payment_status').gte('created_at', monthStart.toISOString()),
        supabase.from('donations').select('amount'),
        supabase.from('donations').select('amount').gte('created_at', monthStart.toISOString()),
        supabase.from('affiliates').select('pending_earnings, paid_earnings, total_earnings'),
        supabase.from('affiliate_payout_requests').select('amount, status').eq('status', 'pending'),
        supabase.from('affiliate_payout_requests').select('id, amount, status, created_at, payout_type').order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select('id, order_email, total_amount, created_at, order_number').eq('payment_status', 'paid').order('created_at', { ascending: false }).limit(6),
      ]);

      const orders = ordersRes.data || [];
      const paid = (o: any) => o.payment_status === 'paid';
      const donations = donRes.data || [];
      const monthDonations = monthDonRes.data || [];
      const affiliates = affRes.data || [];
      const payoutReqs = payoutReqRes.data || [];

      setData({
        totalRevenue: orders.filter(paid).reduce((s, o) => s + Number(o.total_amount || 0), 0),
        revenueToday: (todayRes.data || []).filter(paid).reduce((s, o) => s + Number(o.total_amount || 0), 0),
        revenueThisMonth: (monthRes.data || []).filter(paid).reduce((s, o) => s + Number(o.total_amount || 0), 0),
        paidOrders: orders.filter(paid).length,
        unpaidOrders: orders.filter(o => o.payment_status === 'unpaid').length,
        donationsTotal: donations.reduce((s, d) => s + Number(d.amount || 0), 0),
        donationsThisMonth: monthDonations.reduce((s, d) => s + Number(d.amount || 0), 0),
        affiliateTotal: affiliates.reduce((s, a) => s + Number(a.total_earnings || 0), 0),
        affiliatePending: affiliates.reduce((s, a) => s + Number(a.pending_earnings || 0), 0),
        affiliatePaid: affiliates.reduce((s, a) => s + Number(a.paid_earnings || 0), 0),
        pendingPayoutRequests: payoutReqs.length,
        pendingPayoutAmount: payoutReqs.reduce((s, p) => s + Number(p.amount || 0), 0),
        recentPaidOrders: (recentPaidRes.data || []) as any,
        recentPayouts: (recentPayoutsRes.data || []) as any,
      });
    } catch (e) {
      console.error('Failed to load finance data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (!paymentLoaded) loadPayments();
  }, []);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMins < 1) return 'Just nu';
    if (diffMins < 60) return `${diffMins} min sedan`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h sedan`;
    return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
  };

  // ─── Founder-only actions ───
  const handleResetDonations = async () => {
    if (!confirm('Är du säker på att du vill nollställa alla donationer? Detta kan inte ångras.')) return;
    const { error } = await supabase.from('donations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Kunde inte nollställa donationer'); return; }
    toast.success('Donationer nollställda');
    fetchData();
  };

  const handleResetAffiliateStats = async () => {
    if (!confirm('Nollställ alla affiliate-statistik (pending + paid earnings)? Detta kan inte ångras.')) return;
    const { error } = await supabase.from('affiliates').update({
      pending_earnings: 0, paid_earnings: 0, total_earnings: 0, total_orders: 0, total_sales: 0,
    }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) { toast.error('Kunde inte nollställa affiliate-statistik'); return; }
    toast.success('Affiliate-statistik nollställd');
    fetchData();
  };

  const handleEmergencyStopCheckout = async () => {
    if (!confirm('⚠️ NÖDSTOPP: Stäng av kassan omedelbart för alla kunder?')) return;
    await setCheckoutEnabled(false);
    toast.success('Kassan är nu avstängd');
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const topCards = [
    { label: 'Total intäkt', value: fmt(data.totalRevenue), sub: `${data.paidOrders} betalda ordrar`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-500/10', onClick: () => navigate('/admin/orders') },
    { label: 'Idag', value: fmt(data.revenueToday), sub: `Månad: ${fmt(data.revenueThisMonth)}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-500/10', onClick: () => navigate('/admin/stats') },
    { label: 'Donationer', value: fmt(data.donationsTotal), sub: `Månad: ${fmt(data.donationsThisMonth)}`, icon: Heart, color: 'text-pink-600', bg: 'bg-pink-500/10', onClick: () => navigate('/admin/legal') },
    { label: 'Affiliate', value: fmt(data.affiliateTotal), sub: `Väntande: ${fmt(data.affiliatePending)}`, icon: Users, color: 'text-amber-600', bg: 'bg-amber-500/10', onClick: () => navigate('/admin/partners') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Betalningar & Ekonomi</h1>
          <p className="text-muted-foreground text-sm mt-1">Betalningsmetoder, intäkter och ekonomikontroller</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Uppdatera
        </Button>
      </div>

      {/* Top Stats */}
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

      {/* Tabs */}
      <Tabs defaultValue="methods" className="space-y-4">
        <ScrollableTabs>
          <TabsList className="w-max bg-secondary/50">
            <TabsTrigger value="methods" className="gap-1.5 text-xs"><CreditCard className="w-3.5 h-3.5" /> Betalningsmetoder</TabsTrigger>
            <TabsTrigger value="overview" className="gap-1.5 text-xs"><Wallet className="w-3.5 h-3.5" /> Ekonomi</TabsTrigger>
            {isFounder && (
              <TabsTrigger value="founder" className="gap-1.5 text-xs"><Lock className="w-3.5 h-3.5" /> Grundare</TabsTrigger>
            )}
          </TabsList>
        </ScrollableTabs>

        {/* Payment Methods Tab */}
        <TabsContent value="methods" className="space-y-6">
          {/* Stripe checkout methods */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="w-4 h-4 text-primary" />
                Checkout-betalningsmetoder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Dessa metoder är tillgängliga vid betalning via Stripe Checkout.</p>
              <div className="space-y-1.5">
                {STRIPE_METHODS.map((m) => (
                  <div key={m.id} className={`flex items-center justify-between p-3 rounded-lg border ${m.supported ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/30'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${m.supported ? 'text-foreground' : 'text-muted-foreground'}`}>{m.name}</span>
                      {m.note && <span className="text-[10px] text-muted-foreground">{m.note}</span>}
                    </div>
                    {m.supported ? (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-200">Aktiv</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Kommer snart</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Display payment icons (trust signals) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="w-4 h-4" />
                Betalningsikoner (trust signals)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Styr vilka betalningsikoner som visas i footern, produktsidor och checkout.</p>
              <div className="space-y-1.5">
                {methods.map((method) => {
                  const Icon = PAYMENT_ICON_MAP[method.id];
                  return (
                    <div key={method.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${method.enabled ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 flex justify-center">
                          {Icon ? <Icon size="sm" /> : <GenericIcon name={method.name} size="sm" />}
                        </div>
                        <span className={`text-sm font-medium ${method.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>{method.name}</span>
                      </div>
                      <Switch checked={method.enabled} onCheckedChange={() => togglePayment(method.id)} />
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium mb-2">Förhandsvisning</p>
                <div className="flex flex-wrap gap-2">
                  {methods.filter(m => m.enabled).map(m => (
                    <Badge key={m.id} variant="outline" className="text-xs">{m.name}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Economy Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Secondary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: CreditCard, title: `${data.paidOrders} betalda`, sub: `${data.unpaidOrders} obetalda`, onClick: () => navigate('/admin/orders') },
              { icon: Wallet, title: `${fmt(data.affiliatePaid)} utbetalt`, sub: 'till affiliates', onClick: () => navigate('/admin/partners') },
              { icon: Clock, title: `${data.pendingPayoutRequests} väntande`, sub: `${fmt(data.pendingPayoutAmount)} att betala`, onClick: () => navigate('/admin/partners'), accent: true },
              { icon: Heart, title: fmt(data.donationsThisMonth), sub: 'donationer denna månad', onClick: () => navigate('/admin/legal') },
            ].map((card, i) => (
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

          {/* Recent orders & payouts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-green-500" /> Senaste betalningar
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => navigate('/admin/orders')}>
                    Visa alla <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.recentPaidOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Inga betalda ordrar ännu</p>
                ) : data.recentPaidOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors" onClick={() => navigate('/admin/orders')}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{order.order_number || order.order_email}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(order.created_at)}</p>
                    </div>
                    <span className="text-sm font-bold text-green-600">+{fmt(order.total_amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4 text-amber-500" /> Utbetalningsförfrågningar
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => navigate('/admin/partners')}>
                    Visa alla <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.recentPayouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Inga förfrågningar</p>
                ) : data.recentPayouts.map((p) => (
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
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Ordrar', to: '/admin/orders' },
              { label: 'Partners', to: '/admin/partners' },
              { label: 'Donationer', to: '/admin/legal' },
              { label: 'Statistik', to: '/admin/stats' },
              { label: 'Kampanjer', to: '/admin/campaigns' },
            ].map(link => (
              <Button key={link.to} variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => navigate(link.to)}>
                <ExternalLink className="w-3 h-3" /> {link.label}
              </Button>
            ))}
          </div>
        </TabsContent>

        {/* Founder-only Tab */}
        {isFounder && (
          <TabsContent value="founder" className="space-y-6">
            <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <Lock className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Grundarkontroller</p>
                <p className="text-xs text-muted-foreground">Känsliga åtgärder som bara grundare har tillgång till. Alla åtgärder loggas.</p>
              </div>
            </div>

            <div className="grid gap-4 max-w-xl">
              {/* Emergency checkout stop */}
              <Card className="border-destructive/20">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="w-4.5 h-4.5 text-destructive" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Nödstopp – Kassa</h3>
                      <p className="text-xs text-muted-foreground">Stäng av kassan omedelbart för alla kunder</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium">Kassan är {checkoutEnabled ? 'aktiv' : 'avstängd'}</p>
                      <p className="text-xs text-muted-foreground">{checkoutEnabled ? 'Kunder kan slutföra köp' : 'Inga köp kan göras'}</p>
                    </div>
                    {checkoutEnabled ? (
                      <Button variant="destructive" size="sm" className="gap-2" onClick={handleEmergencyStopCheckout}>
                        <AlertTriangle className="w-3.5 h-3.5" /> Nödstopp
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => setCheckoutEnabled(true)}>
                        Aktivera kassa
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Reset donations */}
              <Card className="border-border">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-pink-500/10 flex items-center justify-center">
                      <Heart className="w-4.5 h-4.5 text-pink-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Nollställ donationer</h3>
                      <p className="text-xs text-muted-foreground">Radera alla donationer från databasen. Kan inte ångras.</p>
                    </div>
                  </div>
                  <Button onClick={handleResetDonations} variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                    <RotateCcw className="w-3.5 h-3.5" /> Nollställ donationer
                  </Button>
                </CardContent>
              </Card>

              {/* Reset affiliate stats */}
              <Card className="border-border">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Users className="w-4.5 h-4.5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Nollställ affiliate-statistik</h3>
                      <p className="text-xs text-muted-foreground">Nollställer earnings, ordrar och försäljning för alla affiliates.</p>
                    </div>
                  </div>
                  <Button onClick={handleResetAffiliateStats} variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                    <RotateCcw className="w-3.5 h-3.5" /> Nollställ affiliate
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AdminPayments;
