import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

interface PrebuyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productTitle: string;
  releaseDate?: string | null;
  lang?: 'sv' | 'en';
}

const PrebuyDialog = ({ open, onOpenChange, productId, productTitle, releaseDate, lang = 'sv' }: PrebuyDialogProps) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const t = (sv: string, en: string) => (lang === 'sv' ? sv : en);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-prebuy-reservation', {
        body: { product_id: productId, email: email.trim(), name: name.trim() || null, quantity: parseInt(quantity, 10) || 1, note: note.trim() || null },
      });
      if (error || (data && (data as any).error)) throw new Error((data as any)?.error || error?.message || 'error');
      setDone(true);
      toast.success(t('Din plats är reserverad ⚡', 'Your spot is reserved ⚡'));
      setTimeout(() => { onOpenChange(false); setDone(false); setEmail(''); setName(''); setNote(''); setQuantity('1'); }, 1600);
    } catch (err: any) {
      toast.error(err?.message || t('Kunde inte reservera', 'Could not reserve'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="chip-gold"><Sparkles className="w-3 h-3" /> {t('FÖRKÖP', 'PREBUY')}</span>
          </div>
          <DialogTitle className="text-xl">{productTitle}</DialogTitle>
          <DialogDescription>
            {t('Reservera din plats gratis — ingen betalning nu. Vi hör av oss så fort produkten släpps.',
               'Reserve your spot for free — no payment now. We\'ll ping you the moment it drops.')}
            {releaseDate && (
              <span className="block mt-1 text-accent font-medium">
                {t('Släpp: ', 'Drop: ')}{new Date(releaseDate).toLocaleDateString(lang === 'sv' ? 'sv-SE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center">
              <Check className="w-7 h-7 text-accent" />
            </div>
            <p className="text-sm font-medium">{t('Klart! Vi hör av oss.', 'Done! We\'ll be in touch.')}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pb-email">Email *</Label>
              <Input id="pb-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="du@email.com" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pb-name">{t('Namn', 'Name')}</Label>
                <Input id="pb-name" value={name} onChange={e => setName(e.target.value)} placeholder={t('Valfritt', 'Optional')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pb-qty">{t('Antal', 'Qty')}</Label>
                <Input id="pb-qty" type="number" min={1} max={20} value={quantity} onChange={e => setQuantity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pb-note">{t('Meddelande', 'Note')}</Label>
              <Textarea id="pb-note" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder={t('Något vi bör veta? (valfritt)', 'Anything we should know? (optional)')} />
            </div>
            <Button type="submit" disabled={loading || !email.trim()} className="w-full h-11 rounded-full font-semibold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {t('Reservera min plats', 'Reserve my spot')}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              {t('Gratis. Ingen betalning. Avboka när du vill.', 'Free. No payment. Cancel anytime.')}
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PrebuyDialog;
