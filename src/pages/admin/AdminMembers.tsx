import AdminMemberManager from '@/components/admin/AdminMemberManager';
import AdminBusinessManager from '@/components/admin/AdminBusinessManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AdminMembers = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Medlemmar & Roller</h1>
      <p className="text-muted-foreground text-sm mt-1">Hantera medlemmar, företag och roller</p>
    </div>
    <Tabs defaultValue="members">
      <TabsList>
        <TabsTrigger value="members">Medlemmar</TabsTrigger>
        <TabsTrigger value="business">Företagskonton</TabsTrigger>
      </TabsList>
      <TabsContent value="members">
        <AdminMemberManager />
      </TabsContent>
      <TabsContent value="business">
        <AdminBusinessManager />
      </TabsContent>
    </Tabs>
  </div>
);

export default AdminMembers;
