import AdminDbProductManager from '@/components/admin/AdminDbProductManager';

const AdminProducts = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Produkthantering</h1>
        <p className="text-muted-foreground text-sm mt-1">Skapa, redigera och hantera produkter och lager</p>
      </div>
      <AdminDbProductManager />
    </div>
  );
};

export default AdminProducts;
