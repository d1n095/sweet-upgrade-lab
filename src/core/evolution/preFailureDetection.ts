/**
 * PRE-FAILURE DETECTION ENGINE
 *
 * Detects inevitable failures BEFORE they happen — using deterministic
 * pattern extrapolation over historical signals. NO probability, NO AI,
 * NO forecasting models. Only counting + monotonic-trend checks.
 *
 * RULES:
 *   - Module in ≥3 distinct failure chains          → CRITICAL_RISK
 *   - Coupling rising monotonically across ≥3 versions → DEGRADING
 *   - Cluster instability rising across ≥3 samples  → FRAGILE_ZONE
 *   - Violation frequency rising across ≥3 cycles   → REGRESSING
 */

export interface VersionMetric {
  version: number;
  /** Map of file → coupling degree at this version. */
  coupling: Record<string, number>;
}

export interface ClusterInstabilitySample {
  taken_at: string; // ISO; used for sort order only
  /** cluster_id → instability score (0..100) */
  scores: Record<string, number>;
}

export interface FailureChain {
  chain_id: string;
  modules: ReadonlyArray<string>;
}

export interface ViolationCount {
  cycle: number;
  /** rule → count this cycle */
  counts: Record<string, number>;
}

export interface PreFailureInput {
  /** Historical chains observed (from failureSimulation, etc.) */
  failure_chains: ReadonlyArray<FailureChain>;
  /** Coupling metrics across recent versions, oldest → newest. */
  version_metrics: ReadonlyArray<VersionMetric>;
  /** Cluster instability samples, oldest → newest. */
  instability_samples: ReadonlyArray<ClusterInstabilitySample>;
  /** Violation counts across recent cycles, oldest → newest. */
  violation_history: ReadonlyArray<ViolationCount>;
}

export type RiskLevel = "CRITICAL_RISK" | "DEGRADING" | "FRAGILE_ZONE" | "REGRESSING" | "STABLE";

export interface RiskEntry {
  target: string;
  target_kind: "module" | "cluster" | "rule";
  level: RiskLevel;
  reasons: ReadonlyArray<string>;
  evidence: Record<string, unknown>;
}

export interface DegradationTrend {
  target: string;
  target_kind: "module" | "cluster" | "rule";
  metric: "coupling" | "instability" | "violations";
  series: ReadonlyArray<number>;
  delta: number;
}

export interface PreFailureReport {
  generated_at: string;
  risk_map: ReadonlyArray<RiskEntry>;
  critical_modules: ReadonlyArray<string>;
  degradation_trends: ReadonlyArray<DegradationTrend>;
  summary: string;
}

const MIN_FAILURE_CHAINS = 3;
const MIN_VERSION_HISTORY = 3;
const MIN_INSTABILITY_SAMPLES = 3;
const MIN_VIOLATION_CYCLES = 3;

// ── Helpers ────────────────────────────────────────────────────────────

/** Strictly monotonically non-decreasing AND last > first (i.e. actually rising). */
function isRising(series: ReadonlyArray<number>): boolean {
  if (series.length < 2) return false;
  for (let i = 1; i < series.length; i++) {
    if (series[i] < series[i - 1]) return false;
  }
  return series[series.length - 1] > series[0];
}

// ── Detectors ──────────────────────────────────────────────────────────

function detectCriticalModules(chains: ReadonlyArray<FailureChain>): RiskEntry[] {
  const occurrences = new Map<string, Set<string>>(); // module → chain_ids
  for (const chain of chains) {
    for (const mod of chain.modules) {
      const cur = occurrences.get(mod) ?? new Set<string>();
      cur.add(chain.chain_id);
      occurrences.set(mod, cur);
    }
  }
  const out: RiskEntry[] = [];
  for (const [mod, chainIds] of occurrences) {
    if (chainIds.size >= MIN_FAILURE_CHAINS) {
      out.push({
        target: mod,
        target_kind: "module",
        level: "CRITICAL_RISK",
        reasons: Object.freeze([
          `Appears in ${chainIds.size} distinct failure chains (≥${MIN_FAILURE_CHAINS}).`,
        ]),
        evidence: { chain_ids: [...chainIds] },
      });
    }
  }
  out.sort((a, b) => a.target.localeCompare(b.target));
  return out;
}

function detectDegradingModules(versions: ReadonlyArray<VersionMetric>): {
  risks: RiskEntry[];
  trends: DegradationTrend[];
} {
  if (versions.length < MIN_VERSION_HISTORY) return { risks: [], trends: [] };
  const sorted = [...versions].sort((a, b) => a.version - b.version);
  const recent = sorted.slice(-MIN_VERSION_HISTORY);

  // Universe of modules seen in recent window
  const universe = new Set<string>();
  for (const v of recent) for (const k of Object.keys(v.coupling)) universe.add(k);

  const risks: RiskEntry[] = [];
  const trends: DegradationTrend[] = [];

  for (const mod of universe) {
    const series = recent.map((v) => v.coupling[mod] ?? 0);
    if (isRising(series)) {
      const delta = series[series.length - 1] - series[0];
      risks.push({
        target: mod,
        target_kind: "module",
        level: "DEGRADING",
        reasons: Object.freeze([
          `Coupling rising across ${series.length} versions: ${series.join(" → ")} (Δ +${delta}).`,
        ]),
        evidence: {
          versions: recent.map((v) => v.version),
          series,
        },
      });
      trends.push({
        target: mod,
        target_kind: "module",
        metric: "coupling",
        series: Object.freeze(series),
        delta,
      });
    }
  }
  risks.sort((a, b) => a.target.localeCompare(b.target));
  trends.sort((a, b) => b.delta - a.delta);
  return { risks, trends };
}

function detectFragileClusters(samples: ReadonlyArray<ClusterInstabilitySample>): {
  risks: RiskEntry[];
  trends: DegradationTrend[];
} {
  if (samples.length < MIN_INSTABILITY_SAMPLES) return { risks: [], trends: [] };
  const sorted = [...samples].sort((a, b) => (a.taken_at < b.taken_at ? -1 : 1));
  const recent = sorted.slice(-MIN_INSTABILITY_SAMPLES);

  const universe = new Set<string>();
  for (const s of recent) for (const k of Object.keys(s.scores)) universe.add(k);

  const risks: RiskEntry[] = [];
  const trends: DegradationTrend[] = [];

  for (const cluster of universe) {
    const series = recent.map((s) => s.scores[cluster] ?? 0);
    if (isRising(series)) {
      const delta = series[series.length - 1] - series[0];
      risks.push({
        target: cluster,
        target_kind: "cluster",
        level: "FRAGILE_ZONE",
        reasons: Object.freeze([
          `Instability rising across ${series.length} samples: ${series.join(" → ")} (Δ +${delta}).`,
        ]),
        evidence: { series },
      });
      trends.push({
        target: cluster,
        target_kind: "cluster",
        metric: "instability",
        series: Object.freeze(series),
        delta,
      });
    }
  }
  risks.sort((a, b) => a.target.localeCompare(b.target));
  trends.sort((a, b) => b.delta - a.delta);
  return { risks, trends };
}

function detectRegressingRules(history: ReadonlyArray<ViolationCount>): {
  risks: RiskEntry[];
  trends: DegradationTrend[];
} {
  if (history.length < MIN_VIOLATION_CYCLES) return { risks: [], trends: [] };
  const sorted = [...history].sort((a, b) => a.cycle - b.cycle);
  const recent = sorted.slice(-MIN_VIOLATION_CYCLES);

  const universe = new Set<string>();
  for (const c of recent) for (const k of Object.keys(c.counts)) universe.add(k);

  const risks: RiskEntry[] = [];
  const trends: DegradationTrend[] = [];

  for (const rule of universe) {
    const series = recent.map((c) => c.counts[rule] ?? 0);
    if (isRising(series)) {
      const delta = series[series.length - 1] - series[0];
      risks.push({
        target: rule,
        target_kind: "rule",
        level: "REGRESSING",
        reasons: Object.freeze([
          `Violation count rising across ${series.length} cycles: ${series.join(" → ")} (Δ +${delta}).`,
        ]),
        evidence: { series },
      });
      trends.push({
        target: rule,
        target_kind: "rule",
        metric: "violations",
        series: Object.freeze(series),
        delta,
      });
    }
  }
  risks.sort((a, b) => a.target.localeCompare(b.target));
  trends.sort((a, b) => b.delta - a.delta);
  return { risks, trends };
}

// ── Public API ─────────────────────────────────────────────────────────

export function detectPreFailures(input: PreFailureInput): PreFailureReport {
  const critical = detectCriticalModules(input.failure_chains);
  const degrading = detectDegradingModules(input.version_metrics);
  const fragile = detectFragileClusters(input.instability_samples);
  const regressing = detectRegressingRules(input.violation_history);

  // Merge by (target_kind, target). CRITICAL outranks DEGRADING.
  const levelRank: Record<RiskLevel, number> = {
    CRITICAL_RISK: 4,
    DEGRADING: 3,
    FRAGILE_ZONE: 3,
    REGRESSING: 2,
    STABLE: 0,
  };

  const merged = new Map<string, RiskEntry>();
  for (const r of [...critical, ...degrading.risks, ...fragile.risks, ...regressing.risks]) {
    const key = `${r.target_kind}:${r.target}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, r);
      continue;
    }
    const winning = levelRank[r.level] >= levelRank[existing.level] ? r : existing;
    const losing = winning === r ? existing : r;
    merged.set(key, {
      ...winning,
      reasons: Object.freeze([...winning.reasons, ...losing.reasons]),
      evidence: { ...losing.evidence, ...winning.evidence },
    });
  }

  const risk_map = [...merged.values()].sort((a, b) => {
    const lr = levelRank[b.level] - levelRank[a.level];
    return lr !== 0 ? lr : a.target.localeCompare(b.target);
  });

  const critical_modules = risk_map
    .filter((r) => r.level === "CRITICAL_RISK" && r.target_kind === "module")
    .map((r) => r.target);

  const degradation_trends = [
    ...degrading.trends,
    ...fragile.trends,
    ...regressing.trends,
  ].sort((a, b) => b.delta - a.delta);

  const counts = {
    critical: risk_map.filter((r) => r.level === "CRITICAL_RISK").length,
    degrading: risk_map.filter((r) => r.level === "DEGRADING").length,
    fragile: risk_map.filter((r) => r.level === "FRAGILE_ZONE").length,
    regressing: risk_map.filter((r) => r.level === "REGRESSING").length,
  };

  return Object.freeze({
    generated_at: new Date().toISOString(),
    risk_map: Object.freeze(risk_map),
    critical_modules: Object.freeze(critical_modules),
    degradation_trends: Object.freeze(degradation_trends),
    summary:
      risk_map.length === 0
        ? "No pre-failure signals detected."
        : `${risk_map.length} risk(s): ${counts.critical} critical · ${counts.degrading} degrading · ${counts.fragile} fragile · ${counts.regressing} regressing.`,
  });
}
