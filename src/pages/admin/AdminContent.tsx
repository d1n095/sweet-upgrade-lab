import AdminUnifiedContent from '@/components/admin/AdminUnifiedContent';

const AdminContent = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Innehåll & Kommunikation</h1>
      <p className="text-muted-foreground text-sm mt-1">Sektioner, nyheter, tidslinje och e-postmallar – allt på ett ställe</p>
    </div>
    <AdminUnifiedContent />
  </div>
);

export default AdminContent;
