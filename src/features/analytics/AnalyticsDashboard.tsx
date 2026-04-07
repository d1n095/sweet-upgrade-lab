import React from 'react';
import { BarChart2 } from 'lucide-react';
import { SystemMetricsPanel } from './SystemMetricsPanel';
import { ExecutionHistoryPanel } from './ExecutionHistoryPanel';
import { SystemHealthChart } from './SystemHealthChart';
import { TrendAnalysisPanel } from './TrendAnalysisPanel';

export function AnalyticsDashboard() {
  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-primary" />
        <h2 className="text-base font-semibold">Analytics</h2>
        <span className="text-xs text-muted-foreground ml-1">System performance over time</span>
      </div>

      {/* Row 1: Metrics + Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <SystemMetricsPanel />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <SystemHealthChart />
        </div>
      </div>

      {/* Row 2: Execution History + Trend Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <ExecutionHistoryPanel />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <TrendAnalysisPanel />
        </div>
      </div>
    </div>
  );
}
