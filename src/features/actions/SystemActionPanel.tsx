// READ-ONLY component — no backend calls, no mutations
// FORBIDDEN:
// - AI modifications
// - refactors
// - renaming fields
// - changing data flow

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Copy, Check, AlertTriangle, Info } from "lucide-react";
import { buildActions, type SystemAction, type ActionSeverity } from "./SystemActionEngine";

interface Props {
  unifiedResult: Record<string, any> | null | undefined;
}

const SEVERITY_STYLES: Record<ActionSeverity, { badge: string; border: string }> = {
  HIGH:   { badge: "bg-red-500/20 text-red-400 border-red-500/30",    border: "border-l-red-500" },
  MEDIUM: { badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", border: "border-l-yellow-500" },
  LOW:    { badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",  border: "border-l-blue-500" },
};

function ActionRow({ action }: { action: SystemAction }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const styles = SEVERITY_STYLES[action.severity];

  const handleCopy = () => {
    navigator.clipboard.writeText(action.copyPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`border-l-2 ${styles.border} pl-3 py-2 space-y-1`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge className={`text-[8px] px-1.5 py-0 shrink-0 ${styles.badge}`}>{action.severity}</Badge>
          <span className="text-[11px] font-medium text-foreground truncate">{action.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Show details"
          >
            <Info className="h-3 w-3" />
          </button>
          <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Copy fix prompt"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground font-mono">{action.category}</p>
      {expanded && (
        <div className="space-y-1 pt-1">
          {action.description && (
            <p className="text-[10px] text-muted-foreground">{action.description}</p>
          )}
          <div className="bg-muted/30 border border-border rounded-md p-2">
            <p className="text-[9px] text-muted-foreground mb-0.5 font-semibold uppercase tracking-wide">Fix suggestion</p>
            <p className="text-[10px] text-foreground">{action.fixSuggestion}</p>
          </div>
          <div className="bg-muted/20 border border-border rounded-md p-2">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Copy prompt</p>
              <button onClick={handleCopy} className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                {copied ? <><Check className="h-2.5 w-2.5 text-green-500" /> Copied</> : <><Copy className="h-2.5 w-2.5" /> Copy</>}
              </button>
            </div>
            <pre className="text-[9px] font-mono text-muted-foreground whitespace-pre-wrap">{action.copyPrompt}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function SystemActionPanel({ unifiedResult }: Props) {
  const [severityFilter, setSeverityFilter] = useState<ActionSeverity | "ALL">("ALL");

  const actions = buildActions(unifiedResult);

  const counts = {
    HIGH:   actions.filter(a => a.severity === "HIGH").length,
    MEDIUM: actions.filter(a => a.severity === "MEDIUM").length,
    LOW:    actions.filter(a => a.severity === "LOW").length,
  };

  const filtered = severityFilter === "ALL" ? actions : actions.filter(a => a.severity === severityFilter);

  if (!unifiedResult) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-[11px] text-muted-foreground">No scan results available. Run a backend scan first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Action Layer
            <span className="text-[9px] text-muted-foreground font-normal font-mono ml-1">read-only · no backend calls</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex gap-3 text-[10px]">
            <div className="flex flex-col items-center px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20">
              <span className="text-muted-foreground">HIGH</span>
              <span className="text-lg font-bold text-red-400">{counts.HIGH}</span>
            </div>
            <div className="flex flex-col items-center px-3 py-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
              <span className="text-muted-foreground">MEDIUM</span>
              <span className="text-lg font-bold text-yellow-400">{counts.MEDIUM}</span>
            </div>
            <div className="flex flex-col items-center px-3 py-2 rounded-md bg-blue-500/10 border border-blue-500/20">
              <span className="text-muted-foreground">LOW</span>
              <span className="text-lg font-bold text-blue-400">{counts.LOW}</span>
            </div>
          </div>
          {actions.length === 0 && (
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
              No issues found in unified_result — scan may be empty or stale
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filter */}
      {actions.length > 0 && (
        <div className="flex gap-1">
          {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors ${
                severityFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground border-border hover:bg-muted/50"
              }`}
            >
              {s}{s !== "ALL" ? ` (${counts[s]})` : ` (${actions.length})`}
            </button>
          ))}
        </div>
      )}

      {/* Action list */}
      {filtered.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-3">
            {filtered.map(action => (
              <ActionRow key={action.id} action={action} />
            ))}
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && actions.length > 0 && (
        <p className="text-[10px] text-muted-foreground">No actions match the selected filter.</p>
      )}
    </div>
  );
}
