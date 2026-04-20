/**
 * EVOLUTION LAB — single combined admin panel for the 7 evolution engines.
 *
 * Each engine is gated by a feature flag (default: internal_only).
 * The panel is read-only by design: engines run on demand, results are
 * displayed for observability. No automatic mutations to project code.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Beaker, FlaskConical, Network, ShieldCheck, Workflow, Sparkles, Activity, Shuffle, HeartPulse, Radar, Brain, Lock, Gauge, Eye, FileSearch, GitBranch, Database, Flame, CheckCircle2, ShieldAlert, Rocket, History, Boxes } from "lucide-react";
import {
  useFeatureFlagsStore,
  FLAG_LABELS,
  type EvolutionFlagKey,
  type FlagState,
} from "@/stores/featureFlagsStore";
import { evaluateAdaptiveThresholds, type AdaptiveThresholdReport } from "@/core/evolution/adaptiveThresholds";
import {
  evaluateControlledMutation,
  type ControlledMutationReport,
} from "@/core/evolution/controlledMutation";
import { runExperiment, type ExperimentResult, type ExperimentSnapshot } from "@/core/evolution/experimentMode";
import { evaluateEvolutionGuard, type EvolutionGuardReport } from "@/core/evolution/evolutionGuard";
import { runEvolutionCycle, type EvolutionCycleReport } from "@/core/evolution/evolutionLoop";
import { buildClusterRegistry, type ClusterRegistry } from "@/core/evolution/clusterIntelligence";
import { evaluateAutoReorganizer, type AutoReorganizerReport } from "@/core/evolution/autoReorganizer";
import { evaluateClusterHealth, type ClusterHealthReport } from "@/core/evolution/clusterHealthScoring";
import { simulateImpact, type ImpactReport } from "@/core/evolution/clusterImpactSimulator";
import { evaluateClusterMemory, recordSnapshot, type ClusterMemoryReport } from "@/core/evolution/clusterMemory";
import { enforceClusterBoundaries, type BoundaryReport } from "@/core/evolution/clusterBoundaryEnforcer";
import { evaluateClusterRenderOptimizer, type RenderOptimizerReport } from "@/core/evolution/clusterRenderOptimizer";
import { evaluateClusterMetaObserver, type MetaObserverReport } from "@/core/evolution/clusterMetaObserver";
import { analyzeProjectStructure, type StructureReport } from "@/core/evolution/projectStructureAnalyzer";
import { buildDepGraph, traceChain, type DepGraphReport } from "@/core/evolution/liveDependencyGraph";
import { scanStateUsage, type StateScanReport } from "@/core/evolution/stateUsageScanner";
import { buildRiskHeatmap, type RiskHeatmapReport } from "@/core/evolution/riskHeatmap";
import { runInFrontendCi, type CiPipelineReport } from "@/core/evolution/inFrontendCi";
import { runIntegrityMonitor, type IntegrityReport } from "@/core/evolution/integrityMonitor";
import { runProductionReadiness, type ReadinessReport } from "@/core/evolution/productionReadiness";
import { runEvolutionTracker, type EvolutionReport as EvoTrackerReport } from "@/core/evolution/evolutionTracker";
import { runArchitectureClusterer, type ClustererReport } from "@/core/evolution/architectureClusterer";
import { fileSystemMap, getRawSources } from "@/lib/fileSystemMap";
import { supabase } from "@/integrations/supabase/client";
import { useSystemStateStore, runAndStore } from "@/stores/systemStateStore";

interface Props {
  isFounder: boolean;
}

const FLAG_STATES: FlagState[] = ["off", "internal_only", "on"];

const flagBadgeVariant = (s: FlagState) =>
  s === "off" ? "outline" : s === "internal_only" ? "secondary" : "default";

export function EvolutionLabPanel({ isFounder }: Props) {
  const { flags, setFlag, isVisible } = useFeatureFlagsStore();
  const slots = useSystemStateStore((s) => s.slots);

  const [thresholds, setThresholds] = useState<AdaptiveThresholdReport | null>(null);
  const [mutation, setMutation] = useState<ControlledMutationReport | null>(null);
  const [experiment, setExperiment] = useState<ExperimentResult | null>(null);
  const [guard, setGuard] = useState<EvolutionGuardReport | null>(null);
  const [cycle, setCycle] = useState<EvolutionCycleReport | null>(null);
  const [clusters, setClusters] = useState<ClusterRegistry | null>(null);
  const [reorg, setReorg] = useState<AutoReorganizerReport | null>(null);
  const [clusterHealth, setClusterHealth] = useState<ClusterHealthReport | null>(null);
  const [impact, setImpact] = useState<ImpactReport | null>(null);
  const [impactFile, setImpactFile] = useState("");
  const [memory, setMemory] = useState<ClusterMemoryReport | null>(null);
  const [boundary, setBoundary] = useState<BoundaryReport | null>(null);
  const [renderOpt, setRenderOpt] = useState<RenderOptimizerReport | null>(null);
  const [meta, setMeta] = useState<MetaObserverReport | null>(null);
  const [structure, setStructure] = useState<StructureReport | null>(null);
  const [depGraph, setDepGraph] = useState<DepGraphReport | null>(null);
  const [chainFile, setChainFile] = useState("");
  const [chain, setChain] = useState<{ upstream: ReadonlyArray<string>; downstream: ReadonlyArray<string> } | null>(null);
  const [stateScan, setStateScan] = useState<StateScanReport | null>(null);
  const [risk, setRisk] = useState<RiskHeatmapReport | null>(null);
  const [ci, setCi] = useState<CiPipelineReport | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [evoTrack, setEvoTrack] = useState<EvoTrackerReport | null>(null);
  const [clusterer, setClusterer] = useState<ClustererReport | null>(null);
  const [changeCounts, setChangeCounts] = useState<Record<string, number>>({});
  const [bugCounts, setBugCounts] = useState<Record<string, number>>({});

  const loadHistorySignals = async () => {
    try {
      const { data: changes } = await supabase
        .from("change_log")
        .select("affected_components")
        .order("created_at", { ascending: false })
        .limit(500);
      const cMap: Record<string, number> = {};
      for (const row of changes ?? []) {
        for (const c of (row.affected_components as string[] | null) ?? []) {
          cMap[c] = (cMap[c] ?? 0) + 1;
        }
      }
      setChangeCounts(cMap);
      const { data: bugs } = await supabase
        .from("bug_reports")
        .select("page_url")
        .limit(500);
      const bMap: Record<string, number> = {};
      for (const b of bugs ?? []) {
        if (b.page_url) bMap[b.page_url] = (bMap[b.page_url] ?? 0) + 1;
      }
      setBugCounts(bMap);
    } catch {
      /* engines degrade safely */
    }
  };

  const normalizedSources = useMemo(() => {
    const out: Record<string, string> = {};
    const raw = getRawSources();
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string") out[k.replace(/^\//, "")] = v;
    }
    return out;
  }, []);

  // Best-effort inputs derived from systemStateStore — all degrade safely.
  const inputs = useMemo(() => {
    const arch = (slots.architecture_scoring?.value ?? null) as any;
    const dep = (slots.dependency_heatmap?.value ?? null) as any;

    const scoreHistory: number[] = Array.isArray(arch?.history)
      ? arch.history.map((h: any) => Number(h.score) || 0).slice(0, 10)
      : typeof arch?.score === "number"
        ? [arch.score]
        : [];

    const snapshot: ExperimentSnapshot = {
      architecture_score: typeof arch?.score === "number" ? arch.score : 80,
      violation_count: Array.isArray(arch?.violations) ? arch.violations.length : 0,
      isolated_nodes: Array.isArray(dep?.isolated_nodes) ? dep.isolated_nodes.length : 0,
      circular_dependencies: Array.isArray(dep?.circular_dependencies)
        ? dep.circular_dependencies.length
        : 0,
    };

    const mutationInput = {
      violations: Array.isArray(arch?.violations) ? arch.violations : [],
      isolated_nodes: Array.isArray(dep?.isolated_nodes) ? dep.isolated_nodes : [],
      high_coupling: Array.isArray(dep?.high_coupling) ? dep.high_coupling : [],
      duplicates: Array.isArray(dep?.duplicates) ? dep.duplicates : [],
    };

    const depGraph = {
      edges: (dep?.edges ?? {}) as Record<string, string[]>,
      violation_files: Array.isArray(arch?.violations)
        ? arch.violations.map((v: any) => v.file).filter(Boolean)
        : [],
    };

    return { scoreHistory, snapshot, mutationInput, depGraph };
  }, [slots]);

  const sections: Array<{
    key: EvolutionFlagKey;
    icon: React.ReactNode;
    run: () => void;
    body: React.ReactNode;
  }> = [
    {
      key: "adaptive_thresholds",
      icon: <Activity className="w-4 h-4" />,
      run: () => setThresholds(evaluateAdaptiveThresholds(inputs.scoreHistory)),
      body: thresholds ? (
        <div className="text-xs space-y-1">
          <div>
            <Badge variant="outline">{thresholds.trend}</Badge>{" "}
            <span className="text-muted-foreground">{thresholds.change_reason}</span>
          </div>
          <pre className="font-mono text-[10px] bg-muted/50 rounded p-2">
            {JSON.stringify(thresholds.current, null, 2)}
          </pre>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No evaluation yet.</p>
      ),
    },
    {
      key: "controlled_mutation",
      icon: <Sparkles className="w-4 h-4" />,
      run: () => setMutation(evaluateControlledMutation(inputs.mutationInput)),
      body: mutation ? (
        <div className="text-xs space-y-2">
          <div>
            <Badge>{mutation.overall_risk} risk</Badge>{" "}
            <span className="text-muted-foreground">{mutation.notes}</span>
          </div>
          <ul className="space-y-1">
            {mutation.proposals.map((p) => (
              <li key={p.id} className="border rounded p-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{p.category}</Badge>
                  <Badge variant={p.risk_level === "high" ? "destructive" : "secondary"}>
                    {p.risk_level}
                  </Badge>
                </div>
                <p className="font-mono mt-1 break-all">{p.target}</p>
                <p className="text-muted-foreground mt-1">{p.rationale}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No proposals generated.</p>
      ),
    },
    {
      key: "experiment_mode",
      icon: <FlaskConical className="w-4 h-4" />,
      run: () => {
        const proposal = mutation?.proposals[0];
        if (!proposal) return;
        setExperiment(runExperiment(inputs.snapshot, proposal));
      },
      body: experiment ? (
        <div className="text-xs space-y-1">
          <Badge variant={experiment.experiment_result === "SUCCESS" ? "default" : "destructive"}>
            {experiment.experiment_result}
          </Badge>
          <p>Δ score: {experiment.improvement_delta}</p>
          <p className="text-muted-foreground">{experiment.reason}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {mutation?.proposals[0]
            ? "Run experiment on the first proposal."
            : "Generate a mutation proposal first."}
        </p>
      ),
    },
    {
      key: "evolution_guard",
      icon: <ShieldCheck className="w-4 h-4" />,
      run: () => {
        if (!experiment) return;
        setGuard(evaluateEvolutionGuard(experiment.before, experiment.after_simulated));
      },
      body: guard ? (
        <div className="text-xs space-y-1">
          <Badge variant={guard.evolution_status === "ALLOWED" ? "default" : "destructive"}>
            {guard.evolution_status}
          </Badge>
          {guard.reasons.length === 0 ? (
            <p className="text-muted-foreground">No regressions detected.</p>
          ) : (
            <ul className="list-disc pl-4 text-muted-foreground">
              {guard.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Run an experiment first.</p>
      ),
    },
    {
      key: "evolution_loop",
      icon: <Workflow className="w-4 h-4" />,
      run: () =>
        setCycle(
          runEvolutionCycle({
            scoreHistory: inputs.scoreHistory,
            snapshot: inputs.snapshot,
            mutationInput: inputs.mutationInput,
          })
        ),
      body: cycle ? (
        <div className="text-xs space-y-1">
          <Badge>{cycle.evolution_cycle_status}</Badge>
          <p className="text-muted-foreground">{cycle.summary}</p>
          <p className="font-mono text-[10px]">cycle: {cycle.cycle_id}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No cycle run yet.</p>
      ),
    },
    {
      key: "cluster_intelligence",
      icon: <Network className="w-4 h-4" />,
      run: () => setClusters(buildClusterRegistry(inputs.depGraph)),
      body: clusters ? (
        <div className="text-xs space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{clusters.clusters.length} clusters</Badge>
            <Badge variant="outline">{clusters.orphans.length} orphans</Badge>
            <Badge variant={clusters.circular_clusters.length ? "destructive" : "outline"}>
              {clusters.circular_clusters.length} cycles
            </Badge>
            <Badge variant={clusters.overcentralized.length ? "destructive" : "outline"}>
              {clusters.overcentralized.length} over-centralized
            </Badge>
          </div>
          {clusters.suggestions.length > 0 && (
            <ul className="list-disc pl-4 text-muted-foreground">
              {clusters.suggestions.slice(0, 5).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No cluster scan yet.</p>
      ),
    },
    {
      key: "cluster_visualization",
      icon: <Beaker className="w-4 h-4" />,
      run: () => setClusters(buildClusterRegistry(inputs.depGraph)),
      body: clusters ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {clusters.clusters.slice(0, 12).map((c) => {
            const color =
              c.failure_risk > 10
                ? "bg-destructive/20 border-destructive/40"
                : c.failure_risk > 4
                  ? "bg-amber-500/20 border-amber-500/40"
                  : "bg-emerald-500/15 border-emerald-500/40";
            const size = Math.min(64, 24 + c.render_heat * 2);
            return (
              <div
                key={c.id}
                title={`${c.id} — files: ${c.files.length}, in: ${c.in_edges}, out: ${c.out_edges}, risk: ${c.failure_risk}`}
                className={`rounded-md border ${color} flex items-center justify-center text-[10px] font-mono p-1 text-center`}
                style={{ minHeight: size }}
              >
                {c.id}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Run cluster intelligence to populate.</p>
      ),
    },
    {
      key: "auto_reorganizer",
      icon: <Shuffle className="w-4 h-4" />,
      run: () => {
        const reg = clusters ?? buildClusterRegistry(inputs.depGraph);
        if (!clusters) setClusters(reg);
        setReorg(evaluateAutoReorganizer(reg));
      },
      body: reorg ? (
        <div className="text-xs space-y-2">
          <p className="text-muted-foreground">{reorg.notes}</p>
          {reorg.suggestions.length > 0 && (
            <ul className="space-y-1">
              {reorg.suggestions.map((s) => (
                <li key={s.id} className="border rounded p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{s.action}</Badge>
                    {s.safe && <Badge variant="secondary">safe</Badge>}
                  </div>
                  <p className="font-mono mt-1 break-all">{s.target}</p>
                  <p className="text-muted-foreground mt-1">{s.rationale}</p>
                  <p className="mt-1">→ {s.expected_gain}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No reorg suggestions yet.</p>
      ),
    },
    {
      key: "cluster_health_scoring",
      icon: <HeartPulse className="w-4 h-4" />,
      run: () => {
        const reg = clusters ?? buildClusterRegistry(inputs.depGraph);
        if (!clusters) setClusters(reg);
        setClusterHealth(evaluateClusterHealth(reg));
      },
      body: clusterHealth ? (
        <div className="text-xs space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">healthy {clusterHealth.summary.healthy}</Badge>
            <Badge variant="secondary">inefficient {clusterHealth.summary.inefficient}</Badge>
            <Badge variant={clusterHealth.summary.unstable ? "destructive" : "outline"}>
              unstable {clusterHealth.summary.unstable}
            </Badge>
            <Badge variant={clusterHealth.summary.critical ? "destructive" : "outline"}>
              critical {clusterHealth.summary.critical}
            </Badge>
          </div>
          {clusterHealth.alerts.length > 0 && (
            <ul className="list-disc pl-4 text-muted-foreground">
              {clusterHealth.alerts.slice(0, 6).map((a, i) => (
                <li key={i}>
                  <span className="font-mono">{a.cluster_id}</span> — {a.flag}: {a.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No cluster health computed.</p>
      ),
    },
    {
      key: "cluster_impact_simulator",
      icon: <Radar className="w-4 h-4" />,
      run: () => {
        if (!impactFile.trim()) return;
        const reg = clusters ?? buildClusterRegistry(inputs.depGraph);
        if (!clusters) setClusters(reg);
        setImpact(simulateImpact(impactFile.trim(), { edges: inputs.depGraph.edges, registry: reg }));
      },
      body: (
        <div className="text-xs space-y-2">
          <Input
            placeholder="src/components/SomeFile.tsx"
            value={impactFile}
            onChange={(e) => setImpactFile(e.target.value)}
            className="h-7 text-xs"
          />
          {impact && (
            <div className="space-y-1">
              <Badge variant={impact.risk_level === "critical" || impact.risk_level === "high" ? "destructive" : "outline"}>
                {impact.risk_level}
              </Badge>
              <p>Re-render spread: {impact.rerender_spread}</p>
              <p className="text-muted-foreground">{impact.reason}</p>
              {impact.affected_clusters.length > 0 && (
                <p className="font-mono text-[10px]">
                  clusters: {impact.affected_clusters.slice(0, 6).map((c) => c.cluster_id).join(", ")}
                </p>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "cluster_memory",
      icon: <Brain className="w-4 h-4" />,
      run: () => {
        const reg = clusters ?? buildClusterRegistry(inputs.depGraph);
        if (!clusters) setClusters(reg);
        const health = clusterHealth ?? evaluateClusterHealth(reg);
        if (!clusterHealth) setClusterHealth(health);
        recordSnapshot(reg, health);
        setMemory(evaluateClusterMemory());
      },
      body: memory ? (
        <div className="text-xs space-y-2">
          <p className="text-muted-foreground">Snapshots: {memory.snapshot_count}</p>
          {memory.predictions.length > 0 && (
            <ul className="space-y-1">
              {memory.predictions.slice(0, 4).map((p, i) => (
                <li key={i} className="border rounded p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{p.confidence}</Badge>
                    <span className="font-mono">{p.cluster_id}</span>
                  </div>
                  <p className="mt-1">{p.prediction}</p>
                  <p className="text-muted-foreground mt-1">→ {p.recommendation}</p>
                </li>
              ))}
            </ul>
          )}
          <ul className="list-disc pl-4 text-muted-foreground">
            {memory.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Run to record a snapshot &amp; compute predictions.</p>
      ),
    },
    {
      key: "cluster_boundary_enforcer",
      icon: <Lock className="w-4 h-4" />,
      run: () => {
        const reg = clusters ?? buildClusterRegistry(inputs.depGraph);
        if (!clusters) setClusters(reg);
        setBoundary(
          enforceClusterBoundaries({
            edges: inputs.depGraph.edges,
            registry: reg,
          })
        );
      },
      body: boundary ? (
        <div className="text-xs space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                boundary.status === "OK"
                  ? "outline"
                  : boundary.status === "WARN"
                    ? "secondary"
                    : "destructive"
              }
            >
              {boundary.status}
            </Badge>
            <Badge variant="outline">R1 orphans {boundary.summary.R1}</Badge>
            <Badge variant="outline">R2 broken {boundary.summary.R2}</Badge>
            <Badge variant="outline">R3 layer {boundary.summary.R3}</Badge>
          </div>
          <p className="text-muted-foreground">{boundary.notes}</p>
          {boundary.orphan_assignments.length > 0 && (
            <div>
              <p className="font-medium">Orphan assignments</p>
              <ul className="space-y-1">
                {boundary.orphan_assignments.slice(0, 5).map((o) => (
                  <li key={o.file} className="border rounded p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{o.confidence}</Badge>
                      <span className="font-mono break-all">{o.file}</span>
                    </div>
                    <p className="mt-1">→ {o.suggested_cluster}</p>
                    <p className="text-muted-foreground">{o.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {boundary.broken_link_fixes.length > 0 && (
            <div>
              <p className="font-medium">Broken link fixes</p>
              <ul className="space-y-1">
                {boundary.broken_link_fixes.slice(0, 5).map((b, i) => (
                  <li key={i} className="border rounded p-2">
                    <p className="font-mono break-all">{b.from}</p>
                    <p className="text-muted-foreground break-all">✗ {b.broken_target}</p>
                    {b.suggested_target && (
                      <p className="break-all">→ {b.suggested_target}</p>
                    )}
                    <p className="text-muted-foreground">{b.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No boundary scan yet.</p>
      ),
    },
    {
      key: "cluster_render_optimizer",
      icon: <Gauge className="w-4 h-4" />,
      run: () => {
        const reg = clusters ?? buildClusterRegistry(inputs.depGraph);
        if (!clusters) setClusters(reg);
        setRenderOpt(evaluateClusterRenderOptimizer(reg));
      },
      body: renderOpt ? (
        <div className="text-xs space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant={renderOpt.totals.cascade_high ? "destructive" : "outline"}>
              {renderOpt.totals.cascade_high} high-cascade
            </Badge>
            <Badge variant="secondary">
              ~{renderOpt.totals.estimated_renders_saved} renders saved
            </Badge>
          </div>
          <p className="text-muted-foreground">{renderOpt.notes}</p>
          {renderOpt.optimizations.length > 0 && (
            <ul className="space-y-1">
              {renderOpt.optimizations.slice(0, 6).map((o) => (
                <li key={o.id} className="border rounded p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{o.kind.replace(/_/g, " ")}</Badge>
                    <span className="font-mono">{o.cluster_id}</span>
                  </div>
                  <p className="mt-1">{o.rationale}</p>
                  <p className="text-muted-foreground">→ {o.expected_gain}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No render analysis yet.</p>
      ),
    },
    {
      key: "cluster_meta_observer",
      icon: <Eye className="w-4 h-4" />,
      run: () => {
        const reg = clusters ?? buildClusterRegistry(inputs.depGraph);
        if (!clusters) setClusters(reg);
        const health = clusterHealth ?? evaluateClusterHealth(reg);
        if (!clusterHealth) setClusterHealth(health);
        setMeta(evaluateClusterMetaObserver({ registry: reg, health }));
      },
      body: meta ? (
        <div className="text-xs space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                meta.status === "STABLE"
                  ? "outline"
                  : meta.status === "DRIFTING"
                    ? "secondary"
                    : "destructive"
              }
            >
              {meta.status}
            </Badge>
            <Badge variant="outline">{meta.drift_signals.length} drift</Badge>
            <Badge variant="outline">{meta.inefficiencies.length} inefficiencies</Badge>
            <Badge variant="outline">{meta.evolution_plan.length} steps</Badge>
          </div>
          <p className="text-muted-foreground">{meta.notes}</p>
          {meta.drift_signals.length > 0 && (
            <div>
              <p className="font-medium">Drift signals</p>
              <ul className="space-y-1">
                {meta.drift_signals.slice(0, 5).map((d, i) => (
                  <li key={i} className="border rounded p-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          d.severity === "critical"
                            ? "destructive"
                            : d.severity === "warn"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {d.severity}
                      </Badge>
                      <span className="font-mono">{d.kind}</span>
                      {d.cluster_id && (
                        <span className="font-mono text-muted-foreground">{d.cluster_id}</span>
                      )}
                    </div>
                    <p className="mt-1">{d.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {meta.evolution_plan.length > 0 && (
            <div>
              <p className="font-medium">Evolution plan</p>
              <ul className="space-y-1">
                {meta.evolution_plan.slice(0, 5).map((s) => (
                  <li key={s.id} className="border rounded p-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={s.priority === "high" ? "destructive" : "outline"}
                      >
                        {s.priority}
                      </Badge>
                      <Badge variant="secondary">{s.action}</Badge>
                      <span className="font-mono">{s.target}</span>
                    </div>
                    <p className="mt-1">{s.rationale}</p>
                    <p className="text-muted-foreground">→ {s.expected_gain}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No meta observation yet.</p>
      ),
    },
    {
      key: "project_structure_analyzer",
      icon: <FileSearch className="w-4 h-4" />,
      run: () => setStructure(analyzeProjectStructure({ edges: inputs.depGraph.edges })),
      body: structure ? (
        <div className="text-xs space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                structure.status === "OK"
                  ? "outline"
                  : structure.status === "WARN"
                    ? "secondary"
                    : "destructive"
              }
            >
              {structure.status}
            </Badge>
            <Badge variant="outline">cycles {structure.summary.circular_dependency}</Badge>
            <Badge variant="outline">orphans {structure.summary.orphan_module}</Badge>
            <Badge variant="outline">dupes {structure.summary.duplicated_logic}</Badge>
            <Badge
              variant={structure.summary.broken_import ? "destructive" : "outline"}
            >
              broken {structure.summary.broken_import}
            </Badge>
            <Badge variant="outline">naming {structure.summary.inconsistent_pattern}</Badge>
          </div>
          <p className="text-muted-foreground">{structure.notes}</p>
          {structure.suggestions.length > 0 && (
            <div>
              <p className="font-medium">Diff-style suggestions</p>
              <ul className="space-y-1">
                {structure.suggestions.slice(0, 5).map((s) => (
                  <li key={s.id} className="border rounded p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{s.category}</Badge>
                      {s.safe && <Badge variant="secondary">safe</Badge>}
                    </div>
                    <p className="mt-1 text-muted-foreground">{s.rationale}</p>
                    <pre className="mt-1 font-mono text-[10px] bg-muted/40 rounded p-2 whitespace-pre-wrap break-all">
                      {s.diff}
                    </pre>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No structure analysis yet.</p>
      ),
    },
    {
      key: "live_dependency_graph",
      icon: <GitBranch className="w-4 h-4" />,
      run: () => {
        const g = buildDepGraph(inputs.depGraph.edges);
        setDepGraph(g);
        if (chainFile.trim()) {
          setChain(traceChain(chainFile.trim(), inputs.depGraph.edges));
        }
      },
      body: (
        <div className="text-xs space-y-2">
          {depGraph && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{depGraph.totals.nodes} nodes</Badge>
                <Badge variant="outline">{depGraph.totals.edges} edges</Badge>
                <Badge variant="destructive">{depGraph.totals.red} red</Badge>
                <Badge variant="secondary">{depGraph.totals.green} green</Badge>
                <Badge variant="outline">{depGraph.totals.grey} grey</Badge>
              </div>
              <p className="text-muted-foreground">{depGraph.notes}</p>
              {depGraph.tight_clusters.length > 0 && (
                <div>
                  <p className="font-medium">Tight-coupling clusters</p>
                  <ul className="space-y-1">
                    {depGraph.tight_clusters.slice(0, 4).map((c) => (
                      <li key={c.cluster_id} className="border rounded p-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">
                            {(c.tightness * 100).toFixed(0)}% tight
                          </Badge>
                          <span className="font-mono">{c.cluster_id}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">
                          internal {c.internal_edges} / external {c.external_edges} ({c.files.length} files)
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {depGraph.violations.length > 0 && (
                <div>
                  <p className="font-medium">Architecture violations</p>
                  <ul className="space-y-1">
                    {depGraph.violations.slice(0, 4).map((v, i) => (
                      <li key={i} className="border rounded p-2 font-mono text-[10px] break-all">
                        <p>{v.from}</p>
                        <p className="text-muted-foreground">↳ {v.to}</p>
                        <p className="text-destructive mt-1">{v.detail}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <details className="rounded-md border p-2">
                <summary className="text-[11px] font-medium cursor-pointer">
                  Top hubs (by total degree)
                </summary>
                <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
                  {[...depGraph.nodes]
                    .sort((a, b) => (b.in_degree + b.out_degree) - (a.in_degree + a.out_degree))
                    .slice(0, 8)
                    .map((n) => (
                      <li
                        key={n.id}
                        title={n.reason}
                        className={
                          n.color === "red"
                            ? "text-destructive break-all"
                            : n.color === "green"
                              ? "text-emerald-500 break-all"
                              : n.color === "grey"
                                ? "text-muted-foreground break-all"
                                : "break-all"
                        }
                      >
                        [{n.in_degree}/{n.out_degree}] {n.id}
                      </li>
                    ))}
                </ul>
              </details>
            </>
          )}
          <div className="space-y-1">
            <p className="font-medium">Trace chain</p>
            <Input
              placeholder="src/components/SomeFile.tsx"
              value={chainFile}
              onChange={(e) => setChainFile(e.target.value)}
              className="h-7 text-xs"
            />
            {chain && (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="border rounded p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Upstream ({chain.upstream.length})
                  </p>
                  <ul className="mt-1 font-mono text-[10px] max-h-32 overflow-auto">
                    {chain.upstream.slice(0, 20).map((u) => (
                      <li key={u} className="break-all">{u}</li>
                    ))}
                  </ul>
                </div>
                <div className="border rounded p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Downstream ({chain.downstream.length})
                  </p>
                  <ul className="mt-1 font-mono text-[10px] max-h-32 overflow-auto">
                    {chain.downstream.slice(0, 20).map((u) => (
                      <li key={u} className="break-all">{u}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
          {!depGraph && !chain && (
            <p className="text-muted-foreground">Run to build the live graph.</p>
          )}
        </div>
      ),
    },
    {
      key: "state_usage_scanner",
      icon: <Database className="w-4 h-4" />,
      run: () => {
        const sources = getRawSources();
        // Strip the leading "/" the glob keys carry, to match what the engine expects.
        const normalized: Record<string, string> = {};
        for (const [k, v] of Object.entries(sources)) {
          if (typeof v === "string") normalized[k.replace(/^\//, "")] = v;
        }
        setStateScan(scanStateUsage({ sources: normalized }));
      },
      body: stateScan ? (
        <div className="text-xs space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant={stateScan.would_block_build ? "destructive" : "outline"}>
              {stateScan.would_block_build ? "WOULD BLOCK BUILD" : "ok"}
            </Badge>
            <Badge variant="outline">{stateScan.files_with_state} files w/ state</Badge>
            <Badge variant={stateScan.summary.unused_state ? "destructive" : "outline"}>
              unused {stateScan.summary.unused_state}
            </Badge>
            <Badge variant={stateScan.summary.props_mirror_state ? "destructive" : "outline"}>
              mirrors {stateScan.summary.props_mirror_state}
            </Badge>
            <Badge variant={stateScan.summary.conflicting_source_of_truth ? "destructive" : "outline"}>
              conflicts {stateScan.summary.conflicting_source_of_truth}
            </Badge>
            <Badge variant="secondary">stale-derived {stateScan.summary.stale_derived_state}</Badge>
          </div>
          <p className="text-muted-foreground">{stateScan.notes}</p>
          {stateScan.issues.length > 0 && (
            <ul className="space-y-1">
              {stateScan.issues.slice(0, 8).map((i, idx) => (
                <li key={`${i.file}-${i.identifier}-${idx}`} className="border rounded p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={i.fake_state ? "destructive" : "secondary"}>
                      {i.kind}
                    </Badge>
                    <span className="font-mono break-all">{i.file}:{i.line_hint}</span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] break-all">{i.evidence}</p>
                  <p className="text-muted-foreground mt-1">{i.suggestion}</p>
                  <pre className="mt-1 font-mono text-[10px] bg-muted/40 rounded p-2 whitespace-pre-wrap break-all">
                    {i.diff}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No state scan yet.</p>
      ),
    },
    {
      key: "risk_heatmap",
      icon: <Flame className="w-4 h-4" />,
      run: async () => {
        await loadHistorySignals();
        await runAndStore("risk_heatmap", () => {
          const r = buildRiskHeatmap({
            edges: inputs.depGraph.edges,
            change_frequency: changeCounts,
            bug_density: bugCounts,
          });
          setRisk(r);
          return r;
        });
      },
      body: risk ? (
        <div className="text-xs space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="destructive">red {risk.totals.red}</Badge>
            <Badge variant="secondary">orange {risk.totals.orange}</Badge>
            <Badge variant="default">green {risk.totals.green}</Badge>
            <Badge variant="outline">grey {risk.totals.grey}</Badge>
          </div>
          <p className="text-muted-foreground">{risk.notes}</p>
          {risk.hotspots.length > 0 && (
            <ul className="space-y-1">
              {risk.hotspots.map((h) => (
                <li key={h.file} className="border rounded p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{h.risk_score}</Badge>
                    <span className="font-mono break-all">{h.file}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    dep {h.dep_weight} · changes {h.change_count} · bugs {h.bug_count}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Run to fetch history + build the heatmap.</p>
      ),
    },
    {
      key: "in_frontend_ci",
      icon: <CheckCircle2 className="w-4 h-4" />,
      run: () => {
        const struct = analyzeProjectStructure({ edges: inputs.depGraph.edges });
        const dep = buildDepGraph(inputs.depGraph.edges);
        const naming = struct.findings.filter(f => f.kind === "inconsistent_pattern");
        const broken = struct.findings.filter(f => f.kind === "broken_import");
        const cycles = struct.findings.filter(f => f.kind === "circular_dependency");
        setCi(runInFrontendCi({
          naming_violations: naming.length,
          naming_examples: naming.flatMap(f => f.files),
          broken_imports: broken.length,
          broken_examples: broken.map(f => f.detail),
          arch_violations: dep.violations.length,
          arch_examples: dep.violations.map(v => `${v.from} → ${v.to}`),
          cycles: cycles.length,
          cycle_examples: cycles.map(c => c.detail),
        }));
      },
      body: ci ? (
        <div className="text-xs space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={ci.would_block ? "destructive" : ci.overall === "warn" ? "secondary" : "default"}>
              {ci.would_block ? "WOULD BLOCK" : ci.overall.toUpperCase()}
            </Badge>
            <span className="text-muted-foreground">{ci.summary}</span>
          </div>
          <ul className="space-y-1">
            {ci.stages.map((s) => (
              <li key={s.stage} className="border rounded p-2">
                <div className="flex items-center gap-2">
                  <Badge variant={s.status === "fail" ? "destructive" : s.status === "warn" ? "secondary" : "outline"}>
                    {s.status}
                  </Badge>
                  <span className="font-mono">{s.stage}</span>
                  <span className="text-muted-foreground">×{s.count}</span>
                </div>
                {s.details.length > 0 && (
                  <ul className="mt-1 font-mono text-[10px] text-muted-foreground space-y-0.5">
                    {s.details.map((d, i) => <li key={i} className="break-all">· {d}</li>)}
                  </ul>
                )}
                {s.status !== "pass" && (
                  <p className="text-muted-foreground mt-1 italic">{s.fix_hint}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No CI run yet.</p>
      ),
    },
    {
      key: "integrity_monitor",
      icon: <ShieldAlert className="w-4 h-4" />,
      run: () => {
        const struct = analyzeProjectStructure({ edges: inputs.depGraph.edges });
        const orphans = struct.findings.filter(f => f.kind === "orphan_module").flatMap(f => f.files);
        const cycles = struct.findings.filter(f => f.kind === "circular_dependency").map(f => [...f.files]);
        setIntegrity(runIntegrityMonitor({
          edges: inputs.depGraph.edges,
          known_files: fileSystemMap.map(f => f.path),
          sources: normalizedSources,
          orphans,
          cycles,
        }));
      },
      body: integrity ? (
        <div className="text-xs space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant={integrity.would_stop_build ? "destructive" : integrity.status === "warn" ? "secondary" : "default"}>
              {integrity.would_stop_build ? "CRITICAL" : integrity.status.toUpperCase()}
            </Badge>
            <Badge variant="outline">broken {integrity.summary.broken_imports}</Badge>
            <Badge variant="outline">cycles {integrity.summary.circular_dependencies}</Badge>
            <Badge variant="outline">unused {integrity.summary.unused_exports}</Badge>
            <Badge variant="outline">side-fx {integrity.summary.uncontrolled_side_effects}</Badge>
          </div>
          <p className="text-muted-foreground">{integrity.notes}</p>
          {integrity.violations.length > 0 && (
            <ul className="space-y-1">
              {integrity.violations.slice(0, 6).map((v, i) => (
                <li key={i} className="border rounded p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={v.severity === "critical" ? "destructive" : "secondary"}>
                      {v.rule}
                    </Badge>
                    <span className="font-mono break-all">{v.file}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">{v.detail}</p>
                  <p className="italic mt-1">→ {v.fix}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Silent — run to surface violations.</p>
      ),
    },
    {
      key: "production_readiness",
      icon: <Rocket className="w-4 h-4" />,
      run: () => {
        setReadiness(runProductionReadiness({ sources: normalizedSources }));
      },
      body: readiness ? (
        <div className="text-xs space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant={readiness.status === "BLOCKED" ? "destructive" : readiness.status === "NEEDS_CLEANUP" ? "secondary" : "default"}>
              {readiness.status}
            </Badge>
            <Badge variant="outline">{readiness.total_files} files</Badge>
            <Badge variant="outline">{(readiness.total_bytes / 1024).toFixed(0)} KB</Badge>
            <Badge variant={readiness.summary.console_log ? "destructive" : "outline"}>
              console {readiness.summary.console_log}
            </Badge>
            <Badge variant={readiness.summary.debugger ? "destructive" : "outline"}>
              debugger {readiness.summary.debugger}
            </Badge>
            <Badge variant="outline">TODO {readiness.summary.todo_marker}</Badge>
            <Badge variant="outline">wildcards {readiness.summary.wildcard_import}</Badge>
            <Badge variant="outline">bloat {readiness.summary.bundle_bloat}</Badge>
          </div>
          <p className="text-muted-foreground">{readiness.notes}</p>
          {readiness.largest_modules.length > 0 && (
            <details className="rounded-md border p-2">
              <summary className="text-[11px] font-medium cursor-pointer">Largest modules</summary>
              <ul className="mt-1 font-mono text-[10px] space-y-0.5">
                {readiness.largest_modules.map(m => (
                  <li key={m.file} className="break-all">
                    [{(m.bytes / 1024).toFixed(1)} KB] {m.file}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {readiness.findings.length > 0 && (
            <ul className="space-y-1">
              {readiness.findings.slice(0, 8).map((f, i) => (
                <li key={i} className="border rounded p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{f.kind}</Badge>
                    <span className="font-mono break-all">{f.file}:{f.line_hint}</span>
                  </div>
                  <p className="font-mono text-[10px] mt-1 break-all">{f.detail}</p>
                  <p className="italic mt-1">→ {f.fix}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Run to scan production hygiene.</p>
      ),
    },
    {
      key: "evolution_tracker",
      icon: <History className="w-4 h-4" />,
      run: async () => {
        await loadHistorySignals();
        const coupling: Record<string, number> = {};
        const dep = buildDepGraph(inputs.depGraph.edges);
        for (const n of dep.nodes) coupling[n.id] = n.in_degree + n.out_degree;
        setEvoTrack(runEvolutionTracker({
          change_counts: changeCounts,
          coupling,
          failures: bugCounts,
        }));
      },
      body: evoTrack ? (
        <div className="text-xs space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">window {evoTrack.window_size}</Badge>
            <Badge variant={evoTrack.findings.length ? "secondary" : "outline"}>
              {evoTrack.findings.length} signals
            </Badge>
          </div>
          <p className="text-muted-foreground">{evoTrack.notes}</p>
          {evoTrack.hot_files.length > 0 && (
            <details className="rounded-md border p-2" open>
              <summary className="text-[11px] font-medium cursor-pointer">Hot files</summary>
              <ul className="mt-1 font-mono text-[10px] space-y-0.5">
                {evoTrack.hot_files.map(h => (
                  <li key={h.file} className="break-all">
                    [c{h.changes}/d{h.coupling}/b{h.failures}] {h.file}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {evoTrack.findings.length > 0 && (
            <ul className="space-y-1">
              {evoTrack.findings.slice(0, 8).map((f, i) => (
                <li key={i} className="border rounded p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{f.kind}</Badge>
                    <span className="font-mono break-all">{f.target}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">{f.metric}</p>
                  <p className="italic mt-1">→ {f.suggestion}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Run to load change history + analyze.</p>
      ),
    },
    {
      key: "architecture_clusterer",
      icon: <Boxes className="w-4 h-4" />,
      run: async () => {
        await loadHistorySignals();
        setClusterer(runArchitectureClusterer({
          edges: inputs.depGraph.edges,
          change_counts: changeCounts,
        }));
      },
      body: clusterer ? (
        <div className="text-xs space-y-2">
          <p className="text-muted-foreground">{clusterer.notes}</p>
          <details className="rounded-md border p-2" open>
            <summary className="text-[11px] font-medium cursor-pointer">
              Clusters ({clusterer.clusters.length})
            </summary>
            <ul className="mt-1 space-y-1">
              {clusterer.clusters.slice(0, 8).map(c => (
                <li key={c.cluster_id} className="border rounded p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={c.is_natural ? "default" : "outline"}>
                      {(c.density * 100).toFixed(0)}% dense
                    </Badge>
                    <span className="font-mono">{c.cluster_id}</span>
                    <span className="text-muted-foreground">
                      {c.files.length} files · churn {c.churn_total}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    internal {c.internal_edges} / external {c.external_edges}
                  </p>
                </li>
              ))}
            </ul>
          </details>
          {clusterer.decoupling.length > 0 && (
            <div>
              <p className="font-medium">Decoupling opportunities</p>
              <ul className="space-y-1">
                {clusterer.decoupling.map((d, i) => (
                  <li key={i} className="border rounded p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{d.edge_count} cables</Badge>
                      <span className="font-mono">{d.from_cluster} → {d.to_cluster}</span>
                    </div>
                    <p className="italic mt-1">→ {d.suggestion}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {clusterer.micro_modules.length > 0 && (
            <div>
              <p className="font-medium">Micro-module suggestions</p>
              <ul className="space-y-1">
                {clusterer.micro_modules.map((m, i) => (
                  <li key={i} className="border rounded p-2">
                    <Badge variant="secondary">{m.cluster_id}</Badge>
                    <p className="text-muted-foreground mt-1">{m.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Run to derive cluster boundaries.</p>
      ),
    },
  ];


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Beaker className="w-4 h-4" />
          Evolution Lab
          <Badge variant="outline" className="ml-2">internal</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Observability-first. All engines run on-demand and never mutate project code.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Flag matrix */}
        <div className="border rounded-md p-3 space-y-2">
          <p className="text-xs font-medium">Feature flags</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(FLAG_LABELS) as EvolutionFlagKey[]).map((k) => (
              <div key={k} className="flex items-center justify-between text-xs gap-2">
                <span className="truncate">{FLAG_LABELS[k]}</span>
                <div className="flex gap-1">
                  {FLAG_STATES.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={flags[k] === s ? "default" : "outline"}
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setFlag(k, s)}
                      disabled={!isFounder}
                    >
                      {s}
                    </Button>
                  ))}
                  <Badge variant={flagBadgeVariant(flags[k])} className="text-[10px]">
                    {flags[k]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Engine sections — only render if flag is visible to this user */}
        {sections.map((s) =>
          isVisible(s.key, isFounder) ? (
            <div key={s.key} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {s.icon}
                  {FLAG_LABELS[s.key]}
                </span>
                <Button size="sm" variant="outline" onClick={s.run}>
                  Run
                </Button>
              </div>
              {s.body}
            </div>
          ) : null
        )}
      </CardContent>
    </Card>
  );
}

export default EvolutionLabPanel;
