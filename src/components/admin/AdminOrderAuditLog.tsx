import { useState, useEffect } from 'react';
import { History, Loader2, Download, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface LogEntry {
  id: string;
  created_at: string;
  log_type: string;
  message: string;
  details: any;
  order_id: string | null;
  user_id: string | null;
}

const AdminOrderAuditLog = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('category', 'order')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs(data || []);
    setLoading(false);
  };

  const filteredLogs = logs.filter(l =>
    !search || l.message.toLowerCase().includes(search.toLowerCase()) ||
    l.order_id?.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const headers = ['Tidpunkt', 'Typ', 'Meddelande', 'Order-ID', 'Detaljer'];
    const rows = filteredLogs.map(l => [
      l.created_at,
      l.log_type,
      l.message,
      l.order_id || '',
      JSON.stringify(l.details || {}),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeColor = (t: string) => {
    switch (t) {
      case 'success': return 'bg-green-500/10 text-green-600';
      case 'error': return 'bg-destructive/10 text-destructive';
      case 'warning': return 'bg-yellow-500/10 text-yellow-600';
      default: return 'bg-blue-500/10 text-blue-600';
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">Orderändringslogg ({filteredLogs.length})</span>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 text-xs">
          <Download className="w-3.5 h-3.5" />
          Exportera
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Sök i loggen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredLogs.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Inga orderhändelser hittades</p>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card text-sm">
              <Badge className={`${typeColor(log.log_type)} text-[10px] shrink-0 mt-0.5`}>
                {log.log_type}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{log.message}</p>
                {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground space-x-3">
                    {log.details.old_status && (
                      <span>{log.details.old_status} → {log.details.new_status}</span>
                    )}
                    {log.details.tracking && <span>Spårning: {log.details.tracking}</span>}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(log.created_at).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminOrderAuditLog;
