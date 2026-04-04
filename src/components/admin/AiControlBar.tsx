import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Radar, Bug, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { startScanJob, onScanComplete } from '@/lib/scanEngine';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ScanControlBarProps {
  onNavigateTab?: (tab: string) => void;
  compact?: boolean;
}

const ScanControlBar = ({ onNavigateTab, compact = false }: ScanControlBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [bugCount, setBugCount] = useState(0);
  const [scanning, setScanning] = useState(false);

  const isOnScanPage = location.pathname === '/admin/system-explorer';

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
      .channel('scan-control-bugs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bug_reports' }, () => {
        fetchBugCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    return onScanComplete((result) => {
      setScanning(false);
      toast.success(`Skanning klar — ${result.systemHealthScore}/100`, { duration: 5000 });
      for (const key of ['admin-scan-results', 'admin-work-items', 'admin-bugs', 'mini-workbench-items', 'scan-history', 'work-items']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    });
  }, [queryClient]);

  const goToTab = (tab: string) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else if (isOnScanPage) {
      navigate(`/admin/system-explorer?tab=${tab}`, { replace: true });
      window.dispatchEvent(new CustomEvent('scan-center-navigate', { detail: tab }));
    } else {
      navigate(`/admin/system-explorer?tab=${tab}`);
    }
  };

  const handleQuickScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    try {
      await startScanJob();
      toast.info('Skanning startad', { duration: 3000 });
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte starta skanning');
      setScanning(false);
    }
  }, [scanning]);

  return (
    <div className={cn(
      'flex items-center gap-1 rounded-lg border border-border bg-secondary/30 px-1 py-0.5',
      compact && 'gap-0.5'
    )}>
      {/* Quick Scan */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'gap-1.5 h-7 text-xs px-2',
              scanning && 'text-blue-500'
            )}
            onClick={handleQuickScan}
            disabled={scanning}
          >
            {scanning ? (
              <Radar className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span className="hidden lg:inline">{scanning ? 'Skannar...' : 'Skanna'}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {scanning ? 'Skanning pågår...' : 'Kör full skanning'}
        </TooltipContent>
      </Tooltip>

      {/* Go to Scan Center */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 text-xs px-2"
            onClick={() => goToTab('scan')}          >
            <Radar className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Scan Center</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Öppna Scan Center</TooltipContent>
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

export default ScanControlBar;
