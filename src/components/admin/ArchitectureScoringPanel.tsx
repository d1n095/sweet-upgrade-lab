/**
 * ARCHITECTURE SCORING PANEL — read-only view of the deterministic score.
 * Renders the breakdown table verbatim. No interpretation, no advice.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calculator, RefreshCw } from "lucide-react";
import {
  runArchitectureScoring,
  type ArchitectureScoreReport,
  type ScoreFactor,
} from "@/core/scanner/architectureScoring";

const GRADE_VARIANT: Record<ArchitectureScoreReport["grade"], "default" | "secondary" | "destructive" | "outline"> = {
  A: "default",
  B: "secondary",
  C: "secondary",
  D: "destructive",
  F: "destructive",
};

export function ArchitectureScoringPanel() {
  const [report, setReport] = useState<ArchitectureScoreReport>(() =>
    runArchitectureScoring()
  );
  const [openKey, setOpenKey] = useState<ScoreFactor["key"] | null>(null);

  const factors = report.score_breakdown;

  const scoreColor = useMemo(() => {
    const s = report.architecture_score;
    if (s >= 90) return "text-emerald-500";
    if (s >= 75) return "text-lime-500";
    if (s >= 60) return "text-amber-500";
    if (s >= 40) return "text-orange-500";
    return "text-destructive";
  }, [report.architecture_score]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4" />
            Architecture Scoring
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              DETERMINISTIC
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => setReport(runArchitectureScoring())}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Recalculate
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Headline */}
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border bg-muted/30 px-4 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              architecture_score
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`font-mono text-4xl font-semibold tabular-nums ${scoreColor}`}>
                {report.architecture_score}
              </span>
              <span className="font-mono text-xs text-muted-foreground">/ 100</span>
              <Badge variant={GRADE_VARIANT[report.grade]} className="ml-2 font-mono">
                {report.grade}
              </Badge>
            </div>
            {report.raw_score !== report.architecture_score && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                raw: <span className="font-mono">{report.raw_score}</span> (clamped to 0–100)
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Files" value={report.inputs.file_count} />
            <Stat label="Routes" value={report.inputs.route_count} />
            <Stat label="Graph nodes" value={report.inputs.node_count} />
            <Stat label="Graph edges" value={report.inputs.edge_count} />
          </div>
        </div>

        {/* Breakdown table */}
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Factor</th>
                <th className="px-3 py-2 text-right font-medium">Count</th>
                <th className="px-3 py-2 text-right font-medium">× Weight</th>
                <th className="px-3 py-2 text-right font-medium">Penalty</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {factors.map((f) => {
                const isOpen = openKey === f.key;
                return (
                  <>
                    <tr
                      key={f.key}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setOpenKey(isOpen ? null : f.key)}
                    >
                      <td className="px-3 py-2">
                        <div className="font-mono text-[11px]">{f.key}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {f.description}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {f.count}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                        × {f.weight}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono tabular-nums ${
                          f.penalty > 0 ? "text-destructive" : ""
                        }`}
                      >
                        −{f.penalty}
                      </td>
                    </tr>
                    {isOpen && f.samples.length > 0 && (
                      <tr key={`${f.key}-samples`} className="bg-muted/20">
                        <td colSpan={4} className="px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            samples ({f.samples.length} of {f.count})
                          </div>
                          <ul className="mt-1 space-y-0.5">
                            {f.samples.map((s, i) => (
                              <li
                                key={i}
                                className="truncate font-mono text-[11px] text-muted-foreground"
                              >
                                {s}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/40">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right font-medium">
                  Total penalty
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-destructive">
                  −{report.total_penalty}
                </td>
              </tr>
              <tr className="border-t">
                <td colSpan={3} className="px-3 py-2 text-right font-medium">
                  100 − penalty =
                </td>
                <td className={`px-3 py-2 text-right font-mono font-semibold tabular-nums ${scoreColor}`}>
                  {report.architecture_score}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground">
          score = 100 − (orphans×1) − (duplicates×2) − (cycles×5) − (cross-layer×3) −
          (unmounted×2) − (high-coupling×1). Pure arithmetic. No interpretation, no
          subjective weighting.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-card px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}
