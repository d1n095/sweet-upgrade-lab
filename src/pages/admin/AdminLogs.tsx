import AdminActivityLog from '@/components/admin/AdminActivityLog';
import AdminBugReports from '@/components/admin/AdminBugReports';
import AdminObservabilityLog from '@/components/admin/AdminObservabilityLog';
import DeepDebugPanel from '@/components/admin/DeepDebugPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AdminLogs = () => {
  return (
    <div className="flex h-full min-h-0 flex-col space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Logg & Säkerhet</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Full spårbarhet — alla händelser, inloggningar, orderändringar och säkerhetshändelser
        </p>
      </div>
      <Tabs defaultValue="activity" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="activity">Aktivitetslogg</TabsTrigger>
          <TabsTrigger value="observability">Observability</TabsTrigger>
          <TabsTrigger value="deep-debug">Deep Debug</TabsTrigger>
          <TabsTrigger value="bugs">Buggrapporter</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto">
          <AdminActivityLog />
        </TabsContent>
        <TabsContent value="observability" className="min-h-0 flex-1 overflow-y-auto">
          <AdminObservabilityLog />
        </TabsContent>
        <TabsContent value="deep-debug" className="min-h-0 flex-1 overflow-y-auto">
          <DeepDebugPanel />
        </TabsContent>
        <TabsContent value="bugs" className="min-h-0 flex-1 overflow-y-auto">
          <AdminBugReports />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminLogs;
