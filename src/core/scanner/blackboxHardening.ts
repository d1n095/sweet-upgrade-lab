/**
 * BLACKBOX HARDENING LAYER
 *
 * Defense-in-depth against manipulation, hidden changes and false states.
 * All checks are pure-deterministic; no AI, no probability, no randomness.
 *
 * Six subsystems:
 *   1. IMMUTABLE_STATE_GUARD     – every state must carry hash + timestamp + source_module
 *   2. EXECUTION_SIGNATURE       – pipeline runs hashed by stage sequence
 *   3. WRITE_AUTHORITY_LOCK      – only the Execution Controller may mutate state
 *   4. DRIFT_LOCK                – snapshot diffs without a pipeline run = DRIFT
 *   5. VALIDATION_REDUNDANCY     – every critical validation is run twice; mismatch = BLOCK
 *   6. TAMPER_TRACE_LOG          – append-only, frozen entries
 */

/* -------------------------------------------------------------------------- */
/*  Deterministic hash (djb2 variant)                                         */
/* -------------------------------------------------------------------------- */

function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify((value as Record<string, unknown>)[k])).join(",") + "}";
}

export function hashState(payload: unknown): string {
  return djb2(stableStringify(payload));
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type AuthorizedWriter = "execution_controller";

export interface ImmutableState {
  source_module: string;
  timestamp: string;
  file_list: ReadonlyArray<string>;
  payload: unknown;
  hash: string;
}

export interface ExecutionRun {
  run_id: string;
  stage_sequence: ReadonlyArray<string>;
  execution_hash: string;
  started_at: string;
}

export type TamperKind =
  | "STATE_HASH_MISMATCH"
  | "EXECUTION_SEQUENCE_ALTERED"
  | "UNAUTHORIZED_WRITE"
  | "DRIFT_DETECTED"
  | "VALIDATION_MISMATCH";

export interface TamperEntry {
  id: string;
  at: string;
  kind: TamperKind;
  who: string;
  detail: string;
  before_hash: string | null;
  after_hash: string | null;
}

export interface SecurityReport {
  generated_at: string;
  security_status: "SECURE" | "DEGRADED" | "BLOCKED";
  integrity_score: number; // 0–100
  detected_tampering: ReadonlyArray<TamperEntry>;
  subsystems: {
    immutable_state_guard: "OK" | "FAIL";
    execution_signature: "OK" | "FAIL";
    write_authority_lock: "OK" | "FAIL";
    drift_lock: "OK" | "FAIL";
    validation_redundancy: "OK" | "FAIL";
  };
}

/* -------------------------------------------------------------------------- */
/*  Tamper trace log (append-only, frozen entries)                            */
/* -------------------------------------------------------------------------- */

const tamperLog: TamperEntry[] = [];
let counter = 0;

function record(entry: Omit<TamperEntry, "id" | "at">): TamperEntry {
  const e: TamperEntry = Object.freeze({
    id: `tamper-${Date.now()}-${++counter}`,
    at: new Date().toISOString(),
    ...entry,
  });
  tamperLog.push(e);
  return e;
}

export function getTamperLog(): ReadonlyArray<TamperEntry> {
  return Object.freeze([...tamperLog]);
}

/* -------------------------------------------------------------------------- */
/*  1. IMMUTABLE STATE GUARD                                                  */
/* -------------------------------------------------------------------------- */

export function sealState(input: {
  source_module: string;
  file_list: ReadonlyArray<string>;
  payload: unknown;
}): ImmutableState {
  const timestamp = new Date().toISOString();
  const sortedFiles = [...input.file_list].sort();
  const hash = hashState({
    source_module: input.source_module,
    file_list: sortedFiles,
    payload: input.payload,
  });
  return Object.freeze({
    source_module: input.source_module,
    timestamp,
    file_list: Object.freeze(sortedFiles),
    payload: input.payload,
    hash,
  });
}

export function verifyState(state: ImmutableState): { ok: boolean; expected: string } {
  const expected = hashState({
    source_module: state.source_module,
    file_list: [...state.file_list].sort(),
    payload: state.payload,
  });
  if (expected !== state.hash) {
    record({
      kind: "STATE_HASH_MISMATCH",
      who: state.source_module,
      detail: `state hash mismatch (expected ${expected}, got ${state.hash})`,
      before_hash: state.hash,
      after_hash: expected,
    });
    return { ok: false, expected };
  }
  return { ok: true, expected };
}

/* -------------------------------------------------------------------------- */
/*  2. EXECUTION SIGNATURE                                                    */
/* -------------------------------------------------------------------------- */

const REQUIRED_PIPELINE: ReadonlyArray<string> = Object.freeze([
  "truth_scan",
  "structure_map",
  "dependency_graph",
  "rule_enforcement",
  "snapshot",
  "release_gate",
]);

export function signExecution(stages: ReadonlyArray<string>): ExecutionRun {
  const execution_hash = hashState(stages);
  return Object.freeze({
    run_id: `run-${Date.now()}-${++counter}`,
    stage_sequence: Object.freeze([...stages]),
    execution_hash,
    started_at: new Date().toISOString(),
  });
}

export function verifyExecution(run: ExecutionRun, who: string): boolean {
  const expectedHash = hashState(run.stage_sequence);
  const sequenceMatches =
    run.stage_sequence.length === REQUIRED_PIPELINE.length &&
    run.stage_sequence.every((s, i) => s === REQUIRED_PIPELINE[i]);
  if (expectedHash !== run.execution_hash || !sequenceMatches) {
    record({
      kind: "EXECUTION_SEQUENCE_ALTERED",
      who,
      detail: `execution sequence altered or hash mismatch (expected ${REQUIRED_PIPELINE.join(",")})`,
      before_hash: run.execution_hash,
      after_hash: expectedHash,
    });
    return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/*  3. WRITE AUTHORITY LOCK                                                   */
/* -------------------------------------------------------------------------- */

const AUTHORIZED: ReadonlySet<AuthorizedWriter> = new Set(["execution_controller"]);

export function assertWriteAuthority(actor: string): boolean {
  if (!AUTHORIZED.has(actor as AuthorizedWriter)) {
    record({
      kind: "UNAUTHORIZED_WRITE",
      who: actor,
      detail: `actor "${actor}" attempted to mutate state — only execution_controller is authorized`,
      before_hash: null,
      after_hash: null,
    });
    return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/*  4. DRIFT LOCK                                                             */
/* -------------------------------------------------------------------------- */

let lastVerifiedSnapshot: ImmutableState | null = null;
let lastVerifiedRun: ExecutionRun | null = null;

export function commitVerifiedSnapshot(snapshot: ImmutableState, run: ExecutionRun): void {
  lastVerifiedSnapshot = snapshot;
  lastVerifiedRun = run;
}

export function checkDrift(currentSnapshot: ImmutableState, runForCurrent: ExecutionRun | null): boolean {
  if (!lastVerifiedSnapshot) {
    // First snapshot — accepted only if it has a backing run.
    if (!runForCurrent) {
      record({
        kind: "DRIFT_DETECTED",
        who: currentSnapshot.source_module,
        detail: "initial snapshot committed without an execution run",
        before_hash: null,
        after_hash: currentSnapshot.hash,
      });
      return false;
    }
    return true;
  }
  if (currentSnapshot.hash === lastVerifiedSnapshot.hash) return true;
  if (!runForCurrent || runForCurrent.run_id === lastVerifiedRun?.run_id) {
    record({
      kind: "DRIFT_DETECTED",
      who: currentSnapshot.source_module,
      detail: "snapshot changed without a new pipeline run",
      before_hash: lastVerifiedSnapshot.hash,
      after_hash: currentSnapshot.hash,
    });
    return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/*  5. VALIDATION REDUNDANCY                                                  */
/* -------------------------------------------------------------------------- */

export interface RedundantCheck<T> {
  name: string;
  primary: () => T;
  secondary: () => T;
  equals?: (a: T, b: T) => boolean;
}

export function runRedundantValidation<T>(check: RedundantCheck<T>): { ok: boolean; value: T | null } {
  const a = check.primary();
  const b = check.secondary();
  const eq = check.equals ?? ((x: T, y: T) => stableStringify(x) === stableStringify(y));
  if (!eq(a, b)) {
    record({
      kind: "VALIDATION_MISMATCH",
      who: check.name,
      detail: `primary and secondary validation disagreed`,
      before_hash: hashState(a),
      after_hash: hashState(b),
    });
    return { ok: false, value: null };
  }
  return { ok: true, value: a };
}

/* -------------------------------------------------------------------------- */
/*  Aggregate report                                                          */
/* -------------------------------------------------------------------------- */

export function getSecurityReport(): SecurityReport {
  const log = getTamperLog();
  const has = (k: TamperKind) => log.some((e) => e.kind === k);
  const subsystems = {
    immutable_state_guard: has("STATE_HASH_MISMATCH") ? "FAIL" : "OK",
    execution_signature: has("EXECUTION_SEQUENCE_ALTERED") ? "FAIL" : "OK",
    write_authority_lock: has("UNAUTHORIZED_WRITE") ? "FAIL" : "OK",
    drift_lock: has("DRIFT_DETECTED") ? "FAIL" : "OK",
    validation_redundancy: has("VALIDATION_MISMATCH") ? "FAIL" : "OK",
  } as const;
  const failedCount = Object.values(subsystems).filter((v) => v === "FAIL").length;
  const integrity_score = Math.max(0, 100 - failedCount * 20 - Math.min(20, log.length));
  const status: SecurityReport["security_status"] =
    failedCount === 0 ? "SECURE" : failedCount >= 3 ? "BLOCKED" : "DEGRADED";
  return Object.freeze({
    generated_at: new Date().toISOString(),
    security_status: status,
    integrity_score,
    detected_tampering: log,
    subsystems,
  });
}

export function resetBlackboxForTest(): void {
  tamperLog.length = 0;
  lastVerifiedSnapshot = null;
  lastVerifiedRun = null;
  counter = 0;
}
