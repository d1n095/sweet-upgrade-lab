import AdminPageContentManager from '@/components/admin/AdminPageContentManager';

const AdminContent = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Sidinnehåll</h1>
      <p className="text-muted-foreground text-sm mt-1">Hantera innehåll och sektioner på alla sidor</p>
    </div>
    <AdminPageContentManager />
  </div>
);

export default AdminContent;
