import { useState, useEffect } from 'react';
import { Building2, Check, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface BusinessAccount {
  id: string;
  company_name: string;
  org_number: string;
  vat_number: string | null;
  company_address: string | null;
  contact_person: string | null;
  status: string;
}

const BusinessAccountForm = () => {
  const { user } = useAuth();
  const [account, setAccount] = useState<BusinessAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    org_number: '',
    vat_number: '',
    company_address: '',
    contact_person: '',
  });

  useEffect(() => {
    if (user) loadAccount();
  }, [user]);

  const loadAccount = async () => {
    const { data } = await supabase
      .from('business_accounts')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (data) setAccount(data as BusinessAccount);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const { error } = await supabase.from('business_accounts').insert({
      user_id: user.id,
      company_name: form.company_name.trim(),
      org_number: form.org_number.trim(),
      vat_number: form.vat_number.trim() || null,
      company_address: form.company_address.trim() || null,
      contact_person: form.contact_person.trim() || null,
    } as any);

    if (error) {
      toast.error(error.message.includes('org_number') ? 'Org.nr redan registrerat' : 'Kunde inte skicka ansökan');
    } else {
      toast.success('Företagsansökan skickad!');
      loadAccount();
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  if (account) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4" />
            Företagskonto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{account.company_name}</p>
              <p className="text-sm text-muted-foreground">Org.nr: {account.org_number}</p>
            </div>
            {account.status === 'verified' ? (
              <Badge className="bg-green-500/10 text-green-600"><Check className="w-3 h-3 mr-1" />Godkänd</Badge>
            ) : account.status === 'rejected' ? (
              <Badge variant="destructive">Avvisad</Badge>
            ) : (
              <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Under granskning</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="w-4 h-4" />
          Registrera företagskonto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-sm">Företagsnamn *</Label>
            <Input value={form.company_name} onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))} required maxLength={100} />
          </div>
          <div>
            <Label className="text-sm">Organisationsnummer *</Label>
            <Input value={form.org_number} onChange={(e) => setForm(f => ({ ...f, org_number: e.target.value }))} required placeholder="XXXXXX-XXXX" maxLength={20} />
          </div>
          <div>
            <Label className="text-sm">VAT-nummer</Label>
            <Input value={form.vat_number} onChange={(e) => setForm(f => ({ ...f, vat_number: e.target.value }))} placeholder="SE..." maxLength={20} />
          </div>
          <div>
            <Label className="text-sm">Företagsadress</Label>
            <Input value={form.company_address} onChange={(e) => setForm(f => ({ ...f, company_address: e.target.value }))} maxLength={200} />
          </div>
          <div>
            <Label className="text-sm">Kontaktperson</Label>
            <Input value={form.contact_person} onChange={(e) => setForm(f => ({ ...f, contact_person: e.target.value }))} maxLength={100} />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Skicka ansökan'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BusinessAccountForm;
