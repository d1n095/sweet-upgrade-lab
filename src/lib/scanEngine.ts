import { getRawSources, scanFileContent } from "@/lib/fileSystemMap";

export type ScanIssue = {
  file: string;
  message: string;
  severity: "high" | "medium" | "low";
};

type ScanCallback = (issues: ScanIssue[]) => void;

const listeners: ScanCallback[] = [];

export function onScanComplete(cb: ScanCallback) {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function runFrontendScan(type: string): ScanIssue[] {
  const rawSources = getRawSources();
  if (!rawSources) {
    console.warn("🚫 NO FILE DATA — scan aborted");
    return [];
  }

  const issues: ScanIssue[] = [];

  Object.entries(rawSources).forEach(([path, content]) => {
    if (!content) return;

    if (
      content.includes("fetch(") &&
      !content.includes("catch") &&
      !content.includes("try")
    ) {
      issues.push({
        file: path,
        message: "Missing error handling",
        severity: "high",
      });
    }

    if (content.includes("onClick") && !content.includes("=>")) {
      issues.push({
        file: path,
        message: "Dead button risk",
        severity: "high",
      });
    }

    const codeIssues = scanFileContent(path, content as string);
    codeIssues.forEach((ci) => {
      issues.push({ file: ci.file, message: ci.message, severity: "medium" });
    });
  });

  console.log("✅ SCAN DONE:", issues.length, "issues found");
  console.log("FLOW:", {
    button: true,
    engine: true,
    scan: true,
    pipeline: true,
  });

  listeners.forEach((cb) => cb(issues));
  return issues;
}

export const startScanJob = (type: string): ScanIssue[] => {
  console.log("🚀 START SCAN:", type);
  return runFrontendScan(type);
};
