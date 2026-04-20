/**
 * SYSTEM INTENT ENGINE — deterministic next-action predictor. NO AI.
 */
import { useSystemStateStore } from "@/stores/systemStateStore";
import { useCommandLayerStore, type CommandEntry } from "./commandLayer";
import { systemStateRegistry } from "./systemStateRegistry";

export interface IntentSnapshot {
  orphan_count: number | null;
  coupling_max: number | null;
  circular_count: number | null;
  failing_modules: string[];
  rejection_count: number;
  taken_at: string;
}

export interface SuggestedCommand {
  command: string;
  trigger_reason: string;
  rule_id: string;
  delta: Record<string, unknown>;
}

export interface IntentReport {
  generated_at: string;
  current: IntentSnapshot;
  previous: IntentSnapshot | null;
  suggested_commands: ReadonlyArray<SuggestedCommand>;
}

function takeSnapshot(): IntentSnapshot {
  const slots = useSystemStateStore.getState().slots;
  const heatmap = slots.dependency_heatmap?.value as
    | { high_coupling?: Array<{ degree: number }>; circular?: unknown[]; orphans?: string[] }
    | null
    | undefined;

  const orphan_count = heatmap?.orphans ? heatmap.orphans.length : null;
  const coupling_max =
    heatmap?.high_coupling && heatmap.high_coupling.length > 0
      ? Math.max(...heatmap.high_coupling.map((n) => n.degree))
      : null;
  const circular_count = heatmap?.circular ? heatmap.circular.length : null;

  const failing_modules = Object.entries(slots)
    .filter(([, s]) => s.health === "error")
    .map(([k]) => k);

  const rejection_count = systemStateRegistry.snapshot().invalid_states.length;

  return {
    orphan_count,
    coupling_max,
    circular_count,
    failing_modules,
    rejection_count,
    taken_at: new Date().toISOString(),
  };
}

type Rule = (current: IntentSnapshot, previous: IntentSnapshot | null, log: CommandEntry[]) => SuggestedCommand | null;

const RULE_orphans_increasing: Rule = (cur, prev) => {
  if (cur.orphan_count == null || prev?.orphan_count == null) return null;
  if (cur.orphan_count <= prev.orphan_count) return null;
  return {
    command: "run heal structure",
    trigger_reason: `orphan_files increased ${prev.orphan_count} → ${cur.orphan_count}`,
    rule_id: "orphans_increasing",
    delta: { orphan_count: { before: prev.orphan_count, after: cur.orphan_count } },
  };
};

const RULE_coupling_rising: Rule = (cur, prev) => {
  if (cur.coupling_max == null || prev?.coupling_max == null) return null;
  if (cur.coupling_max <= prev.coupling_max) return null;
  return {
    command: "analyze dependencies",
    trigger_reason: `coupling_score rose ${prev.coupling_max} → ${cur.coupling_max}`,
    rule_id: "coupling_rising",
    delta: { coupling_max: { before: prev.coupling_max, after: cur.coupling_max } },
  };
};

const RULE_repeated_violations: Rule = (cur, prev) => {
  if (cur.rejection_count <= 0) return null;
  const prevCount = prev?.rejection_count ?? 0;
  const grew = cur.rejection_count > prevCount;
  const repeating = prevCount > 0 && grew;
  const burst = cur.rejection_count - prevCount >= 2;
  if (!repeating && !burst) return null;
  return {
    command: "enable strict mode",
    trigger_reason: `repeated registry violations (${prevCount} → ${cur.rejection_count})`,
    rule_id: "repeated_violations",
    delta: { rejection_count: { before: prevCount, after: cur.rejection_count } },
  };
};

const RULE_circular_appeared: Rule = (cur, prev) => {
  const prevC = prev?.circular_count ?? 0;
  if (cur.circular_count == null || cur.circular_count <= prevC) return null;
  return {
    command: "analyze dependencies",
    trigger_reason: `circular dependencies appeared (${prevC} → ${cur.circular_count})`,
    rule_id: "circular_appeared",
    delta: { circular_count: { before: prevC, after: cur.circular_count } },
  };
};

const RULE_modules_failing: Rule = (cur, prev) => {
  const prevSet = new Set(prev?.failing_modules ?? []);
  const newlyFailing = cur.failing_modules.filter((m) => !prevSet.has(m));
  if (newlyFailing.length === 0) return null;
  return {
    command: "run heal structure",
    trigger_reason: `modules entered error state: ${newlyFailing.join(", ")}`,
    rule_id: "modules_failing",
    delta: { newly_failing: newlyFailing },
  };
};

const RULES: Rule[] = [
  RULE_orphans_increasing,
  RULE_coupling_rising,
  RULE_repeated_violations,
  RULE_circular_appeared,
  RULE_modules_failing,
];

let previousSnapshot: IntentSnapshot | null = null;

export function predictNextActions(): IntentReport {
  const current = takeSnapshot();
  const previous = previousSnapshot;
  const log = useCommandLayerStore.getState().log;

  const suggestions: SuggestedCommand[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    const r = rule(current, previous, log);
    if (r && !seen.has(r.command)) {
      suggestions.push(r);
      seen.add(r.command);
    }
  }

  previousSnapshot = current;

  return {
    generated_at: new Date().toISOString(),
    current,
    previous,
    suggested_commands: Object.freeze(suggestions),
  };
}

export function resetIntentHistory(): void {
  previousSnapshot = null;
}
