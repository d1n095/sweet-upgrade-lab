/**
 * ABSOLUTE CONTROL LAYER
 *
 * ENFORCES:
 *   - The ExecutionController is the SUPREME and ONLY authority that may STOP execution.
 *   - All "validation systems" (Rule Engine, Watchdog, Reality Check, Enforcement Core)
 *     are downgraded to READ-ONLY REPORTERS — they can flag issues but cannot block.
 *   - All "data systems" (Truth Layer, Dependency Engine, Scanner) produce DATA only.
 *   - Conflict rule: if reporters disagree, ALL their signals are IGNORED and the
 *     controller falls back to FILE SYSTEM TRUTH ONLY.
 *
 * This module is purely deterministic. No AI, no async, no cache.
 */
import { fileSystemMap } from "@/lib/fileSystemMap";
import {
  runArchitectureEnforcement,
  type ArchitectureReport,
} from "@/core/architecture/architectureEnforcementCore";
import {
  runDependencyHeatmap,
  type HeatmapReport,
} from "@/core/architecture/dependencyHeatmap";

export type SystemRole = "AUTHORITY" | "READ_ONLY_REPORTER" | "DATA_PRODUCER";

export interface SystemRoleEntry {
  module: string;
  role: SystemRole;
  /** Hard rule: only AUTHORITY may set this true. */
  can_block_execution: boolean;
  description: string;
}

/**
 * Canonical role registry — frozen at module load. The runtime enforces
 * this list when it interprets any engine's output.
 */
export const SYSTEM_ROLE_REGISTRY: ReadonlyArray<SystemRoleEntry> = Object.freeze([
  // ── 1. AUTHORITY ─────────────────────────────────────────────────────────
  {
    module: "executionController",
    role: "AUTHORITY",
    can_block_execution: true,
    description: "Supreme orchestrator. Decides STOP/CONTINUE. Ignores duplicate signals.",
  },
  // ── 2. READ-ONLY REPORTERS ───────────────────────────────────────────────
  {
    module: "architectureEnforcementCore",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Reports A1–A4 architecture violations. Cannot stop execution directly.",
  },
  {
    module: "architectureRuleEngine",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Reports R1–R4 structural rule violations.",
  },
  {
    module: "architectureWatchdog",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Reports broken imports / structural drift.",
  },
  {
    module: "realityCheckEngine",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Reports state-registry mismatches.",
  },
  {
    module: "loopPreventionEngine",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Reports identical-output / stagnation loops.",
  },
  {
    module: "queueCollapseEngine",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Reports duplicate, already-executed, or stale-scan queue items.",
  },
  {
    module: "signalDeduplicator",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Aggregates raw signals from all reporters into unique issues with severity scores.",
  },
  {
    module: "hardStateLock",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Enforces write-access policy on systemStateRegistry. Logs unauthorized attempts.",
  },
  {
    module: "finalSnapshotEngine",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Captures one immutable snapshot per controller run with a verification hash.",
  },
  {
    module: "immutableSnapshotV2",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Audit-grade snapshot store: full files, dep graph, route registry, violations + integrity hash. Append-only, dedup by hash.",
  },
  {
    module: "driftDetector",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Compares live system to last v2 snapshot baseline. Reports STABLE / DRIFT_DETECTED / NO_BASELINE with file, route, graph, and violation deltas.",
  },
  {
    module: "deterministicBuildPipeline",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Composes the 6-stage release-grade pipeline. Stops itself on failure but does not block other systems.",
  },
  {
    module: "versionedArchitectureStore",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Append-only store of verified architecture versions. Writes only after pipeline success.",
  },
  {
    module: "rollbackEngine",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Restores active stable version on pipeline failure, score drop, or violation surge. Never mutates versions.",
  },
  {
    module: "regressionGuard",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Compares candidate build to previous version; returns BLOCK on file drop, route mismatch, new orphans, or coupling rise. Pipeline enforces the block.",
  },
  {
    module: "releaseGate",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Final aggregate verdict (APPROVED/BLOCKED). Combines pipeline status, regression result, architecture score, and critical violations.",
  },
  {
    module: "strictMode",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Zero-tolerance binary verdict (PASS/FAIL). Any violation across architecture, dep graph, regression, release gate, or drift = FAIL. No warnings.",
  },
  {
    module: "patternMemory",
    role: "READ_ONLY_REPORTER",
    can_block_execution: false,
    description: "Stores per-version observations: top 10 connected files, violations, file kinds. Derives stable files, repeated violations, and frequently moved files by raw counting only.",
  },
  // ── 3. DATA PRODUCERS ────────────────────────────────────────────────────
  {
    module: "fileSystemMap",
    role: "DATA_PRODUCER",
    can_block_execution: false,
    description: "Raw file truth. The fallback source when reporters disagree.",
  },
  {
    module: "dependencyHeatmap",
    role: "DATA_PRODUCER",
    can_block_execution: false,
    description: "Produces import-graph data only. No decisions.",
  },
  {
    module: "truthEngine",
    role: "DATA_PRODUCER",
    can_block_execution: false,
    description: "Produces canonical structure data only. No decisions.",
  },
  {
    module: "scannerV2",
    role: "DATA_PRODUCER",
    can_block_execution: false,
    description: "Produces scan data only. No decisions.",
  },
  {
    module: "systemStateRegistry",
    role: "DATA_PRODUCER",
    can_block_execution: false,
    description: "Append-only state record. Stores derived metrics; takes no actions.",
  },
]);

export interface ReporterSignal {
  module: string;
  severity: "info" | "warning" | "critical";
  count: number;
  message: string;
}

export type Decision = "CONTINUE" | "STOP";

export interface AbsoluteControlReport {
  generated_at: string;
  decision: Decision;
  /** Single unified reason string — never multiple. */
  reason: string;
  /** Reporter signals received (not all of them are honored). */
  reporter_signals: ReporterSignal[];
  /** Signals the controller IGNORED, with the rule it violated. */
  ignored_signals: { module: string; ignored_because: string }[];
  /** Whether conflict-fallback (file-system truth only) was triggered. */
  conflict_fallback_triggered: boolean;
  /** Truth basis the decision was made on. */
  decision_basis:
    | "no_critical_signals"
    | "single_authority_threshold"
    | "conflict_fallback_filesystem_truth";
  /** Critical-issue threshold used for the STOP decision. */
  critical_threshold: number;
  /** Total critical issues counted from honored signals. */
  total_critical: number;
}

const DEFAULT_CRITICAL_THRESHOLD = 1;

/**
 * Look up a module's role. Unknown modules are treated as READ_ONLY_REPORTER
 * (defensive default — no unknown module may block execution).
 */
export function getSystemRole(moduleName: string): SystemRoleEntry {
  return (
    SYSTEM_ROLE_REGISTRY.find((s) => s.module === moduleName) ?? {
      module: moduleName,
      role: "READ_ONLY_REPORTER",
      can_block_execution: false,
      description: "Unknown module — defaulted to read-only reporter.",
    }
  );
}

/**
 * Hard guard. ANY caller that holds a reference to a non-authority module
 * but tries to use it as a stopper must funnel through this check first.
 * Returns true if the module is allowed to block.
 */
export function assertCanBlock(moduleName: string): boolean {
  const entry = getSystemRole(moduleName);
  return entry.role === "AUTHORITY" && entry.can_block_execution === true;
}

/**
 * Detect conflict between reporters. Two reporters conflict when they look
 * at the SAME concern (here: architecture vs dependency integrity) and
 * disagree about whether the system is healthy.
 *
 * Pure rule: if architecture reports STOP BUILD but dependency reports
 * zero cycles AND zero broken paths, that is a disagreement on overall
 * health → conflict.
 */
function detectConflict(
  arch: ArchitectureReport,
  dep: HeatmapReport
): { conflict: boolean; explanation: string } {
  const archSaysStop = arch.build_status === "STOP BUILD";
  const depHealthy = dep.circular_dependencies.length === 0 && dep.metrics.isolated < dep.metrics.total_nodes;

  if (archSaysStop && depHealthy && arch.violations.length === 0) {
    // Build status disagrees with its own violation count
    return {
      conflict: true,
      explanation: "architectureEnforcement says STOP BUILD with zero violations — internally inconsistent",
    };
  }
  return { conflict: false, explanation: "" };
}

/**
 * Compute the absolute decision.
 *
 * Step 1: collect reports from all reporters (read-only).
 * Step 2: filter out any reporter that lacks evidence (no source file basis).
 * Step 3: detect conflicts → if any, IGNORE all reporters and fall back to
 *         file-system truth (file count > 0 → CONTINUE).
 * Step 4: if no conflict, count critical signals → STOP if > threshold.
 */
export function computeAbsoluteDecision(
  options: { criticalThreshold?: number } = {}
): AbsoluteControlReport {
  const generated_at = new Date().toISOString();
  const threshold = options.criticalThreshold ?? DEFAULT_CRITICAL_THRESHOLD;
  const ignored: { module: string; ignored_because: string }[] = [];

  // ── Step 1: gather reports (read-only consumption) ──
  const arch = runArchitectureEnforcement();
  const dep = runDependencyHeatmap();

  // Reporter signals (architecture + dependency health treated as reporters here)
  const signals: ReporterSignal[] = [
    {
      module: "architectureEnforcementCore",
      severity: arch.violations.length > 0 ? "critical" : "info",
      count: arch.violations.length,
      message: `${arch.violations.length} architecture violations (build_status=${arch.build_status})`,
    },
    {
      module: "dependencyHeatmap",
      severity: dep.circular_dependencies.length > 0 ? "critical" : "info",
      count: dep.circular_dependencies.length,
      message: `${dep.circular_dependencies.length} circular dependencies`,
    },
  ];

  // ── Step 2: enforce role-registry — drop any signal from a module
  // that claims block authority it does not have. ──
  const honored: ReporterSignal[] = [];
  for (const s of signals) {
    const role = getSystemRole(s.module);
    if (role.can_block_execution) {
      // Authority signals would be self-referential — ignore (controller already runs)
      ignored.push({ module: s.module, ignored_because: "module would self-decide; only AUTHORITY may block" });
      continue;
    }
    honored.push(s);
  }

  // ── Step 3: conflict detection ──
  const { conflict, explanation } = detectConflict(arch, dep);
  if (conflict) {
    for (const s of honored) {
      ignored.push({ module: s.module, ignored_because: `conflict-fallback: ${explanation}` });
    }
    // Fall back to file system truth
    const filesOk = Array.isArray(fileSystemMap) && fileSystemMap.length > 0;
    return {
      generated_at,
      decision: filesOk ? "CONTINUE" : "STOP",
      reason: filesOk
        ? "CONTINUE — reporters disagreed; file-system truth confirms application has files"
        : "STOP — reporters disagreed AND file-system map is empty",
      reporter_signals: signals,
      ignored_signals: ignored,
      conflict_fallback_triggered: true,
      decision_basis: "conflict_fallback_filesystem_truth",
      critical_threshold: threshold,
      total_critical: 0,
    };
  }

  // ── Step 4: count critical and decide ──
  const totalCritical = honored
    .filter((s) => s.severity === "critical")
    .reduce((sum, s) => sum + s.count, 0);

  if (totalCritical >= threshold) {
    // Pick the single highest-count critical reporter to phrase the unified reason
    const top = [...honored]
      .filter((s) => s.severity === "critical")
      .sort((a, b) => b.count - a.count)[0];
    return {
      generated_at,
      decision: "STOP",
      reason: `STOP — ${totalCritical} critical issues (threshold=${threshold}); top reporter: ${top?.module} (${top?.count})`,
      reporter_signals: signals,
      ignored_signals: ignored,
      conflict_fallback_triggered: false,
      decision_basis: "single_authority_threshold",
      critical_threshold: threshold,
      total_critical: totalCritical,
    };
  }

  return {
    generated_at,
    decision: "CONTINUE",
    reason: `CONTINUE — ${totalCritical} critical issues, below threshold (${threshold})`,
    reporter_signals: signals,
    ignored_signals: ignored,
    conflict_fallback_triggered: false,
    decision_basis: "no_critical_signals",
    critical_threshold: threshold,
    total_critical: totalCritical,
  };
}
