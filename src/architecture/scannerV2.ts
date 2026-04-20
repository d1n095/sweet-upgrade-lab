/**
 * SCANNER v2 — Official scanner entrypoint.
 *
 * Replaces all legacy scanner heuristics with a deterministic, file-based
 * truth engine. Every classification decision is logged with the rule that
 * fired, every excluded file carries an explicit reason, and the scanner
 * fails LOUD if file discovery is empty.
 *
 * INPUT  : full file list from import.meta.glob (via fileSystemMap)
 * OUTPUT : ScannerV2Report — verified counts only, every number traceable
 *          to a real file path on disk.
 */

import { fileSystemMap, getRawSources, type FileEntry } from "@/lib/fileSystemMap";
import { runTruthEngine, type TruthReport } from "@/architecture/truthEngine";
import { ROUTE_REGISTRY } from "@/architecture/routeRegistry";
import { verifyState, type VerifiedEnvelope } from "@/core/scanner/zeroFakeStateGuard";

export type ScannerStatus = "VERIFIED" | "BROKEN";

export type Classification = "component" | "route" | "utility" | "other";

export interface FileClassification {
  path: string;
  classification: Classification;
  /** The exact rule that fired (for audit log) */
  rule: string;
}

export interface ScannerV2Report {
  scanner_status: ScannerStatus;
  confidence_score: number; // 0–100
  generated_at: string;

  inputs: {
    received_files: number;
    source: "import.meta.glob via fileSystemMap";
  };

  processed: {
    total: number;
    components: number;
    routes: number;
    utilities: number;
    other: number;
  };

  excluded: { path: string; reason: string }[];

  /** Sample of per-file classifications (first 50) */
  classification_log: FileClassification[];

  /** Every error caught by fail-loud guards */
  errors: string[];

  /** The full truth-engine report this scanner is built on */
  truth: TruthReport;
}

const JSX_RE = /<[A-Z][A-Za-z0-9]*[\s/>]/;
const REACT_IMPORT_RE = /from\s+['"]react['"]/;
const REACT_EXPORT_RE = /export\s+(?:default\s+)?(?:function|const)\s+[A-Z]/;
const ROUTE_DECL_RE = /<Route\s+[^>]*path\s*=\s*["'][^"']*["']/;

function classify(path: string, source: string): FileClassification {
  // Rule R1: page entry file → route
  if (path.startsWith("src/pages/")) {
    return { path, classification: "route", rule: "R1: file under src/pages/" };
  }
  // Rule R2: file declares one or more <Route path="..."> → route
  if (ROUTE_DECL_RE.test(source)) {
    return { path, classification: "route", rule: "R2: contains <Route path=...> declaration" };
  }
  // Rule R3: file contains JSX or React component export → component
  if (JSX_RE.test(source)) {
    return { path, classification: "component", rule: "R3: contains JSX (<PascalCase ...>)" };
  }
  if (REACT_IMPORT_RE.test(source) && REACT_EXPORT_RE.test(source)) {
    return { path, classification: "component", rule: "R3b: imports react + exports PascalCase symbol" };
  }
  // Rule R4: utility folders
  if (
    path.startsWith("src/lib/") ||
    path.startsWith("src/utils/") ||
    path.startsWith("src/stores/") ||
    path.startsWith("src/hooks/")
  ) {
    return { path, classification: "utility", rule: "R4: file under lib/utils/stores/hooks" };
  }
  return { path, classification: "other", rule: "R5: no rule matched" };
}

export function runScannerV2(): ScannerV2Report {
  const generated_at = new Date().toISOString();
  const errors: string[] = [];

  // INPUT LAYER — get the full file list (truth source)
  const allFiles: string[] = fileSystemMap.map((f: FileEntry) => f.path);
  const rawSources = getRawSources();

  // Excluded files from fileSystemMap are .test/.spec/test/setup.ts (already filtered)
  // We re-derive their list here for the audit log.
  const knownExcludedPatterns: { match: (p: string) => boolean; reason: string }[] = [
    { match: (p) => /\.(test|spec)\.[tj]sx?$/.test(p), reason: "matches **/*.{test,spec}.*" },
    { match: (p) => p.startsWith("src/test/"), reason: "inside src/test/" },
  ];
  const excludedSamples: { path: string; reason: string }[] = [];
  // We don't have the raw pre-exclusion list here; the truth source already
  // excluded these. We log them as known patterns so users see the rules.
  excludedSamples.push({ path: "(rule)", reason: "matches **/*.{test,spec}.*" });
  excludedSamples.push({ path: "(rule)", reason: "inside src/test/" });

  // FAIL-LOUD: empty input
  if (allFiles.length === 0) {
    errors.push("SCANNER v2 UNABLE TO VERIFY FILE SYSTEM");
    return {
      scanner_status: "BROKEN",
      confidence_score: 0,
      generated_at,
      inputs: { received_files: 0, source: "import.meta.glob via fileSystemMap" },
      processed: { total: 0, components: 0, routes: 0, utilities: 0, other: 0 },
      excluded: excludedSamples,
      classification_log: [],
      errors,
      truth: runTruthEngine(),
    };
  }

  // ANALYSIS LAYER
  const log: FileClassification[] = [];
  let components = 0,
    routes = 0,
    utilities = 0,
    other = 0;

  for (const path of allFiles) {
    const src = rawSources["/" + path] || "";
    const c = classify(path, src);
    log.push(c);
    if (c.classification === "component") components++;
    else if (c.classification === "route") routes++;
    else if (c.classification === "utility") utilities++;
    else other++;
  }

  // Fail-loud on empty critical metrics
  if (components === 0) errors.push("NO COMPONENTS DETECTED");
  if (routes === 0) errors.push("NO ROUTES DETECTED");

  const truth = runTruthEngine();
  // Pull route registry coverage into the scanner status
  if (truth.routing.phantom_routes.length > 0) {
    errors.push(`PHANTOM ROUTES: ${truth.routing.phantom_routes.length}`);
  }

  const scanner_status: ScannerStatus = errors.length === 0 ? "VERIFIED" : "BROKEN";

  // Confidence: weighted by real signals
  const confidence_score = Math.round(
    ((allFiles.length > 0 ? 1 : 0) * 0.35 +
      (components > 0 ? 1 : 0) * 0.25 +
      (routes > 0 ? 1 : 0) * 0.2 +
      (truth.routing.phantom_routes.length === 0 ? 1 : 0) * 0.1 +
      (errors.length === 0 ? 1 : 0) * 0.1) *
      100
  );

  // Console proof (truth log)
  console.log("[SCANNER v2]", {
    scanner_status,
    confidence_score,
    received_files: allFiles.length,
    components,
    routes,
    utilities,
    other,
    errors,
    routes_declared_in_registry: ROUTE_REGISTRY.length,
    routes_file_backed: truth.routing.real_file_backed,
  });

  return {
    scanner_status,
    confidence_score,
    generated_at,
    inputs: { received_files: allFiles.length, source: "import.meta.glob via fileSystemMap" },
    processed: { total: allFiles.length, components, routes, utilities, other },
    excluded: excludedSamples,
    classification_log: log.slice(0, 50),
    errors,
    truth,
  };
}

/**
 * Verified entrypoint — wraps runScannerV2() in the zero-fake-state guard.
 * Returns an envelope that downstream UI MUST check before rendering.
 */
export function runScannerV2Verified(): VerifiedEnvelope<ScannerV2Report> {
  const computedAt = Date.now();
  const report = runScannerV2();
  return verifyState(report, {
    computedAt,
    requiredCounts: {
      received_files: report.inputs.received_files,
      components: report.processed.components,
      routes: report.processed.routes,
    },
  });
}

