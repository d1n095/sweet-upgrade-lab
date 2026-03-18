import { useState, useEffect } from 'react';
import {
  Activity, Loader2, AlertTriangle, CheckCircle, Info, Filter, RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface LogEntry {
  id: string;
  created_at: string;
  log_type: string;
  category: string;
  message: string;
  details: any;
  order_id: string | null;
}

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  success: { icon: CheckCircle, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Success' },
  error: { icon: AlertTriangle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Error' },
  warning: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Warning' },
  info: { icon: Info, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Info' },
};

const AdminActivityLog = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
        .from('activity_logs')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(200);

      if (typeFilter !== 'all') {
        query = query.eq('log_type', typeFilter);
      }
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [typeFilter, categoryFilter]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('sv-SE', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const errorCount = logs.filter(l => l.log_type === 'error').length;
  const successCount = logs.filter(l => l.log_type === 'success').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Aktivitetslogg</h3>
            <p className="text-sm text-muted-foreground">Senaste 30 dagarna</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Uppdatera
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
          <p className="text-2xl font-bold">{logs.length}</p>
          <p className="text-xs text-muted-foreground">Totalt</p>
        </div>
        <div className="rounded-lg border border-border bg-green-50 dark:bg-green-900/10 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{successCount}</p>
          <p className="text-xs text-muted-foreground">Lyckade</p>
        </div>
        <div className="rounded-lg border border-border bg-red-50 dark:bg-red-900/10 p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{errorCount}</p>
          <p className="text-xs text-muted-foreground">Fel</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm">Typ:</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="error">Fel</SelectItem>
              <SelectItem value="success">Lyckade</SelectItem>
              <SelectItem value="warning">Varning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Kategori:</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-32 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="order">Order</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="payment">Betalning</SelectItem>
              <SelectItem value="product">Produkt</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Inga loggposter hittades</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => {
            const cfg = typeConfig[log.log_type] || typeConfig.info;
            const Icon = cfg.icon;
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 px-3 py-2.5"
              >
                <div className={`mt-0.5 p-1 rounded ${cfg.color}`}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{log.message}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] h-5">{log.category}</Badge>
                    <span className="text-[11px] text-muted-foreground">{formatDate(log.created_at)}</span>
                    {log.order_id && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        #{log.order_id.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <pre className="text-[11px] text-muted-foreground mt-1 bg-secondary/50 rounded px-2 py-1 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminActivityLog;
