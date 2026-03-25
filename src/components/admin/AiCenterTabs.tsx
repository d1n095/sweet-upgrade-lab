import * as React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bot, Play, TrendingUp, Radar, Activity, Monitor,
  Database, Shield, Eye, GitMerge,
  ArrowRightLeft, Layers, ChevronRight, Menu, X,
  Sparkles, Bug, Wrench, Clock,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatePresence, motion } from 'framer-motion';

// ── Tab & Group definitions ──

interface TabDef {
  value: string;
  label: string;
  icon: React.ElementType;
}

interface TabGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  tabs: TabDef[];
}

const TAB_GROUPS: TabGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Activity,
    tabs: [
      { value: 'ai-dashboard', label: 'Översikt', icon: Activity },
      { value: 'unified-pipeline', label: 'Pipeline', icon: GitMerge },
      { value: 'health', label: 'Systemhälsa', icon: Shield },
      { value: 'insights', label: 'Insikter', icon: TrendingUp },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: Wrench,
    tabs: [
      { value: 'lova-chat', label: 'Lova Chat', icon: Bot },
      { value: 'autopilot', label: 'Autopilot', icon: Play },
      { value: 'actions', label: 'Åtgärder', icon: TrendingUp },
      { value: 'tasks', label: 'Uppgifter', icon: Layers },
      { value: 'bugs', label: 'Buggar', icon: Bug },
    ],
  },
  {
    id: 'scanners',
    label: 'Skanners',
    icon: Radar,
    tabs: [
      { value: 'scan', label: 'Full skanning', icon: Radar },
      { value: 'visual-qa', label: 'Visual QA', icon: Monitor },
      { value: 'ux-scanner', label: 'UX-skanner', icon: Eye },
      { value: 'sync-scan', label: 'Synk-skanner', icon: ArrowRightLeft },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Database,
    tabs: [
      { value: 'safe-mode', label: 'Safe Mode', icon: Shield },
      { value: 'trust-score', label: 'Trust Score', icon: Shield },
      { value: 'data-flow', label: 'Dataflöde', icon: ArrowRightLeft },
      { value: 'cleanup', label: 'Rensning', icon: Database },
      { value: 'change-log', label: 'Ändringslogg', icon: Clock },
      { value: 'ai-reads', label: 'AI-läslogg', icon: Eye },
    ],
  },
];

const ALL_TABS = TAB_GROUPS.flatMap(g => g.tabs);

function findGroupForTab(value: string) {
  return TAB_GROUPS.find(g => g.tabs.some(t => t.value === value));
}

// ── Dashboard Overview ──

interface DashboardOverviewProps {
  onNavigate: (tab: string) => void;
}

const quickActions = [
  { label: 'Prata med Lova', icon: Bot, tab: 'lova-chat', color: 'text-primary' },
  { label: 'Full skanning', icon: Radar, tab: 'scan', color: 'text-blue-500' },
  { label: 'Autopilot', icon: Play, tab: 'autopilot', color: 'text-green-500' },
  { label: 'Buggar', icon: Bug, tab: 'bugs', color: 'text-destructive' },
];

const DashboardOverview = ({ onNavigate }: DashboardOverviewProps) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-sm font-semibold mb-3">Snabbåtgärder</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {quickActions.map(a => (
          <button
            key={a.tab}
            onClick={() => onNavigate(a.tab)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors"
          >
            <a.icon className={cn('w-6 h-6', a.color)} />
            <span className="text-xs font-medium">{a.label}</span>
          </button>
        ))}
      </div>
    </div>

    <div>
      <h3 className="text-sm font-semibold mb-3">Moduler</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TAB_GROUPS.filter(g => g.id !== 'dashboard').map(group => (
          <Card
            key={group.id}
            className="cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => onNavigate(group.tabs[0].value)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <group.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-sm">{group.label}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">{group.tabs.length}</Badge>
              </div>
              <div className="space-y-1">
                {group.tabs.slice(0, 4).map(t => (
                  <button
                    key={t.value}
                    onClick={(e) => { e.stopPropagation(); onNavigate(t.value); }}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left py-0.5"
                  >
                    <t.icon className="w-3 h-3 shrink-0" />
                    {t.label}
                  </button>
                ))}
                {group.tabs.length > 4 && (
                  <span className="text-[10px] text-muted-foreground/60 pl-5">
                    +{group.tabs.length - 4} till
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </div>
);

// ── Main Component ──

interface AiCenterTabsProps {
  defaultValue?: string;
  children: React.ReactNode;
}

const AiCenterTabs = ({ defaultValue = 'ai-dashboard', children }: AiCenterTabsProps) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => findGroupForTab(defaultValue)?.id || 'dashboard');

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    const group = findGroupForTab(tab);
    if (group) setExpandedGroup(group.id);
    setMobileNavOpen(false);
  };

  const activeTabDef = ALL_TABS.find(t => t.value === activeTab);

  const sidebarContent = (
    <nav className="space-y-1 px-2">
      <button
        onClick={() => handleNavigate('ai-dashboard')}
        className={cn(
          'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          activeTab === 'ai-dashboard'
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        )}
      >
        <Activity className="w-4 h-4 shrink-0" />
        Dashboard
      </button>

      <div className="h-px bg-border my-2" />

      {TAB_GROUPS.filter(g => g.id !== 'dashboard').map(group => {
        const isExpanded = expandedGroup === group.id;
        const hasActive = group.tabs.some(t => t.value === activeTab);

        return (
          <div key={group.id}>
            <button
              onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
              className={cn(
                'flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                hasActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <span className="flex items-center gap-2.5">
                <group.icon className="w-4 h-4 shrink-0" />
                {group.label}
              </span>
              <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', isExpanded && 'rotate-90')} />
            </button>

            {isExpanded && (
              <div className="ml-4 pl-3 border-l border-border/50 space-y-0.5 mt-0.5 mb-1">
                {group.tabs.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => handleNavigate(tab.value)}
                    className={cn(
                      'flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                      activeTab === tab.value
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5 shrink-0" />
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex gap-0 lg:gap-4 -mx-4 md:-mx-8 min-h-[calc(100vh-200px)] max-h-[calc(100vh-160px)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-52 flex-col shrink-0 border-r border-border bg-card/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">AI Center</span>
          </div>
        </div>
        <ScrollArea className="flex-1 py-2">
          {sidebarContent}
        </ScrollArea>
      </aside>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 md:relative md:z-auto md:bottom-auto">
        <div className="md:hidden bg-card border-t border-border px-2 py-1.5 flex items-center justify-between safe-area-inset-bottom">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-9" onClick={() => setMobileNavOpen(true)}>
            <Menu className="w-4 h-4" />
            <span className="max-w-[120px] truncate">{activeTabDef?.label || 'Dashboard'}</span>
          </Button>
          <div className="flex items-center gap-1">
            {quickActions.slice(0, 3).map(a => (
              <Button
                key={a.tab}
                variant={activeTab === a.tab ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9"
                onClick={() => handleNavigate(a.tab)}
              >
                <a.icon className={cn('w-4 h-4', activeTab === a.tab ? 'text-primary' : 'text-muted-foreground')} />
              </Button>
            ))}
          </div>
        </div>

        {/* Tablet top bar */}
        <div className="hidden md:flex lg:hidden items-center gap-2 px-4 py-2 border-b border-border bg-card/50 overflow-x-auto scrollbar-hide">
          <Button
            variant={activeTab === 'ai-dashboard' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1.5 text-xs shrink-0 h-8"
            onClick={() => handleNavigate('ai-dashboard')}
          >
            <Activity className="w-3.5 h-3.5" />
            Dashboard
          </Button>
          {TAB_GROUPS.filter(g => g.id !== 'dashboard').map(group => (
            <Button
              key={group.id}
              variant={group.tabs.some(t => t.value === activeTab) ? 'secondary' : 'ghost'}
              size="sm"
              className="gap-1.5 text-xs h-8 shrink-0"
              onClick={() => {
                setExpandedGroup(expandedGroup === group.id ? null : group.id);
                if (!group.tabs.some(t => t.value === activeTab)) {
                  handleNavigate(group.tabs[0].value);
                }
              }}
            >
              <group.icon className="w-3.5 h-3.5" />
              {group.label}
              <ChevronRight className={cn('w-3 h-3 transition-transform', expandedGroup === group.id && 'rotate-90')} />
            </Button>
          ))}
        </div>
        {expandedGroup && (
          <div className="hidden md:flex lg:hidden items-center gap-1 px-4 py-1.5 border-b border-border/50 bg-muted/30 overflow-x-auto scrollbar-hide">
            {TAB_GROUPS.find(g => g.id === expandedGroup)?.tabs.map(tab => (
              <Button
                key={tab.value}
                variant={activeTab === tab.value ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1 text-[11px] h-7 shrink-0"
                onClick={() => handleNavigate(tab.value)}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Mobile Nav Drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-[60] bg-black/40"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 z-[70] w-72 bg-card border-r border-border flex flex-col"
            >
              <div className="h-12 flex items-center justify-between px-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">AI Center</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileNavOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 py-2">
                {sidebarContent}
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 min-w-0 px-4 md:px-8 pb-20 lg:pb-4 overflow-y-auto">
        {activeTab !== 'ai-dashboard' && activeTabDef && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 pt-1">
            <button onClick={() => handleNavigate('ai-dashboard')} className="hover:text-foreground transition-colors">
              AI Center
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{activeTabDef.label}</span>
          </div>
        )}

        <div className="min-h-[400px]">
          {activeTab === 'ai-dashboard' ? (
            <DashboardOverview onNavigate={handleNavigate} />
          ) : (
            <div>
              {React.Children.map(children, child => {
                if (!React.isValidElement(child)) return null;
                const value = child.props['data-value'] || child.props.value;
                return value === activeTab ? <div>{child}</div> : null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiCenterTabs;
