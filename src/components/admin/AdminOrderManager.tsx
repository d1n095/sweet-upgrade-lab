import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList, Package, Truck, Check, Clock, Loader2,
  Eye, ChevronDown, ChevronUp, Save, X, CreditCard, MapPin, User, History, CheckCircle, AlertTriangle,
  Printer, FileText, Download
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
import { logActivity } from '@/utils/activityLogger';

interface Order {
  id: string;
  order_email: string;
  status: string;
  payment_status: string;
  total_amount: number;
  currency: string;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  shopify_order_number: string | null;
  order_number: string | null;
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
      logActivity({
        log_type: 'info',
        category: 'admin',
        message: `Order status updated to ${editData.status}`,
        details: { old_status: order.status, new_status: editData.status, tracking: editData.tracking_number || null },
        order_id: order.id,
      });
      toast.success(content.updated);
    } catch (error) {
      console.error('Failed to update order:', error);
      toast.error(content.error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkAsPaid = async (order: Order) => {
    try {
      const existingHistory = Array.isArray(order.status_history) ? order.status_history : [];
      const newHistory = [...existingHistory, {
        status: 'confirmed',
        timestamp: new Date().toISOString(),
        note: 'Manuellt markerad som betald av admin',
      }];

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          status_history: newHistory,
        })
        .eq('id', order.id);

      if (error) throw error;

      setOrders(prev =>
        prev.map(o =>
          o.id === order.id
            ? { ...o, status: 'confirmed', payment_status: 'paid', status_history: newHistory, updated_at: new Date().toISOString() }
            : o
        )
      );

      logActivity({
        log_type: 'success',
        category: 'admin',
        message: 'Order manually marked as paid by admin',
        details: { old_status: order.status },
        order_id: order.id,
      });

      toast.success(language === 'sv' ? 'Order markerad som betald' : 'Order marked as paid');
    } catch (error) {
      console.error('Failed to mark as paid:', error);
      toast.error(content.error);
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

  const handlePrintOrder = (order: Order) => {
    const addr = parseShippingAddress(order.shipping_address);
    const items = Array.isArray(order.items) ? order.items : [];
    const html = `<html><head><title>${order.order_number || order.id.slice(0,8)}</title><style>body{font-family:system-ui;padding:40px;font-size:14px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.header{display:flex;justify-content:space-between;margin-bottom:24px}</style></head><body>
      <div class="header"><div><h1>Order ${order.order_number || ''}</h1><p>${formatDate(order.created_at)}</p></div><div><strong>Status:</strong> ${statusLabels[order.status] || order.status}<br><strong>Betalning:</strong> ${order.payment_status}</div></div>
      <h3>Kund</h3><p>${order.order_email}${addr ? `<br>${addr.name || ''}<br>${addr.address || ''}<br>${addr.zip || ''} ${addr.city || ''}<br>${addr.country || ''}${addr.phone ? '<br>Tel: '+addr.phone : ''}` : ''}</p>
      <h3>Produkter</h3><table><tr><th>Produkt</th><th>Antal</th><th>Pris</th></tr>${items.map((i:any) => `<tr><td>${i.title || i.name || '-'}</td><td>${i.quantity || 1}</td><td>${i.price || '-'}</td></tr>`).join('')}</table>
      <p><strong>Totalt: ${formatCurrency(order.total_amount, order.currency)}</strong></p>
      ${order.tracking_number ? `<p><strong>Spårning:</strong> ${order.tracking_number}</p>` : ''}
      ${order.notes ? `<p><strong>Anteckningar:</strong> ${order.notes}</p>` : ''}
      <script>window.print()</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const handlePrintShippingLabel = (order: Order) => {
    const addr = parseShippingAddress(order.shipping_address);
    if (!addr) { toast.error(language === 'sv' ? 'Ingen leveransadress' : 'No shipping address'); return; }
    const html = `<html><head><title>Fraktsedel</title><style>body{font-family:system-ui;padding:40px}div{border:2px solid #000;padding:32px;max-width:400px;margin:0 auto}.from{margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #ccc;font-size:12px}h2{margin:0 0 8px}p{margin:4px 0;font-size:16px}.order{font-size:12px;color:#666;margin-top:16px}</style></head><body>
      <div><div class="from"><strong>Avsändare:</strong><br>4ThePeople<br>Sverige</div>
      <h2>Mottagare</h2>
      <p><strong>${addr.name || ''}</strong></p>
      <p>${addr.address || ''}</p>
      <p>${addr.zip || ''} ${addr.city || ''}</p>
      <p>${addr.country || 'Sverige'}</p>
      ${addr.phone ? `<p>Tel: ${addr.phone}</p>` : ''}
      <p class="order">${order.order_number || ''}</p></div>
      <script>window.print()</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const handleExportCSV = () => {
    const headers = ['Ordernummer', 'Email', 'Status', 'Betalning', 'Totalt', 'Valuta', 'Spårning', 'Skapad'];
    const rows = filteredOrders.map(o => [
      o.order_number || o.id.slice(0,8),
      o.order_email,
      o.status,
      o.payment_status,
      o.total_amount,
      o.currency,
      o.tracking_number || '',
      o.created_at,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            CSV
          </Button>
          <Badge variant="outline">{orders.length} {content.order.toLowerCase()}</Badge>
        </div>
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
                      <span className="font-medium text-sm font-mono">
                        {order.order_number || order.shopify_order_number || `#${order.id.slice(0, 8)}`}
                      </span>
                      <Badge className={getStatusColor(order.status)}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] h-5 ${
                        order.payment_status === 'paid' 
                          ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400' 
                          : order.payment_status === 'failed'
                          ? 'border-destructive/50 text-destructive'
                          : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400'
                      }`}>
                        {order.payment_status === 'paid' ? (language === 'sv' ? 'Betald' : 'Paid') 
                          : order.payment_status === 'failed' ? (language === 'sv' ? 'Misslyckad' : 'Failed')
                          : (language === 'sv' ? 'Obetald' : 'Unpaid')}
                      </Badge>
                      {order.status === 'failed' && (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.order_email} · {formatDate(order.created_at)}
                    </p>
                  </div>
                   <div className="flex items-center gap-2">
                    {/* Quick actions for pending/failed orders */}
                    {(order.status === 'pending' || order.status === 'failed') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsPaid(order);
                        }}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {language === 'sv' ? 'Markera betald' : 'Mark paid'}
                      </Button>
                    )}
                    <span className="font-semibold text-sm">
                      {formatCurrency(order.total_amount, order.currency)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handlePrintOrder(order); }}
                      className="gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      {language === 'sv' ? 'Skriv ut' : 'Print'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handlePrintShippingLabel(order); }}
                      className="gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      {language === 'sv' ? 'Fraktsedel' : 'Shipping Label'}
                    </Button>
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
