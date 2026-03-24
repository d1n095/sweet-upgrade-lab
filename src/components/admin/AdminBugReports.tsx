import { useState, useEffect } from 'react';
import { Bug, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface BugReport {
  id: string;
  user_id: string;
  page_url: string;
  description: string;
  status: string;
  created_at: string;
  resolution_notes: string | null;
  work_item_status?: string;
}

const AdminBugReports = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Fetch bug reports and join with work_items for status
      const { data: bugs } = await supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (bugs) {
        // Get linked work_items status
        const bugIds = bugs.map(b => b.id);
        const { data: workItems } = await supabase
          .from('work_items')
          .select('source_id, status')
          .eq('source_type', 'bug_report')
          .in('source_id', bugIds);

        const wiMap = new Map(workItems?.map(wi => [wi.source_id, wi.status]) || []);

        setReports(bugs.map(b => ({
          ...b,
          work_item_status: wiMap.get(b.id) || null,
        })) as BugReport[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const resolve = async (id: string) => {
    // Resolve via work_item (triggers sync back to bug_reports)
    const { data: wi } = await supabase
      .from('work_items')
      .select('id')
      .eq('source_type', 'bug_report')
      .eq('source_id', id)
      .maybeSingle();

    if (wi) {
      await supabase.from('work_items').update({
        status: 'done',
        completed_at: new Date().toISOString(),
      }).eq('id', wi.id);
    } else {
      // Fallback: resolve directly if no work_item linked
      await supabase.from('bug_reports').update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id,
      }).eq('id', id);
    }

    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved', work_item_status: 'done' } : r));
    toast.success('Markerad som löst');
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const openCount = reports.filter(r => r.status === 'open').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bug className="w-5 h-5 text-destructive" />
        <h2 className="font-semibold">Buggrapporter ({openCount} öppna)</h2>
      </div>
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Inga rapporter</p>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Badge variant={r.status === 'open' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {r.status === 'open' ? 'Öppen' : 'Löst'}
                  </Badge>
                  {r.work_item_status && r.work_item_status !== 'done' && r.work_item_status !== 'open' && (
                    <Badge variant="outline" className="text-[9px]">
                      WB: {r.work_item_status}
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">{fmtDate(r.created_at)}</span>
              </div>
              <p className="text-sm">{r.description}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{r.page_url}</p>
              {r.status === 'open' && (
                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => resolve(r.id)}>
                  <CheckCircle2 className="w-3 h-3" /> Markera löst
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminBugReports;
