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
import { Beaker, FlaskConical, Network, ShieldCheck, Workflow, Sparkles, Activity, Shuffle, HeartPulse, Radar, Brain } from "lucide-react";
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
import { useSystemStateStore } from "@/stores/systemStateStore";

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
          Observability-first. All 7 engines run on-demand and never mutate project code.
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
