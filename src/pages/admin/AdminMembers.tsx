import AdminMemberManager from '@/components/admin/AdminMemberManager';

const AdminMembers = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Medlemmar & Roller</h1>
      <p className="text-muted-foreground text-sm mt-1">Hantera medlemmar och deras roller</p>
    </div>
    <AdminMemberManager />
  </div>
);

export default AdminMembers;
