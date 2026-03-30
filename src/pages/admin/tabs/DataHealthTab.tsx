import { useState } from 'react';
import { Bug, Copy, Loader2, AlertTriangle, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Database, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const DataHealthTab = () => {
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [results, setResults] = useState<any>(null);

  const run = async (mode: 'scan' | 'repair') => {
    const isRepair = mode === 'repair';
    if (isRepair) setRepairing(true); else setScanning(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Ej inloggad'); setScanning(false); setRepairing(false); return; }

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/data-sync`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode }),
      }
    );

    if (resp.ok) {
      const data = await resp.json();
      setResults(data.results);
      if (isRepair) toast.success(`${data.results.total_fixed} problem åtgärdade`);
    } else {
      toast.error('Fel vid datasync');
    }

    setScanning(false);
    setRepairing(false);
  };

  const healthScore = results
    ? Math.max(0, 100 - (results.total_issues * 5))
    : null;

  const issueCategories = results ? [
    { key: 'orphan_work_items', label: 'Föräldralösa uppgifter', icon: AlertTriangle, fixed: results.orphan_work_items_fixed },
    { key: 'bugs_without_work_items', label: 'Buggar utan uppgift', icon: Bug, fixed: results.bugs_without_work_items_fixed },
    { key: 'status_mismatches', label: 'Statusmismatch', icon: RefreshCw, fixed: results.status_mismatches_fixed },
    { key: 'deleted_order_tasks', label: 'Raderade order-tasks', icon: XCircle, fixed: results.deleted_order_tasks_fixed },
    { key: 'completed_order_tasks', label: 'Klara order-tasks', icon: CheckCircle, fixed: results.completed_order_tasks_fixed || 0 },
    { key: 'cancelled_order_tasks', label: 'Avbrutna order-tasks', icon: XCircle, fixed: results.cancelled_order_tasks_fixed || 0 },
    { key: 'sourceless_items', label: 'Utan källa', icon: AlertCircle, fixed: results.sourceless_items_fixed || 0 },
    { key: 'duplicate_work_items', label: 'Dubbletter', icon: Copy, fixed: 0 },
    { key: 'stale_claimed', label: 'Inaktiva claims', icon: Clock, fixed: results.stale_claimed_fixed },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => run('scan')} disabled={scanning || repairing} className="flex-1 gap-2" variant="outline">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          Skanna data
        </Button>
        <Button onClick={() => run('repair')} disabled={scanning || repairing} className="flex-1 gap-2">
          {repairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          Skanna & reparera
        </Button>
      </div>

      {results && (
        <div className="space-y-4">
          {/* Health score */}
          <div className="border rounded-xl p-4 flex items-center gap-4">
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2',
              (healthScore ?? 0) >= 80 ? 'border-green-500 text-green-700 bg-green-50' :
              (healthScore ?? 0) >= 50 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
              'border-red-500 text-red-700 bg-red-50'
            )}>
              {healthScore}
            </div>
            <div>
              <h3 className="text-sm font-semibold">Data Health Score</h3>
              <p className="text-xs text-muted-foreground">
                {results.total_issues === 0 ? 'Inga problem hittade! 🎉' : `${results.total_issues} problem hittade, ${results.total_fixed} åtgärdade`}
              </p>
            </div>
          </div>

          {/* Issue breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {issueCategories.map(cat => {
              const count = results[cat.key] || 0;
              return (
                <Card key={cat.key} className="border-border">
                  <CardContent className="py-2 px-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <cat.icon className={cn('w-3.5 h-3.5', count > 0 ? 'text-destructive' : 'text-green-600')} />
                      <span className="text-[10px] text-muted-foreground">{cat.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold">{count}</span>
                      {cat.fixed > 0 && <span className="text-[9px] text-green-600">({cat.fixed} fixade)</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Details */}
          {results.details?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Detaljer ({results.details.length})</h4>
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-1.5 pr-2">
                  {results.details.map((d: any, i: number) => (
                    <div key={i} className={cn(
                      'border rounded-md p-2 flex items-start gap-2 text-xs',
                      d.fixed ? 'border-green-200 bg-green-50/50' : 'border-border'
                    )}>
                      {d.fixed ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                      <div className="min-w-0">
                        <Badge variant="outline" className="text-[8px] mr-1">{d.type}</Badge>
                        <span>{d.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Focused Scan (Adaptive Scan Zones) Tab ──
