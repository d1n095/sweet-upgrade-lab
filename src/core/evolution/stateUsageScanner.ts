/**
 * STATE USAGE SCANNER
 *
 * Static analysis over raw component source to detect:
 *   - unused state            (state declared, no setter call, no read in JSX/code)
 *   - props-mirroring state   (useState(props.x) without subsequent transform)
 *   - conflicting truth       (same identifier owned by store + local useState in same file)
 *   - stale derived state     (useState that's only set inside useEffect from other state)
 *
 * Enforces:
 *   - single source of truth
 *   - minimal state principle
 *   - "derive, don't store" wherever possible
 *
 * Output is suggestion-only (diff-style) and a "would_block_build" flag
 * for fake state. Never mutates files. Never blocks the actual build pipeline.
 */

export type StateIssueKind =
  | "unused_state"
  | "props_mirror_state"
  | "conflicting_source_of_truth"
  | "stale_derived_state";

export interface StateIssue {
  kind: StateIssueKind;
  file: string;
  identifier: string;
  line_hint: number;
  evidence: string;
  suggestion: string;
  diff: string;
  fake_state: boolean;
}

export interface StateScanReport {
  generated_at: string;
  files_scanned: number;
  files_with_state: number;
  issues: ReadonlyArray<StateIssue>;
  summary: Record<StateIssueKind, number>;
  would_block_build: boolean;
  notes: string;
}

const STORE_HOOK_PATTERN =
  /\b(use[A-Z][A-Za-z0-9]*Store)\s*\(\s*\(?\s*(?:state\s*=>\s*state\.)?([a-zA-Z_$][\w$]*)/g;

const USE_STATE_PATTERN =
  /const\s*\[\s*([a-zA-Z_$][\w$]*)\s*,\s*(set[A-Z][\w$]*)\s*\]\s*=\s*useState(?:<[^>]+>)?\s*\(\s*([^)]*)\)\s*;?/g;

const USE_EFFECT_PATTERN =
  /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([^\]]*)\]\s*\)/g;

function lineNumberOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function diffPreview(file: string, before: string, after: string): string {
  return `--- ${file}\n+++ ${file}\n- ${before}\n+ ${after}`;
}

export interface StateScanInput {
  /** path → raw file source */
  sources: Record<string, string>;
}

export function scanStateUsage(input: StateScanInput): StateScanReport {
  const issues: StateIssue[] = [];
  let filesWithState = 0;
  let filesScanned = 0;

  for (const [path, raw] of Object.entries(input.sources)) {
    if (!path.endsWith(".tsx") && !path.endsWith(".jsx")) continue;
    if (!raw || !raw.includes("useState")) continue;
    filesScanned++;
    const cleanPath = path.replace(/^\//, "");

    // Strip comments to reduce false positives.
    const noComments = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    let hasAnyState = false;

    // ---- collect store-owned identifiers in this file ----
    const storeOwned = new Set<string>();
    for (const m of noComments.matchAll(STORE_HOOK_PATTERN)) {
      if (m[2]) storeOwned.add(m[2]);
    }

    // ---- collect useEffect bodies + deps for stale-derived detection ----
    const effects: Array<{ body: string; deps: string[] }> = [];
    for (const m of noComments.matchAll(USE_EFFECT_PATTERN)) {
      effects.push({
        body: m[1] ?? "",
        deps: (m[2] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }

    // ---- iterate useState declarations ----
    for (const m of noComments.matchAll(USE_STATE_PATTERN)) {
      hasAnyState = true;
      const ident = m[1];
      const setter = m[2];
      const initExpr = (m[3] ?? "").trim();
      const lineHint = lineNumberOf(noComments, m.index ?? 0);

      // 1) unused_state — neither identifier nor setter referenced anywhere else
      const identUses = countOccurrences(noComments, ident) - 1; // minus declaration
      const setterUses = countOccurrences(noComments, setter) - 1;
      if (identUses === 0 && setterUses === 0) {
        issues.push({
          kind: "unused_state",
          file: cleanPath,
          identifier: ident,
          line_hint: lineHint,
          evidence: `const [${ident}, ${setter}] = useState(${initExpr})`,
          suggestion: `Remove "${ident}" — never read or written.`,
          diff: diffPreview(
            cleanPath,
            `const [${ident}, ${setter}] = useState(${initExpr})`,
            `// removed: unused state`
          ),
          fake_state: true,
        });
        continue;
      }

      // 2) props_mirror_state — initialized from props.x and setter never called
      const propsMirror = /^props\.[A-Za-z_$][\w$]*$/.test(initExpr);
      if (propsMirror && setterUses === 0) {
        const propRef = initExpr;
        issues.push({
          kind: "props_mirror_state",
          file: cleanPath,
          identifier: ident,
          line_hint: lineHint,
          evidence: `const [${ident}, ${setter}] = useState(${propRef})`,
          suggestion: `Use "${propRef}" directly — no transform happens.`,
          diff: diffPreview(
            cleanPath,
            `const [${ident}, ${setter}] = useState(${propRef})`,
            `const ${ident} = ${propRef};`
          ),
          fake_state: true,
        });
        continue;
      }

      // 3) conflicting_source_of_truth — same identifier owned by a store
      if (storeOwned.has(ident)) {
        issues.push({
          kind: "conflicting_source_of_truth",
          file: cleanPath,
          identifier: ident,
          line_hint: lineHint,
          evidence: `Local useState shadows store-owned "${ident}".`,
          suggestion: `Drop the local useState and read "${ident}" from the store only.`,
          diff: diffPreview(
            cleanPath,
            `const [${ident}, ${setter}] = useState(${initExpr})`,
            `// drop local copy — read from store hook instead`
          ),
          fake_state: true,
        });
        continue;
      }

      // 4) stale_derived_state — only ever set from a useEffect with deps
      const setOnlyInsideEffect = effects.some(
        (e) => e.body.includes(setter + "(") && e.deps.length > 0
      );
      const setterInBodyOutsideEffect =
        countOccurrences(noComments, setter + "(") -
        effects.reduce((acc, e) => acc + countOccurrences(e.body, setter + "("), 0);
      if (setOnlyInsideEffect && setterInBodyOutsideEffect === 0) {
        const sourceEffect = effects.find((e) => e.body.includes(setter + "("));
        const deps = sourceEffect?.deps.join(", ") ?? "...";
        issues.push({
          kind: "stale_derived_state",
          file: cleanPath,
          identifier: ident,
          line_hint: lineHint,
          evidence: `"${ident}" is only set inside useEffect([${deps}]).`,
          suggestion: `Replace with const ${ident} = useMemo(() => ..., [${deps}]) — derive instead of store.`,
          diff: diffPreview(
            cleanPath,
            `const [${ident}, ${setter}] = useState(${initExpr}); useEffect(() => { ${setter}(...) }, [${deps}])`,
            `const ${ident} = useMemo(() => /* derive */, [${deps}]);`
          ),
          fake_state: false,
        });
      }
    }

    if (hasAnyState) filesWithState++;
  }

  const summary: Record<StateIssueKind, number> = {
    unused_state: 0,
    props_mirror_state: 0,
    conflicting_source_of_truth: 0,
    stale_derived_state: 0,
  };
  for (const i of issues) summary[i.kind]++;

  const fakeCount = issues.filter((i) => i.fake_state).length;
  const wouldBlock = fakeCount > 0;

  return Object.freeze({
    generated_at: new Date().toISOString(),
    files_scanned: filesScanned,
    files_with_state: filesWithState,
    issues: Object.freeze(issues.slice(0, 60)),
    summary,
    would_block_build: wouldBlock,
    notes: wouldBlock
      ? `${fakeCount} fake-state issue(s) would block a strict build. Suggestions are diff-only — no files are modified.`
      : issues.length === 0
        ? "No state issues detected."
        : `${issues.length} non-blocking suggestion(s).`,
  });
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}
