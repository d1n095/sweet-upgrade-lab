import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Wallet, TrendingUp, Edit, Save, X, Loader2, 
  Plus, Eye, EyeOff, Users, Vote, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface DonationProject {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  goal_amount: number;
  current_amount: number;
  is_active: boolean;
  families_helped: number;
  trees_planted: number;
}

interface Donation {
  id: string;
  amount: number;
  source: string;
  purpose: string;
  is_anonymous: boolean;
  created_at: string;
  user_id: string | null;
}

const AdminDonationManager = () => {
  const { language } = useLanguage();
  const [projects, setProjects] = useState<DonationProject[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [showDonations, setShowDonations] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    name_en: '',
    description: '',
    description_en: '',
    goal_amount: 5000,
  });
  const [editData, setEditData] = useState<Partial<DonationProject>>({});

  const content = {
    sv: {
      title: 'Donationshantering',
      subtitle: 'Bankkonto-vy och projekthantering',
      totalCollected: 'Totalt insamlat',
      totalDonations: 'Antal donationer',
      activeProjects: 'Aktiva projekt',
      addProject: 'Lägg till projekt',
      projectName: 'Projektnamn',
      projectNameEn: 'Projektnamn (engelska)',
      description: 'Beskrivning',
      descriptionEn: 'Beskrivning (engelska)',
      goalAmount: 'Målbelopp (SEK)',
      currentAmount: 'Insamlat belopp',
      save: 'Spara',
      cancel: 'Avbryt',
      edit: 'Redigera',
      showDonations: 'Visa alla donationer',
      hideDonations: 'Dölj donationer',
      anonymous: 'Anonym',
      noProjects: 'Inga donationsprojekt ännu',
      noDonations: 'Inga donationer ännu',
      active: 'Aktiv',
      inactive: 'Inaktiv',
      donated: 'donerat',
      from: 'från',
      projectSaved: 'Projekt sparat!',
      projectAdded: 'Projekt tillagt!',
      error: 'Något gick fel',
    },
    en: {
      title: 'Donation Management',
      subtitle: 'Bank account view and project management',
      totalCollected: 'Total collected',
      totalDonations: 'Number of donations',
      activeProjects: 'Active projects',
      addProject: 'Add project',
      projectName: 'Project name',
      projectNameEn: 'Project name (English)',
      description: 'Description',
      descriptionEn: 'Description (English)',
      goalAmount: 'Goal amount (SEK)',
      currentAmount: 'Collected amount',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      showDonations: 'Show all donations',
      hideDonations: 'Hide donations',
      anonymous: 'Anonymous',
      noProjects: 'No donation projects yet',
      noDonations: 'No donations yet',
      active: 'Active',
      inactive: 'Inactive',
      donated: 'donated',
      from: 'from',
      projectSaved: 'Project saved!',
      projectAdded: 'Project added!',
      error: 'Something went wrong',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsRes, donationsRes] = await Promise.all([
        supabase.from('donation_projects').select('*').order('created_at', { ascending: false }),
        supabase.from('donations').select('*').order('created_at', { ascending: false }).limit(100),
      ]);

      if (projectsRes.data) setProjects(projectsRes.data);
      if (donationsRes.data) setDonations(donationsRes.data);
    } catch (error) {
      console.error('Failed to load donation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalCollected = donations.reduce((sum, d) => sum + Number(d.amount), 0);
  const activeProjectsCount = projects.filter(p => p.is_active).length;

  const handleSaveProject = async (projectId: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('donation_projects')
        .update(editData)
        .eq('id', projectId);

      if (error) throw error;
      toast.success(t.projectSaved);
      setEditingProject(null);
      loadData();
    } catch (error) {
      console.error('Failed to save project:', error);
      toast.error(t.error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProject = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('donation_projects').insert({
        name: newProject.name,
        name_en: newProject.name_en || null,
        description: newProject.description || null,
        description_en: newProject.description_en || null,
        goal_amount: newProject.goal_amount,
        is_active: true,
      });

      if (error) throw error;
      toast.success(t.projectAdded);
      setIsAddingProject(false);
      setNewProject({ name: '', name_en: '', description: '', description_en: '', goal_amount: 5000 });
      loadData();
    } catch (error) {
      console.error('Failed to add project:', error);
      toast.error(t.error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleProjectActive = async (project: DonationProject) => {
    try {
      await supabase
        .from('donation_projects')
        .update({ is_active: !project.is_active })
        .eq('id', project.id);
      loadData();
    } catch (error) {
      console.error('Failed to toggle project:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setIsAddingProject(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          {t.addProject}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-success/5 border border-success/20 rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">{t.totalCollected}</p>
          <p className="text-xl font-bold text-success">{formatPrice(totalCollected)}</p>
        </div>
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">{t.totalDonations}</p>
          <p className="text-xl font-bold text-primary">{donations.length}</p>
        </div>
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">{t.activeProjects}</p>
          <p className="text-xl font-bold text-accent">{activeProjectsCount}</p>
        </div>
      </div>

      {/* Add New Project Form */}
      {isAddingProject && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-secondary/50 rounded-lg p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t.projectName}</Label>
              <Input
                value={newProject.name}
                onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Giftfria produkter"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.projectNameEn}</Label>
              <Input
                value={newProject.name_en}
                onChange={(e) => setNewProject(prev => ({ ...prev, name_en: e.target.value }))}
                placeholder="Toxin-free products"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t.description}</Label>
              <Textarea
                value={newProject.description}
                onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.descriptionEn}</Label>
              <Textarea
                value={newProject.description_en}
                onChange={(e) => setNewProject(prev => ({ ...prev, description_en: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t.goalAmount}</Label>
            <Input
              type="number"
              value={newProject.goal_amount}
              onChange={(e) => setNewProject(prev => ({ ...prev, goal_amount: Number(e.target.value) }))}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddingProject(false)}>
              <X className="w-4 h-4 mr-1" />
              {t.cancel}
            </Button>
            <Button size="sm" onClick={handleAddProject} disabled={!newProject.name || isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              {t.save}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Projects List */}
      <div className="space-y-2">
        {projects.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{t.noProjects}</p>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className="bg-secondary/50 rounded-lg p-4 space-y-3"
            >
              {editingProject === project.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      value={editData.name || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <Input
                      value={editData.name_en || ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, name_en: e.target.value }))}
                      placeholder="English name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      value={editData.goal_amount || 0}
                      onChange={(e) => setEditData(prev => ({ ...prev, goal_amount: Number(e.target.value) }))}
                    />
                    <Input
                      type="number"
                      value={editData.current_amount || 0}
                      onChange={(e) => setEditData(prev => ({ ...prev, current_amount: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingProject(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                    <Button size="sm" onClick={() => handleSaveProject(project.id)} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      {project.description && (
                        <p className="text-sm text-muted-foreground">{project.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={project.is_active ? 'default' : 'secondary'}>
                        {project.is_active ? t.active : t.inactive}
                      </Badge>
                      <Switch
                        checked={project.is_active}
                        onCheckedChange={() => toggleProjectActive(project)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingProject(project.id);
                          setEditData(project);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-success font-medium">
                      {formatPrice(project.current_amount)} / {formatPrice(project.goal_amount)}
                    </span>
                    <span className="text-muted-foreground">
                      ({Math.round((project.current_amount / project.goal_amount) * 100)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full transition-all"
                      style={{ width: `${Math.min((project.current_amount / project.goal_amount) * 100, 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Donations List (Collapsible) */}
      <Collapsible open={showDonations} onOpenChange={setShowDonations}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full gap-2">
            {showDonations ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showDonations ? t.hideDonations : t.showDonations}
            {showDonations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="max-h-60 overflow-y-auto space-y-2">
            {donations.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">{t.noDonations}</p>
            ) : (
              donations.map((donation) => (
                <div
                  key={donation.id}
                  className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                      {donation.is_anonymous ? (
                        <Users className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-success" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-success">{formatPrice(donation.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {donation.is_anonymous ? t.anonymous : donation.user_id?.slice(0, 8) + '...'}
                        {' • '}
                        {donation.purpose}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(donation.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default AdminDonationManager;
