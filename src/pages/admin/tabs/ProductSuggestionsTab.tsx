import { useState } from 'react';
import { Loader2, Lightbulb, Zap, TrendingUp, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { callAI } from './_shared';

export const ProductSuggestionsTab = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    const res = await callAI('product_suggestions');
    if (res) setData(res);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Button onClick={run} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
        Analysera produkter & försäljning
      </Button>

      {data && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{data.summary}</p>

          {data.new_products?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Nya produktförslag</h4>
              {data.new_products.map((p: any, i: number) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <Badge variant="outline" className="text-[9px]">{p.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.reason}</p>
                    <p className="text-xs font-medium">Uppskattat pris: {p.estimated_price}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {data.bundles?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Bundle-förslag</h4>
              {data.bundles.map((b: any, i: number) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-3 space-y-1">
                    <span className="text-sm font-semibold">{b.name}</span>
                    <div className="flex gap-1 flex-wrap">{b.products.map((p: string) => <span key={p} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full">{p}</span>)}</div>
                    <p className="text-xs text-muted-foreground">{b.reason}</p>
                    <Badge variant="secondary" className="text-[9px]">Rabatt: {b.discount}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {data.pricing_suggestions?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Prisförslag</h4>
              {data.pricing_suggestions.map((p: any, i: number) => (
                <div key={i} className="border rounded-lg p-3 space-y-1">
                  <span className="text-sm font-medium">{p.product}</span>
                  {p.current_price && <span className="text-xs text-muted-foreground ml-2">({p.current_price})</span>}
                  <p className="text-xs"><span className="font-medium">Åtgärd:</span> {p.suggested_action}</p>
                  <p className="text-xs text-muted-foreground">{p.reason}</p>
                </div>
              ))}
            </div>
          )}

          {data.campaign_ideas?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Kampanjidéer</h4>
              {data.campaign_ideas.map((c: any, i: number) => (
                <div key={i} className="border rounded-lg p-3 space-y-1">
                  <span className="text-sm font-semibold">{c.title}</span>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                  <Badge variant="outline" className="text-[9px]">Målgrupp: {c.target}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── System Health Tab ──
