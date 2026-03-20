import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Crown, Shield, ClipboardList, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_COLORS: Record<string, string> = {
  founder: 'text-yellow-600',
  admin: 'text-destructive',
  it: 'text-purple-600',
  manager: 'text-green-600',
  moderator: 'text-blue-600',
  support: 'text-cyan-600',
  marketing: 'text-pink-600',
  finance: 'text-emerald-600',
  warehouse: 'text-orange-600',
};

const WorkbenchStaffPanel = () => {
  const [search, setSearch] = useState('');

  const { data: staffData = [] } = useQuery({
    queryKey: ['workbench-staff-panel'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').neq('role', 'user');
      if (!roles?.length) return [];

      const userIds = [...new Set(roles.map(r => r.user_id))];
      const [profilesRes, tasksRes, templatesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', userIds),
        supabase.from('staff_tasks').select('claimed_by, status').neq('status', 'done'),
        supabase.from('role_templates').select('role_key, name_sv'),
      ]);

      const profiles = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const templates = new Map((templatesRes.data || []).map(t => [t.role_key, t.name_sv]));
      const tasks = tasksRes.data || [];

      const roleOrder = ['founder', 'admin', 'it', 'manager', 'moderator', 'support', 'marketing', 'finance', 'warehouse'];

      return userIds.map(uid => {
        const userRoles = roles.filter(r => r.user_id === uid);
        const highestRole = roleOrder.find(ro => userRoles.some(r => r.role === ro)) || 'user';
        const profile = profiles.get(uid);
        const activeTasks = tasks.filter(t => t.claimed_by === uid).length;
        const roleName = templates.get(highestRole) || highestRole;

        return {
          user_id: uid,
          username: profile?.username || uid.substring(0, 8),
          avatar_url: profile?.avatar_url,
          role: highestRole,
          roleName,
          activeTasks,
        };
      }).sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return staffData;
    const q = search.toLowerCase();
    return staffData.filter(s => s.username.toLowerCase().includes(q) || s.role.includes(q));
  }, [staffData, search]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök personal..." className="pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map(member => {
          const isFounder = member.role === 'founder';
          return (
            <Card key={member.user_id} className="border-border hover:shadow-sm transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    isFounder ? 'bg-yellow-600/10' : 'bg-secondary'
                  )}>
                    {isFounder ? <Crown className="w-5 h-5 text-yellow-600" /> : <Shield className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold truncate">{member.username}</h3>
                    <p className={cn('text-xs font-medium', ROLE_COLORS[member.role] || 'text-muted-foreground')}>
                      {member.roleName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>{member.activeTasks} aktiva</span>
                  </div>
                  {member.activeTasks === 0 && (
                    <Badge variant="secondary" className="text-[9px] ml-auto">Tillgänglig</Badge>
                  )}
                  {member.activeTasks > 0 && member.activeTasks <= 3 && (
                    <Badge variant="outline" className="text-[9px] ml-auto text-blue-600 border-blue-600/20">Arbetar</Badge>
                  )}
                  {member.activeTasks > 3 && (
                    <Badge variant="outline" className="text-[9px] ml-auto text-orange-600 border-orange-600/20">Hög belastning</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default WorkbenchStaffPanel;
