import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ScanRun {
  id: string;
  status: string | null;
  system_health_score: number | null;
  total_new_issues: number | null;
  work_items_created: number | null;
  created_at: string | null;
  completed_at: string | null;
  unified_result: Record<string, any> | null;
  steps_results: Record<string, any> | null;
  executive_summary: string | null;
}

interface ScanOverviewPanelProps {
  latestRun: ScanRun | null;
  loading?: boolean;
}

function getHealthLabel(score: number | null): { label: string; color: string; icon: React.ReactNode } {
  if (score == null) return { label: 'Okänd', color: 'text-muted-foreground', icon: <Activity className="w-5 h-5" /> };
  if (score >= 70) return { label: 'Bra', color: 'text-green-500', icon: <ShieldCheck className="w-5 h-5 text-green-500" /> };
  if (score >= 40) return { label: 'Varning', color: 'text-yellow-500', icon: <ShieldAlert className="w-5 h-5 text-yellow-500" /> };
  return { label: 'Kritisk', color: 'text-red-500', icon: <ShieldX className="w-5 h-5 text-red-500" /> };
}

function getStatusBadge(score: number | null) {
  if (score == null) return <Badge variant="outline">Ingen data</Badge>;
  if (score >= 70) return <Badge className="bg-green-500/20 text-green-600 border-green-500/40">Allt fungerar bra</Badge>;
  if (score >= 40) return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/40">Några problem hittades</Badge>;
  return <Badge className="bg-red-500/20 text-red-600 border-red-500/40">Allvarliga problem</Badge>;
}

function countTotalIssues(run: ScanRun | null): number {
  if (!run) return 0;
  const ur = run.unified_result;
  if (!ur) return run.total_new_issues ?? 0;
  const issues = [
    ...(ur.broken_flows || []),
    ...(ur.fake_features || []),
    ...(ur.interaction_failures || []),
    ...(ur.data_issues || []),
  ];
  return issues.length || run.total_new_issues || 0;
}

export function ScanOverviewPanel({ latestRun, loading }: ScanOverviewPanelProps) {
  const score = latestRun?.system_health_score ?? (latestRun?.unified_result as any)?.system_health_score ?? null;
  const { label, color, icon } = getHealthLabel(score);
  const totalIssues = countTotalIssues(latestRun);
  const scannedAt = latestRun?.completed_at
    ? new Date(latestRun.completed_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
    : null;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Laddar senaste skanningsresultat…</CardContent>
      </Card>
    );
  }

  if (!latestRun) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Ingen skanning har körts än. Kör en skanning för att se resultat här.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          Systemöversikt
          {getStatusBadge(score)}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className={`text-3xl font-bold ${color}`}>{score != null ? score : '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">Hälsopoäng av 100</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className="text-3xl font-bold text-foreground">{totalIssues}</div>
            <div className="text-xs text-muted-foreground mt-1">Problem hittade</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className={`text-2xl font-bold ${color}`}>{label}</div>
            <div className="text-xs text-muted-foreground mt-1">Systemstatus</div>
          </div>
        </div>

        {latestRun.executive_summary && (
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{latestRun.executive_summary}</p>
        )}

        {scannedAt && (
          <p className="mt-2 text-xs text-muted-foreground">Senaste skanning: {scannedAt}</p>
        )}
      </CardContent>
    </Card>
  );
}
