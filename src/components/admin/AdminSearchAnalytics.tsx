import { useState, useEffect } from 'react';
import { Search, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface SearchTerm {
  search_term: string;
  count: number;
  avg_results: number;
}

const AdminSearchAnalytics = () => {
  const [topSearches, setTopSearches] = useState<SearchTerm[]>([]);
  const [noResults, setNoResults] = useState<SearchTerm[]>([]);
  const [totalSearches, setTotalSearches] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Get all search logs from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logs } = await supabase
        .from('search_logs')
        .select('search_term, results_count')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!logs) { setLoading(false); return; }

      setTotalSearches(logs.length);

      // Aggregate by term
      const termMap = new Map<string, { count: number; totalResults: number }>();
      logs.forEach(l => {
        const term = l.search_term.toLowerCase().trim();
        if (!term) return;
        const existing = termMap.get(term) || { count: 0, totalResults: 0 };
        existing.count++;
        existing.totalResults += l.results_count;
        termMap.set(term, existing);
      });

      const all = Array.from(termMap.entries()).map(([term, data]) => ({
        search_term: term,
        count: data.count,
        avg_results: Math.round(data.totalResults / data.count),
      }));

      setTopSearches(all.sort((a, b) => b.count - a.count).slice(0, 20));
      setNoResults(all.filter(t => t.avg_results === 0).sort((a, b) => b.count - a.count).slice(0, 15));
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top searches */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Mest sökta
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

        {/* No results */}
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
      </div>
    </div>
  );
};

export default AdminSearchAnalytics;
