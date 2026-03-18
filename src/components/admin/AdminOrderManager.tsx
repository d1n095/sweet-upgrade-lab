import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList, Package, Truck, Check, Clock, Loader2,
  Eye, ChevronDown, ChevronUp, Save, X, CreditCard, MapPin, User, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  status_history: any;
}

const statusOptions = [
  { value: 'pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'confirmed', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'processing', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'shipped', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { value: 'delivered', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'failed', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
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
      notes: 'Adminanteckningar',
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
      failed: 'Misslyckad',
      items: 'Produkter',
      address: 'Leveransadress',
      estimatedDelivery: 'Beräknad leverans',
      notesPlaceholder: 'Lägg till anteckningar om ordern...',
      trackingPlaceholder: 'Ange spårningsnummer...',
      paymentId: 'Betalnings-ID',
      customerInfo: 'Kundinformation',
      orderTimestamps: 'Tidsstämplar',
      created: 'Skapad',
      lastUpdated: 'Senast uppdaterad',
      statusHistory: 'Statushistorik',
      noHistory: 'Ingen historik',
      qty: 'st',
      email: 'E-post',
      phone: 'Telefon',
      name: 'Namn',
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
      notes: 'Admin notes',
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
      failed: 'Failed',
      items: 'Products',
      address: 'Shipping address',
      estimatedDelivery: 'Estimated delivery',
      notesPlaceholder: 'Add notes about the order...',
      trackingPlaceholder: 'Enter tracking number...',
      paymentId: 'Payment ID',
      customerInfo: 'Customer info',
      orderTimestamps: 'Timestamps',
      created: 'Created',
      lastUpdated: 'Last updated',
      statusHistory: 'Status history',
      noHistory: 'No history',
      qty: 'qty',
      email: 'Email',
      phone: 'Phone',
      name: 'Name',
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
    failed: content.failed,
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

  const handleSave = async (order: Order) => {
    setIsSaving(true);
    try {
      // Build updated status history
      const existingHistory = Array.isArray(order.status_history) ? order.status_history : [];
      const newHistory = [...existingHistory];

      if (editData.status !== order.status) {
        newHistory.push({
          status: editData.status,
          timestamp: new Date().toISOString(),
          note: `Status changed from ${order.status} to ${editData.status}`,
        });
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: editData.status,
          tracking_number: editData.tracking_number || null,
          notes: editData.notes || null,
          status_history: newHistory,
        })
        .eq('id', order.id);

      if (error) throw error;

      setOrders(prev =>
        prev.map(o =>
          o.id === order.id
            ? {
                ...o,
                status: editData.status,
                tracking_number: editData.tracking_number || null,
                notes: editData.notes || null,
                status_history: newHistory,
                updated_at: new Date().toISOString(),
              }
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

  const extractPaymentId = (notes: string | null) => {
    if (!notes) return null;
    const match = notes.match(/Stripe session:\s*(cs_\S+)/);
    return match ? match[1] : null;
  };

  const parseShippingAddress = (addr: any) => {
    if (!addr || typeof addr !== 'object') return null;
    return addr as { name?: string; address?: string; zip?: string; city?: string; country?: string; phone?: string };
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
      <div className="space-y-2">
        {filteredOrders.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{content.noOrders}</p>
        ) : (
          filteredOrders.map((order) => {
            const isExpanded = expandedOrder === order.id;
            const isEditing = editingOrder === order.id;
            const paymentId = extractPaymentId(order.notes);
            const shippingAddr = parseShippingAddress(order.shipping_address);
            const statusHistory = Array.isArray(order.status_history) ? order.status_history : [];

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

                {/* Expanded Detail View */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-5">

                    {/* Products */}
                    {order.items && Array.isArray(order.items) && order.items.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{content.items}</Label>
                        </div>
                        <div className="rounded-md border border-border overflow-hidden">
                          {(order.items as any[]).map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-3 px-3 py-2 text-sm even:bg-secondary/20">
                              {item.image && (
                                <img src={item.image} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.title || item.name || 'Produkt'}</p>
                                <p className="text-xs text-muted-foreground">{item.quantity || 1} {content.qty}</p>
                              </div>
                              <span className="text-muted-foreground whitespace-nowrap">
                                {item.price ? formatCurrency(item.price * (item.quantity || 1), order.currency) : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-5">
                      {/* Customer Info */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{content.customerInfo}</Label>
                        </div>
                        <div className="space-y-1 text-sm">
                          {shippingAddr?.name && (
                            <p><span className="text-muted-foreground">{content.name}:</span> {shippingAddr.name}</p>
                          )}
                          <p><span className="text-muted-foreground">{content.email}:</span> {order.order_email}</p>
                          {shippingAddr?.phone && (
                            <p><span className="text-muted-foreground">{content.phone}:</span> {shippingAddr.phone}</p>
                          )}
                        </div>
                      </div>

                      {/* Shipping Address */}
                      {shippingAddr && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{content.address}</Label>
                          </div>
                          <div className="text-sm space-y-0.5">
                            {shippingAddr.address && <p>{shippingAddr.address}</p>}
                            <p>{[shippingAddr.zip, shippingAddr.city].filter(Boolean).join(' ')}</p>
                            {shippingAddr.country && <p>{shippingAddr.country}</p>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Payment ID & Timestamps */}
                    <div className="grid sm:grid-cols-2 gap-5">
                      {paymentId && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{content.paymentId}</Label>
                          </div>
                          <p className="text-sm font-mono break-all bg-secondary/50 rounded px-2 py-1">{paymentId}</p>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{content.orderTimestamps}</Label>
                        </div>
                        <div className="text-sm space-y-1">
                          <p><span className="text-muted-foreground">{content.created}:</span> {formatDate(order.created_at)}</p>
                          <p><span className="text-muted-foreground">{content.lastUpdated}:</span> {formatDate(order.updated_at)}</p>
                          {order.estimated_delivery && (
                            <p><span className="text-muted-foreground">{content.estimatedDelivery}:</span> {order.estimated_delivery}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status History */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <History className="w-4 h-4 text-muted-foreground" />
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{content.statusHistory}</Label>
                      </div>
                      {statusHistory.length > 0 ? (
                        <div className="relative pl-4 border-l-2 border-border space-y-3">
                          {(statusHistory as any[]).map((entry: any, idx: number) => (
                            <div key={idx} className="relative">
                              <div className="absolute -left-[calc(0.5rem+1px)] top-1 w-2 h-2 rounded-full bg-primary" />
                              <div className="text-sm">
                                <Badge className={`${getStatusColor(entry.status)} text-xs`}>
                                  {statusLabels[entry.status] || entry.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {entry.timestamp ? formatDate(entry.timestamp) : ''}
                                </span>
                                {entry.note && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{content.noHistory}</p>
                      )}
                    </div>

                    {/* Tracking (read-only) */}
                    {order.tracking_number && !isEditing && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{content.tracking}</Label>
                        </div>
                        <p className="text-sm font-mono">{order.tracking_number}</p>
                      </div>
                    )}

                    {/* Admin Notes (read-only) */}
                    {order.notes && !isEditing && (
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{content.notes}</Label>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{order.notes}</p>
                      </div>
                    )}

                    <Separator />

                    {/* Edit Form */}
                    {isEditing ? (
                      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
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
                            rows={3}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSave(order);
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
