import { useState, useEffect } from 'react';
import { Building2, Check, X, Clock, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BusinessAccount {
  id: string;
  user_id: string;
  company_name: string;
  org_number: string;
  vat_number: string | null;
  company_address: string | null;
  contact_person: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const AdminBusinessManager = () => {
  const [accounts, setAccounts] = useState<BusinessAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BusinessAccount | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    const { data } = await supabase
      .from('business_accounts')
      .select('*')
      .order('created_at', { ascending: false });
    setAccounts((data as BusinessAccount[]) || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from('business_accounts')
      .update({ status, admin_notes: adminNotes, updated_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) {
      toast.error('Kunde inte uppdatera');
    } else {
      toast.success(status === 'verified' ? 'Företag godkänt!' : 'Företag avvisat');
      loadAccounts();
      setSelected(null);
    }
    setUpdating(false);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'verified': return <Badge className="bg-green-500/10 text-green-600"><Check className="w-3 h-3 mr-1" />Godkänd</Badge>;
      case 'rejected': return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Avvisad</Badge>;
      default: return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Väntande</Badge>;
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Företagskonton ({accounts.length})
        </h2>
        <p className="text-sm text-muted-foreground">Granska och godkänn företagsansökningar</p>
      </div>

      {accounts.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Inga företagsansökningar ännu</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => (
            <Card key={acc.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{acc.company_name}</p>
                    <p className="text-sm text-muted-foreground">Org.nr: {acc.org_number}</p>
                    {acc.vat_number && <p className="text-xs text-muted-foreground">VAT: {acc.vat_number}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(acc.created_at).toLocaleDateString('sv-SE')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(acc.status)}
                    <Button variant="ghost" size="sm" onClick={() => { setSelected(acc); setAdminNotes(acc.admin_notes || ''); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Företagsdetaljer</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Företag:</span><p className="font-medium">{selected.company_name}</p></div>
                <div><span className="text-muted-foreground">Org.nr:</span><p className="font-medium">{selected.org_number}</p></div>
                {selected.vat_number && <div><span className="text-muted-foreground">VAT:</span><p className="font-medium">{selected.vat_number}</p></div>}
                {selected.contact_person && <div><span className="text-muted-foreground">Kontakt:</span><p className="font-medium">{selected.contact_person}</p></div>}
                {selected.company_address && <div className="col-span-2"><span className="text-muted-foreground">Adress:</span><p className="font-medium">{selected.company_address}</p></div>}
              </div>
              <div>
                <label className="text-sm font-medium">Admin-anteckningar</label>
                <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Anteckningar..." className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => updateStatus(selected.id, 'verified')} disabled={updating} className="flex-1 bg-green-600 hover:bg-green-700">
                  <Check className="w-4 h-4 mr-1" /> Godkänn
                </Button>
                <Button onClick={() => updateStatus(selected.id, 'rejected')} disabled={updating} variant="destructive" className="flex-1">
                  <X className="w-4 h-4 mr-1" /> Avvisa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBusinessManager;
