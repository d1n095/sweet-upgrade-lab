import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { CheckCircle, Clock, Loader2, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function StatusIcon({ status }: { status: string }) {
  if (status === 'done' || status === 'completed') {
    return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
  }
  if (status === 'failed') {
    return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  }
  return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
}

export default function DashboardHistory() {
  const { user } = useAuth();

  const { data: scans = [], isLoading } = useQuery({
    queryKey: ['dashboard-history', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scan_runs')
        .select('id, status, system_health_score, total_new_issues, created_at, completed_at')
        .eq('started_by', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">History</h1>

      {scans.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No scans yet.</p>
      ) : (
        <div className="space-y-2">
          {scans.map(scan => (
            <Card key={scan.id}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <StatusIcon status={scan.status} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {scan.completed_at
                      ? format(new Date(scan.completed_at), 'MMM d, yyyy HH:mm')
                      : format(new Date(scan.created_at ?? ''), 'MMM d, yyyy HH:mm')}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{scan.id}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {scan.system_health_score !== null && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        scan.system_health_score >= 80 && 'border-green-400 text-green-700',
                        scan.system_health_score >= 50 &&
                          scan.system_health_score < 80 &&
                          'border-yellow-400 text-yellow-700',
                        scan.system_health_score < 50 && 'border-red-400 text-red-700',
                      )}
                    >
                      {scan.system_health_score}%
                    </Badge>
                  )}
                  {scan.total_new_issues !== null && (
                    <span className="text-xs text-muted-foreground">
                      {scan.total_new_issues} issue{scan.total_new_issues !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
