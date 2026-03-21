import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList, Package, Truck, Check, Clock, Loader2,
  Eye, ChevronDown, ChevronUp, Save, X, CreditCard, MapPin, User, History, CheckCircle, AlertTriangle,
  Printer, FileText, Download, RotateCcw, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { getOrderDisplayId } from '@/utils/orderDisplay';
import ShippingFormDialog from '@/components/admin/ShippingFormDialog';

interface Order {
  id: string;
  order_email: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
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
  refund_status: string | null;
  refund_amount: number | null;
  refunded_at: string | null;
  fulfillment_status: string;
  packed_by: string | null;
  packed_at: string | null;
  shipped_by: string | null;
  shipped_at: string | null;
}

const statusOptions = [
  { value: 'pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'confirmed', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'processing', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'shipped', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { value: 'delivered', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'returned', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'lost', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  { value: 'failed', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'abandoned', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
  { value: 'cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
];

const AdminOrderManager = () => {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';
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
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [fulfillmentTab, setFulfillmentTab] = useState<string>(initialTab);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);

  const t = {
    sv: {
      title: 'Orderhantering',
      subtitle: 'Hantera och spåra alla ordrar',
      noOrders: 'Inga ordrar hittades',
      toPack: 'Att packa',
      packed: 'Packade',
      fulfillmentAll: 'Alla',
      markPacked: 'Markera packad',
      markShipped: 'Markera skickad',
      packing: 'Packas',
      waitingPayment: 'Väntar betalning',
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
      abandoned: 'Övergiven',
      returned: 'Retur',
      lost: 'Borttappad',
      refund: 'Återbetalning',
      refundConfirm: 'Markera som återbetald?',
      refunded: 'Återbetald',
      partialRefund: 'Delvis återbetald',
      paid: 'Betalda',
      unpaid: 'Obetalda',
      paymentAll: 'Alla betalningar',
      paymentMethod: 'Betalmetod',
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
      toPack: 'To pack',
      packed: 'Packed',
      fulfillmentAll: 'All',
      markPacked: 'Mark packed',
      markShipped: 'Mark shipped',
      packing: 'Packing',
      waitingPayment: 'Awaiting payment',
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
      abandoned: 'Abandoned',
      returned: 'Returned',
      lost: 'Lost',
      refund: 'Refund',
      refundConfirm: 'Mark as refunded?',
      refunded: 'Refunded',
      partialRefund: 'Partially refunded',
      paid: 'Paid',
      unpaid: 'Unpaid',
      paymentAll: 'All payments',
      paymentMethod: 'Payment method',
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
    abandoned: content.abandoned,
    returned: content.returned,
    lost: content.lost,
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .is('deleted_at', null)
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

      // Trigger status update email for meaningful status changes
      if (editData.status !== order.status && ['processing', 'shipped', 'delivered', 'returned', 'lost'].includes(editData.status)) {
        try {
          await supabase.functions.invoke('send-order-email', {
            body: { order_id: order.id, email_type: 'status_update' },
          });
          toast.success(`${content.updated} — mail skickat till ${order.order_email}`);
        } catch {
          toast.success(content.updated);
        }
      } else {
        toast.success(content.updated);
      }
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

  const [refundReason, setRefundReason] = useState('');
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);

  const handleRequestRefund = async (order: Order) => {
    if (!refundReason.trim()) {
      toast.error(language === 'sv' ? 'Ange en anledning' : 'Enter a reason');
      return;
    }

    try {
      toast.loading(language === 'sv' ? 'Skapar förfrågan...' : 'Creating request...', { id: 'refund' });

      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: { action: 'create_request', order_id: order.id, reason: refundReason },
      });

      if (error) throw error;

      setRefundOrderId(null);
      setRefundReason('');
      toast.success(
        language === 'sv' ? 'Återbetalningsförfrågan skapad' : 'Refund request created',
        { id: 'refund' }
      );
    } catch (error: any) {
      console.error('Failed to create refund request:', error);
      toast.error(error?.message || (language === 'sv' ? 'Kunde inte skapa förfrågan' : 'Failed to create request'), { id: 'refund' });
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteOrder = async (order: Order) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', order.id);
      if (error) throw error;
      setOrders(prev => prev.filter(o => o.id !== order.id));
      if (expandedOrder === order.id) setExpandedOrder(null);
      setDeleteConfirmId(null);
      logActivity({
        log_type: 'warning',
        category: 'order',
        message: `Order raderad: ${getOrderDisplayId(order)}`,
        details: { order_email: order.order_email, total: order.total_amount },
        order_id: order.id,
      });
      toast.success(language === 'sv' ? 'Order raderad' : 'Order deleted');
    } catch (error) {
      console.error('Failed to delete order:', error);
      toast.error(content.error);
    }
  };

  const getPaymentMethodLabel = (method: string | null): string => {
    if (!method) return '-';
    const map: Record<string, string> = {
      card: 'Kort',
      klarna: 'Klarna',
      swish: 'Swish',
      apple_pay: 'Apple Pay',
      google_pay: 'Google Pay',
    };
    return map[method] || method;
  };

  const getStatusColor = (status: string) => {
    return statusOptions.find(s => s.value === status)?.color || 'bg-secondary text-secondary-foreground';
  };

  const filteredOrders = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (paymentFilter === 'paid' && o.payment_status !== 'paid') return false;
    if (paymentFilter === 'unpaid' && o.payment_status === 'paid') return false;
    if (fulfillmentTab === 'to_pack' && !(o.payment_status === 'paid' && (o.fulfillment_status === 'pending' || o.fulfillment_status === 'unfulfilled'))) return false;
    if (fulfillmentTab === 'packing' && o.fulfillment_status !== 'packing') return false;
    if (fulfillmentTab === 'packed' && o.fulfillment_status !== 'packed') return false;
    if (fulfillmentTab === 'shipped' && o.fulfillment_status !== 'shipped') return false;
    if (fulfillmentTab === 'unpaid' && o.payment_status === 'paid') return false;
    return true;
  });
  const handlePackAndShip = async (order: Order) => {
    if (order.payment_status !== 'paid') {
      toast.error(language === 'sv' ? 'Order måste vara betald först' : 'Order must be paid first');
      return;
    }
    if (order.fulfillment_status === 'shipped' || (order.fulfillment_status === 'packed' && order.tracking_number)) {
      toast.error(language === 'sv' ? 'Frakt redan skapad' : 'Shipment already created');
      return;
    }
    try {
      toast.loading(language === 'sv' ? 'Skapar frakt…' : 'Creating shipment…', { id: `ship-${order.id}` });
      const { data, error } = await supabase.functions.invoke('create-shipment', {
        body: { order_id: order.id },
      });
      toast.dismiss(`ship-${order.id}`);
      if (error) throw new Error(error.message || 'Edge function error');
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      setOrders(prev => prev.map(o => o.id === order.id ? {
        ...o,
        fulfillment_status: 'packed',
        packed_at: new Date().toISOString(),
        tracking_number: data.tracking_number || o.tracking_number,
        status: 'processing',
      } : o));
      if (data.label_url) window.open(data.label_url, '_blank');
      toast.success(
        data.shipmondo_used
          ? (language === 'sv' ? 'Packad & frakt skapad ✓' : 'Packed & shipment created ✓')
          : (language === 'sv' ? 'Packad ✓ (Shipmondo ej konfigurerad)' : 'Packed ✓ (Shipmondo not configured)')
      );
    } catch (err: any) {
      toast.dismiss(`ship-${order.id}`);
      console.error(err);
      toast.error(err.message || content.error);
    }
  };

  const handleMarkShipped = async (order: Order) => {
    if (order.payment_status !== 'paid') {
      toast.error(language === 'sv' ? 'Order måste vara betald först' : 'Order must be paid first');
      return;
    }
    if (order.fulfillment_status !== 'packed') {
      toast.error(language === 'sv' ? 'Packa ordern först' : 'Pack the order first');
      return;
    }
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const existingHistory = Array.isArray(order.status_history) ? order.status_history : [];
      const newHistory = [...existingHistory, {
        status: 'shipped',
        timestamp: new Date().toISOString(),
        note: 'Markerad som skickad',
      }];
      const { error } = await supabase.from('orders').update({
        fulfillment_status: 'shipped',
        shipped_by: currentUser?.id || null,
        shipped_at: new Date().toISOString(),
        status: 'shipped',
        status_history: newHistory,
      }).eq('id', order.id);
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, fulfillment_status: 'shipped', shipped_at: new Date().toISOString(), shipped_by: currentUser?.id || null, status: 'shipped', status_history: newHistory } : o));
      logActivity({ log_type: 'success', category: 'fulfillment', message: `Order ${getOrderDisplayId(order)} skickad`, order_id: order.id });
      toast.success(language === 'sv' ? 'Order markerad som skickad' : 'Order marked as shipped');
      try {
        await supabase.functions.invoke('send-order-email', { body: { order_id: order.id, email_type: 'status_update' } });
      } catch {}
    } catch (err) {
      console.error(err);
      toast.error(content.error);
    }
  };

  // Batch packing helpers
  const showBatchCheckboxes = ['to_pack', 'packing', 'packed'].includes(fulfillmentTab);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleBatchPack = async () => {
    const ids = Array.from(selectedOrders);
    const eligible = orders.filter(o => ids.includes(o.id) && o.payment_status === 'paid' && ['unfulfilled', 'pending', 'packing'].includes(o.fulfillment_status));
    if (eligible.length === 0) { toast.error('Inga giltiga orders att packa'); return; }
    setBatchProcessing(true);
    setBatchProgress({ done: 0, total: eligible.length });
    for (let i = 0; i < eligible.length; i++) {
      const order = eligible[i];
      try {
        const { data, error } = await supabase.functions.invoke('create-shipment', {
          body: { order_id: order.id },
        });
        if (!error && data?.success) {
          setOrders(prev => prev.map(o => o.id === order.id ? {
            ...o,
            fulfillment_status: 'packed',
            packed_at: new Date().toISOString(),
            tracking_number: data.tracking_number || o.tracking_number,
            status: 'processing',
          } : o));
          if (data.label_url) window.open(data.label_url, '_blank');
        }
      } catch (err) {
        console.error(`Batch pack error for ${order.id}:`, err);
      }
      setBatchProgress({ done: i + 1, total: eligible.length });
    }
    setBatchProcessing(false);
    setSelectedOrders(new Set());
    toast.success(`${eligible.length} orders packade & frakt skapad`);
  };

  const handleBatchShip = async () => {
    const ids = Array.from(selectedOrders);
    const eligible = orders.filter(o => ids.includes(o.id) && o.payment_status === 'paid' && o.fulfillment_status === 'packed');
    if (eligible.length === 0) { toast.error('Inga packade orders att skicka'); return; }
    setBatchProcessing(true);
    setBatchProgress({ done: 0, total: eligible.length });
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    for (let i = 0; i < eligible.length; i++) {
      const order = eligible[i];
      const existingHistory = Array.isArray(order.status_history) ? order.status_history : [];
      const newHistory = [...existingHistory, { status: 'shipped', timestamp: new Date().toISOString(), note: 'Batch-skickad' }];
      const { error } = await supabase.from('orders').update({
        fulfillment_status: 'shipped',
        shipped_by: currentUser?.id || null,
        shipped_at: new Date().toISOString(),
        status: 'shipped',
        status_history: newHistory,
      }).eq('id', order.id);
      if (!error) {
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, fulfillment_status: 'shipped', shipped_at: new Date().toISOString(), shipped_by: currentUser?.id || null, status: 'shipped', status_history: newHistory } : o));
        logActivity({ log_type: 'success', category: 'fulfillment', message: `Order ${getOrderDisplayId(order)} batch-skickad`, order_id: order.id });
      }
      setBatchProgress({ done: i + 1, total: eligible.length });
    }
    setBatchProcessing(false);
    setSelectedOrders(new Set());
    toast.success(`${eligible.length} orders skickade`);
  };


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

  const escHtml = (s: string | null | undefined): string =>
    String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const handlePrintOrder = (order: Order) => {
    const addr = parseShippingAddress(order.shipping_address);
    const items = Array.isArray(order.items) ? order.items : [];
    const html = `<html><head><title>${escHtml(getOrderDisplayId(order))}</title><style>body{font-family:system-ui;padding:40px;font-size:14px}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.header{display:flex;justify-content:space-between;margin-bottom:24px}</style></head><body>
      <div class="header"><div><h1>Order ${escHtml(getOrderDisplayId(order))}</h1><p>${formatDate(order.created_at)}</p></div><div><strong>Status:</strong> ${escHtml(statusLabels[order.status] || order.status)}<br><strong>Betalning:</strong> ${escHtml(order.payment_status)}</div></div>
      <h3>Kund</h3><p>${escHtml(order.order_email)}${addr ? `<br>${escHtml(addr.name)}<br>${escHtml(addr.address)}<br>${escHtml(addr.zip)} ${escHtml(addr.city)}<br>${escHtml(addr.country)}${addr.phone ? '<br>Tel: '+escHtml(addr.phone) : ''}` : ''}</p>
      <h3>Produkter</h3><table><tr><th>Produkt</th><th>Antal</th><th>Pris</th></tr>${items.map((i:any) => `<tr><td>${escHtml(i.title || i.name || '-')}</td><td>${escHtml(String(i.quantity || 1))}</td><td>${escHtml(String(i.price || '-'))}</td></tr>`).join('')}</table>
      <p><strong>Totalt: ${formatCurrency(order.total_amount, order.currency)}</strong></p>
      ${order.tracking_number ? `<p><strong>Spårning:</strong> ${escHtml(order.tracking_number)}</p>` : ''}
      ${order.notes ? `<p><strong>Anteckningar:</strong> ${escHtml(order.notes)}</p>` : ''}
      <script>window.print()</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };


  const handleExportCSV = () => {
    const headers = ['Order-ID', 'Email', 'Status', 'Betalning', 'Totalt', 'Valuta', 'Spårning', 'Skapad'];
    const rows = filteredOrders.map(o => [
      getOrderDisplayId(o),
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
      {/* Fulfillment Tabs */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
        {[
          { key: 'all', label: content.fulfillmentAll, count: orders.length },
          { key: 'unpaid', label: content.waitingPayment, count: orders.filter(o => o.payment_status !== 'paid').length },
          { key: 'to_pack', label: content.toPack, count: orders.filter(o => o.payment_status === 'paid' && (o.fulfillment_status === 'pending' || o.fulfillment_status === 'unfulfilled')).length },
          { key: 'packing', label: content.packing, count: orders.filter(o => o.fulfillment_status === 'packing').length },
          { key: 'packed', label: content.packed, count: orders.filter(o => o.fulfillment_status === 'packed').length },
          { key: 'shipped', label: content.shipped, count: orders.filter(o => o.fulfillment_status === 'shipped').length },
        ].map(tab => (
          <Button
            key={tab.key}
            variant={fulfillmentTab === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFulfillmentTab(tab.key); setFilter('all'); setPaymentFilter('all'); setSelectedOrders(new Set()); }}
            className={tab.key === 'to_pack' && tab.count > 0 ? 'border-orange-400 dark:border-orange-600' : ''}
          >
            {tab.label} ({tab.count})
          </Button>
        ))}
      </div>

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

      {/* Payment Status Filters */}
      <div className="flex flex-wrap gap-2">
        <Button variant={paymentFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentFilter('all')}>
          {content.paymentAll}
        </Button>
        <Button variant={paymentFilter === 'paid' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentFilter('paid')}>
          {content.paid} ({orders.filter(o => o.payment_status === 'paid').length})
        </Button>
        <Button variant={paymentFilter === 'unpaid' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentFilter('unpaid')}>
          {content.unpaid} ({orders.filter(o => o.payment_status !== 'paid').length})
        </Button>
      </div>

      {/* Batch Action Bar */}
      {showBatchCheckboxes && selectedOrders.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium">{selectedOrders.size} valda</span>
          {batchProcessing ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">{batchProgress.done} / {batchProgress.total}</span>
              <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }} />
              </div>
            </div>
          ) : (
            <>
              {fulfillmentTab === 'to_pack' && (
                <Button size="sm" onClick={handleBatchPack} className="gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  Batch-packa alla
                </Button>
              )}
              {fulfillmentTab === 'packed' && (
                <Button size="sm" onClick={handleBatchShip} className="gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  Batch-skicka alla
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedOrders(new Set())}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-2">
        {showBatchCheckboxes && filteredOrders.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-1">
            <Checkbox
              checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs text-muted-foreground">Markera alla</span>
          </div>
        )}
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
                className={`rounded-lg border overflow-hidden ${selectedOrders.has(order.id) ? 'border-primary bg-primary/5' : 'border-border bg-secondary/30'}`}
              >
                {/* Order Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                >
                  {showBatchCheckboxes && (
                    <Checkbox
                      checked={selectedOrders.has(order.id)}
                      onCheckedChange={() => toggleOrderSelection(order.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm font-mono">
                        {getOrderDisplayId(order)}
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
                      {order.refund_status && (
                        <Badge variant="outline" className="text-[10px] h-5 border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400">
                          {order.refund_status === 'refunded' ? content.refunded : content.partialRefund}
                        </Badge>
                      )}
                      {order.payment_status === 'paid' && (
                        <Badge variant="outline" className={`text-[10px] h-5 ${
                          order.fulfillment_status === 'shipped' ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400'
                          : order.fulfillment_status === 'packed' ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400'
                          : order.fulfillment_status === 'packing' ? 'border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400'
                          : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400'
                        }`}>
                          {order.fulfillment_status === 'shipped' ? '📦 Skickad'
                          : order.fulfillment_status === 'packed' ? '✅ Packad'
                          : order.fulfillment_status === 'packing' ? '🔧 Packas'
                          : '⏳ Att packa'}
                        </Badge>
                      )}
                      {order.payment_method && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {getPaymentMethodLabel(order.payment_method)}
                        </Badge>
                      )}
                      {(order.status === 'failed' || order.status === 'abandoned') && (
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.order_email} · {formatDate(order.created_at)}
                    </p>
                  </div>
                   <div className="flex items-center gap-2">
                    {/* Payment status is controlled by Stripe webhook only — no manual "mark as paid" */}
                    {/* Fulfillment actions – only for paid orders */}
                    {order.payment_status === 'paid' && !['packed', 'shipped'].includes(order.fulfillment_status) && !order.tracking_number && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs border-primary/50 text-primary hover:bg-primary/10"
                        onClick={(e) => { e.stopPropagation(); handlePackAndShip(order); }}
                      >
                        <Package className="w-3.5 h-3.5" />
                        {language === 'sv' ? 'Packa & skapa frakt' : 'Pack & create shipment'}
                      </Button>
                    )}
                    {order.payment_status === 'paid' && order.fulfillment_status === 'packed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                        onClick={(e) => { e.stopPropagation(); handleMarkShipped(order); }}
                      >
                        <Truck className="w-3.5 h-3.5" />
                        {content.markShipped}
                      </Button>
                    )}
                    {order.payment_status === 'paid' && !order.refund_status && (
                      refundOrderId === order.id ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Input
                            placeholder={language === 'sv' ? 'Anledning...' : 'Reason...'}
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            className="h-7 text-xs w-36"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRequestRefund(order); }}
                          />
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleRequestRefund(order)}>
                            {language === 'sv' ? 'Skicka' : 'Send'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-1.5" onClick={() => { setRefundOrderId(null); setRefundReason(''); }}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRefundOrderId(order.id);
                          }}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {language === 'sv' ? 'Begär återbetalning' : 'Request refund'}
                        </Button>
                      )
                    )}
                    {deleteConfirmId === order.id ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs text-destructive">{language === 'sv' ? 'Radera?' : 'Delete?'}</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrder(order);
                          }}
                        >
                          {language === 'sv' ? 'Ja' : 'Yes'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(null);
                          }}
                        >
                          {language === 'sv' ? 'Nej' : 'No'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(order.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
                                <img src={item.image} alt="" loading="lazy" className="w-10 h-10 rounded object-cover flex-shrink-0" />
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
                    {order.payment_status === 'paid' && !['packed', 'shipped'].includes(order.fulfillment_status) && !order.tracking_number && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handlePackAndShip(order); }}
                        className="gap-2"
                      >
                        <Package className="w-4 h-4" />
                        {language === 'sv' ? 'Packa & skapa frakt' : 'Pack & create shipment'}
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
