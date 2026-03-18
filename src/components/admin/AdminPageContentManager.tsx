import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Eye, EyeOff, Save, Plus, Trash2, GripVertical } from 'lucide-react';

interface PageSection {
  id: string;
  page: string;
  section_key: string;
  title_sv: string;
  title_en: string;
  content_sv: string;
  content_en: string;
  icon: string | null;
  is_visible: boolean;
  display_order: number;
}

const PAGES = [
  { value: 'about', label: 'Om oss' },
  { value: 'home', label: 'Startsidan' },
  { value: 'contact', label: 'Kontakt' },
];

const AdminPageContentManager = () => {
  const [selectedPage, setSelectedPage] = useState('about');
  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PageSection>>({});

  const fetchSections = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('page_sections')
      .select('*')
      .eq('page', selectedPage)
      .order('display_order', { ascending: true });

    if (!error && data) {
      setSections(data as unknown as PageSection[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSections();
  }, [selectedPage]);

  const toggleVisibility = async (section: PageSection) => {
    const { error } = await supabase
      .from('page_sections')
      .update({ is_visible: !section.is_visible } as any)
      .eq('id', section.id);

    if (error) {
      toast.error('Kunde inte uppdatera synlighet');
    } else {
      toast.success(section.is_visible ? 'Sektionen döljs nu' : 'Sektionen visas nu');
      fetchSections();
    }
  };

  const startEdit = (section: PageSection) => {
    setEditingId(section.id);
    setEditForm({ ...section });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const { error } = await supabase
      .from('page_sections')
      .update({
        title_sv: editForm.title_sv,
        title_en: editForm.title_en,
        content_sv: editForm.content_sv,
        content_en: editForm.content_en,
        icon: editForm.icon,
      } as any)
      .eq('id', editingId);

    if (error) {
      toast.error('Kunde inte spara ändringar');
    } else {
      toast.success('Ändringar sparade');
      setEditingId(null);
      setEditForm({});
      fetchSections();
    }
  };

  const addSection = async () => {
    const key = `custom_${Date.now()}`;
    const { error } = await supabase
      .from('page_sections')
      .insert({
        page: selectedPage,
        section_key: key,
        title_sv: 'Ny sektion',
        title_en: 'New section',
        content_sv: '',
        content_en: '',
        is_visible: false,
        display_order: sections.length,
      } as any);

    if (error) {
      toast.error('Kunde inte skapa sektion');
    } else {
      toast.success('Ny sektion skapad');
      fetchSections();
    }
  };

  const deleteSection = async (id: string, key: string) => {
    // Don't allow deleting core sections
    const coreSections = ['hero', 'timeline', 'promise', 'values'];
    if (coreSections.includes(key)) {
      toast.error('Kan inte radera standardsektioner. Dölj dem istället.');
      return;
    }

    const { error } = await supabase
      .from('page_sections')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Kunde inte radera sektion');
    } else {
      toast.success('Sektion raderad');
      fetchSections();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Sidinnehåll</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Redigera innehåll och styr synlighet för sektioner på varje sida
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPage} onValueChange={setSelectedPage}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={addSection}>
            <Plus className="w-4 h-4 mr-1" /> Lägg till
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Laddar...</div>
      ) : sections.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Inga sektioner för denna sida ännu.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={addSection}>
            <Plus className="w-4 h-4 mr-1" /> Skapa första sektionen
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map(section => (
            <Card key={section.id} className={!section.is_visible ? 'opacity-60' : ''}>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-base font-medium">
                      {section.title_sv || section.section_key}
                    </CardTitle>
                    <Badge variant="secondary" className="text-[10px]">
                      {section.section_key}
                    </Badge>
                    {!section.is_visible && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        <EyeOff className="w-3 h-3 mr-1" /> Dold
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={section.is_visible}
                      onCheckedChange={() => toggleVisibility(section)}
                    />
                    {editingId !== section.id ? (
                      <Button size="sm" variant="ghost" onClick={() => startEdit(section)}>
                        Redigera
                      </Button>
                    ) : (
                      <div className="flex gap-1">
                        <Button size="sm" variant="default" onClick={saveEdit}>
                          <Save className="w-3 h-3 mr-1" /> Spara
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          Avbryt
                        </Button>
                      </div>
                    )}
                    {!['hero', 'timeline', 'promise', 'values'].includes(section.section_key) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteSection(section.id, section.section_key)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {editingId === section.id && (
                <CardContent className="pt-0 pb-4 px-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Titel (SV)</Label>
                      <Input
                        value={editForm.title_sv || ''}
                        onChange={e => setEditForm({ ...editForm, title_sv: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Titel (EN)</Label>
                      <Input
                        value={editForm.title_en || ''}
                        onChange={e => setEditForm({ ...editForm, title_en: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Innehåll (SV)</Label>
                      <Textarea
                        rows={4}
                        value={editForm.content_sv || ''}
                        onChange={e => setEditForm({ ...editForm, content_sv: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Innehåll (EN)</Label>
                      <Textarea
                        rows={4}
                        value={editForm.content_en || ''}
                        onChange={e => setEditForm({ ...editForm, content_en: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPageContentManager;
