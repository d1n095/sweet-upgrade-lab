/**
 * REGRESSION GUARD PANEL
 *
 * Surfaces every regression evaluation: which candidate pipeline was checked,
 * which previous version it was compared against, and the differences that
 * caused (or did not cause) a release block.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  ArrowRight,
  Ban,
  CheckCircle2,
} from "lucide-react";
import {
  regressionGuard,
  type RegressionCheck,
  type RegressionEvaluation,
  type RegressionGuardState,
  COUPLING_TOLERANCE,
} from "@/core/scanner/regressionGuard";

const CHECK_LABEL: Record<RegressionCheck, string> = {
  FILE_COUNT_DROP: "File count drop",
  ROUTE_MISMATCH: "Route mismatch",
  NEW_ORPHAN_FILES: "New orphan files",
  INCREASED_COUPLING: "Increased coupling",
};

export function RegressionGuardPanel() {
  const [state, setState] = useState<RegressionGuardState>(() => regressionGuard.getState());

  useEffect(() => {
    const tick = () => setState(regressionGuard.getState());
    return regressionGuard.subscribe(tick);
  }, []);

  const last = state.last;
  const blockedCount = state.blocked_pipeline_ids.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            Regression Guard
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              RELEASE BLOCKER
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              evals: {state.history.length}
            </Badge>
            {blockedCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                blocked: {blockedCount}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Last evaluation summary */}
        <div className="rounded-md border bg-muted/20 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Verdict evaluation={last} />
            </div>
            {last && (
              <div className="text-[11px] text-muted-foreground">
                {new Date(last.evaluated_at).toLocaleString()}
              </div>
            )}
          </div>
          {last ? (
            <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
              <div>
                pipeline <span className="font-mono text-foreground">{last.source_pipeline_id}</span>{" "}
                vs{" "}
                <span className="font-mono text-foreground">
                  {last.previous_version_id ?? "—"}
                </span>
              </div>
              <div>{last.summary}</div>
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-muted-foreground">
              No evaluation yet. The guard runs in the pipeline's RELEASE_CHECK stage.
            </div>
          )}
        </div>

        {/* Differences from latest evaluation */}
        {last && last.differences.length > 0 && (
          <div className="rounded-md border">
            <div className="border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Differences ({last.differences.length})
            </div>
            <ul className="divide-y text-xs">
              {last.differences.map((d, i) => (
                <li key={i} className="grid grid-cols-[160px_1fr_auto] gap-2 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Ban className="h-3 w-3 text-destructive" />
                    <span className="font-medium">{CHECK_LABEL[d.check]}</span>
                  </div>
                  <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
                    <div>{d.field}</div>
                    <div>
                      {d.previous} <ArrowRight className="inline h-3 w-3" />{" "}
                      <span className="text-foreground">{d.candidate}</span>
                    </div>
                  </div>
                  <Badge variant="destructive" className="self-start text-[10px]">
                    Δ {d.delta > 0 ? "+" : ""}
                    {d.delta}
                  </Badge>
                </li>
              ))}
            </ul>
            <div className="border-t bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
              {last.differences.map((d) => d.message).join(" · ")}
            </div>
          </div>
        )}

        {/* Recent history */}
        <div className="rounded-md border bg-card">
          <div className="border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Recent evaluations
          </div>
          {state.history.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No evaluations recorded.
            </div>
          ) : (
            <ul className="max-h-64 divide-y overflow-auto">
              {state.history.slice(0, 20).map((e) => (
                <HistoryRow key={e.id} evaluation={e} />
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          Checks: file_count drop · route_count mismatch · isolated/orphan growth · coupling
          (edges/component) increase &gt; {COUPLING_TOLERANCE}. Any breach blocks the release;
          versions remain immutable.
        </div>
      </CardContent>
    </Card>
  );
}

function Verdict({ evaluation }: { evaluation: RegressionEvaluation | null }) {
  if (!evaluation) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldQuestion className="h-4 w-4" />
        Awaiting first pipeline run
      </span>
    );
  }
  if (evaluation.is_first_version) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <ShieldQuestion className="h-4 w-4" />
        <span className="font-medium">Skipped</span>
        <Badge variant="outline" className="text-[10px]">
          first version
        </Badge>
      </span>
    );
  }
  if (evaluation.regression_detected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <ShieldAlert className="h-4 w-4 text-destructive" />
        <span className="font-medium text-destructive">Regression detected</span>
        <Badge variant="destructive" className="text-[10px]">
          BLOCKED
        </Badge>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <ShieldCheck className="h-4 w-4 text-foreground" />
      <span className="font-medium">No regression</span>
      <Badge variant="secondary" className="text-[10px]">
        PASS
      </Badge>
    </span>
  );
}

function HistoryRow({ evaluation }: { evaluation: RegressionEvaluation }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2 text-xs">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          {evaluation.regression_detected ? (
            <Badge variant="destructive" className="text-[10px]">
              BLOCKED
            </Badge>
          ) : evaluation.is_first_version ? (
            <Badge variant="outline" className="text-[10px]">
              SKIPPED
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              PASS
            </Badge>
          )}
          <span className="font-mono text-[11px]">{evaluation.id}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {evaluation.source_pipeline_id}
          </span>
          {evaluation.previous_version_id && (
            <span className="text-[11px] text-muted-foreground">
              vs <span className="font-mono">{evaluation.previous_version_id}</span>
            </span>
          )}
        </div>
        {evaluation.differences.length > 0 && (
          <div className="text-[11px] text-muted-foreground">
            {evaluation.differences
              .map((d) => `${CHECK_LABEL[d.check]} (Δ${d.delta > 0 ? "+" : ""}${d.delta})`)
              .join(" · ")}
          </div>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {new Date(evaluation.evaluated_at).toLocaleTimeString()}
      </div>
    </li>
  );
}
