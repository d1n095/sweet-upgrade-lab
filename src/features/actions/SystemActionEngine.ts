// READ-ONLY utility — no backend calls, no side effects
// FORBIDDEN:
// - AI modifications
// - refactors
// - renaming fields
// - changing data flow

export type ActionSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface SystemAction {
  id: string;
  title: string;
  description: string;
  severity: ActionSeverity;
  category: string;
  fixSuggestion: string;
  copyPrompt: string;
}

const severityFor = (category: string): ActionSeverity => {
  if (category === "broken_flows" || category === "fake_features") return "HIGH";
  if (category === "interaction_failures") return "MEDIUM";
  return "LOW";
};

const fixFor = (category: string, title: string): string => {
  if (category === "broken_flows") return `Trace and restore the broken flow: "${title}". Verify all route handlers and data dependencies are wired correctly.`;
  if (category === "fake_features") return `Remove or fully implement the fake feature: "${title}". Do not leave placeholder/stub logic in production.`;
  if (category === "interaction_failures") return `Reproduce the interaction failure: "${title}". Check event handlers, async timing, and state mutations.`;
  return `Investigate data issue: "${title}". Validate schema alignment and null-safety for all consumers.`;
};

const promptFor = (category: string, title: string, description: string): string =>
  `Fix the following issue detected by the system scanner.\n\nCategory: ${category}\nTitle: ${title}\nDescription: ${description}\n\nInstructions:\n- Do NOT rename any fields\n- Do NOT change data flow\n- Apply minimal surgical fix only\n- Verify no regressions in scan pipeline`;

export function buildActions(unifiedResult: Record<string, any> | null | undefined): SystemAction[] {
  if (!unifiedResult) return [];

  const categories: Array<[string, any[]]> = [
    ["broken_flows", unifiedResult.broken_flows ?? []],
    ["fake_features", unifiedResult.fake_features ?? []],
    ["interaction_failures", unifiedResult.interaction_failures ?? []],
    ["data_issues", unifiedResult.data_issues ?? []],
  ];

  const actions: SystemAction[] = [];

  categories.forEach(([category, items]) => {
    if (!Array.isArray(items)) return;
    items.forEach((item: any, idx: number) => {
      const title = item?.title ?? item?.description ?? item?.message ?? `Issue #${idx + 1}`;
      const description = item?.description ?? item?.message ?? item?.detail ?? "";
      actions.push({
        id: item?.id ?? `${category}-${idx}`,
        title,
        description,
        severity: severityFor(category),
        category,
        fixSuggestion: fixFor(category, title),
        copyPrompt: promptFor(category, title, description),
      });
    });
  });

  return actions;
}
