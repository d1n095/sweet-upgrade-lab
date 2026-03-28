/**
 * DebugDashboard — /admin/debug-dashboard
 *
 * Central debug hub combining:
 *   - ActionMonitor status, collected data, failure log
 *   - Deep Debug traces
 *   - Action Verification Engine panel
 */
import { Monitor } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ActionMonitorPanel from '@/components/admin/ActionMonitorPanel';
import ActionVerificationPanel from '@/components/admin/ActionVerificationPanel';
import DeepDebugPanel from '@/components/admin/DeepDebugPanel';

const DebugDashboard = () => {
  return (
    <div className="flex h-full min-h-0 flex-col space-y-6">
      <div className="flex items-center gap-2">
        <Monitor className="w-5 h-5" />
        <div>
          <h1 className="text-2xl font-semibold">Debug Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            ActionMonitor, verification engine och deep debug traces i ett enda vy
          </p>
        </div>
      </div>

      <Tabs defaultValue="action-monitor" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="action-monitor">Action Monitor</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="deep-debug">Deep Debug</TabsTrigger>
        </TabsList>

        <TabsContent value="action-monitor" className="min-h-0 flex-1 overflow-y-auto">
          <ActionMonitorPanel />
        </TabsContent>
        <TabsContent value="verification" className="min-h-0 flex-1 overflow-y-auto">
          <ActionVerificationPanel />
        </TabsContent>
        <TabsContent value="deep-debug" className="min-h-0 flex-1 overflow-y-auto">
          <DeepDebugPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DebugDashboard;
