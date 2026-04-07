import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'border-red-400 text-red-700',
  high: 'border-orange-400 text-orange-700',
  medium: 'border-yellow-400 text-yellow-700',
  low: 'border-blue-400 text-blue-700',
};

const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export default function DashboardWorkbench() {
  const { user } = useAuth();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['dashboard-workbench', user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Fetch open work items created by the user
      const { data, error } = await supabase
        .from('work_items')
        .select('id, title, description, priority, status, item_type, created_at')
        .eq('created_by', user!.id)
        .not('status', 'in', '("done","fixed","resolved","ignored")')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sorted = items.slice().sort(
    (a, b) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workbench</h1>
        <span className="text-sm text-muted-foreground">{sorted.length} open</span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No open items. Run a scan to detect issues.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map(item => (
            <Card key={item.id}>
              <CardContent className="py-3 px-4 flex items-start gap-3">
                <Badge
                  variant="outline"
                  className={cn('shrink-0 text-xs mt-0.5', PRIORITY_COLORS[item.priority] ?? '')}
                >
                  {item.priority}
                </Badge>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {item.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
