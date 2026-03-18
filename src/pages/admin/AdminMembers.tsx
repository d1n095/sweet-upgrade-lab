import { useState, useEffect } from 'react';
import { Users, UserCheck, Briefcase, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import AdminMemberManager from '@/components/admin/AdminMemberManager';
import AdminBusinessManager from '@/components/admin/AdminBusinessManager';

const AdminMembers = () => {
  const [stats, setStats] = useState({ total: 0, members: 0, businesses: 0, admins: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ count: total }, { count: members }, { count: businesses }, { count: admins }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_member', true),
        supabase.from('business_accounts').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      ]);
      setStats({ total: total || 0, members: members || 0, businesses: businesses || 0, admins: admins || 0 });
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Medlemmar & Roller</h1>
        <p className="text-muted-foreground text-sm mt-1">Hantera medlemmar, företag och roller</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Totalt profiler', value: stats.total, icon: Users, color: 'text-primary' },
          { label: 'Medlemmar', value: stats.members, icon: UserCheck, color: 'text-green-600' },
          { label: 'Företagskonton', value: stats.businesses, icon: Briefcase, color: 'text-blue-600' },
          { label: 'Administratörer', value: stats.admins, icon: Shield, color: 'text-purple-600' },
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
