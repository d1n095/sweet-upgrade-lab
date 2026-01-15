import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Leaf, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';

interface DonationStats {
  totalDonated: number;
  projectsSupported: number;
  familiesHelped: number;
}

interface DonationProject {
  id: string;
  name: string;
  name_en: string | null;
  goal_amount: number;
  current_amount: number;
  families_helped: number;
  trees_planted: number;
}

const DonationImpact = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [stats, setStats] = useState<DonationStats>({ totalDonated: 0, projectsSupported: 0, familiesHelped: 0 });
  const [projects, setProjects] = useState<DonationProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const content = {
    sv: {
      title: 'Din samhälls-påverkan',
      totalDonated: 'Ditt bidrag',
      familiesHelped: 'Familjer hjälpta',
      projectsSupported: 'Projekt stöttade',
      activeProjects: 'Aktiva projekt',
      goal: 'Mål',
      progress: 'insamlat',
      noData: 'Börja bidra för att se din påverkan!',
      treesPlanted: 'träd planterade',
    },
    en: {
      title: 'Your community impact',
      totalDonated: 'Your contribution',
      familiesHelped: 'Families helped',
      projectsSupported: 'Projects supported',
      activeProjects: 'Active projects',
      goal: 'Goal',
      progress: 'raised',
      noData: 'Start contributing to see your impact!',
      treesPlanted: 'trees planted',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Load user's donations if logged in
      if (user) {
        const { data: donations } = await supabase
          .from('donations')
          .select('amount, purpose')
          .eq('user_id', user.id);

        if (donations && donations.length > 0) {
          const total = donations.reduce((sum, d) => sum + Number(d.amount), 0);
          const uniquePurposes = new Set(donations.map(d => d.purpose));
          
          setStats({
            totalDonated: total,
            projectsSupported: uniquePurposes.size,
            familiesHelped: Math.floor(total / 50) // Rough estimate
          });
        }
      }

      // Load active projects
      const { data: projectsData } = await supabase
        .from('donation_projects')
        .select('*')
        .eq('is_active', true)
        .order('current_amount', { ascending: false });

      if (projectsData) {
        setProjects(projectsData);
      }
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

  if (isLoading) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
          <Heart className="w-5 h-5 text-success" />
        </div>
        <div>
          <h3 className="font-semibold">{t.title}</h3>
          <p className="text-sm text-muted-foreground">
            {language === 'sv' ? 'Tack för att du bryr dig!' : 'Thank you for caring!'}
          </p>
        </div>
      </div>

      {/* User stats */}
      {stats.totalDonated > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-success/5">
            <p className="text-xl font-bold text-success">{formatPrice(stats.totalDonated)}</p>
            <p className="text-xs text-muted-foreground">{t.totalDonated}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-primary/5">
            <p className="text-xl font-bold text-primary">{stats.familiesHelped}</p>
            <p className="text-xs text-muted-foreground">{t.familiesHelped}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-accent/10">
            <p className="text-xl font-bold text-accent">{stats.projectsSupported}</p>
            <p className="text-xs text-muted-foreground">{t.projectsSupported}</p>
          </div>
        </div>
      )}

      {/* Active projects */}
      <div>
        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
          <Leaf className="w-4 h-4 text-primary" />
          {t.activeProjects}
        </h4>
        <div className="space-y-3">
          {projects.map((project) => {
            const progress = (project.current_amount / project.goal_amount) * 100;
            const projectName = language === 'en' && project.name_en ? project.name_en : project.name;
            
            return (
              <div key={project.id} className="p-3 rounded-lg bg-secondary/50">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-sm">{projectName}</p>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatPrice(project.current_amount)} {t.progress}</span>
                  <span>{t.goal}: {formatPrice(project.goal_amount)}</span>
                </div>
                {project.families_helped > 0 && (
                  <p className="text-xs text-success mt-1 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {project.families_helped} {t.familiesHelped.toLowerCase()}
                  </p>
                )}
                {project.trees_planted > 0 && (
                  <p className="text-xs text-success mt-1 flex items-center gap-1">
                    <Leaf className="w-3 h-3" />
                    {project.trees_planted} {t.treesPlanted}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default DonationImpact;
