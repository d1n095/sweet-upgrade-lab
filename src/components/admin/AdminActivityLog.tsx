import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Loader2, AlertTriangle, CheckCircle, Info, Filter, RefreshCw,
  Download, Shield, LogIn, ShoppingCart, Settings, Package, Search, User,
  Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
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
  user_id: string | null;
}

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  success: { icon: CheckCircle, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Lyckad' },
  error: { icon: AlertTriangle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Fel' },
  warning: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Varning' },
  info: { icon: Info, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Info' },
};

const categoryConfig: Record<string, { icon: any; label: string }> = {
  order: { icon: ShoppingCart, label: 'Order' },
  admin: { icon: Settings, label: 'Admin' },
  payment: { icon: ShoppingCart, label: 'Betalning' },
  product: { icon: Package, label: 'Produkt' },
  system: { icon: Activity, label: 'System' },
  auth: { icon: LogIn, label: 'Inloggning' },
  security: { icon: Shield, label: 'Säkerhet' },
  shipping: { icon: Package, label: 'Frakt' },
  campaign: { icon: Settings, label: 'Kampanj' },
  ingredient: { icon: Package, label: 'Ingrediens' },
  recipe: { icon: Settings, label: 'Recept' },
};

const AdminActivityLog = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<string>('all');
  const logsListRef = { current: null as HTMLDivElement | null };

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
        .limit(500);

      if (typeFilter !== 'all') query = query.eq('log_type', typeFilter);
      if (categoryFilter !== 'all') query = query.eq('category', categoryFilter);

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [typeFilter, categoryFilter]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('sv-SE', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  const filteredLogs = searchQuery
    ? logs.filter(l => 
        l.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.details?.user_email && String(l.details.user_email).toLowerCase().includes(searchQuery.toLowerCase())) ||
        (l.order_id && l.order_id.includes(searchQuery))
      )
    : logs;

  const errorCount = logs.filter(l => l.log_type === 'error').length;
  const warningCount = logs.filter(l => l.log_type === 'warning').length;
  const successCount = logs.filter(l => l.log_type === 'success').length;
  const authLogs = logs.filter(l => l.category === 'auth');
  const securityLogs = logs.filter(l => l.category === 'security');
  const orderLogs = logs.filter(l => l.category === 'order' || l.order_id);

  const handleExportCSV = () => {
    const headers = ['Tidpunkt', 'Typ', 'Kategori', 'Meddelande', 'Användare', 'Order-ID'];
    const rows = filteredLogs.map(l => [
      l.created_at,
      l.log_type,
      l.category,
      l.message,
      l.details?.user_email || '',
      l.order_id || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderLogList = (logList: LogEntry[]) => (
    <div className="space-y-1.5">
      {logList.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Inga loggposter hittades</p>
      ) : (
        logList.map((log) => {
          const cfg = typeConfig[log.log_type] || typeConfig.info;
          const catCfg = categoryConfig[log.category] || categoryConfig.system;
          const Icon = cfg.icon;
          const isExpanded = expandedLog === log.id;
          const hasDetails = log.details && Object.keys(log.details).filter(k => k !== 'timestamp' && k !== 'user_email').length > 0;

          return (
            <div
              key={log.id}
              className="rounded-lg border border-border bg-secondary/20 px-3 py-2.5 hover:bg-secondary/30 transition-colors"
            >
              <div
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => hasDetails && setExpandedLog(isExpanded ? null : log.id)}
              >
                <div className={`mt-0.5 p-1 rounded ${cfg.color}`}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{log.message}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px] h-5 gap-1">
                      <catCfg.icon className="w-2.5 h-2.5" />
                      {catCfg.label}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDate(log.created_at)}
                    </span>
                    {log.details?.user_email && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <User className="w-2.5 h-2.5" />
                        {log.details.user_email}
                      </span>
                    )}
                    {log.order_id && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        #{log.order_id.slice(0, 8)}
                      </span>
                    )}
                    {hasDetails && (
                      isExpanded
                        ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                        : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
              {isExpanded && hasDetails && (
                <motion.pre
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="text-[11px] text-muted-foreground mt-2 ml-9 bg-secondary/50 rounded px-2 py-1 overflow-x-auto"
                >
                  {JSON.stringify(
                    Object.fromEntries(Object.entries(log.details).filter(([k]) => k !== 'timestamp' && k !== 'user_email')),
                    null, 2
                  )}
                </motion.pre>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Systemlogg</h3>
            <p className="text-sm text-muted-foreground">Full spårbarhet — senaste 30 dagarna</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Uppdatera
          </Button>
        </div>
      </div>

      {/* Stats – clickable filter cards */}
      {(() => {
        const cards = [
          { key: 'all', count: logs.length, label: 'Totalt', bg: 'bg-secondary/30', activeBorder: 'border-primary', textColor: '' },
          { key: 'success', count: successCount, label: 'Lyckade', bg: 'bg-green-50 dark:bg-green-900/10', activeBorder: 'border-green-500', textColor: 'text-green-600' },
          { key: 'error', count: errorCount, label: 'Fel', bg: 'bg-red-50 dark:bg-red-900/10', activeBorder: 'border-red-500', textColor: 'text-red-600' },
          { key: 'warning', count: warningCount, label: 'Varningar', bg: 'bg-yellow-50 dark:bg-yellow-900/10', activeBorder: 'border-yellow-500', textColor: 'text-yellow-600' },
          { key: 'security', count: securityLogs.length, label: 'Säkerhet', bg: 'bg-purple-50 dark:bg-purple-900/10', activeBorder: 'border-purple-500', textColor: 'text-purple-600' },
        ];

        const handleCardClick = (key: string) => {
          setActiveCard(key);
          if (key === 'all') {
            setTypeFilter('all');
            setCategoryFilter('all');
          } else if (key === 'security') {
            setTypeFilter('all');
            setCategoryFilter('security');
          } else {
            setCategoryFilter('all');
            setTypeFilter(key);
          }
          logsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        return (
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {cards.map(c => (
              <button
                key={c.key}
                onClick={() => handleCardClick(c.key)}
                className={`flex-1 min-w-[120px] rounded-lg border-2 p-3 text-center transition-all duration-200 cursor-pointer
                  hover:scale-[1.03] hover:shadow-md active:scale-[0.98]
                  ${c.bg}
                  ${activeCard === c.key
                    ? `${c.activeBorder} shadow-sm ring-1 ring-primary/20`
                    : 'border-border'
                  }`}
              >
                <p className={`text-2xl font-bold ${c.textColor}`}>{c.count}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </button>
            ))}
          </div>
        );
      })()}

      {/* Tabs for different log views */}
      <Tabs defaultValue="all" className="space-y-4">
        <ScrollableTabs>
          <TabsList className="bg-secondary/50 w-max">
            <TabsTrigger value="all">Alla loggar</TabsTrigger>
            <TabsTrigger value="auth">Inloggningar</TabsTrigger>
            <TabsTrigger value="orders">Orderlogg</TabsTrigger>
            <TabsTrigger value="security">Säkerhet</TabsTrigger>
          </TabsList>
        </ScrollableTabs>

        <TabsContent value="all" className="space-y-4">
          {/* Search + Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Sök i loggar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-28 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla typer</SelectItem>
                  <SelectItem value="error">Fel</SelectItem>
                  <SelectItem value="success">Lyckade</SelectItem>
                  <SelectItem value="warning">Varning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla kategorier</SelectItem>
                  <SelectItem value="order">Order</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="payment">Betalning</SelectItem>
                   <SelectItem value="product">Produkt</SelectItem>
                   <SelectItem value="system">System</SelectItem>
                   <SelectItem value="auth">Inloggning</SelectItem>
                   <SelectItem value="security">Säkerhet</SelectItem>
                   <SelectItem value="shipping">Frakt</SelectItem>
                   <SelectItem value="campaign">Kampanj</SelectItem>
                   <SelectItem value="ingredient">Ingrediens</SelectItem>
                   <SelectItem value="recipe">Recept</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            renderLogList(filteredLogs)
          )}
        </TabsContent>

        <TabsContent value="auth">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <LogIn className="w-4 h-4 text-primary" />
              <h4 className="font-medium text-sm">Inloggningshistorik</h4>
              <Badge variant="outline" className="text-xs">{authLogs.length} poster</Badge>
            </div>
            {renderLogList(authLogs)}
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <h4 className="font-medium text-sm">Orderlogg</h4>
              <Badge variant="outline" className="text-xs">{orderLogs.length} poster</Badge>
            </div>
            {renderLogList(orderLogs)}
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-destructive" />
              <h4 className="font-medium text-sm">Säkerhetsloggar</h4>
              <Badge variant="outline" className="text-xs">{securityLogs.length} poster</Badge>
            </div>
            {securityLogs.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Inga säkerhetshändelser registrerade</p>
              </div>
            ) : renderLogList(securityLogs)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminActivityLog;
