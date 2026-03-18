import AdminCategoryManager from '@/components/admin/AdminCategoryManager';

const AdminCategories = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Kategorihantering</h1>
      <p className="text-muted-foreground text-sm mt-1">Hantera produktkategorier</p>
    </div>
    <AdminCategoryManager />
  </div>
);

export default AdminCategories;
