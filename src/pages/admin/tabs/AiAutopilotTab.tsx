import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, Lightbulb, CheckCircle, XCircle, Shield, Clock, Zap, Radar, ArrowRight, Layers, Monitor, Eye, Compass, GitMerge, ArrowRightLeft, ShieldCheck, Play, Settings2, Gavel, User, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useScannerStore, SCAN_STEPS } from '@/stores/scannerStore';
import type { ScanStepResult } from '@/stores/scannerStore';
import { useFullScanOrchestrator, filterRelevantIssues } from '@/stores/fullScanOrchestrator';
import { callAI, useDetailContext } from './_shared';

type AiMode = 'manual' | 'assisted' | 'autonomous';

interface ExecutionAction {
  action_type: string;
  target_id: string;
  target_title?: string;
  description: string;
  auto_executable: boolean;
  new_value?: string;
  reason?: string;
}

interface ExecutionResult {
  summary: string;
  total_actions: number;
  auto_executed: number;
  needs_approval: number;
  actions: ExecutionAction[];
  duplicates: { ids: string[]; reason: string; suggested_action: string }[];
  health_summary: string;
  mode: string;
  execution_log: { action: string; target: string; success: boolean; description: string }[];
  executed_count: number;
}

// SCAN_STEPS and ScanStepResult imported from @/stores/scannerStore
// Icon mapping for scan steps (icons can't be stored in zustand)
const SCAN_STEP_ICONS: Record<string, any> = {
  system_scan: Radar,
  data_integrity: ShieldCheck,
  content_validation: Eye,
  sync_scan: ArrowRightLeft,
  interaction_qa: Zap,
  visual_qa: Monitor,
  nav_scan: Compass,
  ux_scan: Eye,
  human_test: User,
  action_governor: Gavel,
};


export const AiAutopilotTab = () => {
  const [mode, setMode] = useState<AiMode>('assisted');
  const { scanning, steps, selectedSteps, toggleStep: storeToggleStep, selectAll, selectNone, runAllScans } = useScannerStore();
  const orchestrator = useFullScanOrchestrator();
  const [scanMode, setScanMode] = useState<'orchestrated' | 'custom'>('orchestrated');
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [showResults, setShowResults] = useState<string | null>(null);
  const [showUnifiedDetail, setShowUnifiedDetail] = useState(false);
  const queryClient = useQueryClient();
  const { openDetail } = useDetailContext();

  // Load latest scan run on mount (restores progress if user navigated away)
  useEffect(() => {
    orchestrator.loadLatestScanRun();
    return () => orchestrator.stopPolling();
  }, []);

  // Invalidate queries when scanning finishes
  useEffect(() => {
    if (!scanning && steps.length > 0 && steps.every(s => s.status === 'done' || s.status === 'error')) {
      queryClient.invalidateQueries({ queryKey: ['autopilot-scan-runs'] });
      queryClient.invalidateQueries({ queryKey: ['last-scan-result'] });
      queryClient.invalidateQueries({ queryKey: ['scan-history'] });
    }
  }, [scanning, steps]);

  // Load past full-scan runs
  const { data: scanRuns = [] } = useQuery({
    queryKey: ['autopilot-scan-runs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_scan_results' as any)
        .select('id, scan_type, overall_score, overall_status, executive_summary, issues_count, tasks_created, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
  });

  const toggleStep = storeToggleStep;

  const runExecution = async () => {
    setExecutionLoading(true);
    const res = await callAI('ai_execute', { mode });
    if (res) {
      setExecutionResult(res);
      if (res.executed_count > 0) {
        toast.success(`AI utförde ${res.executed_count} åtgärder`);
        queryClient.invalidateQueries({ queryKey: ['work-items'] });
      }
    }
    setExecutionLoading(false);
  };

  const modeConfig = {
    manual: { label: 'Manuell', desc: 'AI föreslår — du utför', color: 'border-blue-500 bg-blue-50 text-blue-800' },
    assisted: { label: 'Assisterad', desc: 'AI utför säkra åtgärder automatiskt', color: 'border-yellow-500 bg-yellow-50 text-yellow-800' },
    autonomous: { label: 'Autonom', desc: 'AI utför allt utom raderingar', color: 'border-red-500 bg-red-50 text-red-800' },
  };

  const isAnyScanRunning = scanning || orchestrator.running;

  // Custom scan stats
  const completedCount = steps.filter(s => s.status === 'done').length;
  const errorCount = steps.filter(s => s.status === 'error').length;
  const totalIssues = steps.reduce((sum, s) => {
    if (!s.result) return sum;
    return sum + (s.result.issues_found || s.result.issues?.length || s.result.dead_elements?.length || s.result.mismatches?.length || 0);
  }, 0);
  const totalTasks = steps.reduce((sum, s) => sum + (s.result?.tasks_created || 0), 0);
  const avgScore = (() => {
    const scores = steps.filter(s => s.result).map(s => s.result.system_score || s.result.score || s.result.interaction_score || s.result.overall_score).filter(Boolean);
    return scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
  })();

  // Orchestrator stats
  const orchCompleted = orchestrator.steps.filter(s => s.status === 'done').length;
  const orchErrors = orchestrator.steps.filter(s => s.status === 'error').length;
  const orchPct = orchestrator.steps.length > 0 ? Math.round(((orchCompleted + orchErrors) / orchestrator.steps.length) * 100) : 0;
  const orchCurrentStep = orchestrator.steps.find(s => s.status === 'running');

  return (
    <div className="space-y-4">
      {/* Scan Mode Toggle */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radar className="w-4 h-4 text-primary" /> Systemskanning
            </CardTitle>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              <button onClick={() => setScanMode('orchestrated')} className={cn('px-2 py-1 rounded text-[10px] font-medium transition-colors', scanMode === 'orchestrated' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>Full scan</button>
              <button onClick={() => setScanMode('custom')} className={cn('px-2 py-1 rounded text-[10px] font-medium transition-colors', scanMode === 'custom' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>Anpassad</button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {scanMode === 'orchestrated' ? (
            <>
               <p className="text-[10px] text-muted-foreground">Adaptiv rekursiv skanning — lär sig mönster och djupskannar högriskområden (max 3 iterationer). Körs på servern.</p>
               <Button onClick={() => orchestrator.runOrchestrated(queryClient)} disabled={isAnyScanRunning} className="w-full gap-2" size="lg">
                 {orchestrator.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                 {orchestrator.running
                   ? `${orchestrator.currentStepLabel || orchCurrentStep?.progressLabel || 'Kör...'}`
                   : 'Kör Adaptiv Full Scan'}
               </Button>
               {orchestrator.running && orchestrator.steps.length > 0 && (
                 <div className="space-y-1.5">
                   <div className="flex items-center justify-between text-xs">
                     <span className="text-muted-foreground truncate max-w-[60%]">{orchestrator.currentStepLabel || orchCurrentStep?.progressLabel || 'Väntar...'}</span>
                     <span className="font-bold text-primary">{orchPct}%</span>
                   </div>
                   <Progress value={orchPct} className="h-2.5" />
                   <p className="text-[10px] text-muted-foreground text-center">
                     Iteration {orchestrator.currentIteration}/3 — {orchCompleted + orchErrors} av {orchestrator.steps.length} klara 🖥️
                   </p>
                 </div>
               )}
            </>
          ) : (
            <>
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={selectAll}>Alla</Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={selectNone}>Ingen</Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {SCAN_STEPS.map(step => {
                  const active = selectedSteps.has(step.type);
                  const Icon = SCAN_STEP_ICONS[step.type] || Radar;
                  return (
                    <button key={step.type} onClick={() => !scanning && toggleStep(step.type)} className={cn('border rounded-lg p-2 text-left transition-all text-xs', active ? 'border-primary bg-primary/5' : 'border-border opacity-50', scanning && 'pointer-events-none')}>
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3 shrink-0" />
                        <span className="font-medium text-[10px] truncate">{step.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button onClick={() => runAllScans(queryClient)} disabled={isAnyScanRunning || selectedSteps.size === 0} className="w-full gap-2" size="lg">
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {scanning ? `Skannar... (${completedCount + errorCount}/${steps.length})` : `Kör ${selectedSteps.size} skanningar`}
              </Button>
              {scanning && steps.length > 0 && (() => {
                const pct = Math.round(((completedCount + errorCount) / steps.length) * 100);
                const currentStep = steps.find(s => s.status === 'running');
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[60%]">{currentStep ? `Kör: ${currentStep.label}` : 'Väntar...'}</span>
                      <span className="font-bold text-primary">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2.5" />
                  </div>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>

      {/* Orchestrated scan results */}
      {orchestrator.steps.length > 0 && scanMode === 'orchestrated' && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Orkestreringsresultat</CardTitle>
                {orchestrator.unifiedResult?.system_stage && (
                  <Badge variant={orchestrator.unifiedResult.system_stage === 'production' ? 'destructive' : 'secondary'} className="text-[9px] uppercase tracking-wider">
                    {orchestrator.unifiedResult.system_stage === 'production' ? '🟢 Production' : orchestrator.unifiedResult.system_stage === 'staging' ? '🟡 Staging' : '🔧 Development'}
                  </Badge>
                )}
              </div>
              {orchestrator.unifiedResult && (
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2',
                  orchestrator.unifiedResult.system_health_score >= 70 ? 'border-green-500 text-green-700' : orchestrator.unifiedResult.system_health_score >= 40 ? 'border-yellow-500 text-yellow-700' : 'border-red-500 text-red-700'
                )}>
                  {orchestrator.unifiedResult.system_health_score}
                </div>
              )}
            </div>
            {orchestrator.unifiedResult && (() => {
              const r = orchestrator.unifiedResult;
              const brokenFlows = filterRelevantIssues(r.broken_flows);
              const dataIssues = filterRelevantIssues(r.data_issues);
              const interactionFails = filterRelevantIssues(r.interaction_failures);
              const integrityIssues = filterRelevantIssues(r.integrity_issues || []);
              const behaviorFails = filterRelevantIssues(r.behavior_failures || []);
              const devSuppressed = r.data_issues.length - dataIssues.length + r.broken_flows.length - brokenFlows.length;

              return (
                <div className="flex gap-3 text-[10px] text-muted-foreground mt-1 flex-wrap">
                  <span>✅ {orchCompleted} klara</span>
                  {orchErrors > 0 && <span>❌ {orchErrors} fel</span>}
                  <span>🔴 {brokenFlows.length} broken flows</span>
                  <span>👻 {r.fake_features.length} fake features</span>
                  <span>⚡ {interactionFails.length} interaction fails</span>
                  <span>📊 {dataIssues.length} data issues</span>
                  {integrityIssues.length > 0 && (
                    <span>🛡️ {integrityIssues.length} integrity issues</span>
                  )}
                  {behaviorFails.length > 0 && (
                    <span>⚡ {behaviorFails.length} behavior fails</span>
                  )}
                  {devSuppressed > 0 && (
                    <span className="text-muted-foreground/50">🔇 {devSuppressed} dev-förväntade</span>
                  )}
                </div>
              );
            })()}
            {/* Adaptive scan metadata */}
            {orchestrator.unifiedResult?.adaptive_scan && (
              <div className="mt-2 p-2 rounded-lg bg-muted/40 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-semibold">Adaptiv skanning</span>
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground flex-wrap">
                  <span>🔄 {orchestrator.unifiedResult.adaptive_scan.iterations} iterationer</span>
                  <span>🔍 {orchestrator.unifiedResult.adaptive_scan.new_issues_found} nya problem</span>
                  <span>🧠 {orchestrator.unifiedResult.adaptive_scan.pattern_discoveries.length} mönster</span>
                  <span>🔗 {orchestrator.unifiedResult.adaptive_scan.systemic_issues?.length || 0} systemiska</span>
                  <span>⚠️ {orchestrator.unifiedResult.adaptive_scan.high_risk_areas.length} högrisk</span>
                  <span>📈 {orchestrator.unifiedResult.adaptive_scan.coverage_score}% täckning</span>
                  {(orchestrator.unifiedResult.adaptive_scan.predictions?.length || 0) > 0 && (
                    <span>🔮 {orchestrator.unifiedResult.adaptive_scan.predictions!.length} förutsägelser</span>
                  )}
                </div>
                {/* Systemic issues — cross-pattern detection */}
                {(orchestrator.unifiedResult.adaptive_scan.systemic_issues?.length || 0) > 0 && (
                  <div className="mt-2 space-y-1">
                    <span className="text-[9px] font-semibold text-destructive flex items-center gap-1">
                      <GitMerge className="w-3 h-3" /> Systemiska problem (korsmönster):
                    </span>
                    {orchestrator.unifiedResult.adaptive_scan.systemic_issues!.slice(0, 6).map((si: any, i: number) => (
                      <div key={i} className="p-1.5 rounded border border-destructive/20 bg-destructive/5">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="destructive" className="text-[8px] h-4 px-1">{si.severity}</Badge>
                          <span className="text-[10px] font-medium">{si.label}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-0.5 ml-1">{si.description}</p>
                        {si.examples?.length > 0 && (
                          <div className="text-[8px] text-muted-foreground mt-0.5 ml-1 italic">
                            Ex: {si.examples.slice(0, 2).join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {orchestrator.unifiedResult.adaptive_scan.high_risk_areas.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    <span className="text-[9px] font-medium text-destructive">Högriskområden:</span>
                    {orchestrator.unifiedResult.adaptive_scan.high_risk_areas.slice(0, 5).map((area: any, i: number) => (
                      <div key={i} className="text-[9px] text-muted-foreground ml-2">
                        • {area.component} ({area.issue_count} problem, {area.risk_level})
                      </div>
                    ))}
                  </div>
                )}
                {/* Focus Memory — learned hotspots */}
                {(orchestrator.unifiedResult.adaptive_scan.focus_memory?.length || 0) > 0 && (
                  <div className="mt-2 space-y-1">
                    <span className="text-[9px] font-semibold text-primary flex items-center gap-1">
                      <Brain className="w-3 h-3" /> Fokusminne (inlärda hotspots):
                    </span>
                    {orchestrator.unifiedResult.adaptive_scan.focus_memory!.slice(0, 8).map((fm: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-[9px] text-muted-foreground ml-2">
                        <Badge variant={fm.severity === 'critical' ? 'destructive' : 'secondary'} className="text-[7px] h-3.5 px-1">
                          {fm.focus_type}
                        </Badge>
                        <span className="font-medium">{fm.label}</span>
                        <span className="text-muted-foreground/60">({fm.issue_count} problem i {fm.scan_count} skanningar)</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Predictive Issue Detection */}
                {(orchestrator.unifiedResult.adaptive_scan.predictions?.length || 0) > 0 && (
                  <div className="mt-2 space-y-1">
                    <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" /> Förutsägda problem:
                    </span>
                    {orchestrator.unifiedResult.adaptive_scan.predictions!.map((pred: any, i: number) => (
                      <div key={i} className="p-1.5 rounded border border-amber-500/20 bg-amber-500/5">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[7px] h-3.5 px-1 border-amber-500/40 text-amber-700 dark:text-amber-300">
                            {pred.confidence}% konfidens
                          </Badge>
                          <span className="text-[10px] font-medium">{pred.problem}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-0.5 ml-1">
                          <span className="font-medium">Område:</span> {pred.area}
                        </p>
                        <p className="text-[8px] text-muted-foreground/70 mt-0.5 ml-1 italic">{pred.reason}</p>
                        {pred.preventive_fixes?.length > 0 && (
                          <div className="mt-1 ml-1 space-y-0.5">
                            <span className="text-[8px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5" /> Förebyggande åtgärder:
                            </span>
                            {pred.preventive_fixes.map((fix: string, fi: number) => (
                              <div key={fi} className="text-[8px] text-muted-foreground ml-2 flex items-start gap-1">
                                <span className="text-emerald-500 mt-px">→</span>
                                <span>{fix}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {/* Unified blocker highlight */}
            {orchestrator.unifiedResult?.blocker && (
              <div className="mb-3 p-3 rounded-lg border-2 border-destructive/40 bg-destructive/5">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-xs font-bold text-destructive">BLOCKER</span>
                </div>
                <p className="text-xs font-medium">{orchestrator.unifiedResult.blocker.title || orchestrator.unifiedResult.blocker.stage || 'Kritiskt problem'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{orchestrator.unifiedResult.blocker.description || orchestrator.unifiedResult.blocker.root_cause || ''}</p>
              </div>
            )}

            {/* Step-by-step results */}
            <div className="space-y-1.5">
              {orchestrator.steps.map((step, i) => {
                const score = step.result?.overall_score || step.result?.system_score || step.result?.score || step.result?.health_score;
                return (
                  <div key={step.id}>
                    <div className={cn(
                      'flex items-center gap-2 p-2 rounded-lg transition-colors',
                      step.status === 'running' && 'bg-primary/5 border border-primary/20',
                      step.status === 'done' && 'bg-muted/30 cursor-pointer hover:bg-muted/50',
                      step.status === 'error' && 'bg-destructive/5',
                    )} onClick={() => step.status === 'done' && setShowResults(showResults === step.id ? null : step.id)}>
                      {step.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 shrink-0" />}
                      {step.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                      {step.status === 'done' && <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />}
                      {step.status === 'error' && <XCircle className="w-4 h-4 text-destructive shrink-0" />}

                      <span className="text-[10px] text-muted-foreground shrink-0 w-4">{i + 1}</span>
                      <span className={cn('text-xs font-medium flex-1', step.status === 'pending' && 'text-muted-foreground')}>{step.label}</span>

                      {step.duration_ms != null && <span className="text-[9px] text-muted-foreground">{(step.duration_ms / 1000).toFixed(1)}s</span>}
                      {score != null && <span className={cn('text-[10px] font-bold', score >= 70 ? 'text-green-700' : score >= 40 ? 'text-yellow-700' : 'text-red-700')}>{score}</span>}
                      {step.error && <span className="text-[9px] text-destructive truncate max-w-[100px]">{step.error}</span>}
                      {step.status === 'done' && <ArrowRight className={cn('w-3 h-3 text-muted-foreground transition-transform', showResults === step.id && 'rotate-90')} />}
                    </div>

                    {showResults === step.id && step.result && (
                      <div className="ml-8 mt-1 mb-2 border rounded-lg p-3 bg-card space-y-2 text-xs">
                        {(step.result.executive_summary || step.result.summary) && (
                          <p className="text-muted-foreground">{step.result.executive_summary || (typeof step.result.summary === 'string' ? step.result.summary : '')}</p>
                        )}
                        {(step.result.issues || step.result.dead_elements || step.result.mismatches || step.result.critical_issues)?.slice(0, 5).map((issue: any, j: number) => (
                          <div key={j} className="flex items-start gap-2 p-1.5 rounded bg-muted/30">
                            <AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium">{issue.title || issue.element || issue.field || 'Issue'}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{issue.description || issue.issue || issue.detail || ''}</p>
                            </div>
                          </div>
                        ))}
                        {step.result.tasks_created > 0 && <Badge variant="default" className="bg-green-600 text-[9px]">{step.result.tasks_created} uppgifter skapade</Badge>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total duration */}
            {orchestrator.unifiedResult && (
              <div className="mt-3 pt-2 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Total tid: {(orchestrator.unifiedResult.total_duration_ms / 1000).toFixed(1)}s</span>
                <span>Klar: {new Date(orchestrator.unifiedResult.completed_at).toLocaleTimeString('sv-SE')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Custom scan results (existing) */}
      {steps.length > 0 && scanMode === 'custom' && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Skanningsresultat</CardTitle>
              {avgScore !== null && (
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2',
                  avgScore >= 70 ? 'border-green-500 text-green-700' : avgScore >= 40 ? 'border-yellow-500 text-yellow-700' : 'border-red-500 text-red-700'
                )}>
                  {avgScore}
                </div>
              )}
            </div>
            {(completedCount > 0 || errorCount > 0) && (
              <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                <span>✅ {completedCount} klara</span>
                {errorCount > 0 && <span>❌ {errorCount} fel</span>}
                <span>🔍 {totalIssues} issues</span>
                <span>📋 {totalTasks} uppgifter skapade</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {steps.map((step, i) => {
                const stepConfig = SCAN_STEPS.find(s => s.type === step.type);
                const Icon = SCAN_STEP_ICONS[step.type] || Radar;
                const score = step.result?.system_score || step.result?.score || step.result?.interaction_score || step.result?.overall_score;
                return (
                  <div key={step.type}>
                    <div className={cn(
                      'flex items-center gap-2 p-2 rounded-lg transition-colors',
                      step.status === 'running' && 'bg-primary/5 border border-primary/20',
                      step.status === 'done' && 'bg-muted/30 cursor-pointer hover:bg-muted/50',
                      step.status === 'error' && 'bg-destructive/5',
                    )} onClick={() => step.status === 'done' && setShowResults(showResults === step.type ? null : step.type)}>
                      {step.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 shrink-0" />}
                      {step.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                      {step.status === 'done' && <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />}
                      {step.status === 'error' && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className={cn('text-xs font-medium flex-1', step.status === 'pending' && 'text-muted-foreground')}>{step.label}</span>
                      {step.duration_ms != null && <span className="text-[9px] text-muted-foreground">{(step.duration_ms / 1000).toFixed(1)}s</span>}
                      {score != null && <span className={cn('text-[10px] font-bold', score >= 70 ? 'text-green-700' : score >= 40 ? 'text-yellow-700' : 'text-red-700')}>{score}</span>}
                      {step.result && <span className="text-[9px] text-muted-foreground">{step.result.issues_found || step.result.issues?.length || step.result.dead_elements?.length || step.result.mismatches?.length || 0} issues</span>}
                      {step.status === 'done' && <ArrowRight className={cn('w-3 h-3 text-muted-foreground transition-transform', showResults === step.type && 'rotate-90')} />}
                    </div>
                    {showResults === step.type && step.result && (
                      <div className="ml-8 mt-1 mb-2 border rounded-lg p-3 bg-card space-y-2 text-xs">
                        {(step.result.executive_summary || step.result.summary) && (
                          <p className="text-muted-foreground">{step.result.executive_summary || (typeof step.result.summary === 'string' ? step.result.summary : '')}</p>
                        )}
                        {(step.result.issues || step.result.dead_elements || step.result.mismatches || step.result.critical_issues)?.slice(0, 5).map((issue: any, j: number) => (
                          <div key={j} className="flex items-start gap-2 p-1.5 rounded bg-muted/30">
                            <AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium">{issue.title || issue.element || issue.field || 'Issue'}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{issue.description || issue.issue || issue.detail || ''}</p>
                            </div>
                          </div>
                        ))}
                        {step.result.tasks_created > 0 && <Badge variant="default" className="bg-green-600 text-[9px]">{step.result.tasks_created} uppgifter skapade</Badge>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Execution mode */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> AI Execution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.entries(modeConfig) as [AiMode, typeof modeConfig.manual][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={cn(
                  'border-2 rounded-lg p-2.5 text-left transition-all',
                  mode === key ? cfg.color : 'border-border bg-background hover:border-muted-foreground/30'
                )}
              >
                <div className="font-semibold text-[11px]">{cfg.label}</div>
                <div className="text-[9px] mt-0.5 opacity-80">{cfg.desc}</div>
              </button>
            ))}
          </div>
          <Button onClick={runExecution} disabled={executionLoading || scanning} className="w-full gap-2" variant="outline">
            {executionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Kör AI Execution ({modeConfig[mode].label})
          </Button>
        </CardContent>
      </Card>

      {executionResult && (
        <Card className="border-border">
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-medium">{executionResult.summary}</p>
            <div className="flex gap-3 text-xs flex-wrap">
              <Badge variant="outline">{executionResult.total_actions} åtgärder</Badge>
              <Badge variant="default" className="bg-green-600">{executionResult.executed_count} utförda</Badge>
              <Badge variant="secondary">{executionResult.needs_approval} kräver godkännande</Badge>
            </div>
            {executionResult.execution_log.length > 0 && (
              <div className="space-y-1">
                {executionResult.execution_log.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/50">
                    {log.success ? <CheckCircle className="w-3 h-3 text-green-600 shrink-0" /> : <XCircle className="w-3 h-3 text-red-600 shrink-0" />}
                    <span className="font-mono text-[10px] text-muted-foreground">{log.action}</span>
                    <span className="truncate text-[11px]">{log.description}</span>
                  </div>
                ))}
              </div>
            )}
            {executionResult.actions.filter(a => !a.auto_executable).length > 0 && (
              <div className="space-y-1.5 border-t pt-2">
                <p className="text-[10px] font-semibold text-muted-foreground">Kräver godkännande:</p>
                {executionResult.actions.filter(a => !a.auto_executable).map((action, i) => (
                  <div key={i} className="border rounded-lg p-2 space-y-0.5 cursor-pointer hover:bg-muted/30" onClick={() => action.target_id && openDetail(action.target_id)}>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px]">{action.action_type}</Badge>
                      <span className="text-[11px] font-medium truncate">{action.target_title || action.target_id}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{action.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent scan history */}
      {scanRuns.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" /> Skanningshistorik
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-1 pr-2">
                {scanRuns.slice(0, 30).map((run: any) => (
                  <div key={run.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 text-xs">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border shrink-0',
                      (run.overall_score || 0) >= 70 ? 'border-green-400 text-green-700 bg-green-50' :
                      (run.overall_score || 0) >= 40 ? 'border-yellow-400 text-yellow-700 bg-yellow-50' :
                      run.overall_score ? 'border-red-400 text-red-700 bg-red-50' : 'border-border text-muted-foreground bg-muted'
                    )}>
                      {run.overall_score || '—'}
                    </div>
                    <Badge variant="outline" className="text-[8px] shrink-0">{run.scan_type.replace(/_/g, ' ')}</Badge>
                    <span className="truncate text-muted-foreground flex-1">{run.executive_summary || '—'}</span>
                    <span className="text-[9px] text-muted-foreground shrink-0">{new Date(run.created_at).toLocaleDateString('sv-SE')}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ── Interaction QA Tab ──
