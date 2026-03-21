import AdminActivityLog from '@/components/admin/AdminActivityLog';
import AdminBugReports from '@/components/admin/AdminBugReports';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AdminLogs = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Logg & Säkerhet</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Full spårbarhet — alla händelser, inloggningar, orderändringar och säkerhetshändelser
        </p>
      </div>
      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Aktivitetslogg</TabsTrigger>
          <TabsTrigger value="bugs">Buggrapporter</TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <AdminActivityLog />
        </TabsContent>
        <TabsContent value="bugs">
          <AdminBugReports />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminLogs;
