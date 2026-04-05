import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Wifi, Clock } from 'lucide-react';
import { safeFetch } from '@/lib/safeInvoke';

interface WebhookHealth {
  status: string;
  stripe_key_configured: boolean;
  webhook_secret_configured: boolean;
  webhook_secret_prefix: string | null;
  supabase_url_configured: boolean;
  last_event_time: string | null;
  recent_events: Array<{
    time: string;
    message: string;
    type: string;
    event_type: string | null;
  }>;
  timestamp: string;
}

const AdminWebhookStatus = () => {
  const [health, setHealth] = useState<WebhookHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await safeFetch('stripe-webhook', {
        method: 'GET',
        isAdmin: true,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || 'Kunde inte nå webhook');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMins < 1) return 'Just nu';
    if (diffMins < 60) return `${diffMins} min sedan`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h sedan`;
    return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const allGood = health?.stripe_key_configured && health?.webhook_secret_configured && health?.supabase_url_configured;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wifi className="w-4 h-4 text-primary" />
            Stripe Webhook Status
          </CardTitle>
          <Button onClick={checkHealth} variant="outline" size="sm" disabled={loading} className="gap-1.5 h-7 text-xs">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Testa
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <XCircle className="w-4 h-4 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Webhook ej nåbar</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {health && (
          <>
            {/* Overall status */}
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${
              allGood ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'
            }`}>
              {allGood ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <div>
                <p className={`text-sm font-medium ${allGood ? 'text-green-700' : 'text-amber-700'}`}>
                  {allGood ? 'Webhook korrekt konfigurerad' : 'Konfigurationsfel'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {health.last_event_time
                    ? `Senaste event: ${formatTime(health.last_event_time)}`
                    : 'Inga events mottagna ännu'}
                </p>
              </div>
            </div>

            {/* Config checklist */}
            <div className="space-y-1.5">
              {[
                { label: 'STRIPE_SECRET_KEY', ok: health.stripe_key_configured },
                { label: 'STRIPE_WEBHOOK_SECRET', ok: health.webhook_secret_configured, detail: health.webhook_secret_prefix },
                { label: 'SUPABASE_URL', ok: health.supabase_url_configured },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  {item.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-destructive" />
                  )}
                  <span className={item.ok ? 'text-foreground' : 'text-destructive font-medium'}>{item.label}</span>
                  {item.detail && <span className="text-xs text-muted-foreground ml-auto font-mono">{item.detail}</span>}
                </div>
              ))}
            </div>

            {/* Setup guide */}
            {!allGood && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                <p className="text-xs font-semibold">Setup-guide:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Gå till <span className="font-medium">Stripe Dashboard → Developers → Webhooks</span></li>
                  <li>Lägg till endpoint: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">[SUPABASE_URL]/functions/v1/stripe-webhook</code></li>
                  <li>Välj events: <code className="text-[10px]">checkout.session.completed</code>, <code className="text-[10px]">checkout.session.expired</code>, <code className="text-[10px]">payment_intent.payment_failed</code>, <code className="text-[10px]">charge.refunded</code></li>
                  <li>Kopiera "Signing secret" (whsec_...) och lägg in som <span className="font-medium">STRIPE_WEBHOOK_SECRET</span></li>
                </ol>
              </div>
            )}

            {/* Recent events */}
            {health.recent_events.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Senaste webhook-events</p>
                {health.recent_events.map((evt, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded bg-secondary/30 text-xs">
                    <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">{formatTime(evt.time)}</span>
                    <span className="truncate flex-1">{evt.message}</span>
                    <Badge variant={evt.type === 'error' ? 'destructive' : evt.type === 'warning' ? 'outline' : 'secondary'} className="text-[10px] h-4 shrink-0">
                      {evt.type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminWebhookStatus;
