import AdminDonationManager from '@/components/admin/AdminDonationManager';
import AdminLegalDocuments from '@/components/admin/AdminLegalDocuments';

const AdminLegal = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Juridik & Donationer</h1>
      <p className="text-muted-foreground text-sm mt-1">Juridiska dokument och donationshantering</p>
    </div>
    <AdminDonationManager />
    <div className="border-t border-border pt-6">
      <AdminLegalDocuments />
    </div>
  </div>
);

export default AdminLegal;
