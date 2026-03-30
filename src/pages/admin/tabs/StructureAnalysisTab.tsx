import { useState } from 'react';
import { Copy, Loader2, AlertTriangle, ArrowRight, Layers, LayoutGrid, GitMerge, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { callAI, copyToClipboard } from './_shared';

export const StructureAnalysisTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runAnalysis = async () => {
    setLoading(true);
    const res = await callAI('structure_analysis');
    if (res) setResult(res);
    setLoading(false);
  };

  const typeIcon = (t: string) => {
    switch (t) {
      case 'misplaced': return <ArrowRightLeft className="w-3.5 h-3.5" />;
      case 'duplicated': return <Copy className="w-3.5 h-3.5" />;
      case 'fragmented': return <Layers className="w-3.5 h-3.5" />;
      case 'merge_candidate': return <GitMerge className="w-3.5 h-3.5" />;
      default: return <LayoutGrid className="w-3.5 h-3.5" />;
    }
  };

  const severityVariant = (s: string) => {
    if (s === 'critical' || s === 'high') return 'destructive' as const;
    if (s === 'medium') return 'default' as const;
    return 'secondary' as const;
  };

  return (
    <div className="space-y-4">
      <Button onClick={runAnalysis} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />}
        Kör strukturanalys
      </Button>

      {result && (
        <div className="space-y-4">
          {/* Score */}
          <Card className="border-border">
            <CardContent className="py-4 flex items-center gap-4">
              <div className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2',
                result.overall_score >= 70 ? 'border-green-500 text-green-700' :
                result.overall_score >= 40 ? 'border-yellow-500 text-yellow-700' :
                'border-red-500 text-red-700'
              )}>
                {result.overall_score}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm">Strukturhälsa</h3>
                <p className="text-xs text-muted-foreground mt-1">{result.summary}</p>
              </div>
            </CardContent>
          </Card>

          {/* Issues */}
          {result.issues?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" /> Strukturproblem ({result.issues.length})
                </CardTitle>
              </CardHeader>
              <CardContent><ScrollArea className="max-h-[50vh]"><div className="space-y-3 pr-2">
                {result.issues.map((issue: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      {typeIcon(issue.issue_type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-xs">{issue.title}</span>
                          <Badge variant={severityVariant(issue.severity)} className="text-[9px]">{issue.severity}</Badge>
                          <Badge variant="outline" className="text-[9px]">{issue.issue_type}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">{issue.explanation}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-muted-foreground">Nuvarande:</span>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{issue.current_location}</code>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Förslag:</span>
                      <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">{issue.suggested_location}</code>
                    </div>
                    {issue.affected_routes?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {issue.affected_routes.map((r: string, j: number) => (
                          <Badge key={j} variant="outline" className="text-[8px]">{r}</Badge>
                        ))}
                      </div>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => copyToClipboard(issue.lovable_prompt)}>
                      <Copy className="w-3 h-3" /> Kopiera prompt
                    </Button>
                  </div>
                ))}
              </div></ScrollArea></CardContent>
            </Card>
          )}

          {/* Merge suggestions */}
          {result.merge_suggestions?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitMerge className="w-4 h-4 text-primary" /> Sammanslagningsförslag ({result.merge_suggestions.length})
                </CardTitle>
              </CardHeader>
              <CardContent><ScrollArea className="max-h-[50vh]"><div className="space-y-3 pr-2">
                {result.merge_suggestions.map((ms: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ms.modules.map((m: string, j: number) => (
                        <Badge key={j} variant="outline" className="text-[10px]">{m}</Badge>
                      ))}
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <Badge className="text-[10px]">{ms.merged_name}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{ms.reason}</p>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => copyToClipboard(ms.lovable_prompt)}>
                      <Copy className="w-3 h-3" /> Kopiera prompt
                    </Button>
                  </div>
                ))}
              </div></ScrollArea></CardContent>
            </Card>
          )}

          {/* Ideal structure */}
          {result.ideal_structure?.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-primary" /> Ideal struktur
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {result.ideal_structure.map((g: any, i: number) => (
                    <div key={i} className="border rounded-lg p-2.5">
                      <h4 className="text-xs font-semibold mb-1.5">{g.group}</h4>
                      <div className="flex flex-wrap gap-1">
                        {g.modules.map((m: string, j: number) => (
                          <Badge key={j} variant="secondary" className="text-[9px]">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── Development Guardian Tab ──
