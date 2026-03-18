import AdminPageContentManager from '@/components/admin/AdminPageContentManager';

const AdminContent = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Sidinnehåll & Layout</h1>
      <p className="text-muted-foreground text-sm mt-1">Redigera, sortera och styr synlighet för sektioner på varje sida</p>
    </div>
    <AdminPageContentManager />
  </div>
);

export default AdminContent;
