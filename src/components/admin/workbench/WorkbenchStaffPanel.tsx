import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Crown, Shield, ClipboardList, Trophy, Clock, Target, ChevronLeft, Star } from 'lucide-react';
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

interface StaffMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  roleName: string;
  activeTasks: number;
  perf: { tasks_completed: number; avg_completion_seconds: number; sla_hits: number; sla_misses: number; points: number } | null;
}

const formatDuration = (seconds: number) => {
  if (!seconds) return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

const WorkbenchStaffPanel = () => {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data: staffData = [] } = useQuery<StaffMember[]>({
    queryKey: ['workbench-staff-panel-perf'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').neq('role', 'user');
      if (!roles?.length) return [];

      const userIds = [...new Set(roles.map(r => r.user_id))];
      const [profilesRes, itemsRes, templatesRes, perfRes] = await Promise.all([
        supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', userIds),
        supabase.from('work_items').select('claimed_by, status').neq('status', 'done'),
        supabase.from('role_templates').select('role_key, name_sv'),
        supabase.from('staff_performance').select('*').in('user_id', userIds),
      ]);

      const profiles = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const templates = new Map((templatesRes.data || []).map(t => [t.role_key, t.name_sv]));
      const workItems = (itemsRes.data || []) as any[];
      const perfMap = new Map((perfRes.data || []).map((p: any) => [p.user_id, p]));

      const roleOrder = ['founder', 'admin', 'it', 'manager', 'moderator', 'support', 'marketing', 'finance', 'warehouse'];

      return userIds.map(uid => {
        const userRoles = roles.filter(r => r.user_id === uid);
        const highestRole = roleOrder.find(ro => userRoles.some(r => r.role === ro)) || 'user';
        const profile = profiles.get(uid);
        const activeTasks = workItems.filter((t: any) => t.claimed_by === uid).length;
        const perf = perfMap.get(uid) || null;

        return {
          user_id: uid,
          username: profile?.username || uid.substring(0, 8),
          avatar_url: profile?.avatar_url,
          role: highestRole,
          roleName: templates.get(highestRole) || highestRole,
          activeTasks,
          perf,
        };
      }).sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
    },
  });

  const leaderboard = useMemo(() =>
    [...staffData].filter(s => s.perf && s.perf.tasks_completed > 0).sort((a, b) => (b.perf?.points ?? 0) - (a.perf?.points ?? 0)),
    [staffData]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return staffData;
    const q = search.toLowerCase();
    return staffData.filter(s => s.username.toLowerCase().includes(q) || s.role.includes(q));
  }, [staffData, search]);

  const selected = selectedUser ? staffData.find(s => s.user_id === selectedUser) : null;

  if (selected) {
    const slaTotal = (selected.perf?.sla_hits ?? 0) + (selected.perf?.sla_misses ?? 0);
    const slaRate = slaTotal > 0 ? Math.round(((selected.perf?.sla_hits ?? 0) / slaTotal) * 100) : 0;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSelectedUser(null)}>
          <ChevronLeft className="w-4 h-4" /> Tillbaka
        </Button>
        <div className="flex items-center gap-3">
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', selected.role === 'founder' ? 'bg-yellow-600/10' : 'bg-secondary')}>
            {selected.role === 'founder' ? <Crown className="w-6 h-6 text-yellow-600" /> : <Shield className="w-6 h-6 text-muted-foreground" />}
          </div>
          <div>
            <h2 className="text-lg font-bold">{selected.username}</h2>
            <p className={cn('text-sm font-medium', ROLE_COLORS[selected.role])}>{selected.roleName}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Slutförda', value: selected.perf?.tasks_completed ?? 0, icon: ClipboardList },
            { label: 'Snitt-tid', value: formatDuration(selected.perf?.avg_completion_seconds ?? 0), icon: Clock },
            { label: 'SLA', value: `${slaRate}%`, icon: Target },
            { label: 'Poäng', value: selected.perf?.points ?? 0, icon: Star },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4 text-center">
                <s.icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <h3 className="text-sm font-semibold">Aktiva uppgifter</h3>
            <p className="text-2xl font-bold">{selected.activeTasks}</p>
            <Badge variant={selected.activeTasks === 0 ? 'secondary' : selected.activeTasks <= 3 ? 'outline' : 'destructive'}>
              {selected.activeTasks === 0 ? 'Tillgänglig' : selected.activeTasks <= 3 ? 'Arbetar' : 'Hög belastning'}
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {leaderboard.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-yellow-600" />
              <h3 className="text-sm font-semibold">Topplista</h3>
            </div>
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((m, i) => (
                <div key={m.user_id} className="flex items-center gap-3 cursor-pointer hover:bg-secondary/30 rounded px-2 py-1.5 transition-colors"
                  onClick={() => setSelectedUser(m.user_id)}>
                  <span className={cn('text-sm font-bold w-5 text-center',
                    i === 0 ? 'text-yellow-600' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'
                  )}>
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium flex-1 truncate">{m.username}</span>
                  <span className="text-xs text-muted-foreground">{m.perf?.tasks_completed} tasks</span>
                  <Badge variant="secondary" className="text-[10px]">{m.perf?.points ?? 0} p</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök personal..." className="pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map(member => {
          const isFounder = member.role === 'founder';
          return (
            <Card key={member.user_id} className="border-border hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => setSelectedUser(member.user_id)}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    isFounder ? 'bg-yellow-600/10' : 'bg-secondary')}>
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
                  {member.perf && member.perf.tasks_completed > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="w-3 h-3" />
                      <span>{member.perf.points}p</span>
                    </div>
                  )}
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
