import AdminInfluencerManager from '@/components/admin/AdminInfluencerManager';
import AdminAffiliateManager from '@/components/admin/AdminAffiliateManager';
import AdminApplicationsManager from '@/components/admin/AdminApplicationsManager';
import AdminPayoutManager from '@/components/admin/AdminPayoutManager';

const AdminPartners = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Partners</h1>
      <p className="text-muted-foreground text-sm mt-1">Influencers, affiliates och ansökningar</p>
    </div>
    <AdminInfluencerManager />
    <div className="border-t border-border pt-6">
      <AdminAffiliateManager />
    </div>
    <div className="border-t border-border pt-6">
      <AdminApplicationsManager />
    </div>
    <div className="border-t border-border pt-6">
      <AdminPayoutManager />
    </div>
  </div>
);

export default AdminPartners;
