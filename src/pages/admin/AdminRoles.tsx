import { useState } from 'react';
import { UserCog, Lock, Unlock, RefreshCw, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFounderRole } from '@/hooks/useFounderRole';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { type ModuleActions, type GranularPermissions, validatePermissions, parseDbPermissions } from '@/lib/permissions';

interface RoleTemplate {
  id: string;
  role_key: string;
  name_sv: string;
  description_sv: string | null;
  permissions: GranularPermissions;
  is_locked: boolean;
}

// ─── Constants ───
const ADMIN_MODULES = [
  { key: 'dashboard', label: 'Dashboard', group: 'Grundläggande' },
  { key: 'orders', label: 'Ordrar', group: 'Grundläggande' },
  { key: 'products', label: 'Produkter', group: 'Grundläggande' },
  { key: 'categories', label: 'Kategorier', group: 'Innehåll' },
  { key: 'reviews', label: 'Recensioner', group: 'Grundläggande' },
  { key: 'members', label: 'Användare', group: 'Användare' },
  { key: 'partners', label: 'Partners', group: 'Användare' },
  { key: 'finance', label: 'Betalning', group: 'Känsligt' },
  { key: 'content', label: 'Innehåll', group: 'Innehåll' },
  { key: 'campaigns', label: 'Kampanjer', group: 'Marknadsföring' },
  { key: 'shipping', label: 'Frakt', group: 'Drift' },
  { key: 'seo', label: 'SEO', group: 'Marknadsföring' },
  { key: 'visibility', label: 'Sidsynlighet', group: 'Innehåll' },
  { key: 'legal', label: 'Juridik', group: 'Känsligt' },
  { key: 'logs', label: 'Logg', group: 'Känsligt' },
  { key: 'settings', label: 'Inställningar', group: 'Känsligt' },
  { key: 'stats', label: 'Statistik', group: 'Känsligt' },
  { key: 'staff', label: 'Personal', group: 'Känsligt' },
  { key: 'incidents', label: 'Ärenden', group: 'Drift' },
];

const MODULE_GROUPS = ['Grundläggande', 'Innehåll', 'Marknadsföring', 'Drift', 'Användare', 'Känsligt'];

const ROLE_COLORS: Record<string, string> = {
  founder: 'text-yellow-600', admin: 'text-destructive', it: 'text-purple-600',
  manager: 'text-green-600', moderator: 'text-blue-600', support: 'text-cyan-600',
  marketing: 'text-pink-600', finance: 'text-emerald-600', warehouse: 'text-orange-600',
};

const ACTIONS: { key: keyof ModuleActions; label: string }[] = [
  { key: 'read', label: 'Läs' },
  { key: 'write', label: 'Skriv' },
  { key: 'delete', label: 'Radera' },
  { key: 'approve', label: 'Godkänn' },
];

const EMPTY_ACTIONS: ModuleActions = { read: false, write: false, delete: false, approve: false };

const AdminRoles = () => {
  const { isFounder, isLoading: founderLoading } = useFounderRole();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<GranularPermissions>({});
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['role-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('role_templates').select('*').order('is_locked', { ascending: false });
      if (error) throw error;
      return (data || []) as RoleTemplate[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const startEdit = (t: RoleTemplate) => {
    setEditingId(t.id);
    // permissions is the single source of truth — no fallback
    const validated = parseDbPermissions(t.permissions, `role_template:${t.role_key}`);
    if (!validated) { toast.error('Mallen har ogiltiga behörigheter — kontakta administratör'); return; }
    setEditPerms(validated);
    setExpandedId(t.id);
  };

  const toggleAction = (modKey: string, action: keyof ModuleActions) => {
    setEditPerms(prev => {
      const current = prev[modKey] ?? { ...EMPTY_ACTIONS };
      const updated = { ...current, [action]: !current[action] };
      // If read is turned off, clear all other actions too
      if (action === 'read' && !updated.read) {
        return { ...prev, [modKey]: { ...EMPTY_ACTIONS } };
      }
      // If any write/delete/approve is enabled, ensure read is also on
      if (action !== 'read' && updated[action]) {
        updated.read = true;
      }
      return { ...prev, [modKey]: updated };
    });
  };

  const handleSave = async (t: RoleTemplate) => {
    setSaving(true);
    try {
      // Validate before write — no empty permissions allowed
      const perms = validatePermissions(editPerms);
      const { error } = await supabase
        .from('role_templates')
        .update({ permissions: perms })
        .eq('id', t.id);
      if (error) throw error;
      toast.success(`Mall "${t.name_sv}" uppdaterad`);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['role-templates'] });
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Fel'); } finally { setSaving(false); }
  };

  const syncUsersFromTemplate = async (t: RoleTemplate) => {
    if (!confirm(`Synka alla "${t.name_sv}"-användare till mallens behörigheter?`)) return;
    try {
      // Validate template permissions before sync — throws if empty
      const perms = validatePermissions(t.permissions);
      const { data: roleUsers } = await supabase.from('user_roles').select('user_id').eq('role', t.role_key as never);
      if (!roleUsers?.length) { toast.info('Inga användare med den rollen'); return; }
      const userIds = roleUsers.map(r => r.user_id);
      const { error } = await supabase
        .from('staff_permissions')
        .update({ permissions: perms })
        .in('user_id', userIds);
      if (error) throw error;
      toast.success(`${userIds.length} användare synkade`);
      queryClient.invalidateQueries({ queryKey: ['admin-staff-members'] });
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Fel'); }
  };

  // ─── Guards ───
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
  if (!templates && !isLoading) return null; // deny-by-default

  if (isLoading) return <p className="text-center text-muted-foreground py-8">Laddar...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <UserCog className="w-6 h-6 text-primary" />
          Roller & Behörighetsmallar
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Definiera granulär åtkomst per modul och åtgärd för varje roll.
        </p>
      </div>

      <div className="space-y-3">
        {templates.map(t => {
          const isEditing = editingId === t.id;
          const isExpanded = expandedId === t.id;
          const displayPerms: GranularPermissions = isEditing
            ? editPerms
            // Section 4: validate DB data before render — skip if invalid
            : (parseDbPermissions(t.permissions, `render:${t.role_key}`) ?? {});

          const moduleCount = Object.values(displayPerms).filter(a => a.read).length;

          return (
            <Card key={t.id} className="border-border">
              <CardContent className="pt-4 pb-4 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  >
                    {t.is_locked ? <Lock className="w-4 h-4 text-yellow-600 shrink-0" /> : <Unlock className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <h3 className={`font-semibold text-sm ${ROLE_COLORS[t.role_key] || ''}`}>{t.name_sv}</h3>
                    {t.is_locked && <Badge variant="outline" className="text-[10px]">Låst</Badge>}
                    <span className="text-[10px] text-muted-foreground ml-1">({moduleCount} moduler)</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
                  </div>
                  <div className="flex gap-1.5 ml-3 shrink-0">
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
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setEditingId(null); setExpandedId(null); }}>
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {t.description_sv && <p className="text-xs text-muted-foreground">{t.description_sv}</p>}

                {/* Expanded: granular permissions grid */}
                {(isExpanded || isEditing) && (
                  <div className="pt-2 border-t border-border space-y-4">
                    {MODULE_GROUPS.map(group => {
                      const groupMods = ADMIN_MODULES.filter(m => m.group === group);
                      return (
                        <div key={group}>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
                          <div className="space-y-1">
                            {/* Column headers */}
                            <div className="grid grid-cols-[1fr_repeat(4,_44px)] gap-1 px-3 mb-1">
                              <span />
                              {ACTIONS.map(a => (
                                <span key={a.key} className="text-[10px] font-semibold text-muted-foreground text-center">{a.label}</span>
                              ))}
                            </div>
                            {groupMods.map(mod => {
                              const actions = displayPerms[mod.key] ?? EMPTY_ACTIONS;
                              return (
                                <div
                                  key={mod.key}
                                  className={cn(
                                    'grid grid-cols-[1fr_repeat(4,_44px)] gap-1 items-center px-3 py-2 rounded-lg',
                                    actions.read ? 'bg-primary/5 border border-primary/20' : 'bg-secondary/30 border border-transparent'
                                  )}
                                >
                                  <span className="text-xs font-medium truncate">{mod.label}</span>
                                  {ACTIONS.map(a => (
                                    <div key={a.key} className="flex justify-center">
                                      <Checkbox
                                        checked={!!actions[a.key]}
                                        disabled={!isEditing}
                                        onCheckedChange={() => isEditing && toggleAction(mod.key, a.key)}
                                        className={cn(!isEditing && 'opacity-60')}
                                      />
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Collapsed summary badges */}
                {!isExpanded && !isEditing && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(displayPerms)
                      .filter(([, a]) => a.read)
                      .map(([k]) => {
                        const mod = ADMIN_MODULES.find(m => m.key === k);
                        return <Badge key={k} variant="secondary" className="text-[10px]">{mod?.label || k}</Badge>;
                      })}
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

export default AdminRoles;
