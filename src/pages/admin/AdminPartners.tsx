import { useState, useEffect } from 'react';
import { Handshake, Users, DollarSign, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import AdminInfluencerManager from '@/components/admin/AdminInfluencerManager';
import AdminAffiliateManager from '@/components/admin/AdminAffiliateManager';
import AdminApplicationsManager from '@/components/admin/AdminApplicationsManager';
import AdminPayoutManager from '@/components/admin/AdminPayoutManager';

const AdminPartners = () => {
  const [stats, setStats] = useState({ affiliates: 0, influencers: 0, pendingApps: 0, totalEarnings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ count: affiliates }, { count: influencers }, { count: pendingApps }, { data: affData }] = await Promise.all([
        supabase.from('affiliates').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('influencers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('affiliate_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('affiliates').select('total_earnings'),
      ]);
      setStats({
        affiliates: affiliates || 0,
        influencers: influencers || 0,
        pendingApps: pendingApps || 0,
        totalEarnings: (affData || []).reduce((s, a) => s + Number(a.total_earnings || 0), 0),
      });
      setLoading(false);
    };
    load();
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Partners</h1>
        <p className="text-muted-foreground text-sm mt-1">Influencers, affiliates och ansökningar</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Aktiva affiliates', value: stats.affiliates, icon: Handshake, color: 'text-primary' },
          { label: 'Aktiva influencers', value: stats.influencers, icon: Users, color: 'text-pink-600' },
          { label: 'Väntande ansökningar', value: stats.pendingApps, icon: FileText, color: 'text-amber-600' },
          { label: 'Total provision', value: fmt(stats.totalEarnings), icon: DollarSign, color: 'text-green-600' },
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

      <Tabs defaultValue="affiliates">
        <ScrollableTabs>
          <TabsList className="w-max">
            <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
            <TabsTrigger value="influencers">Influencers</TabsTrigger>
            <TabsTrigger value="applications">Ansökningar</TabsTrigger>
            <TabsTrigger value="payouts">Utbetalningar</TabsTrigger>
          </TabsList>
        </ScrollableTabs>
        <TabsContent value="affiliates"><AdminAffiliateManager /></TabsContent>
        <TabsContent value="influencers"><AdminInfluencerManager /></TabsContent>
        <TabsContent value="applications"><AdminApplicationsManager /></TabsContent>
        <TabsContent value="payouts"><AdminPayoutManager /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPartners;
