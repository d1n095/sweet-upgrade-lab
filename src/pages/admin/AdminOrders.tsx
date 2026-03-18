import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminOrderManager from '@/components/admin/AdminOrderManager';
import AdminOrderAuditLog from '@/components/admin/AdminOrderAuditLog';

const AdminOrders = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orderhantering</h1>
        <p className="text-muted-foreground text-sm mt-1">Hantera, spåra och granska alla ordrar</p>
      </div>
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Ordrar</TabsTrigger>
          <TabsTrigger value="audit">Ändringslogg</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <AdminOrderManager />
        </TabsContent>
        <TabsContent value="audit">
          <AdminOrderAuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOrders;
