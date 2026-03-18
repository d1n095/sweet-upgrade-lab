import AdminUnifiedContent from '@/components/admin/AdminUnifiedContent';
import AdminPageVisibility from '@/components/admin/AdminPageVisibility';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import { FileText, Eye } from 'lucide-react';

const AdminContent = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Innehåll & Kommunikation</h1>
      <p className="text-muted-foreground text-sm mt-1">Sektioner, nyheter, sidsynlighet och e-postmallar</p>
    </div>
    <Tabs defaultValue="content" className="space-y-4">
      <ScrollableTabs>
        <TabsList className="w-max">
          <TabsTrigger value="content" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> Innehåll
          </TabsTrigger>
          <TabsTrigger value="visibility" className="gap-1.5 text-xs">
            <Eye className="w-3.5 h-3.5" /> Sidsynlighet
          </TabsTrigger>
        </TabsList>
      </ScrollableTabs>
      <TabsContent value="content">
        <AdminUnifiedContent />
      </TabsContent>
      <TabsContent value="visibility">
        <AdminPageVisibility />
      </TabsContent>
    </Tabs>
  </div>
);

export default AdminContent;
