import AdminEmailTemplates from '@/components/admin/AdminEmailTemplates';

const AdminCommunication = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Recensioner & Kommunikation</h1>
      <p className="text-muted-foreground text-sm mt-1">E-postmallar och recensionshantering</p>
    </div>
    <AdminEmailTemplates />
  </div>
);

export default AdminCommunication;
