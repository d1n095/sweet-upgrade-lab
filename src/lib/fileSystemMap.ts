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
const componentFiles = import.meta.glob("/src/components/**/*.{ts,tsx}", { eager: false });
const pageFiles = import.meta.glob("/src/pages/**/*.{ts,tsx}", { eager: false });
const hookFiles = import.meta.glob("/src/hooks/**/*.{ts,tsx}", { eager: false });
const libFiles = import.meta.glob("/src/lib/**/*.{ts,tsx}", { eager: false });
const storeFiles = import.meta.glob("/src/stores/**/*.{ts,tsx}", { eager: false });
const utilFiles = import.meta.glob("/src/utils/**/*.{ts,tsx}", { eager: false });
const edgeFnFiles = import.meta.glob("/supabase/functions/*/index.ts", { eager: false });

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
    ...Object.keys(edgeFnFiles),
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
