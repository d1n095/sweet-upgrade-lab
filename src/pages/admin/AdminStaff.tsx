import { useState } from 'react';
import {
  Shield, Users, Crown, ClipboardList, LayoutDashboard, UserCog, Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFounderRole } from '@/hooks/useFounderRole';
import WorkbenchOverview from '@/components/admin/workbench/WorkbenchOverview';
import WorkbenchBoard from '@/components/admin/workbench/WorkbenchBoard';
import WorkbenchStaffPanel from '@/components/admin/workbench/WorkbenchStaffPanel';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus, Save, X, Search, Eye, EyeOff, Trash2, ChevronDown, ChevronUp, Info, Lock, Unlock, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ───
const ADMIN_MODULES = [
  { key: 'dashboard', label: 'Dashboard', description: 'Översikt, statistik', group: 'Grundläggande' },
  { key: 'orders', label: 'Ordrar', description: 'Hantera ordrar', group: 'Grundläggande' },
  { key: 'products', label: 'Produkter', description: 'Produkthantering', group: 'Grundläggande' },
  { key: 'categories', label: 'Kategorier', description: 'Produktkategorier', group: 'Innehåll' },
  { key: 'reviews', label: 'Recensioner', description: 'Moderera recensioner', group: 'Grundläggande' },
  { key: 'members', label: 'Användare', description: 'Medlemmar', group: 'Användare' },
  { key: 'partners', label: 'Partners', description: 'Affiliates, influencers', group: 'Användare' },
  { key: 'finance', label: 'Betalning', description: 'Ekonomi', group: 'Känsligt' },
  { key: 'content', label: 'Innehåll', description: 'Sidinnehåll', group: 'Innehåll' },
  { key: 'campaigns', label: 'Kampanjer', description: 'Rabatter', group: 'Marknadsföring' },
  { key: 'shipping', label: 'Frakt', description: 'Fraktbolag', group: 'Drift' },
  { key: 'seo', label: 'SEO', description: 'Sökmotoroptimering', group: 'Marknadsföring' },
  { key: 'visibility', label: 'Sidsynlighet', description: 'Visa/dölj sidor', group: 'Innehåll' },
  { key: 'legal', label: 'Juridik', description: 'Juridiska dokument', group: 'Känsligt' },
  { key: 'logs', label: 'Logg', description: 'Aktivitetsloggar', group: 'Känsligt' },
  { key: 'settings', label: 'Inställningar', description: 'System', group: 'Känsligt' },
  { key: 'stats', label: 'Statistik', description: 'Avancerad statistik', group: 'Känsligt' },
  { key: 'staff', label: 'Personal', description: 'Roller', group: 'Känsligt' },
  { key: 'incidents', label: 'Ärenden', description: 'Incidenter', group: 'Drift' },
];

const MODULE_GROUPS = ['Grundläggande', 'Innehåll', 'Marknadsföring', 'Drift', 'Användare', 'Känsligt'];

const ROLE_COLORS: Record<string, string> = {
  founder: 'text-yellow-600', admin: 'text-destructive', it: 'text-purple-600',
  manager: 'text-green-600', moderator: 'text-blue-600', support: 'text-cyan-600',
  marketing: 'text-pink-600', finance: 'text-emerald-600', warehouse: 'text-orange-600',
};

interface RoleTemplate {
  id: string; role_key: string; name_sv: string; description_sv: string | null;
  default_modules: string[]; is_locked: boolean;
}

interface StaffMember {
  user_id: string; email: string; username: string | null; role: string;
  allowed_modules: string[]; notes: string | null; permissions_id: string | null;
}

// ─── Role Templates Tab ───
const RoleTemplatesTab = ({ isFounder }: { isFounder: boolean }) => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editModules, setEditModules] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['role-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('role_templates').select('*').order('is_locked', { ascending: false });
      if (error) throw error;
      return (data || []) as RoleTemplate[];
    },
  });

  const startEdit = (t: RoleTemplate) => { setEditingId(t.id); setEditModules([...t.default_modules]); };

  const handleSave = async (t: RoleTemplate) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('role_templates').update({ default_modules: editModules } as any).eq('id', t.id);
      if (error) throw error;
      toast.success(`Mall "${t.name_sv}" uppdaterad`);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['role-templates'] });
    } catch (err: any) { toast.error(err?.message || 'Fel'); } finally { setSaving(false); }
  };

  const syncUsersFromTemplate = async (t: RoleTemplate) => {
    if (!confirm(`Synka alla "${t.name_sv}" till mallens standard?`)) return;
    try {
      const { data: roleUsers } = await supabase.from('user_roles').select('user_id').eq('role', t.role_key as any);
      if (!roleUsers?.length) { toast.info('Inga användare'); return; }
      const userIds = roleUsers.map(r => r.user_id);
      const { error } = await supabase.from('staff_permissions').update({ allowed_modules: t.default_modules } as any).in('user_id', userIds);
      if (error) throw error;
      toast.success(`${userIds.length} användare synkade`);
      queryClient.invalidateQueries({ queryKey: ['admin-staff-members'] });
    } catch (err: any) { toast.error(err?.message || 'Fel'); }
  };

  if (isLoading) return <p className="text-center text-muted-foreground py-8">Laddar...</p>;

  return (
    <div className="space-y-3">
      {templates.map(t => {
        const isEditing = editingId === t.id;
        const modules = isEditing ? editModules : t.default_modules;
        return (
          <Card key={t.id} className="border-border">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {t.is_locked ? <Lock className="w-4 h-4 text-yellow-600" /> : <Unlock className="w-4 h-4 text-muted-foreground" />}
                  <h3 className={`font-semibold text-sm ${ROLE_COLORS[t.role_key] || ''}`}>{t.name_sv}</h3>
                  {t.is_locked && <Badge variant="outline" className="text-[10px]">Låst</Badge>}
                </div>
                <div className="flex gap-1.5">
                  {!isEditing ? (
                    <>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => startEdit(t)}>Redigera</Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => syncUsersFromTemplate(t)}>
                        <RefreshCw className="w-3 h-3" /> Synka
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" className="text-xs h-7 gap-1" onClick={() => handleSave(t)} disabled={saving}>
                        <Save className="w-3 h-3" /> Spara
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditingId(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {t.description_sv && <p className="text-xs text-muted-foreground">{t.description_sv}</p>}
              <div className="flex flex-wrap gap-1.5">
                {modules.map(m => {
                  const mod = ADMIN_MODULES.find(am => am.key === m);
                  return (
                    <Badge key={m} variant={isEditing ? 'default' : 'secondary'} className={`text-[10px] ${isEditing ? 'cursor-pointer' : ''}`}
                      onClick={() => { if (isEditing) setEditModules(prev => prev.filter(p => p !== m)); }}>
                      {mod?.label || m} {isEditing && '×'}
                    </Badge>
                  );
                })}
              </div>
              {isEditing && (
                <div className="pt-2 border-t border-border">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Lägg till:</p>
                  <div className="flex flex-wrap gap-1">
                    {ADMIN_MODULES.filter(am => !modules.includes(am.key)).map(am => (
                      <Badge key={am.key} variant="outline" className="text-[10px] cursor-pointer hover:bg-secondary"
                        onClick={() => setEditModules(prev => [...prev, am.key])}>
                        + {am.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// ─── Staff Management Tab ───
const StaffManagementTab = () => {
  const { user } = useAuth();
  const { isFounder } = useFounderRole();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editModules, setEditModules] = useState<Record<string, string[]>>({});
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [editRole, setEditRole] = useState<Record<string, string>>({});
  const [newUserEmail, setNewUserEmail] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['role-templates'],
    queryFn: async () => { const { data } = await supabase.from('role_templates').select('*'); return (data || []) as RoleTemplate[]; },
  });

  const { data: staffMembers = [], isLoading } = useQuery({
    queryKey: ['admin-staff-members'],
    queryFn: async () => {
      const { data: roles, error } = await supabase.from('user_roles').select('user_id, role').neq('role', 'user');
      if (error) throw error;
      if (!roles?.length) return [];
      const userIds = [...new Set(roles.map(r => r.user_id))];
      const [profilesRes, permsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, username').in('user_id', userIds),
        supabase.from('staff_permissions').select('*').in('user_id', userIds),
      ]);
      const permMap = new Map((permsRes.data || []).map(p => [p.user_id, p]));
      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const roleOrder = ['founder', 'admin', 'it', 'manager', 'moderator', 'support', 'marketing', 'finance', 'warehouse'];

      return userIds.map(uid => {
        const userRoles = roles.filter(r => r.user_id === uid);
        const highestRole = roleOrder.find(ro => userRoles.some(r => r.role === ro)) || 'user';
        const perm = permMap.get(uid);
        const profile = profileMap.get(uid);
        return {
          user_id: uid, email: profile?.username || uid.substring(0, 8) + '...', username: profile?.username || null,
          role: highestRole, allowed_modules: (perm as any)?.allowed_modules || [],
          notes: (perm as any)?.notes || null, permissions_id: (perm as any)?.id || null,
        } as StaffMember;
      }).sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
    },
    enabled: isFounder,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return staffMembers;
    const q = search.toLowerCase();
    return staffMembers.filter(m => m.email.toLowerCase().includes(q) || m.username?.toLowerCase().includes(q));
  }, [staffMembers, search]);

  const toggleExpand = (userId: string) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    const member = staffMembers.find(m => m.user_id === userId);
    if (member) {
      setEditModules(prev => ({ ...prev, [userId]: [...member.allowed_modules] }));
      setEditNotes(prev => ({ ...prev, [userId]: member.notes || '' }));
      setEditRole(prev => ({ ...prev, [userId]: member.role }));
    }
  };

  const applyTemplate = (userId: string, roleKey: string) => {
    const tmpl = templates.find(t => t.role_key === roleKey);
    if (tmpl) setEditModules(prev => ({ ...prev, [userId]: [...tmpl.default_modules] }));
    setEditRole(prev => ({ ...prev, [userId]: roleKey }));
  };

  const toggleModule = (userId: string, key: string) => {
    setEditModules(prev => {
      const current = prev[userId] || [];
      return { ...prev, [userId]: current.includes(key) ? current.filter(m => m !== key) : [...current, key] };
    });
  };

  const handleSave = async (member: StaffMember) => {
    if (!user) return;
    if (member.user_id === user.id) { toast.error('Du kan inte ändra dig själv'); return; }
    if (member.role === 'founder') { toast.error('Grundare kan inte ändras'); return; }
    setSaving(member.user_id);
    try {
      const newRole = editRole[member.user_id] || member.role;
      const newModules = editModules[member.user_id] || member.allowed_modules;
      const newNotes = editNotes[member.user_id] ?? member.notes;
      if (newRole !== member.role && member.role !== 'founder') {
        await supabase.from('user_roles').delete().eq('user_id', member.user_id).eq('role', member.role as any);
        await supabase.from('user_roles').insert({ user_id: member.user_id, role: newRole as any });
      }
      if (member.permissions_id) {
        await supabase.from('staff_permissions').update({ allowed_modules: newModules, notes: newNotes || null } as any).eq('id', member.permissions_id);
      } else {
        await supabase.from('staff_permissions').insert({ user_id: member.user_id, allowed_modules: newModules, notes: newNotes || null, granted_by: user.id } as any);
      }
      toast.success('Sparat!');
      queryClient.invalidateQueries({ queryKey: ['admin-staff-members'] });
      setExpandedUser(null);
    } catch (err: any) { toast.error(err?.message || 'Fel'); } finally { setSaving(null); }
  };

  const handleRemove = async (member: StaffMember) => {
    if (!user || member.user_id === user.id || member.role === 'founder') return;
    if (!confirm(`Ta bort ${member.username || member.email}?`)) return;
    try {
      await supabase.from('user_roles').delete().eq('user_id', member.user_id).eq('role', member.role as any);
      if (member.permissions_id) await supabase.from('staff_permissions').delete().eq('id', member.permissions_id);
      toast.success('Borttagen');
      queryClient.invalidateQueries({ queryKey: ['admin-staff-members'] });
    } catch (err: any) { toast.error(err?.message || 'Fel'); }
  };

  const handleAdd = async () => {
    if (!newUserEmail.trim() || !user) return;
    setAddingUser(true);
    try {
      const { data: found } = await supabase.rpc('admin_search_users', { p_query: newUserEmail.trim() });
      if (!found?.length) { toast.error('Ingen hittades'); setAddingUser(false); return; }
      const target = found[0];
      if (target.user_id === user.id || staffMembers.find(m => m.user_id === target.user_id)) {
        toast.error('Redan personal'); setAddingUser(false); return;
      }
      const defaultTmpl = templates.find(t => t.role_key === 'moderator');
      await supabase.from('user_roles').insert({ user_id: target.user_id, role: 'moderator' as any });
      await supabase.from('staff_permissions').insert({ user_id: target.user_id, allowed_modules: defaultTmpl?.default_modules || ['dashboard', 'orders'], granted_by: user.id } as any);
      toast.success('Tillagd!'); setNewUserEmail('');
      queryClient.invalidateQueries({ queryKey: ['admin-staff-members'] });
    } catch (err: any) { toast.error(err?.message || 'Fel'); } finally { setAddingUser(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardContent className="pt-4 pb-4">
          <Label className="text-sm font-semibold mb-2 block">Lägg till personal</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="E-post eller användarnamn..." className="pl-9" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            </div>
            <Button onClick={handleAdd} disabled={addingUser || !newUserEmail.trim()} className="gap-1.5"><Plus className="w-4 h-4" /> Lägg till</Button>
          </div>
        </CardContent>
      </Card>

      {staffMembers.length > 3 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök personal..." className="pl-9" />
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(member => {
          const isExpanded = expandedUser === member.user_id;
          const isSelf = member.user_id === user?.id;
          const isFounderRole = member.role === 'founder';
          const currentModules = editModules[member.user_id] || member.allowed_modules;
          const currentRole = editRole[member.user_id] || member.role;

          return (
            <Card key={member.user_id} className={cn('border-border transition-shadow', isExpanded && 'shadow-md')}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => toggleExpand(member.user_id)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', isFounderRole ? 'bg-yellow-600/10' : 'bg-secondary')}>
                      {isFounderRole ? <Crown className="w-5 h-5 text-yellow-600" /> : <Shield className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{member.username || member.email}</h3>
                        {isSelf && <Badge variant="outline" className="text-[10px] py-0">Du</Badge>}
                      </div>
                      <span className={cn('text-xs font-medium', ROLE_COLORS[member.role])}>
                        {templates.find(t => t.role_key === member.role)?.name_sv || member.role}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isSelf && !isFounderRole && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); handleRemove(member); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                    {isSelf ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
                        <Info className="w-4 h-4 shrink-0" /> Du kan inte ändra dig själv.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Roll</Label>
                          {isFounderRole ? (
                            <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-600/5 rounded-lg p-2.5">
                              <Crown className="w-4 h-4" /> Grundare — kan inte ändras
                            </div>
                          ) : (
                            <Select value={currentRole} onValueChange={v => applyTemplate(member.user_id, v)}>
                              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {templates.filter(t => t.role_key !== 'founder').map(t => (
                                  <SelectItem key={t.role_key} value={t.role_key}>
                                    <span className={cn('font-medium', ROLE_COLORS[t.role_key])}>{t.name_sv}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold">Modulåtkomst</Label>
                            <div className="flex gap-1.5">
                              <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setEditModules(prev => ({ ...prev, [member.user_id]: ADMIN_MODULES.map(m => m.key) }))}>
                                <Eye className="w-3 h-3 mr-1" /> Alla
                              </Button>
                              <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setEditModules(prev => ({ ...prev, [member.user_id]: [] }))}>
                                <EyeOff className="w-3 h-3 mr-1" /> Inga
                              </Button>
                            </div>
                          </div>
                          {MODULE_GROUPS.map(group => (
                            <div key={group} className="space-y-1">
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">{group}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {ADMIN_MODULES.filter(m => m.group === group).map(mod => (
                                  <label key={mod.key} className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm',
                                    currentModules.includes(mod.key) ? 'bg-primary/5 border border-primary/20' : 'bg-secondary/30 border border-transparent hover:bg-secondary/60')}>
                                    <Checkbox checked={currentModules.includes(mod.key)} onCheckedChange={() => toggleModule(member.user_id, mod.key)} />
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium">{mod.label}</p>
                                      <p className="text-[10px] text-muted-foreground">{mod.description}</p>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Anteckningar</Label>
                          <Textarea value={editNotes[member.user_id] || ''} onChange={e => setEditNotes(prev => ({ ...prev, [member.user_id]: e.target.value }))} rows={2} className="text-sm" />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button size="sm" className="gap-1.5" onClick={() => handleSave(member)} disabled={saving === member.user_id}>
                            <Save className="w-3.5 h-3.5" /> Spara
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setExpandedUser(null)}><X className="w-3.5 h-3.5" /> Stäng</Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Workbench Page ───
const AdminStaff = () => {
  const { isFounder, isLoading: founderLoading } = useFounderRole();
  const [activeTab, setActiveTab] = useState('overview');
  const [boardFilter, setBoardFilter] = useState<string | undefined>();

  const handleNavigate = (tab: string, filter?: string) => {
    setActiveTab(tab);
    setBoardFilter(filter);
  };

  if (founderLoading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Laddar...</div>;

  if (!isFounder) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Shield className="w-16 h-16 text-muted-foreground/30" />
        <h2 className="text-xl font-semibold text-muted-foreground">Åtkomst nekad</h2>
        <p className="text-sm text-muted-foreground">Enbart för grundare.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Crown className="w-6 h-6 text-yellow-600" />
          Workbench
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Operativ kontrollpanel — uppgifter, personal och roller.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" className="gap-1.5"><LayoutDashboard className="w-3.5 h-3.5" /> Översikt</TabsTrigger>
          <TabsTrigger value="workboard" className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Workboard</TabsTrigger>
          {isFounder && (
            <>
              <TabsTrigger value="staff" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Personal</TabsTrigger>
              <TabsTrigger value="roles" className="gap-1.5"><UserCog className="w-3.5 h-3.5" /> Roller</TabsTrigger>
              <TabsTrigger value="manage" className="gap-1.5"><Shield className="w-3.5 h-3.5" /> Behörigheter</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview">
          <WorkbenchOverview onNavigate={handleNavigate} />
        </TabsContent>

        <TabsContent value="workboard">
          <WorkbenchBoard initialFilter={boardFilter} />
        </TabsContent>

        <TabsContent value="staff">
          <WorkbenchStaffPanel />
        </TabsContent>

        <TabsContent value="roles">
          <RoleTemplatesTab isFounder={isFounder} />
        </TabsContent>

        <TabsContent value="manage">
          <StaffManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminStaff;
