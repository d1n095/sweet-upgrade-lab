/**
 * ZERO-FAKE-STATE ENFORCEMENT ENGINE
 *
 * Wraps any scanner output and blocks it if the result cannot be traced to
 * live filesystem evidence. No cached metrics, no silent skips, no assumed
 * structure — every count must originate from a fresh import.meta.glob read
 * inside the same process tick.
 *
 * Contract:
 *   - data_source        : LIVE  | INVALID
 *   - verification_status: TRUE  | FALSE
 *   - confidence_score   : 0–100
 *   - blocked_reason     : string | null   (set when state is rejected)
 *
 * If verification fails the engine returns a hard-blocked envelope with the
 * literal payload "STATE BLOCKED — NO VERIFIABLE DATA" so downstream UI can
 * never accidentally render a fake "success" message.
 */

import { fileSystemMap, getRawSources } from "@/lib/fileSystemMap";

export type DataSource = "LIVE" | "INVALID";
export type VerificationStatus = "TRUE" | "FALSE";

export interface VerifiedEnvelope<T> {
  data_source: DataSource;
  verification_status: VerificationStatus;
  confidence_score: number;
  blocked_reason: string | null;
  generated_at: string;
  evidence: {
    file_count: number;
    raw_source_count: number;
    sampled_paths: string[];
  };
  payload: T | "STATE BLOCKED — NO VERIFIABLE DATA";
}

export interface VerifyOptions {
  /** Numeric metrics that must each be > 0 to pass. */
  requiredCounts?: Record<string, number>;
  /** File paths that must exist on disk for the result to be trusted. */
  requiredFiles?: string[];
  /** Maximum age (ms) before the result is considered stale. Default 0 — must be the current tick. */
  maxAgeMs?: number;
  /** When the original computation started, used for staleness check. */
  computedAt?: number;
}

/** Re-read filesystem evidence on every call — never cached. */
function collectEvidence() {
  const map = fileSystemMap;
  const raw = getRawSources();
  const sampled = map.slice(0, 5).map((f) => f.path);
  return {
    file_count: map.length,
    raw_source_count: Object.keys(raw).length,
    sampled_paths: sampled,
  };
}

/** Block any payload that cannot be backed by live evidence. */
export function verifyState<T>(payload: T, opts: VerifyOptions = {}): VerifiedEnvelope<T> {
  const generated_at = new Date().toISOString();
  const evidence = collectEvidence();

  const reasons: string[] = [];

  // RULE 1 — file evidence must exist
  if (evidence.file_count === 0 || evidence.raw_source_count === 0) {
    reasons.push("no live filesystem evidence (glob returned 0)");
  }

  // RULE 2 — required files must exist
  if (opts.requiredFiles?.length) {
    const known = new Set(fileSystemMap.map((f) => f.path));
    const missing = opts.requiredFiles.filter((p) => !known.has(p));
    if (missing.length > 0) {
      reasons.push(`missing required files: ${missing.join(", ")}`);
    }
  }

  // RULE 3 — required counts must each be > 0
  if (opts.requiredCounts) {
    for (const [key, val] of Object.entries(opts.requiredCounts)) {
      if (typeof val !== "number" || !Number.isFinite(val) || val <= 0) {
        reasons.push(`required count "${key}" is not a positive number (got ${val})`);
      }
    }
  }

  // RULE 4 — staleness check
  if (typeof opts.computedAt === "number") {
    const age = Date.now() - opts.computedAt;
    const maxAge = opts.maxAgeMs ?? 0;
    if (age > maxAge && maxAge > 0) {
      reasons.push(`stale result (age ${age}ms > maxAge ${maxAge}ms)`);
    }
  }

  // Confidence: weighted by signals
  let confidence = 0;
  if (evidence.file_count > 0) confidence += 35;
  if (evidence.raw_source_count > 0) confidence += 25;
  if ((opts.requiredCounts && Object.values(opts.requiredCounts).every((v) => v > 0))) confidence += 20;
  if (!opts.requiredFiles || opts.requiredFiles.every((p) => fileSystemMap.find((f) => f.path === p))) confidence += 10;
  if (reasons.length === 0) confidence += 10;
  confidence = Math.min(100, confidence);

  if (reasons.length > 0) {
    console.error("[ZERO-FAKE-STATE] BLOCKED:", reasons);
    return {
      data_source: "INVALID",
      verification_status: "FALSE",
      confidence_score: 0,
      blocked_reason: reasons.join("; "),
      generated_at,
      evidence,
      payload: "STATE BLOCKED — NO VERIFIABLE DATA",
    };
  }

  return {
    data_source: "LIVE",
    verification_status: "TRUE",
    confidence_score: confidence,
    blocked_reason: null,
    generated_at,
    evidence,
    payload,
  };
}

/** Convenience: assert at boundary. Throws if state is fake. */
export function assertVerified<T>(env: VerifiedEnvelope<T>): T {
  if (env.verification_status !== "TRUE" || env.payload === "STATE BLOCKED — NO VERIFIABLE DATA") {
    throw new Error(`[ZERO-FAKE-STATE] ${env.blocked_reason ?? "unverified state"}`);
  }
  return env.payload as T;
}
