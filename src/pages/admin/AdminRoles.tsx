import { useState } from 'react';
import { UserCog, Crown, Lock, Unlock, RefreshCw, Save, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFounderRole } from '@/hooks/useFounderRole';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';

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

const ROLE_COLORS: Record<string, string> = {
  founder: 'text-yellow-600', admin: 'text-destructive', it: 'text-purple-600',
  manager: 'text-green-600', moderator: 'text-blue-600', support: 'text-cyan-600',
  marketing: 'text-pink-600', finance: 'text-emerald-600', warehouse: 'text-orange-600',
};

interface RoleTemplate {
  id: string; role_key: string; name_sv: string; description_sv: string | null;
  default_modules: string[]; is_locked: boolean;
}

const AdminRoles = () => {
  const { isFounder, isLoading: founderLoading } = useFounderRole();
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

  if (isLoading) return <p className="text-center text-muted-foreground py-8">Laddar...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <UserCog className="w-6 h-6 text-primary" />
          Roller & Behörighetsmallar
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Definiera vilka moduler varje roll ger åtkomst till.</p>
      </div>

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
    </div>
  );
};

export default AdminRoles;
