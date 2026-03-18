import AdminDbProductManager from '@/components/admin/AdminDbProductManager';
import AdminProductImportExport from '@/components/admin/AdminProductImportExport';

const AdminProducts = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Produkthantering</h1>
          <p className="text-muted-foreground text-sm mt-1">Skapa, redigera och hantera produkter och lager</p>
        </div>
        <AdminProductImportExport />
      </div>
      <AdminDbProductManager />
    </div>
  );
};

export default AdminProducts;
