import AdminSiteUpdatesManager from '@/components/admin/AdminSiteUpdatesManager';
import AdminTimelineManager from '@/components/admin/AdminTimelineManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AdminUpdates = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Nytt hos oss</h1>
      <p className="text-muted-foreground text-sm mt-1">Hantera nyheter, uppdateringar och timeline</p>
    </div>
    <Tabs defaultValue="updates" className="space-y-4">
      <TabsList className="bg-secondary/50">
        <TabsTrigger value="updates">Nyheter</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
      </TabsList>
      <TabsContent value="updates">
        <AdminSiteUpdatesManager />
      </TabsContent>
      <TabsContent value="timeline">
        <AdminTimelineManager />
      </TabsContent>
    </Tabs>
  </div>
);

export default AdminUpdates;
