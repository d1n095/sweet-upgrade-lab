import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Eye, EyeOff, GripVertical, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TimelineEntry {
  id: string;
  year: string;
  title_sv: string;
  title_en: string | null;
  description_sv: string | null;
  description_en: string | null;
  is_visible: boolean;
  display_order: number;
}

const AdminTimelineManager = () => {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ year: '', title_sv: '', title_en: '', description_sv: '', description_en: '' });

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('timeline_entries')
      .select('*')
      .order('display_order', { ascending: true });
    if (data) setEntries(data as TimelineEntry[]);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleAdd = async () => {
    if (!form.year || !form.title_sv) {
      toast.error('År och svensk titel krävs');
      return;
    }
    const maxOrder = entries.reduce((max, e) => Math.max(max, e.display_order), 0);
    const { error } = await supabase.from('timeline_entries').insert({
      year: form.year,
      title_sv: form.title_sv,
      title_en: form.title_en || null,
      description_sv: form.description_sv || null,
      description_en: form.description_en || null,
      display_order: maxOrder + 1,
    });
    if (error) {
      toast.error('Kunde inte lägga till');
      return;
    }
    toast.success('Tillagd!');
    setForm({ year: '', title_sv: '', title_en: '', description_sv: '', description_en: '' });
    setShowForm(false);
    fetchEntries();
  };

  const toggleVisibility = async (id: string, current: boolean) => {
    await supabase.from('timeline_entries').update({ is_visible: !current }).eq('id', id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, is_visible: !current } : e));
    toast.success(!current ? 'Synlig' : 'Dold');
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Ta bort detta inlägg?')) return;
    await supabase.from('timeline_entries').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success('Borttagen');
  };

  const moveEntry = async (id: string, direction: 'up' | 'down') => {
    const idx = entries.findIndex(e => e.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === entries.length - 1)) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const a = entries[idx];
    const b = entries[swapIdx];
    await Promise.all([
      supabase.from('timeline_entries').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('timeline_entries').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    fetchEntries();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Timeline / Vår resa</h2>
          <p className="text-sm text-muted-foreground">Hantera tidslinje-inlägg på Om oss-sidan</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Lägg till
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-border">
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>År *</Label>
                    <Input value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} placeholder="2026" />
                  </div>
                  <div>
                    <Label>Titel (SV) *</Label>
                    <Input value={form.title_sv} onChange={e => setForm({ ...form, title_sv: e.target.value })} placeholder="Expansion" />
                  </div>
                  <div>
                    <Label>Titel (EN)</Label>
                    <Input value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} placeholder="Expansion" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Beskrivning (SV)</Label>
                    <Textarea value={form.description_sv} onChange={e => setForm({ ...form, description_sv: e.target.value })} rows={2} />
                  </div>
                  <div>
                    <Label>Beskrivning (EN)</Label>
                    <Textarea value={form.description_en} onChange={e => setForm({ ...form, description_en: e.target.value })} rows={2} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAdd} size="sm" className="gap-2"><Save className="w-4 h-4" /> Spara</Button>
                  <Button onClick={() => setShowForm(false)} variant="outline" size="sm">Avbryt</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <div key={entry.id} className={`flex items-center gap-3 p-4 rounded-xl border border-border bg-card ${!entry.is_visible ? 'opacity-50' : ''}`}>
            <div className="flex flex-col gap-1">
              <button onClick={() => moveEntry(entry.id, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20">▲</button>
              <button onClick={() => moveEntry(entry.id, 'down')} disabled={idx === entries.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20">▼</button>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
              {entry.year}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{entry.title_sv}</p>
              <p className="text-xs text-muted-foreground truncate">{entry.description_sv}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleVisibility(entry.id, entry.is_visible)}>
                {entry.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteEntry(entry.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Inga timeline-inlägg ännu</div>
        )}
      </div>
    </div>
  );
};

export default AdminTimelineManager;
