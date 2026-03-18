import { useState, useEffect } from 'react';
import { Users, UserCheck, Briefcase, Shield, Crown, Eye as EyeIcon, Headphones, Package as PackageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import AdminMemberManager from '@/components/admin/AdminMemberManager';
import AdminBusinessManager from '@/components/admin/AdminBusinessManager';

interface RoleStats {
  total: number;
  members: number;
  businesses: number;
  founders: number;
  admins: number;
  moderators: number;
  support: number;
  warehouse: number;
}

const AdminMembers = () => {
  const [stats, setStats] = useState<RoleStats>({ total: 0, members: 0, businesses: 0, founders: 0, admins: 0, moderators: 0, support: 0, warehouse: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [
        { count: total },
        { count: members },
        { count: businesses },
        { data: allRoles },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_member', true),
        supabase.from('business_accounts').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('role'),
      ]);

      // Count each role
      const roleCounts: Record<string, number> = {};
      (allRoles || []).forEach((r: any) => {
        roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
      });

      setStats({
        total: total || 0,
        members: members || 0,
        businesses: businesses || 0,
        founders: roleCounts['founder'] || 0,
        admins: (roleCounts['admin'] || 0) + (roleCounts['it'] || 0) + (roleCounts['founder'] || 0),
        moderators: roleCounts['moderator'] || 0,
        support: roleCounts['support'] || 0,
        warehouse: roleCounts['warehouse'] || 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const statCards = [
    { label: 'Totalt profiler', value: stats.total, icon: Users, color: 'text-primary' },
    { label: 'Medlemmar', value: stats.members, icon: UserCheck, color: 'text-green-600' },
    { label: 'Företagskonton', value: stats.businesses, icon: Briefcase, color: 'text-blue-600' },
    { label: 'Grundare', value: stats.founders, icon: Crown, color: 'text-amber-600' },
    { label: 'Admin-nivå (totalt)', value: stats.admins, icon: Shield, color: 'text-red-600' },
    { label: 'Moderatorer', value: stats.moderators, icon: EyeIcon, color: 'text-purple-600' },
    { label: 'Support', value: stats.support, icon: Headphones, color: 'text-cyan-600' },
    { label: 'Lager', value: stats.warehouse, icon: PackageIcon, color: 'text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Medlemmar & Roller</h1>
        <p className="text-muted-foreground text-sm mt-1">Hantera medlemmar, företag och roller</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
        {statCards.map(s => (
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

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Medlemmar</TabsTrigger>
          <TabsTrigger value="business">Företagskonton</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <AdminMemberManager />
        </TabsContent>
        <TabsContent value="business">
          <AdminBusinessManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminMembers;
