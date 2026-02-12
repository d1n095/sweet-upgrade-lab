import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList, Package, Truck, Check, Clock, Loader2,
  Eye, ChevronDown, ChevronUp, Save, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

interface Order {
  id: string;
  order_email: string;
  status: string;
  total_amount: number;
  currency: string;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  shopify_order_number: string | null;
  items: any;
  shipping_address: any;
  estimated_delivery: string | null;
}

const statusOptions = [
  { value: 'pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'confirmed', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'processing', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'shipped', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { value: 'delivered', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
];

const AdminOrderManager = () => {
  const { language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ status: string; tracking_number: string; notes: string }>({
    status: '',
    tracking_number: '',
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const t = {
    sv: {
      title: 'Orderhantering',
      subtitle: 'Hantera och spåra alla ordrar',
      noOrders: 'Inga ordrar hittades',
      order: 'Order',
      customer: 'Kund',
      status: 'Status',
      total: 'Totalt',
      tracking: 'Spårningsnummer',
      notes: 'Anteckningar',
      save: 'Spara',
      cancel: 'Avbryt',
      edit: 'Redigera',
      updated: 'Order uppdaterad!',
      error: 'Något gick fel',
      all: 'Alla',
      pending: 'Väntande',
      confirmed: 'Bekräftad',
      processing: 'Behandlas',
      shipped: 'Skickad',
      delivered: 'Levererad',
      cancelled: 'Avbruten',
      items: 'Artiklar',
      address: 'Leveransadress',
      estimatedDelivery: 'Beräknad leverans',
      notesPlaceholder: 'Lägg till anteckningar om ordern...',
      trackingPlaceholder: 'Ange spårningsnummer...',
    },
    en: {
      title: 'Order Management',
      subtitle: 'Manage and track all orders',
      noOrders: 'No orders found',
      order: 'Order',
      customer: 'Customer',
      status: 'Status',
      total: 'Total',
      tracking: 'Tracking number',
      notes: 'Notes',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      updated: 'Order updated!',
      error: 'Something went wrong',
      all: 'All',
      pending: 'Pending',
      confirmed: 'Confirmed',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      items: 'Items',
      address: 'Shipping address',
      estimatedDelivery: 'Estimated delivery',
      notesPlaceholder: 'Add notes about the order...',
      trackingPlaceholder: 'Enter tracking number...',
    },
  };

  const content = t[language as keyof typeof t] || t.en;

  const statusLabels: Record<string, string> = {
    pending: content.pending,
    confirmed: content.confirmed,
    processing: content.processing,
    shipped: content.shipped,
    delivered: content.delivered,
    cancelled: content.cancelled,
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (order: Order) => {
    setEditingOrder(order.id);
    setEditData({
      status: order.status,
      tracking_number: order.tracking_number || '',
      notes: order.notes || '',
    });
  };

  const handleSave = async (orderId: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: editData.status,
          tracking_number: editData.tracking_number || null,
          notes: editData.notes || null,
        })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev =>
        prev.map(o =>
          o.id === orderId
            ? { ...o, status: editData.status, tracking_number: editData.tracking_number || null, notes: editData.notes || null }
            : o
        )
      );
      setEditingOrder(null);
      toast.success(content.updated);
    } catch (error) {
      console.error('Failed to update order:', error);
      toast.error(content.error);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    return statusOptions.find(s => s.value === status)?.color || 'bg-secondary text-secondary-foreground';
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold">{content.title}</h3>
            <p className="text-sm text-muted-foreground">{content.subtitle}</p>
          </div>
        </div>
        <Badge variant="outline">{orders.length} {content.order.toLowerCase()}</Badge>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          {content.all} ({orders.length})
        </Button>
        {statusOptions.map(status => {
          const count = orders.filter(o => o.status === status.value).length;
          if (count === 0) return null;
          return (
            <Button
              key={status.value}
              variant={filter === status.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(status.value)}
            >
              {statusLabels[status.value]} ({count})
            </Button>
          );
        })}
      </div>

      {/* Orders List */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filteredOrders.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{content.noOrders}</p>
        ) : (
          filteredOrders.map((order) => {
            const isExpanded = expandedOrder === order.id;
            const isEditing = editingOrder === order.id;

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-border bg-secondary/30 overflow-hidden"
              >
                {/* Order Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        #{order.shopify_order_number || order.id.slice(0, 8)}
                      </span>
                      <Badge className={getStatusColor(order.status)}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.order_email} · {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span className="font-semibold text-sm">
                    {formatCurrency(order.total_amount, order.currency)}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {/* Items */}
                    {order.items && Array.isArray(order.items) && order.items.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{content.items}</Label>
                        <div className="mt-1 space-y-1">
                          {(order.items as any[]).map((item: any, idx: number) => (
                            <div key={idx} className="text-sm flex justify-between">
                              <span>{item.title || item.name || 'Produkt'} × {item.quantity || 1}</span>
                              <span className="text-muted-foreground">{item.price ? `${item.price} ${order.currency}` : ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shipping Address */}
                    {order.shipping_address && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{content.address}</Label>
                        <p className="text-sm mt-1">
                          {typeof order.shipping_address === 'object'
                            ? Object.values(order.shipping_address as Record<string, string>).filter(Boolean).join(', ')
                            : String(order.shipping_address)}
                        </p>
                      </div>
                    )}

                    {/* Tracking & Notes */}
                    {order.tracking_number && !isEditing && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{content.tracking}</Label>
                        <p className="text-sm font-mono mt-1">{order.tracking_number}</p>
                      </div>
                    )}
                    {order.notes && !isEditing && (
                      <div>
                        <Label className="text-xs text-muted-foreground">{content.notes}</Label>
                        <p className="text-sm mt-1">{order.notes}</p>
                      </div>
                    )}

                    {/* Edit Form */}
                    {isEditing ? (
                      <div className="space-y-3 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-2">
                          <Label className="text-sm">{content.status}</Label>
                          <Select
                            value={editData.status}
                            onValueChange={(v) => setEditData(prev => ({ ...prev, status: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map(s => (
                                <SelectItem key={s.value} value={s.value}>
                                  {statusLabels[s.value]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">{content.tracking}</Label>
                          <Input
                            value={editData.tracking_number}
                            onChange={(e) => setEditData(prev => ({ ...prev, tracking_number: e.target.value }))}
                            placeholder={content.trackingPlaceholder}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">{content.notes}</Label>
                          <Textarea
                            value={editData.notes}
                            onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder={content.notesPlaceholder}
                            rows={2}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSave(order.id);
                            }}
                            disabled={isSaving}
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                            {content.save}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingOrder(null);
                            }}
                          >
                            <X className="w-4 h-4 mr-1" />
                            {content.cancel}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(order);
                        }}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        {content.edit}
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminOrderManager;
