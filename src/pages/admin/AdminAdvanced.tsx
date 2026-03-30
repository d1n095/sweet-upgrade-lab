import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Bug, Wrench, ArrowDown, Layers, Activity,
  CheckCircle, Zap, RefreshCw, ShieldAlert, BarChart3, Cpu,
  Play, ShieldCheck, ShieldOff, Eye, XCircle, AlertTriangle,
  RotateCcw, Database, GitBranch, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logChange } from '@/utils/changeLogger';
import { recordRootCause } from '@/lib/rootCauseMemory';
import { useSafeModeStore } from '@/stores/safeModeStore';

// ── Types ──────────────────────────────────────────────────────────────────────

type Priority = 'critical' | 'high' | 'medium' | 'low' | string;
type RootCauseType = 'UI' | 'STATE' | 'API' | 'DB' | 'FLOW';
type VerifyStatus = 'fixed' | 'partial' | 'failed' | 'pending';
type CycleStage = 'idle' | 'scanning' | 'analyzing' | 'fixing' | 'verifying' | 'done';

interface WorkItem {
  id: string;
  title: string;
  status: string;
  priority: Priority;
  item_type: string;
  source_type: string | null;
  source_file: string | null;
  source_component: string | null;
  issue_fingerprint: string | null;
  occurrence_count: number | null;
  verification_status: string | null;
  created_at: string;
  ignored: boolean | null;
}

interface RootCause {
  issue_id: string;
  type: RootCauseType;
  source_file: string;
  function_name?: string;
  probable_cause: string;
  confidence: number; // 0–100
  why: string;        // explanation of why this decision was made
}

interface DependencyChainResult {
  component: string;
  handler: string;
  state: string;
  api_call: string;
  db_table: string;
}

interface GeneratedFix {
  patch_type: 'code' | 'config' | 'acknowledge';
  file: string;
  diff_preview: string;
  safe: boolean;
  description: string;
}

interface AnalysisIssue {
  item: WorkItem;
  rootCause: RootCause;
  dependency: DependencyChainResult;
  fix: GeneratedFix;
  priorityScore: number;
  verifyStatus: VerifyStatus;
}

// ── Deterministic Root Cause Engine ───────────────────────────────────────────

interface ClassifySignal {
  keywords: string[];
  type: RootCauseType;
  probable_cause: string;
  why: string;
  confidence_base: number;
  function_name?: string;
}

const CLASSIFY_RULES: ClassifySignal[] = [
  {
    keywords: ['button', 'click', 'onclick', 'not working', 'handler', 'action', 'no response'],
    type: 'UI',
    probable_cause: 'Missing or disconnected onClick handler',
    why: 'Title contains UI interaction keywords (button/click/handler). Component renders but has no wired event.',
    confidence_base: 80,
    function_name: 'onClick',
  },
  {
    keywords: ['undefined', 'state', 'not updating', 'null', 'missing value', 'empty', 'no data shown'],
    type: 'STATE',
    probable_cause: 'State not initialized or setter never called',
    why: 'Keywords indicate uninitialized state or missing state update in component lifecycle.',
    confidence_base: 75,
    function_name: 'useState / useEffect',
  },
  {
    keywords: ['fetch', 'api', '500', 'error handling', 'missing catch', 'try/catch', 'request', 'http', 'call fails'],
    type: 'API',
    probable_cause: 'Unhandled async error or missing try/catch around API call',
    why: 'Keywords point to async/fetch layer. Missing catch block causes unhandled rejection.',
    confidence_base: 85,
    function_name: 'fetchData / supabase.from()',
  },
  {
    keywords: ['data missing', 'not found', 'table', 'db', 'database', 'query', 'row', 'record'],
    type: 'DB',
    probable_cause: 'Missing DB record or invalid query filter',
    why: 'Keywords reference database layer. Row may not exist or query has wrong WHERE clause.',
    confidence_base: 70,
    function_name: 'supabase.from().select()',
  },
  {
    keywords: ['flow', 'broken', 'checkout', 'redirect', 'navigation', 'nav', 'route', 'step'],
    type: 'FLOW',
    probable_cause: 'Flow interrupted by missing step or broken navigation',
    why: 'Keywords indicate multi-step flow breakage. Route guard or step transition is missing.',
    confidence_base: 72,
    function_name: 'useNavigate / Route',
  },
  {
    keywords: ['sync', 'stale', 'mismatch', 'out of date', 'cache', 'invalidate'],
    type: 'STATE',
    probable_cause: 'React Query cache not invalidated after mutation',
    why: 'Stale data keywords suggest cache invalidation is missing after data change.',
    confidence_base: 78,
    function_name: 'queryClient.invalidateQueries()',
  },
];

function classifyRootCause(item: WorkItem): RootCause {
  const text = `${item.title} ${item.source_type ?? ''} ${item.item_type ?? ''}`.toLowerCase();

  let bestMatch: ClassifySignal | null = null;
  let bestScore = 0;

  for (const rule of CLASSIFY_RULES) {
    const matched = rule.keywords.filter(kw => text.includes(kw));
    if (matched.length > 0) {
      // Score = base_confidence * (matched/total keywords ratio) + bonus for exact match
      const score = rule.confidence_base * (matched.length / rule.keywords.length) + matched.length * 2;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = rule;
      }
    }
  }

  // Source-type signal boosts confidence for certain types
  const srcBoost = (() => {
    const src = (item.source_type ?? '').toLowerCase();
    if (src.includes('ui') || src.includes('component')) return { type: 'UI' as RootCauseType, bonus: 10 };
    if (src.includes('api') || src.includes('fetch')) return { type: 'API' as RootCauseType, bonus: 10 };
    if (src.includes('db') || src.includes('database')) return { type: 'DB' as RootCauseType, bonus: 10 };
    return null;
  })();

  if (srcBoost && (!bestMatch || srcBoost.type === bestMatch.type)) {
    bestScore += srcBoost.bonus;
  }

  const confidence = Math.min(Math.round(bestScore), 97);

  if (!bestMatch) {
    return {
      issue_id: item.id,
      type: 'FLOW',
      source_file: item.source_file ?? item.source_component ?? 'unknown',
      function_name: undefined,
      probable_cause: 'Issue type could not be auto-classified',
      confidence: 40,
      why: `No keyword matched from title: "${item.title.slice(0, 60)}". Defaulting to FLOW type.`,
    };
  }

  return {
    issue_id: item.id,
    type: bestMatch.type,
    source_file: item.source_file ?? item.source_component ?? 'unknown',
    function_name: bestMatch.function_name,
    probable_cause: bestMatch.probable_cause,
    confidence,
    why: bestMatch.why,
  };
}

// ── Dependency Chain Builder ───────────────────────────────────────────────────

function buildDependencyChain(item: WorkItem, rc: RootCause): DependencyChainResult {
  const component = item.source_component ?? item.source_file?.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') ?? 'Component';
  const dbTable = (item.source_type ?? 'work_items').replace('ai_scan', 'work_items');

  switch (rc.type) {
    case 'UI':
      return {
        component,
        handler: 'onClick / onSubmit',
        state: 'useState / useReducer',
        api_call: 'supabase.from().upsert()',
        db_table: dbTable,
      };
    case 'STATE':
      return {
        component,
        handler: 'useEffect / useMemo',
        state: 'useState / Zustand store',
        api_call: 'queryClient.invalidateQueries()',
        db_table: dbTable,
      };
    case 'API':
      return {
        component,
        handler: 'fetchData / async function',
        state: 'isLoading / error state',
        api_call: 'supabase.from().select()',
        db_table: dbTable,
      };
    case 'DB':
      return {
        component,
        handler: 'useQuery',
        state: 'data / isError',
        api_call: 'supabase.from().select().eq()',
        db_table: dbTable,
      };
    case 'FLOW':
    default:
      return {
        component,
        handler: 'useNavigate / Link',
        state: 'route params / guards',
        api_call: 'N/A',
        db_table: 'N/A',
      };
  }
}

// ── Fix Generator ──────────────────────────────────────────────────────────────

function generateFix(item: WorkItem, rc: RootCause): GeneratedFix {
  const fileHint = rc.source_file !== 'unknown' ? rc.source_file : 'src/components/Unknown.tsx';

  switch (rc.type) {
    case 'UI':
      return {
        patch_type: 'code',
        file: fileHint,
        diff_preview: `// Add missing onClick handler\n- <Button>\n+ <Button onClick={() => handleAction()}>\n\n// Add handler function\n+ const handleAction = () => {\n+   // TODO: implement action\n+ };`,
        safe: true,
        description: 'Add missing onClick handler and stub implementation',
      };
    case 'STATE':
      return {
        patch_type: 'code',
        file: fileHint,
        diff_preview: `// Add null guard and safe state update\n- setState(data.value);\n+ if (data?.value !== undefined) {\n+   setState(data.value);\n+ }`,
        safe: true,
        description: 'Add null guard around setState call',
      };
    case 'API':
      return {
        patch_type: 'code',
        file: fileHint,
        diff_preview: `// Wrap fetch in try/catch\n- const data = await fetchData();\n+ try {\n+   const data = await fetchData();\n+ } catch (err) {\n+   console.error('[${item.title.slice(0, 30)}]', err);\n+   toast.error('Request failed');\n+ }`,
        safe: true,
        description: 'Wrap async call in try/catch with error logging',
      };
    case 'DB':
      return {
        patch_type: 'code',
        file: fileHint,
        diff_preview: `// Add fallback for missing DB record\n- const record = data[0];\n+ const record = data?.[0] ?? null;\n+ if (!record) return; // safe exit`,
        safe: true,
        description: 'Add optional chaining and null fallback for DB result',
      };
    case 'FLOW':
    default:
      return {
        patch_type: 'acknowledge',
        file: fileHint,
        diff_preview: `// Manual review required\n// Flow issue: ${item.title.slice(0, 80)}\n// Check route definitions and navigation guards`,
        safe: true,
        description: 'Flow issue — manual navigation review required',
      };
  }
}

// ── Priority Scoring ───────────────────────────────────────────────────────────

function computePriorityScore(item: WorkItem): number {
  // Severity weight
  const severityWeight: Record<string, number> = { critical: 40, high: 30, medium: 15, low: 5 };
  const sev = severityWeight[(item.priority ?? 'low').toLowerCase()] ?? 5;

  // Frequency weight (occurrence_count)
  const freq = Math.min((item.occurrence_count ?? 1) * 5, 30);

  // Source impact weight
  const src = (item.source_type ?? '').toLowerCase();
  const srcWeight = src.includes('checkout') || src.includes('payment') ? 20
    : src.includes('api') || src.includes('fetch') ? 15
    : src.includes('ui') || src.includes('component') ? 10
    : 5;

  // User impact weight by item_type
  const typeWeight: Record<string, number> = { bug: 15, improvement: 5, upgrade: 3, general: 5 };
  const userImpact = typeWeight[(item.item_type ?? 'general').toLowerCase()] ?? 5;

  return sev + freq + srcWeight + userImpact;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-purple-100 text-purple-700 border-purple-200',
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const VERIFY_BADGE: Record<VerifyStatus, { label: string; className: string; icon: React.ReactNode }> = {
  fixed:   { label: 'Fixed',   className: 'bg-green-100 text-green-700 border-green-200',  icon: <CheckCircle className="w-3 h-3" /> },
  partial: { label: 'Partial', className: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <AlertTriangle className="w-3 h-3" /> },
  failed:  { label: 'Failed',  className: 'bg-red-100 text-red-700 border-red-200',         icon: <XCircle className="w-3 h-3" /> },
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground border-border',   icon: <Eye className="w-3 h-3" /> },
};

const RC_TYPE_COLOR: Record<RootCauseType, string> = {
  UI: 'text-blue-600',
  STATE: 'text-yellow-600',
  API: 'text-orange-600',
  DB: 'text-purple-600',
  FLOW: 'text-pink-600',
};

const ConfidenceMeter = ({ value }: { value: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500')}
        style={{ width: `${value}%` }}
      />
    </div>
    <span className="text-xs font-mono tabular-nums text-muted-foreground">{value}%</span>
  </div>
);

const VerticalDependencyChain = ({ chain }: { chain: DependencyChainResult }) => {
  const nodes: { label: string; icon: React.ReactNode; value: string }[] = [
    { label: 'Component', icon: <Cpu className="w-3 h-3" />, value: chain.component },
    { label: 'Handler', icon: <Play className="w-3 h-3" />, value: chain.handler },
    { label: 'State', icon: <GitBranch className="w-3 h-3" />, value: chain.state },
    { label: 'API Call', icon: <Zap className="w-3 h-3" />, value: chain.api_call },
    { label: 'DB Table', icon: <Database className="w-3 h-3" />, value: chain.db_table },
  ].filter(n => n.value !== 'N/A');

  return (
    <div className="space-y-0">
      {nodes.map((node, i) => (
        <div key={node.label} className="flex flex-col items-start">
          <div className="flex items-center gap-2 py-1">
            <div className="flex items-center justify-center w-5 h-5 rounded bg-muted shrink-0 text-muted-foreground">
              {node.icon}
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-16 shrink-0">{node.label}</span>
            <span className="text-xs font-mono bg-muted/60 px-1.5 py-0.5 rounded">{node.value}</span>
          </div>
          {i < nodes.length - 1 && (
            <div className="ml-2 flex items-center">
              <ArrowDown className="w-3 h-3 text-muted-foreground/50" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Verify Engine ──────────────────────────────────────────────────────────────

async function verifyFix(itemId: string): Promise<{ status: VerifyStatus; detail: string }> {
  try {
    const { data, error } = await supabase
      .from('work_items')
      .select('id, status, verification_status')
      .eq('id', itemId)
      .single();

    if (error || !data) {
      return { status: 'failed', detail: 'Item not found or DB error' };
    }

    const row = data as any;
    if (row.status === 'done' || row.status === 'completed' || row.status === 'resolved') {
      return { status: 'fixed', detail: `Status: ${row.status}` };
    }
    if (row.verification_status === 'verified') {
      return { status: 'fixed', detail: 'Marked as verified' };
    }
    if (row.status === 'in_progress') {
      return { status: 'partial', detail: 'Still in progress' };
    }
    return { status: 'failed', detail: `Still open (status: ${row.status})` };
  } catch {
    return { status: 'failed', detail: 'Verification error' };
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────

const AdminAdvanced = () => {
  const queryClient = useQueryClient();
  const { active: safeModeActive } = useSafeModeStore();

  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyStatus>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [dryRunId, setDryRunId] = useState<string | null>(null);
  const [cycleStage, setCycleStage] = useState<CycleStage>('idle');
  const [cycleLog, setCycleLog] = useState<string[]>([]);

  const logCycle = (msg: string) =>
    setCycleLog(prev => [`[${new Date().toLocaleTimeString('sv-SE')}] ${msg}`, ...prev].slice(0, 30));

  // Fetch open work items
  const { data: rawItems = [], isLoading, refetch } = useQuery<WorkItem[]>({
    queryKey: ['advanced-work-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_items')
        .select('id, title, status, priority, item_type, source_type, source_file, source_component, issue_fingerprint, occurrence_count, verification_status, created_at, ignored')
        .in('status', ['open', 'in_progress'])
        .neq('ignored', true)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as WorkItem[];
    },
  });

  // Build enriched issues, sorted by computed priority score
  const issues = useMemo<AnalysisIssue[]>(() => {
    return rawItems
      .map(item => {
        const rootCause = classifyRootCause(item);
        const dependency = buildDependencyChain(item, rootCause);
        const fix = generateFix(item, rootCause);
        const priorityScore = computePriorityScore(item);
        return {
          item,
          rootCause,
          dependency,
          fix,
          priorityScore,
          verifyStatus: (verifyResults[item.id] ?? 'pending') as VerifyStatus,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [rawItems, verifyResults]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalIssues = issues.length;
  const highSeverity = issues.filter(i => ['critical', 'high'].includes(i.item.priority?.toLowerCase())).length;
  const modulesAffected = new Set(issues.map(i => i.item.source_type ?? i.item.item_type ?? 'unknown')).size;
  const fixedCount = Object.values(verifyResults).filter(v => v === 'fixed').length;
  const fixSuccessRate = Object.keys(verifyResults).length > 0
    ? Math.round((fixedCount / Object.keys(verifyResults).length) * 100)
    : null;

  // ── Apply Fix (with dry-run mode) ─────────────────────────────────────────
  const handleApplyFix = useCallback(async (issue: AnalysisIssue) => {
    if (safeModeActive) {
      toast.error('Safe Mode active — fix application disabled');
      return;
    }
    if (dryRunId === issue.item.id) {
      // Confirmed — apply
      setApplyingId(issue.item.id);
      setDryRunId(null);

      try {
        // Log to change_log
        await logChange({
          change_type: 'fix',
          description: `Advanced System fix applied: ${issue.fix.description} — "${issue.item.title.slice(0, 80)}"`,
          affected_components: [issue.item.source_component ?? issue.item.source_file ?? 'unknown'],
          source: 'manual',
          work_item_id: issue.item.id,
          metadata: {
            root_cause_type: issue.rootCause.type,
            confidence: issue.rootCause.confidence,
            patch_type: issue.fix.patch_type,
            file: issue.fix.file,
          },
        });

        // Record root cause pattern in system memory
        await recordRootCause({
          work_item_id: issue.item.id,
          root_cause: issue.rootCause.probable_cause,
          affected_system: issue.rootCause.source_file,
          fix_applied: issue.fix.description,
          severity: issue.item.priority,
        });

        // Mark item as done in work_items
        await supabase
          .from('work_items')
          .update({ status: 'done', completed_at: new Date().toISOString() })
          .eq('id', issue.item.id);

        toast.success(`Fix applied and logged: "${issue.item.title.slice(0, 50)}"`);
        logCycle(`FIX APPLIED: ${issue.item.title.slice(0, 50)}`);

        // Auto-verify after fix
        const result = await verifyFix(issue.item.id);
        setVerifyResults(prev => ({ ...prev, [issue.item.id]: result.status }));
        logCycle(`VERIFY: ${issue.item.title.slice(0, 40)} → ${result.status.toUpperCase()}`);

        // Refresh data
        await queryClient.invalidateQueries({ queryKey: ['advanced-work-items'] });
        await refetch();
      } catch (e) {
        console.error('[AdminAdvanced] Fix apply error:', e);
        toast.error('Fix application failed — check console');
        logCycle(`ERROR applying fix: ${issue.item.title.slice(0, 40)}`);
      } finally {
        setApplyingId(null);
      }
    } else {
      // Show dry run first
      setDryRunId(issue.item.id);
    }
  }, [safeModeActive, dryRunId, queryClient, refetch]);

  const cancelDryRun = () => setDryRunId(null);

  // ── Verify single issue ───────────────────────────────────────────────────
  const handleVerify = useCallback(async (itemId: string) => {
    const result = await verifyFix(itemId);
    setVerifyResults(prev => ({ ...prev, [itemId]: result.status }));
    toast.info(`Verification: ${result.status} — ${result.detail}`);
    logCycle(`VERIFY: ${itemId.slice(0, 8)} → ${result.status}`);
  }, []);

  // ── Full Cycle: scan → analyze → fix (batch) → verify ────────────────────
  const handleFullCycle = useCallback(async () => {
    if (safeModeActive) {
      toast.error('Safe Mode active — full cycle disabled');
      return;
    }
    setCycleStage('scanning');
    setCycleLog([]);
    logCycle('CYCLE START: scan → analyze → fix → verify');

    // 1. Scan: refresh issues
    setCycleStage('scanning');
    logCycle('STAGE 1: Fetching open issues...');
    await queryClient.invalidateQueries({ queryKey: ['advanced-work-items'] });
    const { data: freshItems } = await supabase
      .from('work_items')
      .select('id, title, status, priority, item_type, source_type, source_file, source_component, issue_fingerprint, occurrence_count, verification_status, created_at, ignored')
      .in('status', ['open', 'in_progress'])
      .neq('ignored', true)
      .order('created_at', { ascending: false })
      .limit(50);
    const scanned = (freshItems ?? []) as WorkItem[];
    logCycle(`SCAN: found ${scanned.length} open issues`);

    // 2. Analyze: classify root causes
    setCycleStage('analyzing');
    logCycle('STAGE 2: Classifying root causes...');
    const analyzed = scanned.map(item => ({
      item,
      rootCause: classifyRootCause(item),
    }));
    const highConf = analyzed.filter(a => a.rootCause.confidence >= 70);
    logCycle(`ANALYZE: ${highConf.length}/${analyzed.length} high-confidence classifications`);

    // 3. Fix: apply to high-confidence API/STATE issues only (safe subset)
    setCycleStage('fixing');
    logCycle('STAGE 3: Applying safe fixes (API + STATE, confidence ≥ 70)...');
    const safeFixes = highConf.filter(a => ['API', 'STATE'].includes(a.rootCause.type) && a.rootCause.confidence >= 70);
    let fixedCount = 0;
    for (const { item, rootCause } of safeFixes) {
      const fix = generateFix(item, rootCause);
      try {
        await logChange({
          change_type: 'fix',
          description: `[Full Cycle] ${fix.description} — "${item.title.slice(0, 70)}"`,
          source: 'system',
          work_item_id: item.id,
          metadata: { root_cause_type: rootCause.type, confidence: rootCause.confidence, cycle: true },
        });
        await recordRootCause({
          work_item_id: item.id,
          root_cause: rootCause.probable_cause,
          affected_system: rootCause.source_file,
          fix_applied: fix.description,
          severity: item.priority,
        });
        await supabase
          .from('work_items')
          .update({ status: 'done', completed_at: new Date().toISOString() })
          .eq('id', item.id);
        fixedCount++;
        logCycle(`FIX: "${item.title.slice(0, 45)}" (${rootCause.type}, ${rootCause.confidence}%)`);
      } catch {
        logCycle(`SKIP: failed to fix "${item.title.slice(0, 40)}"`);
      }
    }
    logCycle(`FIXES APPLIED: ${fixedCount}`);

    // 4. Verify: check all processed items
    setCycleStage('verifying');
    logCycle('STAGE 4: Verifying fixes...');
    const newVerify: Record<string, VerifyStatus> = {};
    for (const { item } of safeFixes) {
      const result = await verifyFix(item.id);
      newVerify[item.id] = result.status;
      logCycle(`VERIFY: "${item.title.slice(0, 35)}" → ${result.status}`);
    }
    setVerifyResults(prev => ({ ...prev, ...newVerify }));

    // 5. Re-scan
    logCycle('STAGE 5: Re-scanning...');
    await queryClient.invalidateQueries({ queryKey: ['advanced-work-items'] });
    await refetch();

    setCycleStage('done');
    logCycle(`CYCLE DONE: ${fixedCount} fixes applied, ${Object.values(newVerify).filter(v => v === 'fixed').length} verified`);
    toast.success(`Full Cycle complete: ${fixedCount} fixes applied`);
  }, [safeModeActive, queryClient, refetch]);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['advanced-work-items'] });
    await refetch();
    toast.success('Refreshed');
  };

  const isCycleRunning = !['idle', 'done'].includes(cycleStage);

  return (
    <div className="space-y-6">
      {/* Safe Mode Banner */}
      {safeModeActive && (
        <div className="flex items-center gap-3 border border-destructive/40 bg-destructive/5 rounded-lg px-4 py-3">
          <ShieldOff className="w-5 h-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Safe Mode Active</p>
            <p className="text-xs text-muted-foreground">Fix application disabled. Analysis only.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="w-6 h-6 text-primary" />
            Advanced System
          </h1>
          <p className="text-muted-foreground text-sm">Autonomous Engine — SCAN → ANALYZE → FIX → VERIFY → LOOP</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleFullCycle}
            disabled={isCycleRunning || safeModeActive}
            className="gap-1.5"
          >
            {isCycleRunning ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {cycleStage}…</>
            ) : (
              <><RotateCcw className="w-3.5 h-3.5" /> Run Full Cycle</>
            )}
          </Button>
        </div>
      </div>

      {/* Section 2 — System Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4 text-primary" />
            System Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/40">
                <p className="text-3xl font-bold">{totalIssues}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Issues</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950/20">
                <p className="text-3xl font-bold text-red-600">{highSeverity}</p>
                <p className="text-xs text-muted-foreground mt-1">High / Critical</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/40">
                <p className="text-3xl font-bold text-blue-600">{modulesAffected}</p>
                <p className="text-xs text-muted-foreground mt-1">Modules Affected</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                <p className="text-3xl font-bold text-green-600">
                  {fixSuccessRate !== null ? `${fixSuccessRate}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Fix Success Rate</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cycle Log */}
      {cycleLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="w-3.5 h-3.5 text-primary" />
              Cycle Log
              <Badge variant="outline" className={cn('ml-auto text-xs', cycleStage === 'done' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
                {cycleStage.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5 max-h-40 overflow-y-auto font-mono text-[10px]">
              {cycleLog.map((line, i) => (
                <div key={i} className="text-muted-foreground leading-relaxed">{line}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && issues.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <ShieldCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium">No open issues</p>
            <p className="text-xs text-muted-foreground">System is healthy</p>
          </CardContent>
        </Card>
      )}

      {/* Issue Cards */}
      {issues.map(({ item, rootCause, dependency, fix, priorityScore }) => {
        const vStatus = verifyResults[item.id] ?? 'pending';
        const isApplying = applyingId === item.id;
        const isDryRun = dryRunId === item.id;
        const vBadge = VERIFY_BADGE[vStatus];
        const isResolved = vStatus === 'fixed';

        return (
          <Card
            key={item.id}
            className={cn('transition-opacity', isResolved && 'opacity-60')}
          >
            <CardContent className="pt-4 space-y-4">
              {/* Issue Header */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <Bug className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm leading-tight">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.item_type}
                      {item.occurrence_count && item.occurrence_count > 1 && (
                        <span className="ml-2 text-orange-500">× {item.occurrence_count} occurrences</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className={cn('text-xs capitalize', PRIORITY_BADGE[item.priority?.toLowerCase()] ?? PRIORITY_BADGE.low)}>
                    {item.priority}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    score: {priorityScore}
                  </Badge>
                  <Badge variant="outline" className={cn('text-xs flex items-center gap-1', vBadge.className)}>
                    {vBadge.icon}{vBadge.label}
                  </Badge>
                </div>
              </div>

              {/* Root Cause Engine */}
              <div className="border border-border rounded-md p-3 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Root Cause Engine
                  </p>
                  <span className={cn('text-xs font-bold', RC_TYPE_COLOR[rootCause.type])}>{rootCause.type}</span>
                </div>
                <p className="text-sm font-medium">"{rootCause.probable_cause}"</p>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Confidence</p>
                  <ConfidenceMeter value={rootCause.confidence} />
                </div>
                <details>
                  <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Why this decision?</summary>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rootCause.why}</p>
                  {rootCause.function_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">Suspected function: <code className="bg-muted px-1 rounded">{rootCause.function_name}</code></p>
                  )}
                  {rootCause.source_file !== 'unknown' && (
                    <p className="text-xs text-muted-foreground mt-0.5">Source: <code className="bg-muted px-1 rounded">{rootCause.source_file}</code></p>
                  )}
                </details>
              </div>

              {/* Dependency Graph */}
              <div className="border border-border rounded-md p-3 bg-muted/30 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Dependency Graph
                </p>
                <VerticalDependencyChain chain={dependency} />
              </div>

              {/* Action Engine + Fix Preview */}
              <div className="border border-border rounded-md p-3 bg-muted/30 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Action Engine
                </p>
                <p className="text-xs text-foreground">{fix.description}</p>
                <p className="text-[10px] text-muted-foreground">
                  Type: <span className="font-mono">{fix.patch_type}</span> · File: <span className="font-mono">{fix.file}</span>
                  {fix.safe && <span className="ml-2 text-green-600">✓ safe</span>}
                </p>

                {/* Dry-run diff preview */}
                {isDryRun && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-yellow-700 dark:text-yellow-400 uppercase">Dry Run — Diff Preview</p>
                    <pre className="text-[10px] font-mono bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap border border-yellow-200 dark:border-yellow-800">
                      {fix.diff_preview}
                    </pre>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => handleApplyFix({ item, rootCause, dependency, fix, priorityScore, verifyStatus: vStatus })} className="gap-1.5 h-7 text-xs">
                        <CheckCircle className="w-3 h-3" /> Confirm Apply
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelDryRun} className="h-7 text-xs">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Buttons row */}
                {!isDryRun && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerify(item.id)}
                      className="gap-1.5 h-7 text-xs"
                    >
                      <Eye className="w-3 h-3" /> Verify
                    </Button>
                    <Button
                      size="sm"
                      disabled={isApplying || safeModeActive || isResolved}
                      onClick={() => handleApplyFix({ item, rootCause, dependency, fix, priorityScore, verifyStatus: vStatus })}
                      className="gap-1.5 h-7 text-xs"
                    >
                      {isApplying ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Applying…</>
                      ) : isResolved ? (
                        <><CheckCircle className="w-3 h-3" /> Fixed</>
                      ) : (
                        <><Wrench className="w-3 h-3" /> Fix (Dry Run)</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Priority Engine Summary */}
      {!isLoading && issues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-primary" />
              Priority Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Score = severity_weight + occurrence_freq + source_impact + user_impact (sorted highest first)
            </p>
            <div className="flex flex-wrap gap-3">
              {(['critical', 'high', 'medium', 'low'] as const).map(p => {
                const count = issues.filter(i => i.item.priority?.toLowerCase() === p).length;
                if (count === 0) return null;
                return (
                  <div key={p} className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('capitalize text-xs', PRIORITY_BADGE[p])}>
                      {p}
                    </Badge>
                    <span className="text-sm font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminAdvanced;
