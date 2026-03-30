import { useState } from 'react';
import { Sparkles, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { callAI, copyToClipboard, GeneratedPrompt } from './_shared';

// ── Prompt Generator Tab ──
export const PromptGeneratorTab = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedPrompt | null>(null);
  const [history, setHistory] = useState<GeneratedPrompt[]>([]);

  const generate = async () => {
    if (!input.trim() || input.trim().length < 5) { toast.error('Skriv minst 5 tecken'); return; }
    setLoading(true);
    const res = await callAI('generate_prompt', { input: input.trim() });
    if (res) {
      setResult(res);
      setHistory(prev => [res, ...prev].slice(0, 20));
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea placeholder="Beskriv ett problem, en idé eller en bugg..." value={input} onChange={e => setInput(e.target.value)} rows={4} className="text-sm" />
        <Button onClick={generate} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generera prompt
        </Button>
      </div>

      {result && (
        <div className="border rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm">{result.title}</h3>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{result.category}</Badge>
                <Badge variant={result.priority === 'critical' || result.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px]">{result.priority}</Badge>
                {result.tags.map(t => <span key={t} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{t}</span>)}
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs shrink-0" onClick={() => copyToClipboard(result.full_prompt)}>
              <Copy className="w-3 h-3" /> Kopiera
            </Button>
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            <div><span className="text-xs font-semibold text-muted-foreground">🎯 MÅL</span><p className="text-sm">{result.goal}</p></div>
            {result.problem && <div><span className="text-xs font-semibold text-muted-foreground">⚠️ PROBLEM</span><p className="text-sm">{result.problem}</p></div>}
            <div><span className="text-xs font-semibold text-muted-foreground">📋 STEG</span><ol className="list-decimal list-inside text-sm space-y-0.5 mt-0.5">{result.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
            <div><span className="text-xs font-semibold text-muted-foreground">✅ FÖRVÄNTAT RESULTAT</span><p className="text-sm">{result.expected_result}</p></div>
          </div>
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground">Full prompt</span>
              <Button size="sm" variant="ghost" className="h-5 text-[9px] gap-0.5 px-1" onClick={() => copyToClipboard(result.full_prompt)}><Copy className="w-2.5 h-2.5" /> Kopiera</Button>
            </div>
            <div className="text-xs bg-muted/50 rounded-md p-3 whitespace-pre-wrap border font-mono max-h-60 overflow-y-auto">{result.full_prompt}</div>
          </div>
        </div>
      )}

      {history.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">Historik</h4>
          {history.slice(1).map((h, i) => (
            <div key={i} className="border rounded-md p-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{h.title}</p>
                <div className="flex gap-1 mt-0.5">
                  <Badge variant="outline" className="text-[9px]">{h.category}</Badge>
                  <Badge variant="secondary" className="text-[9px]">{h.priority}</Badge>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-6 text-[9px] shrink-0" onClick={() => { setResult(h); copyToClipboard(h.full_prompt); }}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
