import { useState } from 'react';
import { Loader2, RefreshCw, XCircle, Wrench, User, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';


// ── Sync Scanner Tab ──
const syncTypeLabels: Record<string, string> = {
  category_mismatch: 'Kategorimismatch', product_mismatch: 'Produktmismatch',
  orphan_data: 'Föräldralös data', stale_reference: 'Gammal referens',
  missing_data: 'Saknad data', status_desync: 'Statusdesync',
};

// ── AI User Management Tab ──
export const AiUserManagementTab = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('all');

  const callMgmt = async (body: Record<string, any>) => {
    const data = await runAISafe({
      source: 'ADMIN',
      feature: 'ai-user-management',
      payload: body,
      functionName: 'ai-user-management',
    });
    if (!data) throw new Error('AI user management unavailable');
    return data;
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await callMgmt({ action: 'list_users' });
      if (data?.users) setUsers(data.users);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const analyzeUsers = async () => {
    setAnalyzing(true);
    try {
      const data = await callMgmt({ action: 'ai_analyze' });
      if (data) setRecommendations(data);
      toast.success(`AI-analys klar: ${data?.recommendations?.length || 0} rekommendationer`);
    } catch (e: any) { toast.error(e.message); }
    setAnalyzing(false);
  };

  const assignRole = async (userId: string, role: string) => {
    setActionLoading(`assign-${userId}-${role}`);
    try {
      const data = await callMgmt({ action: 'assign_role', user_id: userId, role });
      toast.success(data?.detail || 'Roll tilldelad');
      await loadUsers();
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(null);
  };

  const removeRole = async (userId: string, role: string) => {
    setActionLoading(`remove-${userId}-${role}`);
    try {
      const data = await callMgmt({ action: 'remove_role', user_id: userId, role });
      toast.success(data?.detail || 'Roll borttagen');
      await loadUsers();
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(null);
  };

  const deactivateUser = async (userId: string) => {
    setActionLoading(`deact-${userId}`);
    try {
      const data = await callMgmt({ action: 'deactivate_user', user_id: userId });
      toast.success(data?.detail || 'Användare inaktiverad');
      await loadUsers();
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(null);
  };

  const reactivateUser = async (userId: string) => {
    setActionLoading(`react-${userId}`);
    try {
      const data = await callMgmt({ action: 'reactivate_user', user_id: userId });
      toast.success(data?.detail || 'Användare återaktiverad');
      await loadUsers();
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(null);
  };

  const applyRecommendation = async (rec: any) => {
    const user = users.find(u => u.email === rec.user_email);
    if (!user) { toast.error('Användare hittades inte'); return; }
    try {
      switch (rec.suggested_action) {
        case 'downgrade':
        case 'remove_role':
          if (rec.current_roles?.length) {
            const highRoles = rec.current_roles.filter((r: string) => ['admin', 'it'].includes(r));
            for (const r of highRoles) await removeRole(user.id, r);
            if (rec.suggested_role) await assignRole(user.id, rec.suggested_role);
          }
          break;
        case 'upgrade':
        case 'add_role':
          if (rec.suggested_role) await assignRole(user.id, rec.suggested_role);
          break;
        case 'deactivate':
          await deactivateUser(user.id);
          break;
      }
      toast.success('Rekommendation tillämpad');
    } catch (e: any) { toast.error(e.message); }
  };

  const validRoles = ['admin', 'moderator', 'founder', 'it', 'support', 'manager', 'marketing', 'finance', 'warehouse'];

  const filteredUsers = users.filter(u => {
    const matchSearch = !search || u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.first_name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' ||
      (roleFilter === 'no-role' ? u.roles.length === 0 : u.roles.includes(roleFilter));
    return matchSearch && matchRole;
  });

  const riskColor = (risk: string) => {
    if (risk === 'critical') return 'border-red-500/30 bg-red-500/5';
    if (risk === 'high') return 'border-orange-500/30 bg-orange-500/5';
    if (risk === 'medium') return 'border-yellow-500/30 bg-yellow-500/5';
    return 'border-border bg-muted/20';
  };

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      downgrade: '⬇️ Nedgradera', upgrade: '⬆️ Uppgradera', remove_role: '🗑️ Ta bort roll',
      add_role: '➕ Lägg till roll', deactivate: '🚫 Inaktivera', no_change: '✅ Ingen ändring',
    };
    return map[action] || action;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2"><User className="w-4 h-4" /> AI Användarhantering</h3>
          <p className="text-xs text-muted-foreground">Hantera användare, roller och behörigheter med AI-stöd</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={analyzeUsers} disabled={analyzing || users.length === 0} size="sm" variant="outline" className="gap-1">
            {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
            {analyzing ? 'Analyserar...' : 'AI-analys'}
          </Button>
          <Button onClick={loadUsers} disabled={loading} size="sm" className="gap-1">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {loading ? 'Laddar...' : users.length ? 'Uppdatera' : 'Hämta användare'}
          </Button>
        </div>
      </div>

      {/* AI Recommendations */}
      {recommendations && recommendations.recommendations?.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Brain className="w-3.5 h-3.5" /> AI-rekommendationer ({recommendations.recommendations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recommendations.summary && <p className="text-xs text-muted-foreground mb-3">{recommendations.summary}</p>}
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-2">
                {recommendations.recommendations.map((rec: any, idx: number) => (
                  <div key={idx} className={cn('text-xs border rounded-md p-3 space-y-1.5', riskColor(rec.risk))}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{rec.user_email}</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[8px]">{rec.risk}</Badge>
                        <Badge variant="secondary" className="text-[8px]">{actionLabel(rec.suggested_action)}</Badge>
                      </div>
                    </div>
                    <p className="text-muted-foreground">Roller: {rec.current_roles?.join(', ') || 'inga'}</p>
                    {rec.suggested_role && <p>Föreslagen roll: <span className="font-medium">{rec.suggested_role}</span></p>}
                    <p className="text-muted-foreground italic">{rec.reason}</p>
                    {rec.suggested_action !== 'no_change' && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 mt-1" onClick={() => applyRecommendation(rec)}>
                        <Wrench className="w-2.5 h-2.5" /> Tillämpa
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* User list */}
      {users.length > 0 && (
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <Input placeholder="Sök email/namn..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs w-48" />
            <div className="flex gap-1 flex-wrap">
              {['all', 'no-role', ...validRoles].map(r => (
                <Button key={r} size="sm" variant={roleFilter === r ? 'default' : 'ghost'} className="h-6 text-[9px] px-1.5"
                  onClick={() => setRoleFilter(r)}>
                  {r === 'all' ? `Alla (${users.length})` : r === 'no-role' ? `Utan roll (${users.filter(u => u.roles.length === 0).length})` : `${r} (${users.filter(u => u.roles.includes(r)).length})`}
                </Button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="py-2">
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-1">
                  {filteredUsers.slice(0, 50).map(u => (
                    <div key={u.id} className={cn('text-xs border rounded p-2.5 space-y-1.5', u.is_banned ? 'opacity-50 bg-red-500/5' : 'bg-muted/10')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{u.email}</span>
                          {u.username && <span className="text-muted-foreground">({u.username})</span>}
                          {u.is_banned && <Badge variant="destructive" className="text-[8px]">Inaktiverad</Badge>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {u.is_banned ? (
                            <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5" disabled={actionLoading?.startsWith(`react-${u.id}`)}
                              onClick={() => reactivateUser(u.id)}>
                              {actionLoading === `react-${u.id}` ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Återaktivera'}
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5 text-destructive" disabled={actionLoading?.startsWith(`deact-${u.id}`)}
                              onClick={() => deactivateUser(u.id)}>
                              {actionLoading === `deact-${u.id}` ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Inaktivera'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Roles */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {u.roles.map((r: string) => (
                          <Badge key={r} variant="secondary" className="text-[8px] gap-0.5 pr-0.5">
                            {r}
                            <button className="ml-0.5 hover:text-destructive transition-colors p-0.5" onClick={() => removeRole(u.id, r)}
                              disabled={actionLoading === `remove-${u.id}-${r}`}>
                              {actionLoading === `remove-${u.id}-${r}` ? <Loader2 className="w-2 h-2 animate-spin" /> : <XCircle className="w-2.5 h-2.5" />}
                            </button>
                          </Badge>
                        ))}
                        {/* Add role dropdown */}
                        <select className="h-5 text-[9px] bg-muted border rounded px-1" defaultValue=""
                          onChange={e => { if (e.target.value) { assignRole(u.id, e.target.value); e.target.value = ''; } }}>
                          <option value="">+ roll</option>
                          {validRoles.filter(r => !u.roles.includes(r)).map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>

                      {/* Meta */}
                      <p className="text-muted-foreground text-[9px]">
                        Nivå {u.level} · {u.is_member ? '👑 Medlem' : 'Icke-medlem'}
                        {u.last_sign_in_at && <> · Senast inloggad: {new Date(u.last_sign_in_at).toLocaleDateString('sv-SE')}</>}
                      </p>
                    </div>
                  ))}
                  {filteredUsers.length > 50 && <p className="text-xs text-muted-foreground text-center py-2">Visar 50 av {filteredUsers.length}. Filtrera för att se fler.</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

// ── Access Control Intelligence Tab ──
