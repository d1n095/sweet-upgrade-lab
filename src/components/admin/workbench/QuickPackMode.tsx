import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Package, CheckCircle2, Loader2, ArrowRight, Timer, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logActivity } from '@/utils/activityLogger';
import { getOrderDisplayId } from '@/utils/orderDisplay';
import { motion, AnimatePresence } from 'framer-motion';

interface PackOrder {
  id: string;
  order_email: string;
  total_amount: number;
  items: any;
  shipping_address: any;
  fulfillment_status: string;
  payment_status: string;
  created_at: string;
}

const QuickPackMode = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [isPacking, setIsPacking] = useState(false);
  const [justPacked, setJustPacked] = useState(false);
  const [packedCount, setPackedCount] = useState(0);
  const [startTime] = useState(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: queue = [] } = useQuery({
    queryKey: ['quick-pack-queue'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_email, total_amount, items, shipping_address, fulfillment_status, payment_status, created_at')
        .eq('payment_status', 'paid')
        .in('fulfillment_status', ['pending', 'unfulfilled'])
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      return (data || []) as PackOrder[];
    },
    refetchInterval: 10000,
  });

  const current = queue[0] || null;
  const items = current?.items ? (Array.isArray(current.items) ? current.items : []) : [];
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const allChecked = items.length > 0 && items.every((_: any, i: number) => checkedItems[i]);
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0;

  const elapsedMin = Math.max(1, (Date.now() - startTime) / 60000);
  const ordersPerHour = Math.round((packedCount / elapsedMin) * 60);

  useEffect(() => {
    setCheckedItems({});
  }, [current?.id]);

  const handlePack = async () => {
    if (!current || !user) return;
    setIsPacking(true);
    try {
      await supabase.from('orders').update({
        fulfillment_status: 'packed',
        packed_at: new Date().toISOString(),
        packed_by: user.id,
        status: 'processing',
      }).eq('id', current.id);

      await logActivity({
        log_type: 'success',
        category: 'fulfillment',
        message: 'Order packad (snabbläge)',
        order_id: current.id,
      });

      setPackedCount(prev => prev + 1);
      setJustPacked(true);
      setTimeout(() => setJustPacked(false), 1200);
      queryClient.invalidateQueries({ queryKey: ['quick-pack-queue'] });
      queryClient.invalidateQueries({ queryKey: ['pack-queue'] });
      toast.success('Packad ✓');
    } catch {
      toast.error('Fel vid packning');
    } finally {
      setIsPacking(false);
    }
  };

  if (queue.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 className="w-12 h-12 text-accent mx-auto mb-3" />
        <p className="text-lg font-semibold">Alla orders packade! 🎉</p>
        <p className="text-sm text-muted-foreground mt-1">
          {packedCount > 0 && `${packedCount} packade denna session (~${ordersPerHour}/h)`}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4 max-w-2xl mx-auto">
      {/* Stats bar */}
      <div className="flex items-center justify-between bg-secondary/30 rounded-xl px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm">
            <Package className="w-4 h-4 text-primary" />
            <span className="font-semibold">{queue.length}</span>
            <span className="text-muted-foreground">kvar</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Zap className="w-4 h-4 text-accent" />
            <span className="font-semibold">{packedCount}</span>
            <span className="text-muted-foreground">packade</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Timer className="w-4 h-4" />
          ~{ordersPerHour}/h
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {justPacked && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-6 h-6 text-accent" />
            <span className="text-base font-semibold text-accent">Klar ✓ — nästa order</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current order */}
      <motion.div
        key={current.id}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        className="border-2 border-primary/30 rounded-xl overflow-hidden bg-card"
      >
        {/* Header */}
        <div className="bg-primary/5 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-muted-foreground">{getOrderDisplayId(current as any)}</p>
            <p className="text-sm font-medium">{current.order_email}</p>
          </div>
          <Badge variant="secondary" className="font-semibold">
            {current.total_amount.toLocaleString('sv-SE')} kr
          </Badge>
        </div>

        {/* Address snippet */}
        {current.shipping_address && (
          <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground">
            {(current.shipping_address as any)?.name} — {(current.shipping_address as any)?.city}
          </div>
        )}

        {/* Items */}
        <div className="p-4 space-y-2">
          <Progress value={progress} className="h-1.5 mb-3" />
          {items.map((item: any, idx: number) => (
            <label
              key={idx}
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all',
                checkedItems[idx] ? 'border-accent/40 bg-accent/5' : 'border-border hover:border-primary/30'
              )}
            >
              <Checkbox
                checked={!!checkedItems[idx]}
                onCheckedChange={(v) => setCheckedItems(prev => ({ ...prev, [idx]: !!v }))}
              />
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', checkedItems[idx] && 'line-through text-muted-foreground')}>
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">× {item.quantity}</p>
              </div>
              {checkedItems[idx] && <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />}
            </label>
          ))}
        </div>

        {/* Action */}
        <div className="px-4 pb-4">
          <Button
            onClick={handlePack}
            disabled={!allChecked || isPacking}
            className="w-full h-12 text-base gap-2"
          >
            {isPacking ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Packad — Nästa
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default QuickPackMode;
