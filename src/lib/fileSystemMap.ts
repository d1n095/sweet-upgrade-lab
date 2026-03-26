// Static file system map generated at build time via import.meta.glob
// READ ONLY — no GitHub API calls

interface FileEntry {
  path: string;
  type: "component" | "page" | "hook" | "lib" | "store" | "util" | "edge_function" | "other";
  folder: string;
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
  // Return the meaningful folder segment
  if (parts.length >= 3) return parts.slice(0, parts.length - 1).join("/");
  return parts[0] || "/";
}

// Gather all relevant source files at build time
const componentFiles = import.meta.glob("/src/components/**/*.{ts,tsx}", { eager: false });
const pageFiles = import.meta.glob("/src/pages/**/*.{ts,tsx}", { eager: false });
const hookFiles = import.meta.glob("/src/hooks/**/*.{ts,tsx}", { eager: false });
const libFiles = import.meta.glob("/src/lib/**/*.{ts,tsx}", { eager: false });
const storeFiles = import.meta.glob("/src/stores/**/*.{ts,tsx}", { eager: false });
const utilFiles = import.meta.glob("/src/utils/**/*.{ts,tsx}", { eager: false });
const edgeFnFiles = import.meta.glob("/supabase/functions/*/index.ts", { eager: false });

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

  return allPaths.map((raw) => {
    const path = raw.startsWith("/") ? raw.slice(1) : raw;
    return {
      path,
      type: classifyFile(path),
      folder: extractFolder(path),
    };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

export const fileSystemMap: FileEntry[] = buildMap();

export type { FileEntry };
