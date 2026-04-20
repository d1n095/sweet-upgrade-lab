/**
 * RELEASE GATE PANEL
 *
 * Shows the latest APPROVED / BLOCKED verdict, the four requirements it is
 * based on, and a compact history of recent decisions.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  ShieldQuestion,
  ListChecks,
  Lock,
} from "lucide-react";
import {
  releaseGate,
  type ReleaseDecision,
  type ReleaseGateState,
  type ReleaseRequirementKey,
  ARCHITECTURE_SCORE_THRESHOLD,
  MAX_VIOLATIONS_FOR_RELEASE,
} from "@/core/scanner/releaseGate";

const REQUIREMENT_LABEL: Record<ReleaseRequirementKey, string> = {
  pipeline_status: "Pipeline status = SUCCESS",
  regression_detected: "Regression detected = NO",
  architecture_score: `Architecture score ≥ ${ARCHITECTURE_SCORE_THRESHOLD}`,
  critical_rule_violations: "No critical rule violations",
};

export function ReleaseGatePanel() {
  const [state, setState] = useState<ReleaseGateState>(() => releaseGate.getState());
  useEffect(() => {
    const tick = () => setState(releaseGate.getState());
    return releaseGate.subscribe(tick);
  }, []);

  const current = state.current;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Release Gate
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              FINAL VERDICT
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              approved: {state.approved_count}
            </Badge>
            {state.blocked_count > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                blocked: {state.blocked_count}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Verdict */}
        <div className="rounded-md border bg-muted/20 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Verdict decision={current} />
            {current && (
              <div className="text-[11px] text-muted-foreground">
                pipeline{" "}
                <span className="font-mono text-foreground">{current.source_pipeline_id}</span>
                {current.source_version_id && (
                  <>
                    {" "}
                    · version{" "}
                    <span className="font-mono text-foreground">
                      {current.source_version_id}
                    </span>
                  </>
                )}{" "}
                · {new Date(current.evaluated_at).toLocaleString()}
              </div>
            )}
          </div>

          {current && current.blocking_reasons.length > 0 && (
            <div className="mt-2 rounded border border-destructive/40 bg-destructive/5 px-2 py-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-destructive">
                Blocking reasons
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-foreground">
                {current.blocking_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {!current && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              No decision yet. The gate runs after each pipeline finishes.
            </div>
          )}
        </div>

        {/* Requirements checklist */}
        {current && (
          <div className="rounded-md border">
            <div className="flex items-center gap-1.5 border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <ListChecks className="h-3 w-3" />
              Requirements
            </div>
            <ul className="divide-y text-xs">
              {current.requirements.map((r) => (
                <li key={r.key} className="grid grid-cols-[24px_1fr_auto] gap-2 px-3 py-2">
                  {r.passed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-foreground" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                  )}
                  <div className="space-y-0.5">
                    <div className="font-medium">{REQUIREMENT_LABEL[r.key]}</div>
                    <div className="text-[11px] text-muted-foreground">{r.detail}</div>
                  </div>
                  <div className="text-right text-[10px] font-mono text-muted-foreground">
                    <div>exp {r.expected}</div>
                    <div>got {r.actual}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* History */}
        <div className="rounded-md border bg-card">
          <div className="border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Recent decisions
          </div>
          {state.history.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No release decisions recorded.
            </div>
          ) : (
            <ul className="max-h-64 divide-y overflow-auto">
              {state.history.slice(0, 20).map((d) => (
                <HistoryRow key={d.id} decision={d} />
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          Approval requires: pipeline SUCCESS · regression = NO · architecture_score ≥{" "}
          {ARCHITECTURE_SCORE_THRESHOLD} · ≤ {MAX_VIOLATIONS_FOR_RELEASE} rule violation(s) and no
          STOP BUILD. Any failure blocks the release.
        </div>
      </CardContent>
    </Card>
  );
}

function Verdict({ decision }: { decision: ReleaseDecision | null }) {
  if (!decision) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldQuestion className="h-4 w-4" />
        Awaiting first pipeline
      </span>
    );
  }
  if (decision.release_status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <CheckCircle2 className="h-5 w-5 text-foreground" />
        <span className="font-semibold">RELEASE APPROVED</span>
        <Badge variant="secondary" className="text-[10px]">
          {decision.requirements.length} / {decision.requirements.length} pass
        </Badge>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <XCircle className="h-5 w-5 text-destructive" />
      <span className="font-semibold text-destructive">RELEASE BLOCKED</span>
      <Badge variant="destructive" className="text-[10px]">
        {decision.blocking_reasons.length} reason
        {decision.blocking_reasons.length === 1 ? "" : "s"}
      </Badge>
    </span>
  );
}

function HistoryRow({ decision }: { decision: ReleaseDecision }) {
  const approved = decision.release_status === "APPROVED";
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2 text-xs">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Badge variant={approved ? "secondary" : "destructive"} className="text-[10px]">
            {decision.release_status}
          </Badge>
          <span className="font-mono text-[11px]">{decision.id}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {decision.source_pipeline_id}
          </span>
          {decision.source_version_id && (
            <span className="text-[11px] text-muted-foreground">
              → <span className="font-mono">{decision.source_version_id}</span>
            </span>
          )}
        </div>
        {!approved && decision.blocking_reasons.length > 0 && (
          <div className="text-[11px] text-muted-foreground">
            {decision.blocking_reasons.join(" · ")}
          </div>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {new Date(decision.evaluated_at).toLocaleTimeString()}
      </div>
    </li>
  );
}
