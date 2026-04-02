import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Bug, Copy, Loader2, RefreshCw, Bot, CheckCircle, XCircle, Zap, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callAI, copyToClipboard, applyFix } from './_shared';

// ── Bug AI Tab ──
export const BugTab = () => {
  const [bugs, setBugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, any>>({});
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>('open');

  const loadBugs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('bug_reports')
      .select('id, description, page_url, status, ai_summary, ai_severity, ai_category, ai_tags, created_at, resolution_notes, resolved_at')
      .order('created_at', { ascending: false })
      .limit(30);

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data } = await query;
    setBugs(data || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    loadBugs();
  }, [loadBugs]);

  const analyzeBug = async (bugId: string, deep = false) => {
    setAnalyzing(bugId);
    const res = await callAI(deep ? 'bug_deep_analysis' : 'bug_fix_suggestion', { bug_id: bugId });
    if (res) setFixes(prev => ({ ...prev, [bugId]: deep ? { ...res, _deep: true } : res }));
    setAnalyzing(null);
  };

  const markResolved = async (bugId: string, notes?: string) => {
    const { error } = await supabase
      .from('bug_reports')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_notes: notes || 'Markerad som löst',
      } as any)
      .eq('id', bugId);

    if (!error) {
      toast.success('Bugg markerad som löst ✅');
      setSelectedBugId(null);
      setBugs(prev => prev.filter(b => b.id !== bugId));
    } else {
      toast.error('Kunde inte uppdatera bugg');
    }
  };

  const ignoreBug = async (bugId: string) => {
    const { error } = await supabase
      .from('bug_reports')
      .update({ status: 'ignored' as any, resolution_notes: 'Ignorerad av admin' } as any)
      .eq('id', bugId);

    if (!error) {
      toast.success('Bugg ignorerad');
      setSelectedBugId(null);
      setBugs(prev => prev.filter(b => b.id !== bugId));
    } else {
      toast.error('Kunde inte ignorera bugg');
    }
  };

  const sevBadge = (sev: string) => {
    if (sev === 'critical' || sev === 'high') return 'destructive' as const;
    return 'secondary' as const;
  };

  const selectedBug = bugs.find(b => b.id === selectedBugId) || null;
  const selectedFix = selectedBugId ? fixes[selectedBugId] : null;

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['open', 'resolved', 'all'] as const).map(f => (
            <Button key={f} size="sm" variant={statusFilter === f ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setStatusFilter(f)}>
              {f === 'open' ? '🐛 Öppna' : f === 'resolved' ? '✅ Lösta' : '📋 Alla'}
            </Button>
          ))}
        </div>
        <Button onClick={loadBugs} disabled={loading} variant="outline" size="sm" className="h-7 gap-1 text-xs ml-auto">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Uppdatera
        </Button>
        <Badge variant="secondary" className="text-xs">{bugs.length} buggar</Badge>
      </div>

      {bugs.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Inga buggar hittade 🎉</p>
      ) : (
        <>
          {/* TOP: Horizontal compact bug list */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
            {bugs.map(bug => (
              <button
                key={bug.id}
                onClick={() => setSelectedBugId(bug.id)}
                className={cn(
                  'shrink-0 border rounded-lg px-3 py-2 text-left transition-colors max-w-[220px]',
                  selectedBugId === bug.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
                )}
              >
                <p className="text-[11px] font-medium line-clamp-1">{bug.ai_summary || bug.description?.substring(0, 60)}</p>
                <div className="flex gap-1 mt-1 items-center">
                  {bug.ai_severity && <Badge variant={sevBadge(bug.ai_severity)} className="text-[8px] px-1 py-0 leading-tight">{bug.ai_severity}</Badge>}
                  <span className="text-[8px] text-muted-foreground">{new Date(bug.created_at).toLocaleDateString('sv-SE')}</span>
                </div>
              </button>
            ))}
          </div>

          {/* BOTTOM: Full-width detail */}
          {!selectedBug ? (
            <div className="border border-dashed rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">Klicka på en bugg ovan för att se detaljer</p>
            </div>
          ) : (
            <Card key={selectedBugId!}>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold">{selectedBug.ai_summary || 'Buggrapport'}</h4>
                    <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                      {selectedBug.ai_severity && <Badge variant={sevBadge(selectedBug.ai_severity)} className="text-[10px]">{selectedBug.ai_severity}</Badge>}
                      {selectedBug.ai_category && <Badge variant="outline" className="text-[10px]">{selectedBug.ai_category}</Badge>}
                      <span className="text-[10px] text-muted-foreground">{selectedBug.page_url}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => setSelectedBugId(null)}>✕</Button>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  <Button size="sm" variant="default" className="gap-1 h-7 text-xs" disabled={analyzing === selectedBug.id} onClick={() => analyzeBug(selectedBug.id, false)}>
                    {analyzing === selectedBug.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                    Bearbeta med AI
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" disabled={analyzing === selectedBug.id} onClick={() => analyzeBug(selectedBug.id, false)}>
                    {analyzing === selectedBug.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Analysera
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" disabled={analyzing === selectedBug.id} onClick={() => analyzeBug(selectedBug.id, true)}>
                    {analyzing === selectedBug.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    Djupanalys
                  </Button>
                  {selectedBug.status === 'open' && (
                    <>
                      <Button size="sm" variant="secondary" className="gap-1 h-7 text-xs ml-auto" onClick={() => markResolved(selectedBug.id, selectedFix?.summary || selectedFix?.diagnosis?.summary)}>
                        <CheckCircle className="w-3 h-3" /> Markera löst
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs text-muted-foreground" onClick={() => ignoreBug(selectedBug.id)}>
                        <XCircle className="w-3 h-3" /> Ignorera
                      </Button>
                    </>
                  )}
                </div>

                <div className="bg-muted/30 rounded-md p-3 text-xs space-y-1">
                  <p className="font-medium text-muted-foreground">Beskrivning</p>
                  <p>{selectedBug.description}</p>
                  {selectedBug.resolution_notes && (
                    <div className="mt-2">
                      <p className="font-medium text-muted-foreground">Lösning</p>
                      <p>{selectedBug.resolution_notes}</p>
                    </div>
                  )}
                </div>

                {selectedFix && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Sparkles className="w-3.5 h-3.5" />
                      {selectedFix._deep ? 'AI Djupanalys' : 'AI Output'}
                    </div>
                    {selectedFix.diagnosis?.summary && (
                      <div className="text-xs border rounded-md p-2 bg-muted/30">{selectedFix.diagnosis.summary}</div>
                    )}
                    {selectedFix.summary && !selectedFix.diagnosis?.summary && (
                      <div className="text-xs border rounded-md p-2 bg-muted/30">{selectedFix.summary}</div>
                    )}
                    {(selectedFix.lovable_prompt || selectedFix.fix_suggestions?.[0]?.lovable_prompt) && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => {
                          const fixText = selectedFix.lovable_prompt || selectedFix.fix_suggestions?.[0]?.lovable_prompt || '';
                          applyFix(fixText, selectedBug?.description?.slice(0, 80) || 'Bug fix', {
                            severity: selectedBug?.ai_severity,
                            category: selectedBug?.ai_category,
                            bugId: selectedBug?.id,
                            buttonId: 'apply-fix-bug',
                          });
                        }} id="apply-fix-bug">
                          <Zap className="w-3 h-3" /> Apply Fix
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copyToClipboard(selectedFix.lovable_prompt || selectedFix.fix_suggestions?.[0]?.lovable_prompt || '')}>
                          <Copy className="w-3 h-3" /> Kopiera prompt
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
