import AdminPageVisibility from '@/components/admin/AdminPageVisibility';

const AdminVisibility = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Sidsynlighet</h1>
      <p className="text-muted-foreground text-sm mt-1">Visa eller dölj sidor i butiken</p>
    </div>
    <AdminPageVisibility />
  </div>
);

export default AdminVisibility;
