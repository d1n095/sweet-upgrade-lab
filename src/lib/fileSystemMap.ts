// Static file system map generated at build time via import.meta.glob
// READ ONLY — no GitHub API calls

interface FileEntry {
  path: string;
  type: "component" | "page" | "hook" | "lib" | "store" | "util" | "edge_function" | "other";
  folder: string;
  used_in: string[];
  has_api_logic: boolean;
}

function classifyFile(path: string): FileEntry["type"] {
  if (path.includes("/components/")) return "component";
  if (path.includes("/pages/")) return "page";
  if (path.includes("/hooks/")) return "hook";
  if (path.includes("/lib/")) return "lib";
  if (path.includes("/stores/")) return "store";
  if (path.includes("/utils/")) return "util";
  if (path.includes("supabase/functions/")) return "edge_function";
  return "other";
}

function extractFolder(path: string): string {
  const parts = path.split("/");
  if (parts.length >= 3) return parts.slice(0, parts.length - 1).join("/");
  return parts[0] || "/";
}

// Gather all relevant source files at build time (paths only)
console.log("[FILE MAP BUILD START]");

const files = import.meta.glob("/src/**/*.{ts,tsx,js,jsx}", { eager: true });

console.log("[FILE MAP COUNT]:", Object.keys(files).length);

if (Object.keys(files).length === 0) {
  throw new Error("No files detected in project");
}

const componentFiles = import.meta.glob("/src/components/**/*.{ts,tsx}", { eager: false });
const pageFiles = import.meta.glob("/src/pages/**/*.{ts,tsx}", { eager: false });
const hookFiles = import.meta.glob("/src/hooks/**/*.{ts,tsx}", { eager: false });
const libFiles = import.meta.glob("/src/lib/**/*.{ts,tsx}", { eager: false });
const storeFiles = import.meta.glob("/src/stores/**/*.{ts,tsx}", { eager: false });
const utilFiles = import.meta.glob("/src/utils/**/*.{ts,tsx}", { eager: false });
// Edge functions excluded from glob to avoid Deno import resolution errors

// Raw source for import parsing
const rawSources = import.meta.glob(
  ["/src/components/**/*.{ts,tsx}", "/src/pages/**/*.{ts,tsx}", "/src/hooks/**/*.{ts,tsx}", "/src/lib/**/*.{ts,tsx}", "/src/stores/**/*.{ts,tsx}", "/src/utils/**/*.{ts,tsx}"],
  { eager: true, query: "?raw", import: "default" }
) as Record<string, string>;

function extractImports(source: string): string[] {
  const results: string[] = [];
  const regex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source)) !== null) {
    results.push(m[1]);
  }
  return results;
}

function resolveAlias(imp: string): string | null {
  if (imp.startsWith("@/")) return "src/" + imp.slice(2);
  if (imp.startsWith("./") || imp.startsWith("../")) return null; // relative — skip for now
  return null;
}

function buildMap(): FileEntry[] {
  const allPaths = [
    ...Object.keys(componentFiles),
    ...Object.keys(pageFiles),
    ...Object.keys(hookFiles),
    ...Object.keys(libFiles),
    ...Object.keys(storeFiles),
    ...Object.keys(utilFiles),
    // edgeFnFiles excluded
  ];

  const cleanPaths = allPaths.map((raw) => (raw.startsWith("/") ? raw.slice(1) : raw));

  // Build usage map: target -> list of files that import it
  const usageMap: Record<string, string[]> = {};

  for (const [rawFilePath, source] of Object.entries(rawSources)) {
    if (typeof source !== "string") continue;
    const filePath = rawFilePath.startsWith("/") ? rawFilePath.slice(1) : rawFilePath;
    const fileName = filePath.split("/").pop() || filePath;
    const imports = extractImports(source);

    for (const imp of imports) {
      const resolved = resolveAlias(imp);
      if (!resolved) continue;
      // Match against known files (with or without extension)
      for (const known of cleanPaths) {
        const knownNoExt = known.replace(/\.(tsx?|jsx?)$/, "");
        if (resolved === known || resolved === knownNoExt || resolved + "/index" === knownNoExt) {
          if (!usageMap[known]) usageMap[known] = [];
          if (!usageMap[known].includes(fileName)) {
            usageMap[known].push(fileName);
          }
        }
      }
    }
  }

  return cleanPaths.map((path) => {
    const rawKey = "/" + path;
    const source = typeof rawSources[rawKey] === "string" ? rawSources[rawKey] : "";
    const has_api_logic = /supabase\.(from|rpc|auth|storage)|\.functions\.invoke|fetch\s*\(/.test(source);
    return {
      path,
      type: classifyFile(path),
      folder: extractFolder(path),
      used_in: usageMap[path] || [],
      has_api_logic,
    };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

export const fileSystemMap: FileEntry[] = buildMap();

export type { FileEntry };

export function getFileContent(path: string): string | null {
  const key = "/" + path;
  const content = rawSources[key];
  if (typeof content !== "string") return null;
  const lines = content.split("\n");
  return lines.slice(0, 500).join("\n");
}

export function getCodeIndex() {
  return Object.entries(rawSources).map(([path, content]) => ({
    path,
    hasApiCall: content.includes("fetch(") || content.includes("supabase"),
    hasUseEffect: content.includes("useEffect"),
    hasState: content.includes("useState"),
    lineCount: content.split("\n").length
  }));
}

export function getDuplicatedLines(minFiles = 3, minLineLength = 40): { line: string; files: string[] }[] {
  const lineMap: Record<string, string[]> = {};
  for (const [rawPath, content] of Object.entries(rawSources)) {
    if (typeof content !== "string") continue;
    const path = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
    const seen = new Set<string>();
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length < minLineLength) continue;
      if (trimmed.startsWith("//") || trimmed.startsWith("import ") || trimmed.startsWith("export ")) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      if (!lineMap[trimmed]) lineMap[trimmed] = [];
      lineMap[trimmed].push(path);
    }
  }
  return Object.entries(lineMap)
    .filter(([, files]) => files.length >= minFiles)
    .map(([line, files]) => ({ line, files }))
    .sort((a, b) => b.files.length - a.files.length);
}

export function getRawSources(): Record<string, string> {
  return rawSources;
}

export type AnalysisRating = "good" | "neutral" | "bad";

export interface CodeIssue {
  path: string;
  issue_type: string;
  message: string;
  analysis_rating: AnalysisRating;
  analysis_reason: string;
  analysis_confidence: 1 | 2 | 3 | 4 | 5;
}

export function scanFileContent(path: string, content: string) {
  const issues: { type: string; message: string; file: string }[] = [];
  if (!content) return issues;
  // RULE 1 — API CALL IN COMPONENT
  if (
    path.includes("/components/") &&
    (content.includes("fetch(") || content.includes("supabase"))
  ) {
    issues.push({
      type: "structure",
      message: "API call inside component",
      file: path
    });
  }
  // RULE 2 — MISSING ERROR HANDLING
  if (content.includes("fetch(") && !content.includes("catch")) {
    issues.push({
      type: "bug",
      message: "Fetch without error handling",
      file: path
    });
  }
  // RULE 3 — EMPTY FILE
  if (content.trim().length === 0) {
    issues.push({
      type: "error",
      message: "Empty file",
      file: path
    });
  }
  // RULE 4 — LARGE FILE
  if (content.split("\n").length > 300) {
    issues.push({
      type: "performance",
      message: "File too large",
      file: path
    });
  }
  // RULE 5 — HARDCODED VALUES
  if (content.includes("price =") || content.includes("const price")) {
    issues.push({
      type: "data",
      message: "Possible hardcoded price",
      file: path
    });
  }
  // RULE 6 — RESPONSIVE LAYOUT ISSUES
  const VIEWPORTS = [
    { name: "desktop", width: 1440 },
    { name: "tablet", width: 768 },
    { name: "mobile", width: 375 },
  ];
  if (path.includes("/components/") || path.includes("/pages/")) {
    for (const vp of VIEWPORTS) {
      // OVERFLOW CHECK
      if (content.includes("overflow-hidden") && content.includes("absolute") && !content.includes("overflow-auto")) {
        issues.push({
          type: "responsive",
          message: `Responsive layout issue: overflow hidden + absolute without scroll fallback`,
          file: path,
          viewport: vp.name,
        } as any);
      }
      // HIDDEN ELEMENTS — display:none / hidden without responsive guard
      if (content.includes("hidden") && !content.includes("md:block") && !content.includes("lg:block") && !content.includes("sm:block") && vp.name === "mobile") {
        issues.push({
          type: "responsive",
          message: `Responsive layout issue: element hidden without responsive breakpoint guard`,
          file: path,
          viewport: vp.name,
        } as any);
      }
      // STACKED LAYOUT — flex-col without min-h-0 on mobile
      if (content.includes("flex-col") && !content.includes("min-h-0") && vp.name === "mobile") {
        issues.push({
          type: "responsive",
          message: `Responsive layout issue: flex-col without min-h-0 may cause stacking overflow`,
          file: path,
          viewport: vp.name,
        } as any);
      }
      // FIXED/STICKY WITHOUT Z-INDEX
      if ((content.includes("sticky") || content.includes("fixed")) && !content.includes("z-")) {
        issues.push({
          type: "responsive",
          message: `Responsive layout issue: sticky/fixed element without z-index`,
          file: path,
          viewport: vp.name,
        } as any);
      }
      // GRID WITHOUT RESPONSIVE COLS
      if (content.includes("grid-cols-") && !content.includes("md:grid-cols") && !content.includes("lg:grid-cols") && vp.name !== "desktop") {
        issues.push({
          type: "responsive",
          message: `Responsive layout issue: grid without responsive column breakpoints`,
          file: path,
          viewport: vp.name,
        } as any);
      }
    }
  }
  return issues;
}

export function getCodeIssues(): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const index = getCodeIndex();

  for (const f of index) {
    if (f.hasApiCall && f.path.includes("/components")) {
      issues.push({
        path: f.path,
        issue_type: "structure",
        message: "API call inside component (bad practice)",
        analysis_rating: "bad",
        analysis_reason: "Components should not contain direct API calls. Move to hooks or services.",
        analysis_confidence: 4,
      });
    }
  }

  const dupes = getDuplicatedLines();
  for (const d of dupes) {
    issues.push({
      path: d.files[0],
      issue_type: "duplicate",
      message: `Possible duplicated logic (${d.files.length} files)`,
      analysis_rating: "neutral",
      analysis_reason: `Same line found in ${d.files.length} files. May be intentional or a candidate for extraction.`,
      analysis_confidence: 2,
    });
  }

  // Post-process: signal-based rating override
  for (const issue of issues) {
    const text = issue.path + " " + issue.message;
    let rating: AnalysisRating = "neutral";
    let reason = "No clear impact detected";
    let confidence: CodeIssue["analysis_confidence"] = 2;

    // GOOD signals
    if (text.includes("error") || text.includes("crash") || text.includes("fails")) {
      rating = "good";
      reason = "Clear bug or failure described";
      confidence = 5;
    }

    // BAD signals
    if (text.includes("maybe") || text.includes("could") || text.includes("nice to have")) {
      rating = "bad";
      reason = "Unclear or low priority suggestion";
      confidence = 3;
    }

    // CRITICAL signals
    if (text.includes("security") || text.includes("data loss") || text.includes("payment")) {
      rating = "good";
      reason = "Critical system risk";
      confidence = 5;
    }

    issue.analysis_rating = rating;
    issue.analysis_reason = reason;
    issue.analysis_confidence = confidence;
  }

  return issues;
}
