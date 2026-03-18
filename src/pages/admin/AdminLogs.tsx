import AdminActivityLog from '@/components/admin/AdminActivityLog';

const AdminLogs = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Logg & Säkerhet</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Full spårbarhet — alla händelser, inloggningar, orderändringar och säkerhetshändelser
        </p>
      </div>
      <AdminActivityLog />
    </div>
  );
};

export default AdminLogs;
