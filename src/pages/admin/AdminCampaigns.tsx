import AdminCampaignsManager from '@/components/admin/AdminCampaignsManager';

const AdminCampaigns = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Kampanjer & Rabatter</h1>
      <p className="text-muted-foreground text-sm mt-1">Hantera mängdrabatter, paket och kampanjpriser</p>
    </div>
    <AdminCampaignsManager />
  </div>
);

export default AdminCampaigns;
