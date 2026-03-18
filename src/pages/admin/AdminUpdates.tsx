import AdminSiteUpdatesManager from '@/components/admin/AdminSiteUpdatesManager';

const AdminUpdates = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Nytt hos oss</h1>
      <p className="text-muted-foreground text-sm mt-1">Hantera nyheter och uppdateringar</p>
    </div>
    <AdminSiteUpdatesManager />
  </div>
);

export default AdminUpdates;
