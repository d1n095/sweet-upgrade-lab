import { useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle, Zap, Activity, AlertCircle, Database, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI, useDetailContext } from './_shared';

export const AutoFixTab = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { openDetail } = useDetailContext();

  const run = async () => {
    setLoading(true);
    const r = await callAI('auto_fix');
    if (r) {
      setResult(r);
      toast.success(`Auto-fix klar – ${r.total_fixed || 0} åtgärdade, ${r.total_flagged || 0} flaggade`);
    }
    setLoading(false);
  };

  const confColor = (c: number) => c >= 80 ? 'text-green-700' : c >= 50 ? 'text-yellow-700' : 'text-red-700';
  const confBg = (c: number) => c >= 80 ? 'bg-green-100' : c >= 50 ? 'bg-yellow-100' : 'bg-red-100';

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">AI Direktfixar</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          AI åtgärdar säkra problem direkt i databasen utan extern byggprocess: 
          dubbletter, föräldralösa kopplingar, felaktig status, tomma kategorier, inaktiva buggar.
          Kräver ≥80% confidence för auto-fix, annars skapas uppgift.
        </p>
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          {['Statussynk', 'Dubblettmerge', 'Felaktiga kopplingar', 'Tomma kategorier', 'Gamla buggar', 'Datasynk'].map(t => (
            <span key={t} className="border rounded-full px-2 py-0.5">{t}</span>
          ))}
        </div>
        <Button onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Kör Direktfixar
        </Button>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
            {[
              { key: 'total_fixed', label: 'Åtgärdade', color: 'text-green-700' },
              { key: 'total_flagged', label: 'Flaggade', color: 'text-yellow-700' },
              { key: 'status_fixed', label: 'Statussynk', color: 'text-foreground' },
              { key: 'duplicates_merged', label: 'Dubbletter', color: 'text-primary' },
              { key: 'orphan_links_fixed', label: 'Kopplingar', color: 'text-foreground' },
              { key: 'categories_hidden', label: 'Kategorier', color: 'text-foreground' },
              { key: 'stale_bugs_closed', label: 'Gamla buggar', color: 'text-foreground' },
            ].map(s => (
              <Card key={s.key} className="p-2 text-center">
                <p className={cn('text-xl font-bold', s.color)}>{result[s.key] || 0}</p>
                <p className="text-[9px] text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Data sync info */}
          {result.data_sync && (
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Data Sync:</span>
                <span>{result.data_sync.issues} problem hittade, {result.data_sync.fixed} åtgärdade</span>
              </div>
            </Card>
          )}

          {/* Fix log */}
          {result.fixes?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Åtgärdslogg ({result.fixes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {result.fixes.map((fix: any, i: number) => (
                      <div
                        key={i}
                        className={cn(
                          'flex items-start gap-2 p-2 rounded text-sm border',
                          fix.fixed ? 'border-green-200 bg-green-50/50' : 'border-yellow-200 bg-yellow-50/50',
                          fix.target_id && 'cursor-pointer hover:bg-muted/40'
                        )}
                        onClick={() => fix.target_id && openDetail(fix.target_id)}
                      >
                        {fix.fixed ? <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate">{fix.action}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[9px]">{fix.type}</Badge>
                            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', confBg(fix.confidence), confColor(fix.confidence))}>
                              {fix.confidence}% confidence
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Fallback tasks */}
          {result.fallback_tasks?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" /> Kräver manuell granskning ({result.fallback_tasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {result.fallback_tasks.map((t: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">• {t}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── UI Overflow Detection Tab ──
