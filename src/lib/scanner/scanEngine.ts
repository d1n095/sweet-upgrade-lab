import { supabase } from '@/integrations/supabase/client';

export type ScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ScanIssue {
  component: string;
  rule: string;
  severity: ScanSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export interface ScanResult {
  issues: ScanIssue[];
  scannedAt: string;
  durationMs: number;
}

// ── Rule: Stuck orders ──
async function scanStuckOrders(): Promise<ScanIssue[]> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, created_at, total_amount')
    .eq('payment_status', 'paid')
    .in('fulfillment_status', ['pending', 'unfulfilled'])
    .is('deleted_at', null)
    .lt('created_at', oneDayAgo)
    .limit(50);

  return (data || []).map(order => ({
    component: 'fulfillment',
    rule: 'stuck-order',
    severity: (order.total_amount ?? 0) >= 500 ? 'critical' : 'high',
    message: `Order ${order.order_number ?? order.id.slice(0, 8)} har legat opackad i >24h`,
    details: { order_id: order.id, amount: order.total_amount, created_at: order.created_at },
  }));
}

// ── Rule: Open bug reports older than 72h ──
async function scanStaleBugReports(): Promise<ScanIssue[]> {
  const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('bug_reports')
    .select('id, title, created_at, severity')
    .eq('status', 'open')
    .lt('created_at', threeDaysAgo)
    .limit(50);

  return (data || []).map(bug => ({
    component: 'bug-reports',
    rule: 'stale-bug',
    severity: (bug.severity === 'critical' || bug.severity === 'high') ? bug.severity as ScanSeverity : 'medium',
    message: `Bugg öppen sedan >72h: ${bug.title ?? bug.id}`,
    details: { bug_id: bug.id, created_at: bug.created_at },
  }));
}

// ── Rule: Work items stuck in_progress for >48h ──
async function scanStuckWorkItems(): Promise<ScanIssue[]> {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('work_items')
    .select('id, title, priority, item_type, updated_at')
    .eq('status', 'in_progress')
    .lt('updated_at', twoDaysAgo)
    .limit(50);

  return (data || []).map(item => ({
    component: 'work-items',
    rule: 'stuck-work-item',
    severity: item.priority === 'critical' ? 'critical' : item.priority === 'high' ? 'high' : 'medium',
    message: `Ärende "${item.title ?? item.id}" har inte uppdaterats på >48h`,
    details: { work_item_id: item.id, priority: item.priority, item_type: item.item_type },
  }));
}

// ── Rule: Unassigned critical/high work items ──
async function scanUnassignedCritical(): Promise<ScanIssue[]> {
  const { data } = await supabase
    .from('work_items')
    .select('id, title, priority')
    .in('priority', ['critical', 'high'])
    .eq('status', 'open')
    .is('assigned_to', null)
    .is('claimed_by', null)
    .limit(50);

  return (data || []).map(item => ({
    component: 'work-items',
    rule: 'unassigned-critical',
    severity: item.priority as ScanSeverity,
    message: `Otilldelat ${item.priority}-ärende: "${item.title ?? item.id}"`,
    details: { work_item_id: item.id },
  }));
}

// ── Main entry point ──
export async function runScan(): Promise<ScanResult> {
  const start = Date.now();

  const [stuckOrders, staleBugs, stuckItems, unassigned] = await Promise.all([
    scanStuckOrders(),
    scanStaleBugReports(),
    scanStuckWorkItems(),
    scanUnassignedCritical(),
  ]);

  const issues = [...stuckOrders, ...staleBugs, ...stuckItems, ...unassigned];

  return {
    issues,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}
