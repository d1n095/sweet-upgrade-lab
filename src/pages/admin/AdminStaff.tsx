import { useState, useMemo } from 'react';
import {
  Shield, Users, Crown, ClipboardList, LayoutDashboard, UserCog, Zap,
  Plus, Save, X, Search, Trash2, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFounderRole } from '@/hooks/useFounderRole';
import WorkbenchOverview from '@/components/admin/workbench/WorkbenchOverview';
import WorkbenchBoard from '@/components/admin/workbench/WorkbenchBoard';
import WorkbenchStaffPanel from '@/components/admin/workbench/WorkbenchStaffPanel';
import QuickPackMode from '@/components/admin/workbench/QuickPackMode';
import AdminRoles from './AdminRoles';

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
import { cn } from '@/lib/utils';
import {
  type ModuleActions,
  type GranularPermissions,
  mergePermissions,
  validatePermissions,
  parseDbPermissions,
} from '@/lib/permissions';
import { enforce } from '@/lib/permissionGuard';

// ─── Write audit log entry (best-effort, non-blocking) ───
const writeAuditLog = async (
  actorId: string,
  action: string,
  targetTable: string,
  targetId: string,
  changes: Record<string, unknown>,
) => {
  try {
    await supabase.from('audit_logs').insert({
      actor_id: actorId,
      action,
      target_table: targetTable,
      target_id: targetId,
      changes,
    });
  } catch (_) { /* non-blocking */ }
};

// ─── Constants ───
const ADMIN_MODULES = [
  { key: 'dashboard',  label: 'Dashboard',     description: 'Översikt, statistik',      group: 'Grundläggande' },
  { key: 'orders',     label: 'Ordrar',         description: 'Hantera ordrar',            group: 'Grundläggande' },
  { key: 'products',   label: 'Produkter',      description: 'Produkthantering',          group: 'Grundläggande' },
  { key: 'categories', label: 'Kategorier',     description: 'Produktkategorier',         group: 'Innehåll' },
  { key: 'reviews',    label: 'Recensioner',    description: 'Moderera recensioner',      group: 'Grundläggande' },
  { key: 'members',    label: 'Användare',      description: 'Medlemmar',                 group: 'Användare' },
  { key: 'partners',   label: 'Partners',       description: 'Affiliates, influencers',   group: 'Användare' },
  { key: 'finance',    label: 'Betalning',      description: 'Ekonomi',                   group: 'Känsligt' },
  { key: 'content',    label: 'Innehåll',       description: 'Sidinnehåll',               group: 'Innehåll' },
  { key: 'campaigns',  label: 'Kampanjer',      description: 'Rabatter',                  group: 'Marknadsföring' },
  { key: 'shipping',   label: 'Frakt',          description: 'Fraktbolag',                group: 'Drift' },
  { key: 'seo',        label: 'SEO',            description: 'Sökmotoroptimering',        group: 'Marknadsföring' },
  { key: 'visibility', label: 'Sidsynlighet',   description: 'Visa/dölj sidor',           group: 'Innehåll' },
  { key: 'legal',      label: 'Juridik',        description: 'Juridiska dokument',        group: 'Känsligt' },
  { key: 'logs',       label: 'Logg',           description: 'Aktivitetsloggar',          group: 'Känsligt' },
  { key: 'settings',   label: 'Inställningar',  description: 'System',                    group: 'Känsligt' },
  { key: 'stats',      label: 'Statistik',      description: 'Avancerad statistik',       group: 'Känsligt' },
  { key: 'staff',      label: 'Personal',       description: 'Roller',                    group: 'Känsligt' },
  { key: 'incidents',  label: 'Ärenden',        description: 'Incidenter',                group: 'Drift' },
];

const MODULE_GROUPS = ['Grundläggande', 'Innehåll', 'Marknadsföring', 'Drift', 'Användare', 'Känsligt'];

const ROLE_COLORS: Record<string, string> = {
  founder: 'text-yellow-600', admin: 'text-destructive', it: 'text-purple-600',
  manager: 'text-green-600', moderator: 'text-blue-600', support: 'text-cyan-600',
  marketing: 'text-pink-600', finance: 'text-emerald-600', warehouse: 'text-orange-600',
};

const ACTIONS: { key: keyof ModuleActions; label: string }[] = [
  { key: 'read',    label: 'Läs'     },
  { key: 'write',   label: 'Skriv'   },
  { key: 'delete',  label: 'Radera'  },
  { key: 'approve', label: 'Godkänn' },
];

const EMPTY_ACTIONS: ModuleActions = { read: false, write: false, delete: false, approve: false };

// ─── Interfaces ───
interface RoleTemplate {
  id: string;
  role_key: string;
  name_sv: string;
  description_sv: string | null;
  permissions: GranularPermissions;
  is_locked: boolean;
}

interface StaffMember {
  user_id: string;
  email: string;
  username: string | null;
  role: string;
  /** Granular permissions — single source of truth */
  permissions: GranularPermissions;
  notes: string | null;
  permissions_id: string | null;
  /** All roles assigned to this user (multi-role support) */
  roles: string[];
}

// ─── Staff Management Tab ───
const StaffManagementTab = () => {
  const { user } = useAuth();
  const { isFounder } = useFounderRole();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<Record<string, GranularPermissions>>({});
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [editRole, setEditRole] = useState<Record<string, string>>({});
  const [newUserEmail, setNewUserEmail] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['role-templates'],
    queryFn: async () => {
      const { data } = await supabase.from('role_templates').select('*');
      return (data || []) as RoleTemplate[];
    },
    staleTime: 5 * 60 * 1000,
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
        // Section 4: validate DB permissions — skip invalid records gracefully
        const rawPerms = perm?.permissions ?? null;
        const validatedPerms = parseDbPermissions(rawPerms, `staff_permissions:${uid}`);
        return {
          user_id: uid,
          email: profile?.username || uid.substring(0, 8) + '...',
          username: profile?.username || null,
          role: highestRole,
          permissions: validatedPerms ?? ({} as GranularPermissions),
          notes: perm?.notes || null,
          permissions_id: perm?.id || null,
          roles: userRoles.map(r => r.role),
        } as StaffMember;
      }).sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
    },
    enabled: isFounder,
    staleTime: 30 * 1000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return staffMembers;
    const q = search.toLowerCase();
    return staffMembers.filter(m =>
      m.email.toLowerCase().includes(q) || m.username?.toLowerCase().includes(q),
    );
  }, [staffMembers, search]);

  const toggleExpand = (userId: string) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    const member = staffMembers.find(m => m.user_id === userId);
    if (member) {
      setEditPerms(prev => ({ ...prev, [userId]: { ...member.permissions } }));
      setEditNotes(prev => ({ ...prev, [userId]: member.notes || '' }));
      setEditRole(prev => ({ ...prev, [userId]: member.role }));
    }
  };

  // Populate editPerms from the selected role template — permissions are the single source of truth
  const handleRoleChange = (userId: string, roleKey: string) => {
    const tmpl = templates.find(t => t.role_key === roleKey);
    const perms = tmpl ? parseDbPermissions(tmpl.permissions, `role_template:${roleKey}`) : null;
    if (!perms) {
      toast.error('Rollmallen saknar giltiga behörigheter');
      return;
    }
    setEditPerms(prev => ({ ...prev, [userId]: perms }));
    setEditRole(prev => ({ ...prev, [userId]: roleKey }));
  };

  // Toggle a single action for a module, maintaining read-dependency rules
  const toggleUserAction = (userId: string, modKey: string, action: keyof ModuleActions) => {
    setEditPerms(prev => {
      const userPerms = prev[userId] ?? {};
      const current = userPerms[modKey] ?? { ...EMPTY_ACTIONS };
      const updated = { ...current, [action]: !current[action] };
      // Turning off read clears all actions
      if (action === 'read' && !updated.read) {
        return { ...prev, [userId]: { ...userPerms, [modKey]: { ...EMPTY_ACTIONS } } };
      }
      // Enabling write/delete/approve auto-enables read
      if (action !== 'read' && updated[action]) {
        updated.read = true;
      }
      return { ...prev, [userId]: { ...userPerms, [modKey]: updated } };
    });
  };

  const handleSave = async (member: StaffMember) => {
    if (!user) return;
    if (member.user_id === user.id) { toast.error('Du kan inte ändra dig själv'); return; }
    const newRole = editRole[member.user_id] || member.role;
    if (member.user_id === user.id && ['founder', 'admin'].includes(newRole)) {
      toast.error('Du kan inte ge dig själv en högre roll'); return;
    }
    const newPerms = editPerms[member.user_id] ?? member.permissions;
    // Reject writes with empty/null permissions
    if (!newPerms || Object.keys(newPerms).length === 0) {
      toast.error('Behörigheter får inte vara tomma'); return;
    }
    setSaving(member.user_id);
    try {
      const newNotes = editNotes[member.user_id] ?? member.notes;
      const changes: Record<string, unknown> = {};

      if (newRole !== member.role) {
        changes.role_before = member.role;
        changes.role_after = newRole;
        await supabase.from('user_roles').delete().eq('user_id', member.user_id).eq('role', member.role as never);
        await supabase.from('user_roles').insert({ user_id: member.user_id, role: newRole as never });
      }
      if (JSON.stringify(newPerms) !== JSON.stringify(member.permissions)) {
        changes.before_permissions = member.permissions;
        changes.after_permissions = newPerms;
      }
      if (member.permissions_id) {
        await supabase.from('staff_permissions')
          .update({ permissions: newPerms, notes: newNotes || null })
          .eq('id', member.permissions_id);
      } else {
        await supabase.from('staff_permissions')
          .insert({ user_id: member.user_id, permissions: newPerms, notes: newNotes || null, granted_by: user.id });
      }
      if (Object.keys(changes).length > 0) {
        await writeAuditLog(user.id, 'update_staff', 'staff_permissions', member.user_id, changes);
      }
      toast.success('Sparat!');
      queryClient.invalidateQueries({ queryKey: ['admin-staff-members'] });
      setExpandedUser(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fel');
    } finally { setSaving(null); }
  };

  const handleRemove = async (member: StaffMember) => {
    if (!user || member.user_id === user.id) return;
    if (!confirm(`Ta bort ${member.username || member.email}?`)) return;
    try {
      await supabase.from('user_roles').delete().eq('user_id', member.user_id).eq('role', member.role as never);
      if (member.permissions_id) {
        await supabase.from('staff_permissions').delete().eq('id', member.permissions_id);
      }
      await writeAuditLog(user.id, 'remove_staff', 'user_roles', member.user_id, { role: member.role });
      toast.success('Borttagen');
      queryClient.invalidateQueries({ queryKey: ['admin-staff-members'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fel');
    }
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
      const defaultPerms = defaultTmpl ? parseDbPermissions(defaultTmpl.permissions, 'role_template:moderator') : null;
      if (!defaultPerms) {
        toast.error('Moderator-mallen saknar giltiga behörigheter — konfigurera rollmallen först');
        setAddingUser(false);
        return;
      }
      await supabase.from('user_roles').insert({ user_id: target.user_id, role: 'moderator' as never });
      await supabase.from('staff_permissions').insert({
        user_id: target.user_id, permissions: defaultPerms, granted_by: user.id,
      });
      await writeAuditLog(user.id, 'add_staff', 'user_roles', target.user_id, {
        role: 'moderator', after_permissions: defaultPerms,
      });
      toast.success('Tillagd!'); setNewUserEmail('');
      queryClient.invalidateQueries({ queryKey: ['admin-staff-members'] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fel');
    } finally { setAddingUser(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardContent className="pt-4 pb-4">
          <Label className="text-sm font-semibold mb-2 block">Lägg till personal</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={newUserEmail}
                onChange={e => setNewUserEmail(e.target.value)}
                placeholder="E-post eller användarnamn..."
                className="pl-9"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <Button onClick={handleAdd} disabled={addingUser || !newUserEmail.trim()} className="gap-1.5">
              <Plus className="w-4 h-4" /> Lägg till
            </Button>
          </div>
        </CardContent>
      </Card>

      {staffMembers.length > 3 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök personal..." className="pl-9" />
        </div>
      )}

      {isLoading && <p className="text-center text-muted-foreground py-8">Laddar...</p>}

      <div className="space-y-2">
        {filtered.map(member => {
          const isExpanded = expandedUser === member.user_id;
          const isSelf = member.user_id === user?.id;
          const isFounderRole = member.role === 'founder';
          const currentRole = editRole[member.user_id] || member.role;
          // Effective permissions = union of all role templates (multi-role)
          const mergedPerms = mergePermissions(
            member.roles.map(r => templates.find(t => t.role_key === r)?.permissions || {}),
          );
          const moduleCount = Object.values(member.permissions).filter(a => a.read).length;

          return (
            <Card key={member.user_id} className={cn('border-border transition-shadow', isExpanded && 'shadow-md')}>
              <CardContent className="pt-4 pb-4">
                {/* Collapsed header */}
                <div
                  className="flex items-center justify-between gap-3 cursor-pointer"
                  onClick={() => toggleExpand(member.user_id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                      isFounderRole ? 'bg-yellow-600/10' : 'bg-secondary',
                    )}>
                      {isFounderRole
                        ? <Crown className="w-5 h-5 text-yellow-600" />
                        : <Shield className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{member.username || member.email}</h3>
                        {isSelf && <Badge variant="outline" className="text-[10px] py-0">Du</Badge>}
                        {member.roles.length > 1 && (
                          <Badge variant="secondary" className="text-[10px] py-0">{member.roles.length} roller</Badge>
                        )}
                      </div>
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        {member.roles.map(r => (
                          <span key={r} className={cn('text-xs font-medium', ROLE_COLORS[r])}>
                            {templates.find(t => t.role_key === r)?.name_sv || r}
                          </span>
                        ))}
                      </div>
                      {moduleCount > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {moduleCount} moduler · {Object.values(mergedPerms).filter(a => a.read).length} via roll
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isSelf && (
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={e => { e.stopPropagation(); handleRemove(member); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded edit panel */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                    {isSelf ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
                        <Info className="w-4 h-4 shrink-0" /> Du kan inte ändra dig själv.
                      </div>
                    ) : (
                      <>
                        {/* Role selector */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Roll</Label>
                          {isFounderRole && (
                            <div className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-600/5 rounded-lg px-2.5 py-1.5 mb-1.5">
                              <Crown className="w-3.5 h-3.5 shrink-0" /> Grundare — full åtkomst aktiverad
                            </div>
                          )}
                          <Select value={currentRole} onValueChange={v => handleRoleChange(member.user_id, v)}>
                            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {templates.map(t => (
                                <SelectItem key={t.role_key} value={t.role_key}>
                                  <span className={cn('font-medium', ROLE_COLORS[t.role_key])}>{t.name_sv}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Granular permissions matrix — single source of truth */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold">Behörigheter per modul</Label>
                          {MODULE_GROUPS.map(group => {
                            const groupMods = ADMIN_MODULES.filter(m => m.group === group);
                            return (
                              <div key={group} className="space-y-1">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">{group}</p>
                                {/* Column headers */}
                                <div className="grid grid-cols-[1fr_repeat(4,_44px)] gap-1 px-3 mb-1">
                                  <span />
                                  {ACTIONS.map(a => (
                                    <span key={a.key} className="text-[10px] font-semibold text-muted-foreground text-center">{a.label}</span>
                                  ))}
                                </div>
                                {groupMods.map(mod => {
                                  const currentPerms = editPerms[member.user_id] ?? member.permissions;
                                  const actions = currentPerms[mod.key] ?? EMPTY_ACTIONS;
                                  return (
                                    <div
                                      key={mod.key}
                                      className={cn(
                                        'grid grid-cols-[1fr_repeat(4,_44px)] gap-1 items-center px-3 py-2 rounded-lg',
                                        actions.read
                                          ? 'bg-primary/5 border border-primary/20'
                                          : 'bg-secondary/30 border border-transparent',
                                      )}
                                    >
                                      <span className="text-xs font-medium truncate">{mod.label}</span>
                                      {ACTIONS.map(a => (
                                        <div key={a.key} className="flex justify-center">
                                          <Checkbox
                                            checked={!!actions[a.key]}
                                            onCheckedChange={() => toggleUserAction(member.user_id, mod.key, a.key)}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Anteckningar</Label>
                          <Textarea
                            value={editNotes[member.user_id] || ''}
                            onChange={e => setEditNotes(prev => ({ ...prev, [member.user_id]: e.target.value }))}
                            rows={2}
                            className="text-sm"
                          />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button size="sm" className="gap-1.5" onClick={() => handleSave(member)} disabled={saving === member.user_id}>
                            <Save className="w-3.5 h-3.5" /> Spara
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setExpandedUser(null)}>
                            <X className="w-3.5 h-3.5" /> Stäng
                          </Button>
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

  if (founderLoading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">Laddar...</div>
  );

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
          <TabsTrigger value="overview"  className="gap-1.5"><LayoutDashboard className="w-3.5 h-3.5" /> Översikt</TabsTrigger>
          <TabsTrigger value="workboard" className="gap-1.5"><ClipboardList   className="w-3.5 h-3.5" /> Workboard</TabsTrigger>
          <TabsTrigger value="quickpack" className="gap-1.5"><Zap             className="w-3.5 h-3.5" /> Snabb packning</TabsTrigger>
          {isFounder && (
            <>
              <TabsTrigger value="staff"  className="gap-1.5"><Users   className="w-3.5 h-3.5" /> Personal</TabsTrigger>
              <TabsTrigger value="roles"  className="gap-1.5"><UserCog className="w-3.5 h-3.5" /> Roller & Behörigheter</TabsTrigger>
              <TabsTrigger value="manage" className="gap-1.5"><Shield  className="w-3.5 h-3.5" /> Hantera personal</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="overview">
          <WorkbenchOverview onNavigate={handleNavigate} />
        </TabsContent>

        <TabsContent value="workboard">
          <WorkbenchBoard initialFilter={boardFilter} />
        </TabsContent>

        <TabsContent value="quickpack">
          <QuickPackMode />
        </TabsContent>

        <TabsContent value="staff">
          <WorkbenchStaffPanel />
        </TabsContent>

        {/* Granular permissions editor — single source of truth */}
        <TabsContent value="roles">
          <AdminRoles />
        </TabsContent>

        {/* Per-user permission management */}
        <TabsContent value="manage">
          <StaffManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminStaff;
