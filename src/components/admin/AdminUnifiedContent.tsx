import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Eye, EyeOff, Save, Plus, Trash2,
  ArrowUp, ArrowDown, Pencil, X,
  LayoutList, Clock, RefreshCw, Sparkles, Package, FolderOpen,
  Zap, Mail, Loader2, ChevronUp,
  Home, Info, Phone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// ─── Types ───
interface PageSection {
  id: string;
  page: string;
  section_key: string;
  title_sv: string | null;
  title_en: string | null;
  content_sv: string | null;
  content_en: string | null;
  icon: string | null;
  is_visible: boolean;
  display_order: number;
}

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

interface SiteUpdate {
  id: string;
  update_type: string;
  title_sv: string;
  title_en: string | null;
  description_sv: string | null;
  description_en: string | null;
  image_url: string | null;
  is_published: boolean;
  created_at: string;
}

// ─── Module definitions ───
const MODULES = [
  { key: 'timeline', label: 'Vår Resa', icon: Clock, description: 'Milstolpar i företagets historia' },
  { key: 'sections', label: 'Sidsektioner', icon: LayoutList, description: 'Redigera innehåll per sida' },
  { key: 'updates', label: 'Nyheter', icon: Sparkles, description: 'Blogginlägg & uppdateringar' },
  { key: 'email', label: 'E-post', icon: Mail, description: 'Välkomstmail' },
] as const;

type ModuleKey = typeof MODULES[number]['key'];

const PAGES = [
  { value: 'about', label: 'Om oss', icon: Info },
  { value: 'home', label: 'Startsidan', icon: Home },
  { value: 'contact', label: 'Kontakt', icon: Phone },
];

const ICON_OPTIONS = ['Leaf', 'Heart', 'Shield', 'Users', 'Award', 'Star', 'Sparkles', 'Globe'];
const CORE_SECTIONS = ['hero', 'timeline', 'promise', 'values'];

const AdminUnifiedContent = () => {
  const [activeModule, setActiveModule] = useState<ModuleKey>('timeline');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Innehåll</h1>
        <p className="text-muted-foreground text-sm mt-1">Hantera hemsidans texter, tidslinje och nyheter</p>
      </div>

      {/* Module switcher */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {MODULES.map(mod => {
          const Icon = mod.icon;
          const active = activeModule === mod.key;
          return (
            <button
              key={mod.key}
              onClick={() => setActiveModule(mod.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap ${
                active
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{mod.label}</span>
            </button>
          );
        })}
      </div>

      {/* Module content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeModule}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeModule === 'timeline' && <TimelineModule />}
          {activeModule === 'sections' && <SectionsModule />}
          {activeModule === 'updates' && <UpdatesModule />}
          {activeModule === 'email' && <EmailModule />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════
//  TIMELINE MODULE ("Vår Resa")
// ═══════════════════════════════════════════════
const TimelineModule = () => {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ year: '', title: '', title_en: '', description: '', description_en: '' });
  const [saving, setSaving] = useState(false);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('timeline_entries').select('*').order('display_order', { ascending: true });
    if (data) setTimeline(data as TimelineEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  const resetForm = () => {
    setForm({ year: '', title: '', title_en: '', description: '', description_en: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (entry: TimelineEntry) => {
    setForm({
      year: entry.year,
      title: entry.title_sv,
      title_en: entry.title_en || '',
      description: entry.description_sv || '',
      description_en: entry.description_en || '',
    });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const saveEntry = async () => {
    if (!form.year || !form.title) { toast.error('År och titel krävs'); return; }
    setSaving(true);

    const payload = {
      year: form.year,
      title_sv: form.title,
      title_en: form.title_en || form.title,
      description_sv: form.description || null,
      description_en: form.description_en || form.description || null,
    };

    if (editingId) {
      await supabase.from('timeline_entries').update(payload).eq('id', editingId);
      toast.success('Uppdaterad');
    } else {
      const maxOrder = timeline.reduce((max, e) => Math.max(max, e.display_order), 0);
      await supabase.from('timeline_entries').insert({ ...payload, display_order: maxOrder + 1 });
      toast.success('Tillagd');
    }

    resetForm();
    setSaving(false);
    fetchTimeline();
  };

  const toggleVisibility = async (id: string, current: boolean) => {
    await supabase.from('timeline_entries').update({ is_visible: !current }).eq('id', id);
    setTimeline(prev => prev.map(e => e.id === id ? { ...e, is_visible: !current } : e));
    toast.success(!current ? 'Synlig' : 'Dold');
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Ta bort denna milstolpe?')) return;
    await supabase.from('timeline_entries').delete().eq('id', id);
    setTimeline(prev => prev.filter(e => e.id !== id));
    toast.success('Borttagen');
  };

  const moveEntry = async (id: string, direction: 'up' | 'down') => {
    const idx = timeline.findIndex(e => e.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === timeline.length - 1)) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const a = timeline[idx], b = timeline[swapIdx];
    await Promise.all([
      supabase.from('timeline_entries').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('timeline_entries').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    fetchTimeline();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Vår Resa</h2>
          <p className="text-sm text-muted-foreground">Milstolpar och händelser som visas på hemsidan</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> Ny milstolpe
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-primary/20">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">År *</Label>
                    <Input value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} placeholder="2026" className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Titel (SV) *</Label>
                    <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Vad hände?" className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">Titel (EN)</Label>
                    <Input value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} placeholder="English title" className="h-9" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Beskrivning (SV)</Label>
                    <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Kort beskrivning..." />
                  </div>
                  <div>
                    <Label className="text-xs">Description (EN)</Label>
                    <Textarea value={form.description_en} onChange={e => setForm({ ...form, description_en: e.target.value })} rows={2} placeholder="Short description..." />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEntry} disabled={saving} className="gap-1.5">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {editingId ? 'Uppdatera' : 'Lägg till'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetForm}>Avbryt</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : timeline.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Inga milstolpar ännu</p>
          <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Skapa första
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {timeline.map((entry, idx) => (
            <div key={entry.id} className={`flex items-center gap-2 p-3 rounded-xl border border-border bg-card transition-opacity ${!entry.is_visible ? 'opacity-40' : ''}`}>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveEntry(entry.id, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"><ArrowUp className="w-3 h-3" /></button>
                <button onClick={() => moveEntry(entry.id, 'down')} disabled={idx === timeline.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"><ArrowDown className="w-3 h-3" /></button>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">{entry.year}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{entry.title_sv}</p>
                {entry.title_en && <p className="text-xs text-muted-foreground truncate">{entry.title_en}</p>}
                {entry.description_sv && <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{entry.description_sv}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(entry)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Switch checked={entry.is_visible} onCheckedChange={() => toggleVisibility(entry.id, entry.is_visible)} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteEntry(entry.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
//  SECTIONS MODULE
// ═══════════════════════════════════════════════
const SectionsModule = () => {
  const [selectedPage, setSelectedPage] = useState('about');
  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, Partial<PageSection>>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('page_sections')
      .select('*')
      .eq('page', selectedPage)
      .order('display_order', { ascending: true });

    if (data) {
      const typed = data as unknown as PageSection[];
      setSections(typed);
      const forms: Record<string, Partial<PageSection>> = {};
      typed.forEach(s => { forms[s.id] = { ...s }; });
      setEditForms(forms);
      setDirtyIds(new Set());
    }
    setLoading(false);
  }, [selectedPage]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  const updateField = (id: string, field: string, value: string | null) => {
    setEditForms(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setDirtyIds(prev => new Set(prev).add(id));
  };

  const toggleVisibility = async (section: PageSection) => {
    await supabase.from('page_sections').update({ is_visible: !section.is_visible } as any).eq('id', section.id);
    toast.success(section.is_visible ? 'Dold' : 'Synlig');
    fetchSections();
  };

  const saveSection = async (id: string) => {
    const form = editForms[id];
    if (!form) return;
    setSavingId(id);

    const { error } = await supabase.from('page_sections').update({
      title_sv: form.title_sv,
      title_en: form.title_en,
      content_sv: form.content_sv,
      content_en: form.content_en,
      icon: form.icon,
    } as any).eq('id', id);
    
    setSavingId(null);
    if (error) { toast.error('Kunde inte spara'); return; }
    toast.success('Sparad');
    setDirtyIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    fetchSections();
  };

  const moveSection = async (id: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === sections.length - 1)) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const a = sections[idx], b = sections[swapIdx];
    await Promise.all([
      supabase.from('page_sections').update({ display_order: b.display_order } as any).eq('id', a.id),
      supabase.from('page_sections').update({ display_order: a.display_order } as any).eq('id', b.id),
    ]);
    fetchSections();
  };

  const addSection = async () => {
    const key = `custom_${Date.now()}`;
    await supabase.from('page_sections').insert({
      page: selectedPage, section_key: key,
      title_sv: 'Ny sektion', title_en: 'New section',
      content_sv: '', content_en: '', is_visible: false,
      display_order: sections.length,
    } as any);
    toast.success('Ny sektion skapad');
    fetchSections();
  };

  const deleteSection = async (id: string, key: string) => {
    if (CORE_SECTIONS.includes(key)) { toast.error('Kan inte radera standardsektioner'); return; }
    if (!confirm('Ta bort denna sektion?')) return;
    await supabase.from('page_sections').delete().eq('id', id);
    toast.success('Raderad');
    fetchSections();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {PAGES.map(p => {
            const Icon = p.icon;
            return (
              <button
                key={p.value}
                onClick={() => setSelectedPage(p.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedPage === p.value
                    ? 'bg-secondary text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>
        <Button size="sm" variant="outline" onClick={addSection} className="gap-1 h-8 text-xs">
          <Plus className="w-3.5 h-3.5" /> Ny sektion
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : sections.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <LayoutList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Inga sektioner ännu.</p>
          <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={addSection}>
            <Plus className="w-3.5 h-3.5" /> Skapa första sektionen
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sections.map((section, idx) => {
            const isExpanded = expandedId === section.id;
            const isDirty = dirtyIds.has(section.id);
            const form = editForms[section.id] || {};
            const isCore = CORE_SECTIONS.includes(section.section_key);
            const isSaving = savingId === section.id;

            return (
              <motion.div key={section.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                <Card className={`transition-all ${!section.is_visible ? 'opacity-50 border-dashed' : ''} ${isExpanded ? 'ring-1 ring-primary/30' : ''}`}>
                  <div className="flex items-center gap-2 p-3">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveSection(section.id, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => moveSection(section.id, 'down')} disabled={idx === sections.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">{idx + 1}</div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : section.id)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{(form.title_sv as string) || section.section_key}</span>
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0">{section.section_key}</Badge>
                        {isCore && <Badge variant="secondary" className="text-[9px] shrink-0">System</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDirty && (
                        <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => saveSection(section.id)} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Spara
                        </Button>
                      )}
                      <Switch checked={section.is_visible} onCheckedChange={() => toggleVisibility(section)} />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpandedId(isExpanded ? null : section.id)}>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                      </Button>
                      {!isCore && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteSection(section.id, section.section_key)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <CardContent className="pt-0 pb-4 px-4 border-t border-border/50 mt-0 space-y-4">
                          {(section.section_key.startsWith('value_') || section.section_key === 'promise') && (
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1.5 block">Ikon</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {ICON_OPTIONS.map(icon => (
                                  <button key={icon} onClick={() => updateField(section.id, 'icon', icon)} className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${form.icon === icon ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/50 border-border text-muted-foreground hover:border-primary/50'}`}>
                                    {icon}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Titel (SV)</Label>
                                <Input value={(form.title_sv as string) || ''} onChange={e => updateField(section.id, 'title_sv', e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Innehåll (SV)</Label>
                                <Textarea rows={4} value={(form.content_sv as string) || ''} onChange={e => updateField(section.id, 'content_sv', e.target.value)} />
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Title (EN)</Label>
                                <Input value={(form.title_en as string) || ''} onChange={e => updateField(section.id, 'title_en', e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Content (EN)</Label>
                                <Textarea rows={4} value={(form.content_en as string) || ''} onChange={e => updateField(section.id, 'content_en', e.target.value)} />
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <Button size="sm" variant="outline" onClick={() => setExpandedId(null)} className="gap-1"><X className="w-3 h-3" /> Stäng</Button>
                            {isDirty && (
                              <Button size="sm" onClick={() => saveSection(section.id)} disabled={isSaving} className="gap-1">
                                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                Spara ändringar
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
//  UPDATES MODULE
// ═══════════════════════════════════════════════
const UpdatesModule = () => {
  const [updates, setUpdates] = useState<SiteUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<SiteUpdate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title_sv: '', title_en: '', description_sv: '', description_en: '',
    update_type: 'general', image_url: '', is_published: true,
  });

  useEffect(() => {
    fetchUpdates();
    const channel = supabase
      .channel('admin-site-updates-unified')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_updates' }, () => fetchUpdates())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchUpdates = async () => {
    const { data } = await supabase.from('site_updates').select('*').order('created_at', { ascending: false });
    setUpdates(data || []);
    setIsLoading(false);
  };

  const resetForm = () => {
    setFormData({ title_sv: '', title_en: '', description_sv: '', description_en: '', update_type: 'general', image_url: '', is_published: true });
    setEditingUpdate(null);
  };

  const handleEdit = (update: SiteUpdate) => {
    setEditingUpdate(update);
    setFormData({
      title_sv: update.title_sv,
      title_en: update.title_en || '',
      description_sv: update.description_sv || '',
      description_en: update.description_en || '',
      update_type: update.update_type,
      image_url: update.image_url || '',
      is_published: update.is_published,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title_sv.trim()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        title_sv: formData.title_sv,
        title_en: formData.title_en || formData.title_sv,
        description_sv: formData.description_sv || null,
        description_en: formData.description_en || formData.description_sv || null,
        update_type: formData.update_type,
        image_url: formData.image_url || null,
        is_published: formData.is_published,
        updated_at: new Date().toISOString(),
      };
      if (editingUpdate) {
        await supabase.from('site_updates').update(payload).eq('id', editingUpdate.id);
      } else {
        await supabase.from('site_updates').insert(payload);
      }
      toast.success('Sparad!');
      resetForm();
      setIsDialogOpen(false);
    } catch { toast.error('Något gick fel'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Ta bort denna nyhet?')) return;
    await supabase.from('site_updates').delete().eq('id', id);
    toast.success('Borttagen');
  };

  const getTypeIcon = (type: string) => {
    const map: Record<string, any> = { product: Package, category: FolderOpen, feature: Zap };
    return map[type] || Sparkles;
  };

  const typeLabels: Record<string, string> = { general: 'Allmänt', product: 'Ny produkt', category: 'Ny kategori', feature: 'Ny funktion' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Nyheter & Uppdateringar</h2>
          <p className="text-sm text-muted-foreground">Skapa och hantera nyheter som visas på sidan</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4" /> Ny nyhet
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : updates.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Inga nyheter ännu</p>
      ) : (
        <div className="space-y-2">
          {updates.map(update => {
            const Icon = getTypeIcon(update.update_type);
            return (
              <motion.div key={update.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${update.is_published ? 'bg-secondary/50' : 'bg-muted/30 opacity-60'}`}>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{update.title_sv}</p>
                  <p className="text-xs text-muted-foreground">{typeLabels[update.update_type] || update.update_type}</p>
                </div>
                <Badge variant={update.is_published ? 'default' : 'secondary'} className="text-xs shrink-0">
                  {update.is_published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(update)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(update.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {editingUpdate ? 'Redigera nyhet' : 'Ny nyhet'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Titel (SV) *</Label>
                <Input value={formData.title_sv} onChange={e => setFormData(p => ({ ...p, title_sv: e.target.value }))} placeholder="Nyhet..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Title (EN)</Label>
                <Input value={formData.title_en} onChange={e => setFormData(p => ({ ...p, title_en: e.target.value }))} placeholder="News..." />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Beskrivning (SV)</Label>
                <Textarea value={formData.description_sv} onChange={e => setFormData(p => ({ ...p, description_sv: e.target.value }))} placeholder="Beskrivning..." rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description (EN)</Label>
                <Textarea value={formData.description_en} onChange={e => setFormData(p => ({ ...p, description_en: e.target.value }))} placeholder="Description..." rows={3} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Typ</Label>
                <Select value={formData.update_type} onValueChange={v => setFormData(p => ({ ...p, update_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bild-URL (valfritt)</Label>
                <Input value={formData.image_url} onChange={e => setFormData(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Publicerad</Label>
              <Switch checked={formData.is_published} onCheckedChange={checked => setFormData(p => ({ ...p, is_published: checked }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { resetForm(); setIsDialogOpen(false); }} className="flex-1">Avbryt</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !formData.title_sv.trim()} className="flex-1">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Spara
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ═══════════════════════════════════════════════
//  EMAIL MODULE
// ═══════════════════════════════════════════════
const EmailModule = () => {
  const [template, setTemplate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    subject_sv: '', subject_en: '',
    greeting_sv: '', greeting_en: '',
    intro_sv: '', intro_en: '',
    benefits_sv: '', benefits_en: '',
    cta_sv: '', cta_en: '',
    footer_sv: '', footer_en: '',
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('email_templates').select('*').eq('template_type', 'welcome').single();
      if (data) {
        setTemplate(data);
        setForm({
          subject_sv: data.subject_sv || '', subject_en: data.subject_en || '',
          greeting_sv: data.greeting_sv || '', greeting_en: data.greeting_en || '',
          intro_sv: data.intro_sv || '', intro_en: data.intro_en || '',
          benefits_sv: (data.benefits_sv || []).join('\n'), benefits_en: (data.benefits_en || []).join('\n'),
          cta_sv: data.cta_text_sv || '', cta_en: data.cta_text_en || '',
          footer_sv: data.footer_sv || '', footer_en: data.footer_en || '',
        });
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!template) return;
    setIsSaving(true);
    try {
      const benefitsSv = form.benefits_sv.split('\n').filter(b => b.trim());
      const benefitsEn = form.benefits_en.split('\n').filter(b => b.trim());

      await supabase.from('email_templates').update({
        subject_sv: form.subject_sv, subject_en: form.subject_en || form.subject_sv,
        greeting_sv: form.greeting_sv, greeting_en: form.greeting_en || form.greeting_sv,
        intro_sv: form.intro_sv, intro_en: form.intro_en || form.intro_sv,
        benefits_sv: benefitsSv, benefits_en: benefitsEn.length > 0 ? benefitsEn : benefitsSv,
        cta_text_sv: form.cta_sv, cta_text_en: form.cta_en || form.cta_sv,
        footer_sv: form.footer_sv, footer_en: form.footer_en || form.footer_sv,
      }).eq('template_type', 'welcome');

      toast.success('Mall sparad!');
    } catch { toast.error('Kunde inte spara'); }
    finally { setIsSaving(false); }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const fields = [
    { key: 'subject', label: 'Ämnesrad / Subject', type: 'input' as const },
    { key: 'greeting', label: 'Hälsning / Greeting', type: 'input' as const },
    { key: 'intro', label: 'Introduktion / Introduction', type: 'textarea' as const },
    { key: 'benefits', label: 'Fördelar / Benefits (en per rad)', type: 'textarea' as const },
    { key: 'cta', label: 'Knapptext / Button text', type: 'input' as const },
    { key: 'footer', label: 'Avslutning / Footer', type: 'input' as const },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Välkomstmail</h2>
          <p className="text-sm text-muted-foreground">Anpassa välkomstmailet — fyll i SV och EN</p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Spara
        </Button>
      </div>

      <div className="space-y-4">
        {fields.map(field => (
          <div key={field.key} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{field.label.split(' / ')[0]} (SV)</Label>
              {field.type === 'input' ? (
                <Input
                  value={(form as any)[`${field.key}_sv`]}
                  onChange={e => setForm(p => ({ ...p, [`${field.key}_sv`]: e.target.value }))}
                />
              ) : (
                <Textarea
                  value={(form as any)[`${field.key}_sv`]}
                  onChange={e => setForm(p => ({ ...p, [`${field.key}_sv`]: e.target.value }))}
                  rows={field.key === 'benefits' ? 4 : 3}
                />
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{field.label.split(' / ')[1] || 'EN'} (EN)</Label>
              {field.type === 'input' ? (
                <Input
                  value={(form as any)[`${field.key}_en`]}
                  onChange={e => setForm(p => ({ ...p, [`${field.key}_en`]: e.target.value }))}
                />
              ) : (
                <Textarea
                  value={(form as any)[`${field.key}_en`]}
                  onChange={e => setForm(p => ({ ...p, [`${field.key}_en`]: e.target.value }))}
                  rows={field.key === 'benefits' ? 4 : 3}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Simple preview */}
      <Card className="bg-muted/20">
        <CardContent className="pt-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Förhandsgranskning (SV)</p>
          <div className="bg-card rounded-lg p-4 space-y-3 border border-border">
            <p className="text-xs text-muted-foreground">Ämne: <span className="font-medium text-foreground">{form.subject_sv}</span></p>
            <div className="bg-primary text-primary-foreground rounded-lg p-3 text-center text-sm font-medium">{form.greeting_sv}</div>
            <p className="text-sm text-muted-foreground">{form.intro_sv}</p>
            {form.benefits_sv && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-2.5">
                {form.benefits_sv.split('\n').filter(b => b.trim()).map((b, i) => (
                  <p key={i} className="text-xs text-green-700 dark:text-green-300">{b}</p>
                ))}
              </div>
            )}
            <div className="text-center">
              <span className="inline-block bg-primary text-primary-foreground px-5 py-1.5 rounded-lg text-xs font-medium">{form.cta_sv} →</span>
            </div>
            <p className="text-xs text-center text-muted-foreground border-t pt-2">{form.footer_sv}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUnifiedContent;
