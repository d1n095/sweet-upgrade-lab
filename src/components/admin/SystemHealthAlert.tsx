import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface HealthRow {
  overall_status: 'ok' | 'degraded' | 'failed';
  checked_at: string;
  details: { failures?: string[]; queue_depth?: number } | null;
  api_ms: number | null;
}

export const SystemHealthAlert = () => {
  const [latest, setLatest] = useState<HealthRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('system_health_checks' as any)
        .select('overall_status, checked_at, details, api_ms')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setLatest(data as unknown as HealthRow);
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!latest || latest.overall_status === 'ok') return null;

  const isFailed = latest.overall_status === 'failed';
  const failures = latest.details?.failures || [];

  return (
    <Alert variant={isFailed ? 'destructive' : 'default'} className="mb-4">
      {isFailed ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <AlertTitle>
        {isFailed ? 'Systemfel upptäckt' : 'Systemet är försämrat'}
      </AlertTitle>
      <AlertDescription>
        <div className="text-sm">
          {failures.length > 0 ? failures.join(', ') : 'Hälsokontroll misslyckades'}
          {latest.api_ms != null && <span className="ml-2 opacity-70">({latest.api_ms}ms)</span>}
        </div>
      </AlertDescription>
    </Alert>
  );
};
