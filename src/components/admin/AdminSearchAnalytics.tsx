import { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, AlertCircle, BarChart3, Lightbulb, Flame, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface SearchTerm {
  search_term: string;
  count: number;
  avg_results: number;
}

interface TrendItem {
  search_term: string;
  currentCount: number;
  previousCount: number;
  change: number; // percent
  direction: 'up' | 'down' | 'stable';
}

const AdminSearchAnalytics = () => {
  const [topSearches, setTopSearches] = useState<SearchTerm[]>([]);
  const [noResults, setNoResults] = useState<SearchTerm[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [totalSearches, setTotalSearches] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(now.getDate() - 60);

      // Fetch last 60 days for trend comparison
      const { data: logs } = await supabase
        .from('search_logs')
        .select('search_term, results_count, created_at')
        .gte('created_at', sixtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(2000);

      if (!logs) { setLoading(false); return; }

      const recentLogs = logs.filter(l => new Date(l.created_at) >= thirtyDaysAgo);
      const olderLogs = logs.filter(l => new Date(l.created_at) < thirtyDaysAgo);

      setTotalSearches(recentLogs.length);

      // Aggregate recent
      const recentMap = new Map<string, { count: number; totalResults: number }>();
      recentLogs.forEach(l => {
        const term = l.search_term.toLowerCase().trim();
        if (!term) return;
        const existing = recentMap.get(term) || { count: 0, totalResults: 0 };
        existing.count++;
        existing.totalResults += l.results_count;
        recentMap.set(term, existing);
      });

      // Aggregate older period
      const olderMap = new Map<string, number>();
      olderLogs.forEach(l => {
        const term = l.search_term.toLowerCase().trim();
        if (!term) return;
        olderMap.set(term, (olderMap.get(term) || 0) + 1);
      });

      const all = Array.from(recentMap.entries()).map(([term, data]) => ({
        search_term: term,
        count: data.count,
        avg_results: Math.round(data.totalResults / data.count),
      }));

      setTopSearches(all.sort((a, b) => b.count - a.count).slice(0, 20));
      setNoResults(all.filter(t => t.avg_results === 0).sort((a, b) => b.count - a.count).slice(0, 15));

      // Compute trends
      const trendItems: TrendItem[] = Array.from(recentMap.entries()).map(([term, data]) => {
        const prev = olderMap.get(term) || 0;
        const change = prev === 0 ? (data.count > 0 ? 100 : 0) : Math.round(((data.count - prev) / prev) * 100);
        return {
          search_term: term,
          currentCount: data.count,
          previousCount: prev,
          change,
          direction: change > 10 ? 'up' : change < -10 ? 'down' : 'stable',
        };
      });

      // Show trending up first, sorted by change magnitude
      setTrends(
        trendItems
          .filter(t => t.direction !== 'stable' && t.currentCount >= 2)
          .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
          .slice(0, 15)
      );

      setLoading(false);
    };
    load();
  }, []);

  // Product ideas from no-results searches
  const productIdeas = useMemo(() => {
    return noResults.filter(t => t.count >= 2).slice(0, 10);
  }, [noResults]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const TrendIcon = ({ direction }: { direction: string }) => {
    if (direction === 'up') return <ArrowUpRight className="w-3.5 h-3.5 text-green-600" />;
    if (direction === 'down') return <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />;
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Sökanalys</h3>
          <p className="text-sm text-muted-foreground">
            {totalSearches} sökningar senaste 30 dagarna
          </p>
        </div>
      </div>

      <Tabs defaultValue="top" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="top" className="text-xs">Mest sökta</TabsTrigger>
          <TabsTrigger value="noresults" className="text-xs">Utan träff</TabsTrigger>
          <TabsTrigger value="trends" className="text-xs">Trender</TabsTrigger>
          <TabsTrigger value="ideas" className="text-xs">Produktidéer</TabsTrigger>
        </TabsList>

        {/* Top searches */}
        <TabsContent value="top">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Mest sökta termer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {topSearches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Ingen sökdata ännu</p>
              ) : (
                topSearches.map((t, i) => (
                  <div key={t.search_term} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{t.search_term}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs">{t.count}×</Badge>
                      <span className="text-xs text-muted-foreground">{t.avg_results} träffar</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* No results */}
        <TabsContent value="noresults">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                Sökningar utan träff
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {noResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Alla sökningar ger träff 🎉</p>
              ) : (
                noResults.map((t) => (
                  <div key={t.search_term} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <Search className="w-3.5 h-3.5 text-destructive shrink-0" />
                      <span className="text-sm truncate">{t.search_term}</span>
                    </div>
                    <Badge variant="destructive" className="text-xs shrink-0">{t.count}×</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends */}
        <TabsContent value="trends">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Trendande sökningar (30d vs föregående 30d)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {trends.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Inte tillräckligt med data för trender ännu</p>
              ) : (
                trends.map((t) => (
                  <div key={t.search_term} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <TrendIcon direction={t.direction} />
                      <span className="text-sm truncate">{t.search_term}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{t.currentCount}× nu</span>
                      <Badge
                        variant={t.direction === 'up' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {t.change > 0 ? '+' : ''}{t.change}%
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Product ideas */}
        <TabsContent value="ideas">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                Produktidéer (sökningar utan matchning, ≥2 ggr)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {productIdeas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Inga saknade produkter identifierade ännu</p>
              ) : (
                productIdeas.map((t) => (
                  <div key={t.search_term} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <Lightbulb className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                      <span className="text-sm truncate font-medium">{t.search_term}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {t.count} personer sökte
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSearchAnalytics;
