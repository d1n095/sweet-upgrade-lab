import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Plus, Loader2, Copy, Mail, 
  DollarSign, TrendingUp, Check, X,
  ChevronDown, ChevronUp, CreditCard, Share2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface Affiliate {
  id: string;
  email: string;
  name: string;
  code: string;
  commission_percent: number;
  total_earnings: number;
  pending_earnings: number;
  paid_earnings: number;
  total_orders: number;
  total_sales: number;
  is_active: boolean;
  payout_method: string;
  notes: string | null;
  created_at: string;
}

const AdminAffiliateManager = () => {
  const { language } = useLanguage();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    commissionPercent: '10',
    payoutMethod: 'bank_transfer',
    notes: '',
  });

  const content = {
    sv: {
      title: 'Affiliate-program',
      subtitle: 'Hantera ambassadörer och provisioner',
      addAffiliate: 'Lägg till affiliate',
      name: 'Namn',
      email: 'Email',
      commission: 'Provision %',
      payoutMethod: 'Utbetalningsmetod',
      bank: 'Banköverföring',
      swish: 'Swish',
      notes: 'Anteckningar',
      save: 'Skapa affiliate',
      cancel: 'Avbryt',
      noAffiliates: 'Inga affiliates ännu',
      code: 'Kod',
      earnings: 'Intjänat',
      pending: 'Väntar',
      paid: 'Utbetalt',
      orders: 'ordrar',
      sales: 'Försäljning',
      active: 'Aktiv',
      paused: 'Pausad',
      copyCode: 'Kopiera kod',
      copied: 'Kopierad!',
      pause: 'Pausa',
      activate: 'Aktivera',
      affiliateAdded: 'Affiliate tillagd!',
      error: 'Något gick fel',
      payoutThreshold: 'Utbetalning vid 500 kr',
      totalStats: 'Totalt genererat',
    },
    en: {
      title: 'Affiliate Program',
      subtitle: 'Manage ambassadors and commissions',
      addAffiliate: 'Add Affiliate',
      name: 'Name',
      email: 'Email',
      commission: 'Commission %',
      payoutMethod: 'Payout Method',
      bank: 'Bank Transfer',
      swish: 'Swish',
      notes: 'Notes',
      save: 'Create Affiliate',
      cancel: 'Cancel',
      noAffiliates: 'No affiliates yet',
      code: 'Code',
      earnings: 'Earned',
      pending: 'Pending',
      paid: 'Paid',
      orders: 'orders',
      sales: 'Sales',
      active: 'Active',
      paused: 'Paused',
      copyCode: 'Copy code',
      copied: 'Copied!',
      pause: 'Pause',
      activate: 'Activate',
      affiliateAdded: 'Affiliate added!',
      error: 'Something went wrong',
      payoutThreshold: 'Payout at 500 SEK',
      totalStats: 'Total generated',
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    loadAffiliates();
  }, []);

  const loadAffiliates = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .order('total_earnings', { ascending: false });

      if (error) throw error;
      setAffiliates((data || []) as unknown as Affiliate[]);
    } catch (error) {
      console.error('Failed to load affiliates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateCode = (name: string) => {
    const cleanName = name.replace(/[^a-zA-Z]/g, '').slice(0, 6);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `AMB${cleanName}${random}`.toUpperCase();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      commissionPercent: '10',
      payoutMethod: 'bank_transfer',
      notes: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const code = generateCode(formData.name);
      
      const { error } = await supabase
        .from('affiliates')
        .insert({
          name: formData.name,
          email: formData.email.toLowerCase(),
          code,
          commission_percent: parseFloat(formData.commissionPercent),
          payout_method: formData.payoutMethod,
          notes: formData.notes || null,
        });

      if (error) throw error;

      // Send welcome email
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-affiliate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(sessionData?.session?.access_token && {
              'Authorization': `Bearer ${sessionData.session.access_token}`
            })
          },
          body: JSON.stringify({
            email: formData.email.toLowerCase(),
            name: formData.name,
            code,
            commissionPercent: parseFloat(formData.commissionPercent),
          }),
        });
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
      }

      toast.success(t.affiliateAdded);
      resetForm();
      setIsAddDialogOpen(false);
      loadAffiliates();
    } catch (error) {
      console.error('Failed to create affiliate:', error);
      toast.error(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      loadAffiliates();
    } catch (error) {
      console.error('Failed to update:', error);
      toast.error(t.error);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t.copied);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate totals
  const totalEarnings = affiliates.reduce((sum, a) => sum + a.total_earnings, 0);
  const totalSales = affiliates.reduce((sum, a) => sum + a.total_sales, 0);
  const totalOrders = affiliates.reduce((sum, a) => sum + a.total_orders, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              {t.addAffiliate}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary" />
                {t.addAffiliate}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.name}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Anders Andersson"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t.email}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="anders@example.com"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="commission">{t.commission}</Label>
                  <Select
                    value={formData.commissionPercent}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, commissionPercent: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="8">8%</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="15">15%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t.payoutMethod}</Label>
                  <Select
                    value={formData.payoutMethod}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, payoutMethod: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">{t.bank}</SelectItem>
                      <SelectItem value="swish">{t.swish}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="YouTube-kanal med 10k prenumeranter..."
                  rows={2}
                />
              </div>

              {formData.name && (
                <div className="p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/20">
                  <p className="text-sm text-muted-foreground mb-1">
                    {language === 'sv' ? 'Genererad kod:' : 'Generated code:'}
                  </p>
                  <p className="font-mono font-bold text-amber-600">
                    {generateCode(formData.name)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t.payoutThreshold}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  className="flex-1"
                >
                  {t.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.name || !formData.email}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t.save
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats summary */}
      {affiliates.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">{t.totalStats}</p>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(totalSales)}</p>
          </div>
          <div className="p-3 bg-success/10 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">{t.earnings}</p>
            <p className="text-lg font-bold text-success">{formatCurrency(totalEarnings)}</p>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">{t.orders}</p>
            <p className="text-lg font-bold text-primary">{totalOrders}</p>
          </div>
        </div>
      )}

      {/* Affiliate List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : affiliates.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{t.noAffiliates}</p>
        ) : (
          affiliates.map((affiliate) => {
            const isExpanded = expandedId === affiliate.id;

            return (
              <Collapsible
                key={affiliate.id}
                open={isExpanded}
                onOpenChange={(open) => setExpandedId(open ? affiliate.id : null)}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-semibold">
                          {affiliate.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{affiliate.name}</p>
                            <Badge variant={affiliate.is_active ? 'default' : 'secondary'} className="text-xs">
                              {affiliate.is_active ? t.active : t.paused}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{affiliate.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <p className="text-sm font-bold text-success">
                            {formatCurrency(affiliate.total_earnings)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {affiliate.total_orders} {t.orders}
                          </p>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyCode(affiliate.code)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>

                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-0 border-t border-border/50 space-y-3">
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="p-2 bg-secondary/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">{t.code}</p>
                          <p className="font-mono font-medium text-amber-600">{affiliate.code}</p>
                        </div>
                        <div className="p-2 bg-secondary/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">{t.commission}</p>
                          <p className="font-medium">{affiliate.commission_percent}%</p>
                        </div>
                        <div className="p-2 bg-secondary/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">{t.pending}</p>
                          <p className="font-medium text-amber-600">{formatCurrency(affiliate.pending_earnings)}</p>
                        </div>
                        <div className="p-2 bg-secondary/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">{t.paid}</p>
                          <p className="font-medium text-success">{formatCurrency(affiliate.paid_earnings)}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActive(affiliate.id, affiliate.is_active)}
                          className="flex-1"
                        >
                          {affiliate.is_active ? t.pause : t.activate}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyCode(affiliate.code)}
                          className="flex-1"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          {t.copyCode}
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </motion.div>
              </Collapsible>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminAffiliateManager;
