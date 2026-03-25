import * as React from 'react';
import { useState } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import {
  Bot, Copy, Play, TrendingUp, Radar, Activity, Monitor, Compass,
  Database, Shield, Package, Sparkles, Bug, BarChart3, LayoutGrid,
  ShieldCheck, Zap, CheckCircle, Wrench, Eye, GitMerge, Maximize2,
  ArrowRightLeft, Gavel, Layers,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface TabDef {
  value: string;
  label: string;
  shortLabel?: string;
  icon: React.ElementType;
}

interface TabGroup {
  label: string;
  tabs: TabDef[];
}

const TAB_GROUPS: TabGroup[] = [
  {
    label: 'Kärna',
    tabs: [
      { value: 'lova-chat', label: 'Lova 0.5', shortLabel: 'Lova', icon: Bot },
      { value: 'lova-prompts', label: 'Prompts', icon: Copy },
      { value: 'autopilot', label: 'Autopilot', icon: Play },
      { value: 'actions', label: 'Actions', icon: TrendingUp },
    ],
  },
  {
    label: 'Skanning',
    tabs: [
      { value: 'scan', label: 'Scan', icon: Radar },
      { value: 'visual-qa', label: 'Visual QA', shortLabel: 'VQA', icon: Monitor },
      { value: 'nav-bug', label: 'Nav & Bugg', shortLabel: 'Nav', icon: Compass },
      { value: 'overflow-scan', label: 'Overflow', icon: Maximize2 },
      { value: 'ux-scanner', label: 'UX', icon: Eye },
      { value: 'focused-scan', label: 'Fokus', icon: Radar },
      { value: 'sync-scan', label: 'Sync', icon: ArrowRightLeft },
    ],
  },
  {
    label: 'Data & Hälsa',
    tabs: [
      { value: 'dashboard', label: 'Översikt', icon: Activity },
      { value: 'data-health', label: 'Data', icon: Database },
      { value: 'health', label: 'Hälsa', icon: Shield },
      { value: 'data-integrity', label: 'Integritet', shortLabel: 'Int', icon: ShieldCheck },
      { value: 'content-validation', label: 'Innehåll QA', shortLabel: 'CQA', icon: Eye },
      { value: 'cleanup', label: 'Cleanup', icon: Database },
    ],
  },
  {
    label: 'Verktyg',
    tabs: [
      { value: 'products', label: 'Produktförslag', shortLabel: 'Prod', icon: Package },
      { value: 'tasks', label: 'Tasks', icon: Bot },
      { value: 'prompts', label: 'Prompt Gen', shortLabel: 'Gen', icon: Sparkles },
      { value: 'bugs', label: 'Bugg', icon: Bug },
      { value: 'insights', label: 'Insights', icon: BarChart3 },
      { value: 'auto-fix', label: 'Fix', icon: Wrench },
    ],
  },
  {
    label: 'Avancerat',
    tabs: [
      { value: 'structure', label: 'Struktur', icon: LayoutGrid },
      { value: 'guardian', label: 'Guardian', icon: ShieldCheck },
      { value: 'interaction-qa', label: 'Interaction QA', shortLabel: 'IQA', icon: Zap },
      { value: 'verification', label: 'Verifiering', shortLabel: 'Ver', icon: CheckCircle },
      { value: 'patterns', label: 'Mönster', icon: GitMerge },
      { value: 'governor', label: 'Gov', icon: Gavel },
      { value: 'prompt-queue', label: 'Kö', icon: Layers },
      { value: 'orchestration', label: 'Orch', icon: GitMerge },
    ],
  },
];

const ALL_TABS = TAB_GROUPS.flatMap(g => g.tabs);

function findTabGroup(value: string) {
  return TAB_GROUPS.find(g => g.tabs.some(t => t.value === value));
}

interface AiCenterTabsProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {
  defaultValue?: string;
}

const AiCenterTabs = ({ defaultValue = 'lova-chat', children, className, ...props }: AiCenterTabsProps) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  const [activeGroup, setActiveGroup] = useState(() => findTabGroup(defaultValue)?.label || 'Kärna');

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const group = findTabGroup(value);
    if (group) setActiveGroup(group.label);
  };

  const currentGroupTabs = TAB_GROUPS.find(g => g.label === activeGroup)?.tabs || [];

  return (
    <TabsPrimitive.Root value={activeTab} onValueChange={handleTabChange} className={cn('w-full', className)} {...props}>
      {/* ── Mobile: Select dropdown ── */}
      <div className="md:hidden space-y-2">
        <Select value={activeTab} onValueChange={handleTabChange}>
          <SelectTrigger className="w-full h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[60vh]">
            {TAB_GROUPS.map(group => (
              <React.Fragment key={group.label}>
                <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  {group.label}
                </div>
                {group.tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <SelectItem key={tab.value} value={tab.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {tab.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Desktop/Tablet: Group chips + tab row ── */}
      <div className="hidden md:block space-y-2">
        {/* Group selector */}
        <div className="flex items-center gap-1 flex-wrap">
          {TAB_GROUPS.map(group => (
            <button
              key={group.label}
              type="button"
              onClick={() => {
                setActiveGroup(group.label);
                // Switch to first tab in group if current tab isn't in it
                if (!group.tabs.some(t => t.value === activeTab)) {
                  handleTabChange(group.tabs[0].value);
                }
              }}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                activeGroup === group.label
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              {group.label}
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{group.tabs.length}</Badge>
            </button>
          ))}
        </div>

        {/* Tab triggers for active group */}
        <ScrollArea className="w-full">
          <TabsPrimitive.List className="inline-flex items-center rounded-lg bg-muted p-1 text-muted-foreground gap-0.5">
            {currentGroupTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <TabsPrimitive.Trigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    'inline-flex items-center justify-center whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ring-offset-background transition-all gap-1.5',
                    'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'disabled:pointer-events-none disabled:opacity-50'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.shortLabel || tab.label}
                </TabsPrimitive.Trigger>
              );
            })}
          </TabsPrimitive.List>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Tab content passed as children */}
      {children}
    </TabsPrimitive.Root>
  );
};

export default AiCenterTabs;
