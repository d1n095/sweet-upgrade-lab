import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, Package, RotateCcw, TrendingDown, TrendingUp, Users, Zap } from 'lucide-react';
import { format, subDays, subHours } from 'date-fns';

type Severity = 'ok' | 'warning' | 'critical';

interface InsightItem {
  label: string;
  value: number;
  unit: string;
  severity: Severity;
  details?: string;
}

const severityColor: Record<Severity, string> = {
  ok: 'bg-green-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
};

const severityBadge: Record<Severity, string> = {
  ok: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800',
};

const getSeverity = (val: number, warnThreshold: number, critThreshold: number): Severity => {
  if (val >= critThreshold) return 'critical';
  if (val >= warnThreshold) return 'warning';
  return 'ok';
};

const AdminInsights = () => {
  const [period, setPeriod] = useState('7');
  const fromDate = subDays(new Date(), parseInt(period)).toISOString();

  // Packing speed: avg time from paid to packed
  const { data: packingData } = useQuery({
    queryKey: ['insights-packing', period],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, created_at, packed_at, shipped_at, payment_status, fulfillment_status, total_amount, items')
        .gte('created_at', fromDate)
        .eq('payment_status', 'paid');

      if (!orders?.length) return { avgPackHours: 0, avgShipHours: 0, slowOrders: [], total: 0 };

      const packTimes: number[] = [];
      const shipTimes: number[] = [];
      const slowOrders: any[] = [];

      for (const o of orders) {
        if (o.packed_at) {
          const hours = (new Date(o.packed_at).getTime() - new Date(o.created_at).getTime()) / 3600000;
          packTimes.push(hours);
          if (hours > 24) slowOrders.push({ ...o, delayHours: hours, type: 'packing' });
        }
        if (o.shipped_at && o.packed_at) {
          const hours = (new Date(o.shipped_at).getTime() - new Date(o.packed_at).getTime()) / 3600000;
          shipTimes.push(hours);
          if (hours > 24) slowOrders.push({ ...o, delayHours: hours, type: 'shipping' });
        }
      }

      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      return {
        avgPackHours: Math.round(avg(packTimes) * 10) / 10,
        avgShipHours: Math.round(avg(shipTimes) * 10) / 10,
        slowOrders: slowOrders.sort((a, b) => b.delayHours - a.delayHours).slice(0, 10),
        total: orders.length,
      };
    },
  });

  // SLA performance from tasks
  const { data: taskData } = useQuery({
    queryKey: ['insights-tasks', period],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from('staff_tasks')
        .select('*')
        .gte('created_at', fromDate);

      if (!tasks?.length) return { total: 0, done: 0, slaMisses: 0, byType: {} as Record<string, { total: number; done: number; slaMiss: number; avgSeconds: number }> };

      const byType: Record<string, { total: number; done: number; slaMiss: number; totalSeconds: number }> = {};

      let slaMisses = 0;
      let doneCount = 0;

      for (const t of tasks) {
        const type = t.task_type || 'general';
        if (!byType[type]) byType[type] = { total: 0, done: 0, slaMiss: 0, totalSeconds: 0 };
        byType[type].total++;

        if (t.status === 'done') {
          doneCount++;
          byType[type].done++;
          if (t.due_at && t.completed_at && new Date(t.completed_at) > new Date(t.due_at)) {
            slaMisses++;
            byType[type].slaMiss++;
          }
          if (t.completed_at && t.claimed_at) {
            byType[type].totalSeconds += (new Date(t.completed_at).getTime() - new Date(t.claimed_at).getTime()) / 1000;
          }
        }
      }

      const result: Record<string, { total: number; done: number; slaMiss: number; avgSeconds: number }> = {};
      for (const [k, v] of Object.entries(byType)) {
        result[k] = { ...v, avgSeconds: v.done > 0 ? Math.round(v.totalSeconds / v.done) : 0 };
      }

      return { total: tasks.length, done: doneCount, slaMisses, byType: result };
    },
  });

  // Incidents per product
  const { data: incidentData } = useQuery({
    queryKey: ['insights-incidents', period],
    queryFn: async () => {
      const { data: incidents } = await supabase
        .from('order_incidents')
        .select('id, order_id, type, priority, status, title, created_at')
        .gte('created_at', fromDate);

      if (!incidents?.length) return { total: 0, byType: {} as Record<string, number>, highPriority: 0, unresolved: 0 };

      const byType: Record<string, number> = {};
      let highPriority = 0;
      let unresolved = 0;

      for (const i of incidents) {
        byType[i.type] = (byType[i.type] || 0) + 1;
        if (i.priority === 'high') highPriority++;
        if (!['resolved', 'closed'].includes(i.status)) unresolved++;
      }

      return { total: incidents.length, byType, highPriority, unresolved };
    },
  });

  // Refund stats
  const { data: refundData } = useQuery({
    queryKey: ['insights-refunds', period],
    queryFn: async () => {
      const { data: refunds } = await supabase
        .from('refund_requests')
        .select('id, order_id, status, reason, refund_amount, created_at')
        .gte('created_at', fromDate);

      if (!refunds?.length) return { total: 0, approved: 0, totalAmount: 0, reasons: {} as Record<string, number> };

      const reasons: Record<string, number> = {};
      let approved = 0;
      let totalAmount = 0;

      for (const r of refunds) {
        if (r.reason) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
        if (r.status === 'approved') {
          approved++;
          totalAmount += r.refund_amount || 0;
        }
      }

      return { total: refunds.length, approved, totalAmount: Math.round(totalAmount), reasons };
    },
  });

  // Performance summary
  const { data: perfData } = useQuery({
    queryKey: ['insights-perf'],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_performance')
        .select('*')
        .order('points', { ascending: false });
      return data || [];
    },
  });

  const packSeverity = getSeverity(packingData?.avgPackHours || 0, 12, 24);
  const shipSeverity = getSeverity(packingData?.avgShipHours || 0, 12, 24);
  const slaMissRate = taskData?.done ? Math.round((taskData.slaMisses / taskData.done) * 100) : 0;
  const slaSeverity = getSeverity(slaMissRate, 10, 25);
  const incidentSeverity = getSeverity(incidentData?.unresolved || 0, 3, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Insights</h1>
          <p className="text-muted-foreground text-sm">Identifiera flaskhalsar och problem i realtid</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Idag</SelectItem>
            <SelectItem value="7">7 dagar</SelectItem>
            <SelectItem value="30">30 dagar</SelectItem>
            <SelectItem value="90">90 dagar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Heatmap Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeatCard
          icon={<Package className="h-5 w-5" />}
          title="Packningstid"
          value={`${packingData?.avgPackHours || 0}h`}
          subtitle="snitt paid → packed"
          severity={packSeverity}
        />
        <HeatCard
          icon={<Zap className="h-5 w-5" />}
          title="Frakttid"
          value={`${packingData?.avgShipHours || 0}h`}
          subtitle="snitt packed → shipped"
          severity={shipSeverity}
        />
        <HeatCard
          icon={<Clock className="h-5 w-5" />}
          title="SLA Misses"
          value={`${slaMissRate}%`}
          subtitle={`${taskData?.slaMisses || 0} av ${taskData?.done || 0} tasks`}
          severity={slaSeverity}
        />
        <HeatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Olösta ärenden"
          value={`${incidentData?.unresolved || 0}`}
          subtitle={`${incidentData?.highPriority || 0} hög prioritet`}
          severity={incidentSeverity}
        />
      </div>

      {/* Detail Tabs */}
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">Orderflöde</TabsTrigger>
          <TabsTrigger value="tasks">Tasks / SLA</TabsTrigger>
          <TabsTrigger value="incidents">Ärenden</TabsTrigger>
          <TabsTrigger value="refunds">Refunds</TabsTrigger>
          <TabsTrigger value="staff">Personal</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Långsamma orders</CardTitle></CardHeader>
            <CardContent>
              {!packingData?.slowOrders?.length ? (
                <p className="text-muted-foreground text-sm">Inga försenade orders ✓</p>
              ) : (
                <div className="space-y-2">
                  {packingData.slowOrders.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <span className="font-mono text-sm">{o.id.slice(0, 8)}…</span>
                        <span className="ml-2 text-sm text-muted-foreground">
                          {o.type === 'packing' ? 'Packning' : 'Frakt'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={o.delayHours > 48 ? severityBadge.critical : severityBadge.warning}>
                          {Math.round(o.delayHours)}h
                        </Badge>
                        <span className="text-sm">{o.total_amount} kr</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Tasks per typ</CardTitle></CardHeader>
            <CardContent>
              {!taskData?.byType || !Object.keys(taskData.byType).length ? (
                <p className="text-muted-foreground text-sm">Ingen taskdata för perioden</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(taskData.byType).map(([type, stats]) => {
                    const missRate = stats.done ? Math.round((stats.slaMiss / stats.done) * 100) : 0;
                    const sev = getSeverity(missRate, 10, 25);
                    const avgMin = Math.round(stats.avgSeconds / 60);
                    return (
                      <div key={type} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${severityColor[sev]}`} />
                            <span className="font-medium capitalize">{type}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{stats.done}/{stats.total} klara</span>
                            <span>SLA miss: {missRate}%</span>
                            <span>Snitt: {avgMin}min</span>
                          </div>
                        </div>
                        <Progress value={stats.total ? (stats.done / stats.total) * 100 : 0} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Ärenden per typ</CardTitle></CardHeader>
              <CardContent>
                {!incidentData?.byType || !Object.keys(incidentData.byType).length ? (
                  <p className="text-muted-foreground text-sm">Inga ärenden för perioden ✓</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(incidentData.byType)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between p-2 rounded border">
                          <span className="capitalize text-sm">{type}</span>
                          <Badge variant={count > 5 ? 'destructive' : 'secondary'}>{count}</Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Sammanfattning</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Totalt</span><span className="font-bold">{incidentData?.total || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Olösta</span>
                  <span className={`font-bold ${(incidentData?.unresolved || 0) > 0 ? 'text-destructive' : ''}`}>
                    {incidentData?.unresolved || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Hög prioritet</span>
                  <span className={`font-bold ${(incidentData?.highPriority || 0) > 0 ? 'text-destructive' : ''}`}>
                    {incidentData?.highPriority || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="refunds" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Refund-orsaker</CardTitle></CardHeader>
              <CardContent>
                {!refundData?.reasons || !Object.keys(refundData.reasons).length ? (
                  <p className="text-muted-foreground text-sm">Inga refunds för perioden ✓</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(refundData.reasons)
                      .sort(([, a], [, b]) => b - a)
                      .map(([reason, count]) => (
                        <div key={reason} className="flex items-center justify-between p-2 rounded border">
                          <span className="text-sm truncate max-w-[200px]">{reason}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Sammanfattning</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Totalt begärda</span><span className="font-bold">{refundData?.total || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Godkända</span><span className="font-bold">{refundData?.approved || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Belopp</span><span className="font-bold">{refundData?.totalAmount || 0} kr</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Personal – Problemområden</CardTitle></CardHeader>
            <CardContent>
              {!perfData?.length ? (
                <p className="text-muted-foreground text-sm">Ingen prestandadata än</p>
              ) : (
                <div className="space-y-3">
                  {perfData.map((p) => {
                    const slaRate = (p.sla_hits + p.sla_misses) > 0
                      ? Math.round((p.sla_hits / (p.sla_hits + p.sla_misses)) * 100)
                      : 100;
                    const sev = getSeverity(100 - slaRate, 10, 25);
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${severityColor[sev]}`} />
                          <span className="font-mono text-sm">{p.user_id.slice(0, 8)}…</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{p.tasks_completed} klara</span>
                          <span>SLA {slaRate}%</span>
                          <span>{p.points} poäng</span>
                          <Badge className={severityBadge[sev]}>{sev === 'ok' ? 'OK' : sev === 'warning' ? 'Varning' : 'Kritisk'}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const HeatCard = ({ icon, title, value, subtitle, severity }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  severity: Severity;
}) => (
  <Card className={`relative overflow-hidden border-l-4 ${
    severity === 'critical' ? 'border-l-red-500' : severity === 'warning' ? 'border-l-yellow-500' : 'border-l-green-500'
  }`}>
    <CardContent className="pt-4 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">{icon} {title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className={`w-4 h-4 rounded-full ${severityColor[severity]}`} />
      </div>
    </CardContent>
  </Card>
);

export default AdminInsights;
