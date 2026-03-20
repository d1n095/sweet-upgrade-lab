import AdminIncidentManager from '@/components/admin/AdminIncidentManager';

const AdminIncidents = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ärenden & SLA</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Spåra incidenter, SLA-tider och eskaleringar
        </p>
      </div>
      <AdminIncidentManager />
    </div>
  );
};

export default AdminIncidents;
