import { useState } from 'react';
import { BarChart3, Loader2, Send, AlertTriangle, Lightbulb, Info, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI, DataInsight, DataAnalysis } from './_shared';

// ── Data Insights Tab ──
export const DataInsightsTab = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<DataAnalysis | null>(null);
  const [autoAction, setAutoAction] = useState(false);

  const analyze = async () => {
    setLoading(true);
    const res = await callAI('data_insights', { auto_action: autoAction });
    if (res) {
      setAnalysis(res);
      if (res.work_items_created > 0) {
        toast.success(`${res.work_items_created} uppgifter skapade från varningar`);
      }
    }
    setLoading(false);
  };

  const createTaskFromInsight = async (insight: DataInsight) => {
    const res = await callAI('create_action', {
      title: insight.title,
      description: `${insight.description}\n\nRekommenderad åtgärd: ${insight.action}`,
      priority: insight.type === 'warning' ? 'high' : 'medium',
      category: 'business',
      source_type: 'insight',
    });
    if (res?.created) toast.success('Uppgift skapad i Workbench');
  };

  const INSIGHT_ICONS: Record<string, any> = { warning: AlertTriangle, opportunity: Lightbulb, info: Info };
  const INSIGHT_COLORS: Record<string, string> = {
    warning: 'text-destructive bg-destructive/10 border-destructive/20',
    opportunity: 'text-green-700 bg-green-50 border-green-200',
    info: 'text-blue-700 bg-blue-50 border-blue-200',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <Button onClick={analyze} disabled={loading} className="flex-1 gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          Analysera hela systemet
        </Button>
        <Button variant={autoAction ? 'default' : 'outline'} size="sm" className="gap-1 text-xs h-9" onClick={() => setAutoAction(!autoAction)}>
          <Zap className="w-3.5 h-3.5" />
          {autoAction ? 'Auto-action PÅ' : 'Auto-action AV'}
        </Button>
      </div>
      {autoAction && <p className="text-[10px] text-muted-foreground">⚡ Varningar skapar automatiskt uppgifter i Workbench</p>}

      {analysis && (
        <div className="space-y-4">
          <div className="border rounded-lg p-4 flex items-center gap-4">
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2',
              analysis.health_score >= 70 ? 'border-green-500 text-green-700 bg-green-50' :
              analysis.health_score >= 40 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
              'border-red-500 text-red-700 bg-red-50'
            )}>
              {analysis.health_score}
            </div>
            <div>
              <h3 className="text-sm font-semibold">Systemhälsa</h3>
              <p className="text-xs text-muted-foreground">{analysis.summary}</p>
            </div>
          </div>

          <div className="space-y-2">
            {analysis.insights.map((insight, i) => {
              const Icon = INSIGHT_ICONS[insight.type] || Info;
              return (
                <div key={i} className={cn('border rounded-lg p-3 space-y-1', INSIGHT_COLORS[insight.type])}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0" />
                    <h4 className="text-sm font-semibold">{insight.title}</h4>
                  </div>
                  <p className="text-xs">{insight.description}</p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <Send className="w-3 h-3" />
                      <span className="text-xs font-medium">{insight.action}</span>
                    </div>
                    <Button size="sm" variant="outline" className="h-5 text-[9px] gap-0.5" onClick={() => createTaskFromInsight(insight)}>
                      <Zap className="w-2.5 h-2.5" /> Skapa uppgift
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

