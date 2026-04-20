import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { runRuleEvolution, type RuleEvolutionReport, type RuleSeverity } from "@/core/scanner/ruleEvolution";
import { TrendingUp, TrendingDown, ShieldCheck, RefreshCw } from "lucide-react";

const sevVariant: Record<RuleSeverity, "destructive" | "default" | "secondary" | "outline"> = {
  CRITICAL: "destructive",
  WARNING: "default",
  INFO: "secondary",
  DOWNGRADED: "outline",
};

export function RuleEvolutionPanel() {
  const [report, setReport] = useState<RuleEvolutionReport | null>(() => {
    try {
      return runRuleEvolution();
    } catch {
      return null;
    }
  });

  const stats = useMemo(() => {
    if (!report) return null;
    return {
      total: report.evolved_rules.length,
      upgraded: report.upgraded_rules.length,
      downgraded: report.downgraded_rules.length,
      enforced: report.enforced_standards.length,
    };
  }, [report]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Rule Evolution Engine
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setReport(runRuleEvolution())}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Evolve
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!report && <p className="text-muted-foreground">No evolution report available.</p>}
        {report && stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="border rounded-md p-2">
                <div className="text-xs text-muted-foreground">Observations</div>
                <div className="font-mono text-lg">{report.observations_considered}</div>
              </div>
              <div className="border rounded-md p-2">
                <div className="text-xs text-muted-foreground">Upgraded</div>
                <div className="font-mono text-lg text-destructive">{stats.upgraded}</div>
              </div>
              <div className="border rounded-md p-2">
                <div className="text-xs text-muted-foreground">Downgraded</div>
                <div className="font-mono text-lg">{stats.downgraded}</div>
              </div>
              <div className="border rounded-md p-2">
                <div className="text-xs text-muted-foreground">Enforced</div>
                <div className="font-mono text-lg text-primary">{stats.enforced}</div>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground font-mono">
              upgrade ≥ {report.upgrade_threshold} versions · downgrade ≥ {report.downgrade_threshold}{" "}
              absent · regression history: {report.regression_history_length}
            </div>

            <section>
              <h4 className="font-medium flex items-center gap-1 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-destructive" /> Upgraded (Critical)
              </h4>
              {report.upgraded_rules.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">None.</p>
              ) : (
                <ul className="space-y-1">
                  {report.upgraded_rules.map((r) => (
                    <li key={r.key} className="border rounded-md p-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-xs truncate">{r.rule} · {r.file}</div>
                        <div className="text-[11px] text-muted-foreground">{r.reason}</div>
                      </div>
                      <Badge variant={sevVariant[r.severity]}>{r.severity}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h4 className="font-medium flex items-center gap-1 mb-2">
                <TrendingDown className="h-3.5 w-3.5" /> Downgraded
              </h4>
              {report.downgraded_rules.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">None.</p>
              ) : (
                <ul className="space-y-1">
                  {report.downgraded_rules.map((r) => (
                    <li key={r.key} className="border rounded-md p-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-xs truncate">{r.rule} · {r.file}</div>
                        <div className="text-[11px] text-muted-foreground">{r.reason}</div>
                      </div>
                      <Badge variant={sevVariant[r.severity]}>{r.severity}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h4 className="font-medium flex items-center gap-1 mb-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Enforced Standards
              </h4>
              {report.enforced_standards.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No stable, violation-free files yet.</p>
              ) : (
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {report.enforced_standards.slice(0, 30).map((s) => (
                    <li key={s.file} className="border rounded-md p-1.5 font-mono text-[11px] truncate">
                      {s.file}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h4 className="font-medium mb-2">All Evolved Rules ({report.evolved_rules.length})</h4>
              {report.evolved_rules.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No rules tracked yet. Run the build pipeline to generate observations.</p>
              ) : (
                <ul className="space-y-1 max-h-60 overflow-y-auto">
                  {report.evolved_rules.map((r) => (
                    <li key={r.key} className="border rounded-md p-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-xs truncate">{r.rule} · {r.file}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.occurrences}× · streak {r.absent_streak} · {r.change}
                        </div>
                      </div>
                      <Badge variant={sevVariant[r.severity]}>{r.severity}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
