/**
 * STRICT MODE
 *
 * GOAL: Force production-level discipline. Binary verdict only.
 *
 * RULES:
 *   - ANY violation → immediate STOP (no scoring, no thresholds, no grace).
 *   - NO warnings allowed (warnings are promoted to violations under strict mode).
 *   - ONLY PASS / FAIL — no "WARN", no "PARTIAL", no "MOSTLY OK".
 *
 * SOURCES (all read-only — strict mode never mutates):
 *   - architecture report  → any violation = FAIL
 *   - dependency heatmap   → any cycle or isolated node = FAIL
 *   - regression guard     → any regression = FAIL
 *   - release gate         → BLOCKED = FAIL
 *   - drift detector       → DRIFT_DETECTED or NO_BASELINE = FAIL
 *
 * AUTHORITY: read-only reporter. Cannot block other systems on its own — but
 * other gates are encouraged to refuse to advance while strict_status = FAIL.
 */
import {
  runArchitectureEnforcement,
  type ArchitectureReport,
} from "@/core/architecture/architectureEnforcementCore";
import {
  runDependencyHeatmap,
  type HeatmapReport,
} from "@/core/architecture/dependencyHeatmap";
import { regressionGuard } from "@/core/scanner/regressionGuard";
import { releaseGate } from "@/core/scanner/releaseGate";
import { driftDetector } from "@/core/scanner/driftDetector";

export type StrictStatus = "PASS" | "FAIL";

export interface StrictViolation {
  readonly source: string;
  readonly rule: string;
  readonly detail: string;
}

export interface StrictCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface StrictReport {
  readonly evaluated_at: string;
  readonly strict_status: StrictStatus;
  readonly violations: ReadonlyArray<StrictViolation>;
  readonly violation_count: number;
  readonly checks: ReadonlyArray<StrictCheck>;
  readonly summary: string;
}

interface StrictModeState {
  enabled: boolean;
  last_report: StrictReport | null;
  history: ReadonlyArray<StrictReport>;
  total_evaluations: number;
  total_failures: number;
  last_fail_at: string | null;
}

// In strict mode, ANY cycle or isolated node is failure.
const STRICT_MAX_CYCLES = 0;
const STRICT_MAX_ISOLATED = 0;

class StrictMode {
  private enabled = false;
  private history: StrictReport[] = [];
  private total_failures = 0;
  private last_fail_at: string | null = null;
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.emit();
  }

  getState(): StrictModeState {
    return {
      enabled: this.enabled,
      last_report: this.history[0] ?? null,
      history: [...this.history],
      total_evaluations: this.history.length,
      total_failures: this.total_failures,
      last_fail_at: this.last_fail_at,
    };
  }

  /**
   * Evaluate the system against strict-mode rules. Pure derivation from live
   * reporters — no mutation. Returns a binary verdict.
   */
  evaluate(): StrictReport {
    const violations: StrictViolation[] = [];
    const checks: StrictCheck[] = [];

    // 1. Architecture
    let arch: ArchitectureReport | null = null;
    try {
      arch = runArchitectureEnforcement();
    } catch (e: any) {
      violations.push({
        source: "architecture",
        rule: "ENGINE_FAILURE",
        detail: `architecture engine threw: ${e?.message ?? e}`,
      });
    }
    if (arch) {
      const archPass = arch.violations.length === 0 && arch.build_status === "PASS";
      checks.push({
        name: "architecture",
        passed: archPass,
        detail: archPass
          ? "no architecture violations"
          : `${arch.violations.length} violation(s) — build_status=${arch.build_status}`,
      });
      for (const v of arch.violations) {
        violations.push({
          source: "architecture",
          rule: v.rule,
          detail: `${v.file}:${v.line_hint} — ${v.evidence}`,
        });
      }
    }

    // 2. Dependency graph — cycles or isolated nodes = instant fail.
    let dep: HeatmapReport | null = null;
    try {
      dep = runDependencyHeatmap();
    } catch (e: any) {
      violations.push({
        source: "dependency_graph",
        rule: "ENGINE_FAILURE",
        detail: `heatmap engine threw: ${e?.message ?? e}`,
      });
    }
    if (dep) {
      const cycles = (dep.circular_dependencies ?? []).length;
      const isolated = (dep.isolated_nodes ?? []).length;
      const depPass = cycles <= STRICT_MAX_CYCLES && isolated <= STRICT_MAX_ISOLATED;
      checks.push({
        name: "dependency_graph",
        passed: depPass,
        detail: depPass
          ? "no cycles, no isolated nodes"
          : `${cycles} cycle(s), ${isolated} isolated node(s)`,
      });
      if (cycles > STRICT_MAX_CYCLES) {
        violations.push({
          source: "dependency_graph",
          rule: "CIRCULAR_DEPENDENCY",
          detail: `${cycles} circular dependency chain(s) detected`,
        });
      }
      if (isolated > STRICT_MAX_ISOLATED) {
        violations.push({
          source: "dependency_graph",
          rule: "ISOLATED_NODES",
          detail: `${isolated} isolated module(s) — strict mode treats orphan modules as failure`,
        });
      }
    }

    // 3. Regression guard
    const regState = regressionGuard.getState();
    const regLast = regState.last;
    if (regLast) {
      const regPass = !regLast.regression_detected;
      checks.push({
        name: "regression_guard",
        passed: regPass,
        detail: regPass
          ? "no regression vs previous version"
          : `${regLast.differences.length} regression difference(s)`,
      });
      if (!regPass) {
        for (const d of regLast.differences) {
          violations.push({
            source: "regression_guard",
            rule: d.check,
            detail: d.message,
          });
        }
      }
    } else {
      checks.push({
        name: "regression_guard",
        passed: true,
        detail: "no prior version to compare (first build)",
      });
    }

    // 4. Release gate
    const gateState = releaseGate.getState();
    const gateLast = gateState.current;
    if (gateLast) {
      const gatePass = gateLast.release_status === "APPROVED";
      checks.push({
        name: "release_gate",
        passed: gatePass,
        detail: gatePass
          ? "release approved"
          : `release blocked — ${gateLast.blocking_reasons.join("; ") || "see gate"}`,
      });
      if (!gatePass) {
        for (const r of gateLast.blocking_reasons) {
          violations.push({
            source: "release_gate",
            rule: "BLOCKED",
            detail: r,
          });
        }
      }
    } else {
      checks.push({
        name: "release_gate",
        passed: false,
        detail: "no release decision recorded — strict mode requires an approved release",
      });
      violations.push({
        source: "release_gate",
        rule: "NO_DECISION",
        detail: "no release decision exists — run the deterministic build pipeline first",
      });
    }

    // 5. Drift detector
    const driftState = driftDetector.getState();
    const driftLast = driftState.last_report;
    if (driftLast) {
      const driftPass = driftLast.drift_status === "STABLE";
      checks.push({
        name: "drift_detector",
        passed: driftPass,
        detail:
          driftLast.drift_status === "STABLE"
            ? "live state matches baseline"
            : driftLast.drift_status === "NO_BASELINE"
              ? "no baseline snapshot — strict mode requires one"
              : `drift detected — ${driftLast.changed_files.total} file change(s), ${driftLast.route_diff.total} route change(s)`,
      });
      if (!driftPass) {
        violations.push({
          source: "drift_detector",
          rule: driftLast.drift_status,
          detail: driftLast.summary,
        });
      }
    } else {
      checks.push({
        name: "drift_detector",
        passed: false,
        detail: "no drift check has been run — strict mode requires one",
      });
      violations.push({
        source: "drift_detector",
        rule: "NO_CHECK",
        detail: "no drift check on record — run the Drift Detector first",
      });
    }

    const strict_status: StrictStatus = violations.length === 0 ? "PASS" : "FAIL";
    const summary =
      strict_status === "PASS"
        ? "All strict checks passed. Production discipline intact."
        : `Strict mode FAILED — ${violations.length} violation(s) across ${
            new Set(violations.map((v) => v.source)).size
          } source(s).`;

    const report: StrictReport = Object.freeze({
      evaluated_at: new Date().toISOString(),
      strict_status,
      violations: Object.freeze(violations.map((v) => Object.freeze({ ...v }))),
      violation_count: violations.length,
      checks: Object.freeze(checks.map((c) => Object.freeze({ ...c }))),
      summary,
    });

    if (strict_status === "FAIL") {
      this.total_failures++;
      this.last_fail_at = report.evaluated_at;
    }
    this.history.unshift(report);
    if (this.history.length > 50) this.history.length = 50;
    this.emit();
    return report;
  }

  reset(): void {
    this.history = [];
    this.total_failures = 0;
    this.last_fail_at = null;
    this.emit();
  }
}

export const strictMode = new StrictMode();
