import { useState, useEffect } from 'react';
import { Bug, CheckCircle2, Loader2 } from 'lucide-react';
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
}

const AdminBugReports = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setReports((data as BugReport[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const resolve = async (id: string) => {
    const { error } = await supabase.from('bug_reports').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id,
    }).eq('id', id);
    if (!error) {
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved' } : r));
      toast.success('Markerad som löst');
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bug className="w-5 h-5 text-destructive" />
        <h2 className="font-semibold">Buggrapporter ({reports.filter(r => r.status === 'open').length} öppna)</h2>
      </div>
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Inga rapporter</p>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="border border-border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Badge variant={r.status === 'open' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {r.status === 'open' ? 'Öppen' : 'Löst'}
                </Badge>
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
