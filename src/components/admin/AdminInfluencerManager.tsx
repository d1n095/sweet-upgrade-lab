import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Plus, Edit, Trash2, Loader2, 
  Gift, Check, X, Clock, Copy, Mail,
  ChevronDown, ChevronUp, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface Influencer {
  id: string;
  email: string;
  name: string;
  code: string;
  max_products: number;
  products_used: number;
  is_active: boolean;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
}

interface InfluencerProduct {
  id: string;
  product_title: string;
  received_at: string;
}

const AdminInfluencerManager = () => {
  const { language } = useLanguage();
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [productHistory, setProductHistory] = useState<Record<string, InfluencerProduct[]>>({});
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    maxProducts: '3',
    validUntil: '',
    notes: '',
  });

  const content = {
    sv: {
      title: 'Influencer & VIP',
      subtitle: 'Hantera influencers och gratisprodukter',
      addInfluencer: 'Lägg till influencer',
      name: 'Namn',
      email: 'Email',
      maxProducts: 'Antal produkter',
      validUntil: 'Giltig till (valfritt)',
      notes: 'Anteckningar',
      save: 'Skapa influencer',
      cancel: 'Avbryt',
      noInfluencers: 'Inga influencers ännu',
      code: 'Kod',
      used: 'använd',
      of: 'av',
      active: 'Aktiv',
      paused: 'Pausad',
      expired: 'Utgången',
      copyCode: 'Kopiera kod',
      copied: 'Kopierad!',
      viewHistory: 'Visa historik',
      noHistory: 'Inga produkter mottagna ännu',
      pause: 'Pausa',
      activate: 'Aktivera',
      delete: 'Ta bort',
      deleteConfirm: 'Är du säker?',
      influencerAdded: 'Influencer tillagd!',
      influencerUpdated: 'Uppdaterad!',
      influencerDeleted: 'Borttagen!',
      error: 'Något gick fel',
    },
    en: {
      title: 'Influencer & VIP',
      subtitle: 'Manage influencers and free products',
      addInfluencer: 'Add Influencer',
      name: 'Name',
      email: 'Email',
      maxProducts: 'Product Count',
      validUntil: 'Valid Until (optional)',
      notes: 'Notes',
      save: 'Create Influencer',
      cancel: 'Cancel',
      noInfluencers: 'No influencers yet',
      code: 'Code',
      used: 'used',
      of: 'of',
      active: 'Active',
      paused: 'Paused',
      expired: 'Expired',
      copyCode: 'Copy code',
      copied: 'Copied!',
      viewHistory: 'View history',
      noHistory: 'No products received yet',
      pause: 'Pause',
      activate: 'Activate',
      delete: 'Delete',
      deleteConfirm: 'Are you sure?',
      influencerAdded: 'Influencer added!',
      influencerUpdated: 'Updated!',
      influencerDeleted: 'Deleted!',
      error: 'Something went wrong',
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    loadInfluencers();
  }, []);

  const loadInfluencers = async () => {
    try {
      const { data, error } = await supabase
        .from('influencers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInfluencers((data || []) as unknown as Influencer[]);
    } catch (error) {
      console.error('Failed to load influencers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProductHistory = async (influencerId: string) => {
    try {
      const { data, error } = await supabase
        .from('influencer_products')
        .select('id, product_title, received_at')
        .eq('influencer_id', influencerId)
        .order('received_at', { ascending: false });

      if (error) throw error;
      setProductHistory(prev => ({
        ...prev,
        [influencerId]: (data || []) as InfluencerProduct[]
      }));
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const generateCode = (name: string) => {
    const cleanName = name.replace(/[^a-zA-Z]/g, '').slice(0, 8);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `INFLU${cleanName}${random}`.toUpperCase();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      maxProducts: '3',
      validUntil: '',
      notes: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const code = generateCode(formData.name);
      
      const { error } = await supabase
        .from('influencers')
        .insert({
          name: formData.name,
          email: formData.email.toLowerCase(),
          code,
          max_products: parseInt(formData.maxProducts),
          valid_until: formData.validUntil || null,
          notes: formData.notes || null,
        });

      if (error) throw error;

      toast.success(t.influencerAdded);
      resetForm();
      setIsAddDialogOpen(false);
      loadInfluencers();
    } catch (error) {
      console.error('Failed to create influencer:', error);
      toast.error(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('influencers')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      toast.success(t.influencerUpdated);
      loadInfluencers();
    } catch (error) {
      console.error('Failed to update:', error);
      toast.error(t.error);
    }
  };

  const deleteInfluencer = async (id: string) => {
    if (!confirm(t.deleteConfirm)) return;

    try {
      const { error } = await supabase
        .from('influencers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success(t.influencerDeleted);
      loadInfluencers();
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error(t.error);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t.copied);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatus = (influencer: Influencer) => {
    if (!influencer.is_active) return 'paused';
    if (influencer.valid_until && new Date(influencer.valid_until) < new Date()) return 'expired';
    if (influencer.products_used >= influencer.max_products) return 'completed';
    return 'active';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/30">{t.active}</Badge>;
      case 'paused':
        return <Badge variant="secondary">{t.paused}</Badge>;
      case 'expired':
        return <Badge variant="destructive">{t.expired}</Badge>;
      case 'completed':
        return <Badge className="bg-primary/10 text-primary">100%</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600" />
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
              {t.addInfluencer}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-primary" />
                {t.addInfluencer}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t.name}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Anna Svensson"
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
                    placeholder="anna@example.com"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxProducts">{t.maxProducts}</Label>
                  <Input
                    id="maxProducts"
                    type="number"
                    min="1"
                    max="50"
                    value={formData.maxProducts}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxProducts: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="validUntil">{t.validUntil}</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Instagram 50k följare..."
                  rows={2}
                />
              </div>

              {formData.name && (
                <div className="p-3 bg-primary/5 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">
                    {language === 'sv' ? 'Genererad kod:' : 'Generated code:'}
                  </p>
                  <p className="font-mono font-bold text-primary">
                    {generateCode(formData.name)}
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

      {/* Influencer List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : influencers.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{t.noInfluencers}</p>
        ) : (
          influencers.map((influencer) => {
            const status = getStatus(influencer);
            const isExpanded = expandedId === influencer.id;

            return (
              <Collapsible
                key={influencer.id}
                open={isExpanded}
                onOpenChange={(open) => {
                  setExpandedId(open ? influencer.id : null);
                  if (open && !productHistory[influencer.id]) {
                    loadProductHistory(influencer.id);
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
                          {influencer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{influencer.name}</p>
                            {getStatusBadge(status)}
                          </div>
                          <p className="text-xs text-muted-foreground">{influencer.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <p className="text-sm font-mono font-medium text-primary">{influencer.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {influencer.products_used}/{influencer.max_products} {t.used}
                          </p>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyCode(influencer.code)}
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
                    <div className="px-3 pb-3 pt-0 border-t border-border/50">
                      {/* Progress bar */}
                      <div className="my-3">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                            initial={{ width: 0 }}
                            animate={{ 
                              width: `${(influencer.products_used / influencer.max_products) * 100}%` 
                            }}
                          />
                        </div>
                      </div>

                      {/* Product History */}
                      <div className="mb-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <History className="w-3 h-3" />
                          {t.viewHistory}
                        </p>
                        {productHistory[influencer.id]?.length ? (
                          <div className="space-y-1">
                            {productHistory[influencer.id].map((product) => (
                              <div
                                key={product.id}
                                className="flex items-center justify-between text-sm py-1 px-2 bg-secondary/50 rounded"
                              >
                                <span>{product.product_title}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(product.received_at)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">{t.noHistory}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActive(influencer.id, influencer.is_active)}
                          className="flex-1"
                        >
                          {influencer.is_active ? (
                            <>
                              <X className="w-3 h-3 mr-1" />
                              {t.pause}
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              {t.activate}
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteInfluencer(influencer.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {t.delete}
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

export default AdminInfluencerManager;
