import { useState, useEffect } from 'react';
import { Percent, Package, Tag, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import AdminCampaignsManager from '@/components/admin/AdminCampaignsManager';

const AdminCampaigns = () => {
  const [stats, setStats] = useState({ discounts: 0, bundles: 0, onSale: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ count: discounts }, { count: bundles }, { data: products }] = await Promise.all([
        supabase.from('volume_discounts').select('*', { count: 'exact', head: true }),
        supabase.from('bundles').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('products').select('price, original_price'),
      ]);
      setStats({
        discounts: discounts || 0,
        bundles: bundles || 0,
        onSale: (products || []).filter(p => p.original_price && p.original_price > p.price).length,
      });
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kampanjer & Rabatter</h1>
        <p className="text-muted-foreground text-sm mt-1">Hantera mängdrabatter, paket och kampanjpriser</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Mängdrabatter', value: stats.discounts, icon: Percent, color: 'text-primary' },
          { label: 'Aktiva paket', value: stats.bundles, icon: Package, color: 'text-blue-600' },
          { label: 'Produkter på rea', value: stats.onSale, icon: Sparkles, color: 'text-pink-600' },
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

      <AdminCampaignsManager />
    </div>
  );
};

export default AdminCampaigns;
