import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, CheckCircle, XCircle, Clock,
  RefreshCw, Shield, Zap, Eye, Database, Bot, Radar,
  Settings2, BarChart2, Play, Ban, Info, Search,
  Loader2, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getInvokeLog, clearInvokeLog, type InvokeLogEntry } from '@/lib/invokeLogger';
import { supabase } from '@/integrations/supabase/client';
import { safeInvoke } from '@/lib/safeInvoke';

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION INVENTORY
// This is the authoritative map of every edge function referenced in the
// codebase.  Update this list whenever a new function is added or removed.
// ─────────────────────────────────────────────────────────────────────────────

type TriggerType = 'button' | 'auto' | 'hidden';
type RiskLevel = 'low' | 'medium' | 'high';
type FunctionStatus = 'active' | 'blocked' | 'unknown';

interface FunctionDef {
  function_name: string;
  where_called_from: string[];
  has_ui: boolean;
  trigger_type: TriggerType;
  risk_level: RiskLevel;
  status: FunctionStatus;
  invisible: boolean;
  description: string;
}

const FUNCTION_INVENTORY: FunctionDef[] = [
  // ── ACTIVE FUNCTIONS ──
  {
    function_name: 'process-refund',
    where_called_from: ['AdminRefundRequests', 'AdminOrderManager'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'low',
    status: 'active',
    invisible: false,
    description: 'Processes customer refunds via Stripe',
  },
  {
    function_name: 'send-order-email',
    where_called_from: ['AdminOrderManager', 'ShippingFormDialog'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'low',
    status: 'active',
    invisible: false,
    description: 'Sends order confirmation/status emails to customers',
  },
  {
    function_name: 'generate-receipt',
    where_called_from: ['AdminOrderManager'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'low',
    status: 'active',
    invisible: false,
    description: 'Generates PDF receipts for orders',
  },
  {
    function_name: 'shopify-proxy',
    where_called_from: ['AdminProductManager', 'lib/shopify'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'medium',
    status: 'active',
    invisible: false,
    description: 'Proxies requests to Shopify API for product sync',
  },
  {
    function_name: 'notify-influencer',
    where_called_from: ['AdminInfluencerManager'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'low',
    status: 'active',
    invisible: false,
    description: 'Sends email notifications to influencers',
  },
  {
    function_name: 'notify-affiliate',
    where_called_from: ['AdminAffiliateManager', 'AdminApplicationsManager'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'low',
    status: 'active',
    invisible: false,
    description: 'Sends email notifications to affiliates',
  },
  {
    function_name: 'data-sync',
    where_called_from: ['WorkbenchBoard'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'medium',
    status: 'active',
    invisible: false,
    description: 'Synchronises data between internal systems',
  },
  {
    function_name: 'process-bug-report',
    where_called_from: ['AdminBugReports'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'low',
    status: 'active',
    invisible: false,
    description: 'Processes and stores bug reports',
  },
  {
    function_name: 'run-full-scan',
    where_called_from: ['SystemExplorer', 'fullScanOrchestrator'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'medium',
    status: 'active',
    invisible: false,
    description: 'Full deterministic codebase/system scan (no AI)',
  },
  {
    function_name: 'apply-fix',
    where_called_from: ['AdminAdvanced'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'high',
    status: 'active',
    invisible: false,
    description: 'Applies automated code/config fixes',
  },
  {
    function_name: 'access-control-scan',
    where_called_from: ['AdminAdvanced'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'high',
    status: 'active',
    invisible: false,
    description: 'Scans access control rules for misconfiguration',
  },
  {
    function_name: 'permission-fix',
    where_called_from: ['AdminAdvanced'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'high',
    status: 'active',
    invisible: false,
    description: 'Automatically fixes permission issues found by scan',
  },
  {
    function_name: 'access-flow-validate',
    where_called_from: ['AdminAdvanced'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'high',
    status: 'active',
    invisible: false,
    description: 'Validates the complete access-flow graph',
  },
  {
    function_name: 'lookup-order',
    where_called_from: ['OrderConfirmation', 'TrackOrder'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'low',
    status: 'active',
    invisible: false,
    description: 'Looks up a customer order by ID / email',
  },
  {
    function_name: 'create-checkout',
    where_called_from: ['Checkout', 'TrackOrder'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'low',
    status: 'active',
    invisible: false,
    description: 'Creates a Stripe Checkout session',
  },
  {
    function_name: 'notify-review',
    where_called_from: ['ReviewForm'],
    has_ui: true,
    trigger_type: 'auto',
    risk_level: 'low',
    status: 'active',
    invisible: false,
    description: 'Notifies admin when a new product review is submitted',
  },
  {
    function_name: 'send-welcome-email',
    where_called_from: ['AuthModal'],
    has_ui: false,
    trigger_type: 'auto',
    risk_level: 'low',
    status: 'active',
    invisible: true,
    description: 'Sends a welcome email when a new user registers',
  },
  {
    function_name: 'google-places',
    where_called_from: ['AddressAutocomplete'],
    has_ui: true,
    trigger_type: 'auto',
    risk_level: 'low',
    status: 'active',
    invisible: false,
    description: 'Address autocomplete at checkout via Google Places API',
  },
  {
    function_name: 'stripe-webhook',
    where_called_from: ['AdminWebhookStatus'],
    has_ui: true,
    trigger_type: 'hidden',
    risk_level: 'medium',
    status: 'active',
    invisible: false,
    description: 'Receives Stripe payment webhook events (external trigger)',
  },
  // ── BLOCKED / DISABLED FUNCTIONS ──
  {
    function_name: 'automation-engine',
    where_called_from: ['WorkbenchBoard (disabled)'],
    has_ui: true,
    trigger_type: 'button',
    risk_level: 'high',
    status: 'blocked',
    invisible: false,
    description: 'General automation orchestrator — DISABLED',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────────────────────────────────────

function statusBadge(status: FunctionStatus) {
  if (status === 'active') return <Badge variant="default" className="bg-green-600 text-white text-xs">Aktiv</Badge>;
  if (status === 'blocked') return <Badge variant="destructive" className="text-xs">BLOCKERAD</Badge>;
  return <Badge variant="outline" className="text-xs">Okänd</Badge>;
}

function riskBadge(risk: RiskLevel) {
  const map: Record<RiskLevel, string> = {
    low: 'bg-blue-100 text-blue-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  };
  const labelMap: Record<RiskLevel, string> = { low: 'Låg', medium: 'Medel', high: 'Hög' };
  return <Badge className={cn('text-xs font-medium', map[risk])}>{labelMap[risk]}</Badge>;
}

function triggerBadge(t: TriggerType) {
  const map: Record<TriggerType, string> = {
    button: 'bg-indigo-100 text-indigo-700',
    auto: 'bg-orange-100 text-orange-700',
    hidden: 'bg-zinc-100 text-zinc-600',
  };
  return <Badge className={cn('text-xs font-medium', map[t])}>{t}</Badge>;
}

function invokeStatusIcon(s: InvokeLogEntry['status']) {
  if (s === 'success') return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (s === 'error') return <XCircle className="w-4 h-4 text-red-500" />;
  if (s === 'blocked') return <Ban className="w-4 h-4 text-orange-500" />;
  return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────────────────

const OverviewTab = ({ log }: { log: InvokeLogEntry[] }) => {
  const active = FUNCTION_INVENTORY.filter(f => f.status === 'active').length;
  const blocked = FUNCTION_INVENTORY.filter(f => f.status === 'blocked').length;
  const invisible = FUNCTION_INVENTORY.filter(f => f.invisible).length;
  const highRisk = FUNCTION_INVENTORY.filter(f => f.risk_level === 'high' && f.status === 'active').length;
  const recentErrors = log.filter(e => e.status === 'error').length;
  const recentBlocked = log.filter(e => e.status === 'blocked').length;

  const lastScan = log.find(e => e.fn === 'run-full-scan');

  return (
    <div className="space-y-4">
      {/* Top KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Aktiva funktioner', value: active, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Blockerade (AI)', value: blocked, icon: Ban, color: 'text-orange-500' },
          { label: 'Osynliga system', value: invisible, icon: Eye, color: 'text-purple-500' },
          { label: 'Hög risk (aktiva)', value: highRisk, icon: AlertTriangle, color: 'text-red-500' },
          { label: 'Fel (session)', value: recentErrors, icon: XCircle, color: 'text-red-500' },
          { label: 'Blockerade anrop', value: recentBlocked, icon: Shield, color: 'text-orange-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-3 flex flex-col gap-1">
              <Icon className={cn('w-4 h-4', color)} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Status banner */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="w-6 h-6 text-orange-600 shrink-0" />
          <div>
            <p className="font-semibold text-orange-800">AI är INAKTIVERAT</p>
            <p className="text-sm text-orange-700">
              Alla 7 AI-funktioner är blockerade i det globala invoke-lagret.
              Systemet är 100% deterministiskt — inga OpenAI/Anthropic-anrop sker.
            </p>
          </div>
          <Badge variant="destructive" className="ml-auto shrink-0">BLOCKERAD</Badge>
        </CardContent>
      </Card>

      {/* Last scan */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radar className="w-4 h-4 text-blue-500" />
            Senaste skanningen
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {lastScan ? (
            <div className="flex items-center gap-3">
              {invokeStatusIcon(lastScan.status)}
              <div>
                <p className="text-sm font-medium">{lastScan.fn}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(lastScan.calledAt), 'yyyy-MM-dd HH:mm:ss')}
                  {lastScan.durationMs !== undefined && ` · ${lastScan.durationMs}ms`}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Ingen skanning genomförd denna session.</p>
          )}
        </CardContent>
      </Card>

      {/* Invisible systems list */}
      <Card className="border-purple-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-500" />
            Osynliga system (kör utan synlig UI)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {FUNCTION_INVENTORY.filter(f => f.invisible).map(f => (
            <div key={f.function_name} className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-xs font-mono shrink-0">{f.function_name}</Badge>
              <span className="text-muted-foreground">{f.description}</span>
              {statusBadge(f.status)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTIONS TAB  (complete inventory table)
// ─────────────────────────────────────────────────────────────────────────────

const FunctionsTab = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | FunctionStatus>('all');

  const filtered = FUNCTION_INVENTORY.filter(f => {
    const matchSearch =
      !search ||
      f.function_name.includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase()) ||
      f.where_called_from.some(w => w.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Sök funktion..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {(['all', 'active', 'blocked'] as const).map(s => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'Alla' : s === 'active' ? 'Aktiva' : 'Blockerade'}
          </Button>
        ))}
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-3 py-2 font-medium">Funktion</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Risk</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Trigger</th>
              <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">Anropas från</th>
              <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">Beskrivning</th>
              <th className="text-left px-3 py-2 font-medium">UI</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.function_name} className={cn('border-b last:border-0', f.invisible && 'bg-purple-50/50')}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{f.function_name}</code>
                    {f.invisible && <Badge className="text-xs bg-purple-100 text-purple-700">osynlig</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2">{statusBadge(f.status)}</td>
                <td className="px-3 py-2 hidden md:table-cell">{riskBadge(f.risk_level)}</td>
                <td className="px-3 py-2 hidden md:table-cell">{triggerBadge(f.trigger_type)}</td>
                <td className="px-3 py-2 hidden lg:table-cell text-xs text-muted-foreground">
                  {f.where_called_from.join(', ')}
                </td>
                <td className="px-3 py-2 hidden lg:table-cell text-xs text-muted-foreground max-w-xs">
                  {f.description}
                </td>
                <td className="px-3 py-2">
                  {f.has_ui
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-muted-foreground" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} / {FUNCTION_INVENTORY.length} funktioner</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCAN CONTROL TAB
// ─────────────────────────────────────────────────────────────────────────────

const ScanControlTab = ({ log }: { log: InvokeLogEntry[] }) => {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const scanHistory = log.filter(e => e.fn === 'run-full-scan');

  const runScan = async () => {
    setRunning(true);
    try {
      const { data, error } = await safeInvoke('run-full-scan', {
        body: { source: 'system-monitor' },
        isAdmin: true,
      });
      setLastResult(data);
      if (!error) {
        toast.success(`Skanning klar: ${data?.issues?.length ?? 0} problem hittades`);
      } else {
        toast.error((error as any)?.message || 'Skanning misslyckades');
      }
    } catch (e: any) {
      toast.error(e.message || 'Okänt fel');
    }
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={runScan} disabled={running} className="gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          {running ? 'Kör skanning...' : 'Kör full skanning'}
        </Button>
      </div>

      {lastResult && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Senaste resultat</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex gap-3 flex-wrap mb-3">
              <Badge variant="outline">
                Problem: {lastResult.issues?.length ?? 0}
              </Badge>
              <Badge variant="outline">
                Poäng: {lastResult.overall_score ?? 'N/A'}
              </Badge>
              {lastResult.ai_skipped && (
                <Badge className="bg-orange-100 text-orange-700">AI hoppades över</Badge>
              )}
            </div>
            <ScrollArea className="h-48">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                {JSON.stringify(lastResult, null, 2)}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Skanningshistorik (session)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {scanHistory.length === 0 && (
            <p className="text-sm text-muted-foreground">Ingen skanning genomförd denna session.</p>
          )}
          {scanHistory.map(e => (
            <div key={e.id} className="flex items-center gap-2 text-sm">
              {invokeStatusIcon(e.status)}
              <span className="font-mono text-xs">{format(new Date(e.calledAt), 'HH:mm:ss')}</span>
              {e.durationMs !== undefined && (
                <span className="text-xs text-muted-foreground">{e.durationMs}ms</span>
              )}
              {e.errorMessage && (
                <span className="text-xs text-red-500 truncate">{e.errorMessage}</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AI CONTROL TAB
// ─────────────────────────────────────────────────────────────────────────────

const AI_BLOCKED_FUNCTIONS = FUNCTION_INVENTORY.filter(f => f.status === 'blocked');

const AiControlTab = ({ log }: { log: InvokeLogEntry[] }) => {
  const blockedCalls = log.filter(e => e.status === 'blocked');

  return (
    <div className="space-y-4">
      {/* Master toggle (display only — always blocked) */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5 text-orange-600" />
              <div>
                <p className="font-semibold">AI-system</p>
                <p className="text-xs text-muted-foreground">
                  Alla AI-anrop blockeras i det globala invoke-lagret (client.ts)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="ai-toggle" className="text-sm text-muted-foreground">Inaktivt</Label>
              <Switch id="ai-toggle" checked={false} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Blocked function list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Ban className="w-4 h-4 text-orange-500" />
            Blockerade AI-funktioner ({AI_BLOCKED_FUNCTIONS.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {AI_BLOCKED_FUNCTIONS.map(f => (
            <div key={f.function_name} className="flex items-center gap-2 py-1 border-b last:border-0">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded min-w-48">{f.function_name}</code>
              <span className="text-xs text-muted-foreground flex-1">{f.description}</span>
              {riskBadge(f.risk_level)}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Blocked calls log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" />
            Blockerade anrop denna session ({blockedCalls.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {blockedCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga AI-anrop försökte göras denna session.</p>
          ) : (
            <div className="space-y-1.5">
              {blockedCalls.map(e => (
                <div key={e.id} className="flex items-center gap-2 text-sm p-2 rounded bg-red-50 border border-red-100">
                  <Ban className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <code className="text-xs font-mono">{e.fn}</code>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(e.calledAt), 'HH:mm:ss')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATION CONTROL TAB
// ─────────────────────────────────────────────────────────────────────────────

const AUTOMATIONS = FUNCTION_INVENTORY.filter(
  f => f.trigger_type === 'auto' || f.trigger_type === 'hidden'
);

const AutomationControlTab = ({ log }: { log: InvokeLogEntry[] }) => (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Automatiska och dolda triggers — dessa kör utan att en admin klickar på en knapp.
    </p>
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left px-3 py-2 font-medium">Funktion</th>
            <th className="text-left px-3 py-2 font-medium">Trigger</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            <th className="text-left px-3 py-2 font-medium">Källa</th>
            <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Beskrivning</th>
          </tr>
        </thead>
        <tbody>
          {AUTOMATIONS.map(f => {
            const calls = log.filter(e => e.fn === f.function_name);
            const lastCall = calls[0];
            return (
              <tr key={f.function_name} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{f.function_name}</code>
                </td>
                <td className="px-3 py-2">{triggerBadge(f.trigger_type)}</td>
                <td className="px-3 py-2">{statusBadge(f.status)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {lastCall ? (
                    <span className="flex items-center gap-1">
                      {invokeStatusIcon(lastCall.status)}
                      {format(new Date(lastCall.calledAt), 'HH:mm:ss')}
                    </span>
                  ) : 'Ej anropad'}
                </td>
                <td className="px-3 py-2 hidden md:table-cell text-xs text-muted-foreground">
                  {f.description}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION LOGS TAB
// ─────────────────────────────────────────────────────────────────────────────

const FunctionLogsTab = ({
  log,
  onClear,
}: {
  log: InvokeLogEntry[];
  onClear: () => void;
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvokeLogEntry['status']>('all');

  const filtered = log.filter(e => {
    const matchSearch = !search || e.fn.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Filtrera på funktionsnamn..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {(['all', 'success', 'error', 'blocked', 'pending'] as const).map(s => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
            className="capitalize"
          >
            {s === 'all' ? 'Alla' : s}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto gap-1 text-muted-foreground">
          <Trash2 className="w-3.5 h-3.5" />
          Rensa
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Inga anrop loggade ännu.  Funktioner loggas automatiskt när de anropas.
        </p>
      ) : (
        <ScrollArea className="h-[520px]">
          <div className="space-y-1">
            {filtered.map(e => (
              <div
                key={e.id}
                className={cn(
                  'flex items-center gap-2 text-sm p-2.5 rounded border',
                  e.status === 'success' && 'bg-green-50/50 border-green-100',
                  e.status === 'error' && 'bg-red-50/50 border-red-100',
                  e.status === 'blocked' && 'bg-orange-50/50 border-orange-100',
                  e.status === 'pending' && 'bg-muted/40 border-muted',
                )}
              >
                {invokeStatusIcon(e.status)}
                <code className="text-xs font-mono min-w-48">{e.fn}</code>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(e.calledAt), 'HH:mm:ss.SSS')}
                </span>
                {e.durationMs !== undefined && (
                  <Badge variant="outline" className="text-xs ml-1">{e.durationMs}ms</Badge>
                )}
                {e.errorMessage && (
                  <span className="text-xs text-red-600 truncate flex-1 text-right" title={e.errorMessage}>
                    {e.errorMessage.slice(0, 80)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
      <p className="text-xs text-muted-foreground">{filtered.length} / {log.length} poster</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG PANEL TAB
// ─────────────────────────────────────────────────────────────────────────────

const DebugPanelTab = ({ log }: { log: InvokeLogEntry[] }) => {
  const errors = log.filter(e => e.status === 'error');
  const blocked = log.filter(e => e.status === 'blocked');
  const highRiskCalls = log.filter(e => {
    const def = FUNCTION_INVENTORY.find(f => f.function_name === e.fn);
    return def?.risk_level === 'high';
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className={cn('border', errors.length > 0 ? 'border-red-200 bg-red-50' : '')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className={cn('w-4 h-4', errors.length > 0 ? 'text-red-500' : 'text-muted-foreground')} />
              <p className="font-medium text-sm">Fel</p>
              <Badge variant={errors.length > 0 ? 'destructive' : 'outline'} className="ml-auto">{errors.length}</Badge>
            </div>
            {errors.length === 0 ? (
              <p className="text-xs text-muted-foreground">Inga fel denna session.</p>
            ) : (
              <div className="space-y-1">
                {errors.slice(0, 5).map(e => (
                  <div key={e.id} className="text-xs">
                    <code className="text-red-700">{e.fn}</code>
                    <p className="text-muted-foreground truncate" title={e.errorMessage}>{e.errorMessage}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn('border', blocked.length > 0 ? 'border-orange-200 bg-orange-50' : '')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Ban className={cn('w-4 h-4', blocked.length > 0 ? 'text-orange-500' : 'text-muted-foreground')} />
              <p className="font-medium text-sm">Blockerade triggers</p>
              <Badge variant={blocked.length > 0 ? 'outline' : 'outline'} className="ml-auto">{blocked.length}</Badge>
            </div>
            {blocked.length === 0 ? (
              <p className="text-xs text-muted-foreground">Inga AI-anrop försökte göras.</p>
            ) : (
              <div className="space-y-1">
                {blocked.slice(0, 5).map(e => (
                  <div key={e.id} className="text-xs">
                    <code className="text-orange-700">{e.fn}</code>
                    <span className="text-muted-foreground ml-2">{format(new Date(e.calledAt), 'HH:mm:ss')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn('border', highRiskCalls.length > 0 ? 'border-yellow-200 bg-yellow-50' : '')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={cn('w-4 h-4', highRiskCalls.length > 0 ? 'text-yellow-600' : 'text-muted-foreground')} />
              <p className="font-medium text-sm">Hög-risk anrop</p>
              <Badge variant="outline" className="ml-auto">{highRiskCalls.length}</Badge>
            </div>
            {highRiskCalls.length === 0 ? (
              <p className="text-xs text-muted-foreground">Inga hög-risk funktioner anropade.</p>
            ) : (
              <div className="space-y-1">
                {highRiskCalls.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center gap-1 text-xs">
                    {invokeStatusIcon(e.status)}
                    <code className="text-yellow-700">{e.fn}</code>
                    <span className="text-muted-foreground ml-auto">{format(new Date(e.calledAt), 'HH:mm:ss')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4" />
            Systemkonfiguration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {[
            { label: 'Global invoke-guard', value: 'safeInvoke (single entrypoint)', ok: true },
            { label: 'AI-isolation', value: 'APPROVED_FUNCTIONS allowlist only', ok: true },
            { label: 'run-full-scan (deterministisk)', value: 'AKTIV — ai_skipped: true', ok: true },
            { label: 'Invoke-logg (session)', value: `${log.length} poster`, ok: true },
            { label: 'Global monkey-patch', value: 'Borttagen — safeInvoke ansvarar', ok: true },
          ].map(({ label, value, ok }) => (
            <div key={label} className="flex items-center justify-between py-1 border-b last:border-0 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className={cn('font-mono text-xs', ok ? 'text-green-600' : 'text-red-600')}>{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const AdminSystemMonitor = () => {
  const [log, setLog] = useState<InvokeLogEntry[]>([]);

  const refresh = useCallback(() => setLog(getInvokeLog()), []);

  const handleClear = () => {
    clearInvokeLog();
    setLog([]);
    toast.success('Invoke-loggen rensad');
  };

  // Poll the in-memory log every 2 s
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            System Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fullständig synlighet — alla funktioner, anrop och systemstatus på ett ställe.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Uppdatera
        </Button>
      </div>

      <Separator />

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Översikt
          </TabsTrigger>
          <TabsTrigger value="functions" className="gap-1.5">
            <Database className="w-3.5 h-3.5" />
            Funktioner
          </TabsTrigger>
          <TabsTrigger value="scan" className="gap-1.5">
            <Radar className="w-3.5 h-3.5" />
            Skanning
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Bot className="w-3.5 h-3.5" />
            AI-kontroll
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" />
            Invoke-logg
          </TabsTrigger>
          <TabsTrigger value="debug" className="gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            Debug
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="overview"><OverviewTab log={log} /></TabsContent>
          <TabsContent value="functions"><FunctionsTab /></TabsContent>
          <TabsContent value="scan"><ScanControlTab log={log} /></TabsContent>
          <TabsContent value="ai"><AiControlTab log={log} /></TabsContent>
          <TabsContent value="automation"><AutomationControlTab log={log} /></TabsContent>
          <TabsContent value="logs"><FunctionLogsTab log={log} onClear={handleClear} /></TabsContent>
          <TabsContent value="debug"><DebugPanelTab log={log} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default AdminSystemMonitor;
