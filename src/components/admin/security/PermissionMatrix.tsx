import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useFounderRole } from '@/hooks/useFounderRole';

type Row = {
  id?: string;
  role: string;
  module: string;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
};

const ACTIONS = ['can_read', 'can_create', 'can_update', 'can_delete'] as const;

export default function PermissionMatrix() {
  const { isFounder, isLoading: roleLoading } = useFounderRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('role_module_permissions')
      .select('*')
      .order('role')
      .order('module');
    if (error) toast.error('Kunde inte ladda behörigheter');
    setRows((data as Row[]) || []);
    setDirty(new Set());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = (idx: number, action: typeof ACTIONS[number]) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [action]: !copy[idx][action] };
      return copy;
    });
    setDirty((prev) => {
      const next = new Set(prev);
      next.add(`${idx}`);
      return next;
    });
  };

  const save = async () => {
    if (!isFounder) {
      toast.error('Endast founder kan ändra behörigheter');
      return;
    }
    setSaving(true);
    try {
      const changed = Array.from(dirty).map((i) => rows[Number(i)]);
      for (const r of changed) {
        const { error } = await supabase
          .from('role_module_permissions')
          .update({
            can_read: r.can_read,
            can_create: r.can_create,
            can_update: r.can_update,
            can_delete: r.can_delete,
          })
          .eq('role', r.role)
          .eq('module', r.module);
        if (error) throw error;
      }
      toast.success(`${changed.length} behörigheter sparade`);
      await load();
    } catch (e: any) {
      toast.error('Spara misslyckades: ' + (e.message || 'okänt fel'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const grouped: Record<string, Row[]> = {};
  rows.forEach((r) => {
    grouped[r.role] = grouped[r.role] || [];
    grouped[r.role].push(r);
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Roll- och modulmatris
          {!isFounder && <span className="text-xs text-muted-foreground font-normal">(läsläge — endast founder kan ändra)</span>}
        </CardTitle>
        <Button size="sm" onClick={save} disabled={!isFounder || dirty.size === 0 || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Spara ({dirty.size})
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-3">Roll</th>
              <th className="py-2 pr-3">Modul</th>
              <th className="py-2 px-2 text-center">Läs</th>
              <th className="py-2 px-2 text-center">Skapa</th>
              <th className="py-2 px-2 text-center">Ändra</th>
              <th className="py-2 px-2 text-center">Radera</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([role, list]) =>
              list.map((r, i) => {
                const idx = rows.indexOf(r);
                return (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="py-1.5 pr-3 font-medium">{i === 0 ? role : ''}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{r.module}</td>
                    {ACTIONS.map((a) => (
                      <td key={a} className="py-1.5 px-2 text-center">
                        <Checkbox
                          checked={r[a]}
                          disabled={!isFounder}
                          onCheckedChange={() => toggle(idx, a)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
