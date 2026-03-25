import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Radar, Bot, Bug, Play, Pause, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AiControlBarProps {
  /** If provided, switches tab directly instead of navigating */
  onNavigateTab?: (tab: string) => void;
  compact?: boolean;
}

const AiControlBar = ({ onNavigateTab, compact = false }: AiControlBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [bugCount, setBugCount] = useState(0);
  const [autopilotOn, setAutopilotOn] = useState(false);
  const [scanRunning, setScanRunning] = useState(false);

  const isOnAiPage = location.pathname === '/admin/ai';

  useEffect(() => {
    const fetchBugCount = async () => {
      const { count } = await supabase
        .from('bug_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      setBugCount(count || 0);
    };
    fetchBugCount();

    const channel = supabase
      .channel('ai-control-bugs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bug_reports' }, () => {
        fetchBugCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const goToTab = (tab: string) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else if (isOnAiPage) {
      // Already on AI page but no handler - use URL param
      navigate(`/admin/ai?tab=${tab}`, { replace: true });
      window.dispatchEvent(new CustomEvent('ai-center-navigate', { detail: tab }));
    } else {
      navigate(`/admin/ai?tab=${tab}`);
    }
  };

  const toggleAutopilot = () => {
    setAutopilotOn(prev => !prev);
    // If turning on and on AI page, navigate to autopilot tab
    if (!autopilotOn) {
      goToTab('autopilot');
    }
  };

  return (
    <div className={cn(
      'flex items-center gap-1 rounded-lg border border-border bg-secondary/30 px-1 py-0.5',
      compact && 'gap-0.5'
    )}>
      {/* Scan */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'gap-1.5 h-7 text-xs px-2',
              scanRunning && 'text-blue-500'
            )}
            onClick={() => goToTab('scan')}
          >
            <Radar className={cn('w-3.5 h-3.5', scanRunning && 'animate-spin')} />
            <span className="hidden lg:inline">Skanning</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Full skanning</TooltipContent>
      </Tooltip>

      {/* Lova Chat */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 text-xs px-2"
            onClick={() => goToTab('lova-chat')}
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Lova</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Lova AI Chat</TooltipContent>
      </Tooltip>

      {/* Autopilot toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleAutopilot}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium transition-colors',
              autopilotOn
                ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            {autopilotOn ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline">Autopilot</span>
            {autopilotOn && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Autopilot {autopilotOn ? 'PÅ' : 'AV'}
        </TooltipContent>
      </Tooltip>

      {/* Bugs */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 text-xs px-2 relative"
            onClick={() => goToTab('bugs')}
          >
            <Bug className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Buggar</span>
            {bugCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {bugCount > 99 ? '99+' : bugCount}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {bugCount > 0 ? `${bugCount} öppna buggar` : 'Inga öppna buggar'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default AiControlBar;
