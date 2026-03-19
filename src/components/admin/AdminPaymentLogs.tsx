import { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle, Info, RefreshCw, CreditCard, Clock,
  ChevronDown, ChevronUp, Search, Loader2, Zap, XCircle, Download
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface PaymentLog {
  id: string;
  created_at: string;
  log_type: string;
  category: string;
  message: string;
  details: any;
  order_id: string | null;
}

const typeStyle: Record<string, { icon: any; cls: string }> = {
  error: { icon: XCircle, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  warning: { icon: AlertTriangle, cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  success: { icon: CheckCircle, cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  info: { icon: Info, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

const AdminPaymentLogs = () => {
  const [logs, setLogs] = useState<PaymentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');

  const fetch_ = async () => {
    setLoading(true);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .in('category', ['payment', 'order'])
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, []);

  const filtered = logs.filter(l => {
    if (filter === 'error' && l.log_type !== 'error') return false;
    if (filter === 'warning' && l.log_type !== 'warning') return false;
    if (search) {
      const q = search.toLowerCase();
      return l.message.toLowerCase().includes(q) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(q) ||
        (l.order_id || '').includes(q);
    }
    return true;
  });

  const errorCount = logs.filter(l => l.log_type === 'error').length;
  const warnCount = logs.filter(l => l.log_type === 'warning').length;

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    const diff = Math.floor((Date.now() - dt.getTime()) / 60000);
    if (diff < 1) return 'Just nu';
    if (diff < 60) return `${diff}m sedan`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h sedan`;
    return dt.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const exportCSV = () => {
    const headers = ['Tid', 'Typ', 'Meddelande', 'Detaljer', 'Order-ID'];
    const rows = filtered.map(l => [
      l.created_at, l.log_type, l.message,
      JSON.stringify(l.details || {}), l.order_id || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `payment-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border bg-secondary/20 cursor-pointer" onClick={() => setFilter('all')}>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold">{logs.length}</p>
            <p className="text-xs text-muted-foreground">Totalt (7d)</p>
          </CardContent>
        </Card>
        <Card className={`border-border cursor-pointer ${filter === 'error' ? 'ring-2 ring-red-500' : 'bg-red-50 dark:bg-red-900/10'}`} onClick={() => setFilter(f => f === 'error' ? 'all' : 'error')}>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-red-600">{errorCount}</p>
            <p className="text-xs text-muted-foreground">Fel</p>
          </CardContent>
        </Card>
        <Card className={`border-border cursor-pointer ${filter === 'warning' ? 'ring-2 ring-yellow-500' : 'bg-yellow-50 dark:bg-yellow-900/10'}`} onClick={() => setFilter(f => f === 'warning' ? 'all' : 'warning')}>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{warnCount}</p>
            <p className="text-xs text-muted-foreground">Varningar</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + actions */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Sök fel, session_id, order..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 text-xs">
          <Download className="w-3.5 h-3.5" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={fetch_} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Log list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Inga betalningsfel hittades — allt ser bra ut! 🎉</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(log => {
            const style = typeStyle[log.log_type] || typeStyle.info;
            const Icon = style.icon;
            const isOpen = expanded === log.id;
            const details = log.details || {};
            const stripeError = details.stripe_error || details.error || details.raw_error;
            const hasExtra = Object.keys(details).filter(k => !['timestamp', 'user_email'].includes(k)).length > 0;

            return (
              <div
                key={log.id}
                className={`rounded-lg border px-3 py-2.5 transition-colors ${
                  log.log_type === 'error' ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10' :
                  log.log_type === 'warning' ? 'border-yellow-200 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-900/10' :
                  'border-border bg-secondary/20'
                }`}
              >
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => hasExtra && setExpanded(isOpen ? null : log.id)}
                >
                  <div className={`mt-0.5 p-1 rounded ${style.cls}`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.message}</p>
                    {stripeError && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 font-mono truncate">
                        ⚡ {typeof stripeError === 'string' ? stripeError : JSON.stringify(stripeError)}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {fmtDate(log.created_at)}
                      </span>
                      {log.order_id && (
                        <Badge variant="outline" className="text-[10px] h-4 font-mono">
                          #{log.order_id.slice(0, 8)}
                        </Badge>
                      )}
                      {details.session_id && (
                        <Badge variant="secondary" className="text-[10px] h-4 font-mono">
                          cs_{details.session_id.slice(-8)}
                        </Badge>
                      )}
                      {details.payment_method && (
                        <Badge variant="outline" className="text-[10px] h-4 gap-0.5">
                          <CreditCard className="w-2.5 h-2.5" /> {details.payment_method}
                        </Badge>
                      )}
                      {hasExtra && (isOpen ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />)}
                    </div>
                  </div>
                </div>
                {isOpen && hasExtra && (
                  <pre className="text-[11px] text-muted-foreground mt-2 ml-9 bg-secondary/50 rounded px-2 py-1 overflow-x-auto max-h-40">
                    {JSON.stringify(
                      Object.fromEntries(Object.entries(details).filter(([k]) => !['timestamp', 'user_email'].includes(k))),
                      null, 2
                    )}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminPaymentLogs;
