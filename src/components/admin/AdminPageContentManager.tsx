import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  Eye, EyeOff, Save, Plus, Trash2, ChevronDown, ChevronUp,
  ArrowUp, ArrowDown, FileText, Home, Phone, Info, Pencil, X,
  LayoutList, Clock, RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

const PAGES = [
  { value: 'about', label: 'Om oss', icon: Info },
  { value: 'home', label: 'Startsidan', icon: Home },
  { value: 'contact', label: 'Kontakt', icon: Phone },
];

const ICON_OPTIONS = ['Leaf', 'Heart', 'Shield', 'Users', 'Award', 'Star', 'Sparkles', 'Globe'];

const CORE_SECTIONS = ['hero', 'timeline', 'promise', 'values'];

const AdminPageContentManager = () => {
  const [selectedPage, setSelectedPage] = useState('about');
  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, Partial<PageSection>>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  // Timeline state
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [showTimelineForm, setShowTimelineForm] = useState(false);
  const [timelineForm, setTimelineForm] = useState({ year: '', title_sv: '', title_en: '', description_sv: '', description_en: '' });

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

  const fetchTimeline = useCallback(async () => {
    setTimelineLoading(true);
    const { data } = await supabase
      .from('timeline_entries')
      .select('*')
      .order('display_order', { ascending: true });
    if (data) setTimeline(data as TimelineEntry[]);
    setTimelineLoading(false);
  }, []);

  useEffect(() => {
    fetchSections();
    if (selectedPage === 'about') fetchTimeline();
  }, [selectedPage, fetchSections, fetchTimeline]);

  // --- Section handlers ---
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
    const { error } = await supabase.from('page_sections').update({
      title_sv: form.title_sv,
      title_en: form.title_en,
      content_sv: form.content_sv,
      content_en: form.content_en,
      icon: form.icon,
    } as any).eq('id', id);
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
      page: selectedPage,
      section_key: key,
      title_sv: 'Ny sektion',
      title_en: 'New section',
      content_sv: '',
      content_en: '',
      is_visible: false,
      display_order: sections.length,
    } as any);
    toast.success('Ny sektion skapad');
    fetchSections();
  };

  const deleteSection = async (id: string, key: string) => {
    if (CORE_SECTIONS.includes(key)) {
      toast.error('Kan inte radera standardsektioner');
      return;
    }
    if (!confirm('Ta bort denna sektion?')) return;
    await supabase.from('page_sections').delete().eq('id', id);
    toast.success('Raderad');
    fetchSections();
  };

  // --- Timeline handlers ---
  const addTimelineEntry = async () => {
    if (!timelineForm.year || !timelineForm.title_sv) { toast.error('År och titel krävs'); return; }
    const maxOrder = timeline.reduce((max, e) => Math.max(max, e.display_order), 0);
    await supabase.from('timeline_entries').insert({
      year: timelineForm.year,
      title_sv: timelineForm.title_sv,
      title_en: timelineForm.title_en || null,
      description_sv: timelineForm.description_sv || null,
      description_en: timelineForm.description_en || null,
      display_order: maxOrder + 1,
    });
    toast.success('Tillagd');
    setTimelineForm({ year: '', title_sv: '', title_en: '', description_sv: '', description_en: '' });
    setShowTimelineForm(false);
    fetchTimeline();
  };

  const toggleTimelineVisibility = async (id: string, current: boolean) => {
    await supabase.from('timeline_entries').update({ is_visible: !current }).eq('id', id);
    setTimeline(prev => prev.map(e => e.id === id ? { ...e, is_visible: !current } : e));
    toast.success(!current ? 'Synlig' : 'Dold');
  };

  const deleteTimelineEntry = async (id: string) => {
    if (!confirm('Ta bort?')) return;
    await supabase.from('timeline_entries').delete().eq('id', id);
    setTimeline(prev => prev.filter(e => e.id !== id));
    toast.success('Borttagen');
  };

  const moveTimelineEntry = async (id: string, direction: 'up' | 'down') => {
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

  const renderSectionCard = (section: PageSection, idx: number) => {
    const isExpanded = expandedId === section.id;
    const isDirty = dirtyIds.has(section.id);
    const form = editForms[section.id] || {};
    const isCore = CORE_SECTIONS.includes(section.section_key);

    return (
      <motion.div
        key={section.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.03 }}
      >
        <Card className={`transition-all ${!section.is_visible ? 'opacity-50 border-dashed' : ''} ${isExpanded ? 'ring-1 ring-primary/30' : ''}`}>
          <div className="flex items-center gap-2 p-3">
            {/* Reorder */}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => moveSection(section.id, 'up')}
                disabled={idx === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => moveSection(section.id, 'down')}
                disabled={idx === sections.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Order number */}
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
              {idx + 1}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0" onClick={() => setExpandedId(isExpanded ? null : section.id)}>
              <div className="flex items-center gap-2 cursor-pointer">
                <span className="font-medium text-sm truncate">{form.title_sv || section.section_key}</span>
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                  {section.section_key}
                </Badge>
                {isCore && (
                  <Badge variant="secondary" className="text-[9px] shrink-0">System</Badge>
                )}
              </div>
              {form.content_sv && (
                <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-md">
                  {(form.content_sv as string).substring(0, 80)}...
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isDirty && (
                <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => saveSection(section.id)}>
                  <Save className="w-3 h-3" /> Spara
                </Button>
              )}
              <Switch
                checked={section.is_visible}
                onCheckedChange={() => toggleVisibility(section)}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setExpandedId(isExpanded ? null : section.id)}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              </Button>
              {!isCore && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => deleteSection(section.id, section.section_key)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Expanded edit form */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-0 pb-4 px-4 border-t border-border/50 mt-0 space-y-4">
                  {/* Icon selector for value sections */}
                  {(section.section_key.startsWith('value_') || section.section_key === 'promise') && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Ikon</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {ICON_OPTIONS.map(icon => (
                          <button
                            key={icon}
                            onClick={() => updateField(section.id, 'icon', icon)}
                            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                              form.icon === icon
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-secondary/50 border-border text-muted-foreground hover:border-primary/50'
                            }`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Titel (SV)</Label>
                      <Input
                        value={(form.title_sv as string) || ''}
                        onChange={e => updateField(section.id, 'title_sv', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Titel (EN)</Label>
                      <Input
                        value={(form.title_en as string) || ''}
                        onChange={e => updateField(section.id, 'title_en', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Innehåll (SV)</Label>
                      <Textarea
                        rows={4}
                        value={(form.content_sv as string) || ''}
                        onChange={e => updateField(section.id, 'content_sv', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Innehåll (EN)</Label>
                      <Textarea
                        rows={4}
                        value={(form.content_en as string) || ''}
                        onChange={e => updateField(section.id, 'content_en', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => setExpandedId(null)} className="gap-1">
                      <X className="w-3 h-3" /> Stäng
                    </Button>
                    {isDirty && (
                      <Button size="sm" onClick={() => saveSection(section.id)} className="gap-1">
                        <Save className="w-3 h-3" /> Spara ändringar
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
  };

  const renderTimelineManager = () => (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Tidslinje-inlägg</h3>
          <Badge variant="secondary" className="text-[10px]">{timeline.length} st</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowTimelineForm(!showTimelineForm)} className="gap-1 h-7 text-xs">
          <Plus className="w-3 h-3" /> Lägg till
        </Button>
      </div>

      <AnimatePresence>
        {showTimelineForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-primary/20">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">År *</Label>
                    <Input value={timelineForm.year} onChange={e => setTimelineForm({ ...timelineForm, year: e.target.value })} placeholder="2026" className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Titel (SV) *</Label>
                    <Input value={timelineForm.title_sv} onChange={e => setTimelineForm({ ...timelineForm, title_sv: e.target.value })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Titel (EN)</Label>
                    <Input value={timelineForm.title_en} onChange={e => setTimelineForm({ ...timelineForm, title_en: e.target.value })} className="h-8" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Beskrivning (SV)</Label>
                    <Textarea value={timelineForm.description_sv} onChange={e => setTimelineForm({ ...timelineForm, description_sv: e.target.value })} rows={2} />
                  </div>
                  <div>
                    <Label className="text-xs">Beskrivning (EN)</Label>
                    <Textarea value={timelineForm.description_en} onChange={e => setTimelineForm({ ...timelineForm, description_en: e.target.value })} rows={2} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addTimelineEntry} className="gap-1 h-7 text-xs"><Save className="w-3 h-3" /> Spara</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowTimelineForm(false)} className="h-7 text-xs">Avbryt</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {timelineLoading ? (
        <div className="flex justify-center py-6"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-1.5">
          {timeline.map((entry, idx) => (
            <div
              key={entry.id}
              className={`flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card transition-opacity ${!entry.is_visible ? 'opacity-40' : ''}`}
            >
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveTimelineEntry(entry.id, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button onClick={() => moveTimelineEntry(entry.id, 'down')} disabled={idx === timeline.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5">
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                {entry.year}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{entry.title_sv}</p>
                {entry.description_sv && <p className="text-xs text-muted-foreground truncate">{entry.description_sv}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch
                  checked={entry.is_visible}
                  onCheckedChange={() => toggleTimelineVisibility(entry.id, entry.is_visible)}
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteTimelineEntry(entry.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {timeline.length === 0 && (
            <p className="text-center text-muted-foreground text-xs py-6">Inga tidslinje-inlägg ännu</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page tabs */}
      <Tabs value={selectedPage} onValueChange={setSelectedPage}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <ScrollableTabs>
            <TabsList className="w-max">
              {PAGES.map(p => (
                <TabsTrigger key={p.value} value={p.value} className="gap-1.5 text-xs">
                  <p.icon className="w-3.5 h-3.5" />
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollableTabs>
          <Button size="sm" variant="outline" onClick={addSection} className="gap-1 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" /> Ny sektion
          </Button>
        </div>

        {PAGES.map(page => (
          <TabsContent key={page.value} value={page.value} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : sections.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <LayoutList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Inga sektioner för {page.label} ännu.</p>
                <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={addSection}>
                  <Plus className="w-3.5 h-3.5" /> Skapa första sektionen
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                {sections.map((s, i) => renderSectionCard(s, i))}
              </div>
            )}

            {/* Timeline manager only on About page */}
            {page.value === 'about' && renderTimelineManager()}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminPageContentManager;
