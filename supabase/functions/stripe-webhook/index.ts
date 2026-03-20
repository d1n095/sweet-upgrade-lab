import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
 try {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── HEALTH CHECK (GET) ──
  if (req.method === 'GET') {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    let lastEvents: any[] = [];
    let lastEventTime: string | null = null;
    try {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl!, serviceKey);
      const { data } = await supabase
        .from('activity_logs')
        .select('created_at, message, log_type, details')
        .eq('category', 'payment')
        .order('created_at', { ascending: false })
        .limit(5);
      lastEvents = (data || []).map((e: any) => ({
        time: e.created_at,
        message: e.message,
        type: e.log_type,
        event_type: e.details?.event_type || null,
      }));
      lastEventTime = lastEvents[0]?.time || null;
    } catch {}

    return new Response(JSON.stringify({
      status: 'ok',
      stripe_key_configured: !!stripeKey,
      webhook_secret_configured: !!webhookSecret,
      webhook_secret_prefix: webhookSecret ? webhookSecret.substring(0, 10) + '...' : null,
      supabase_url_configured: !!supabaseUrl,
      last_event_time: lastEventTime,
      recent_events: lastEvents,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY not configured');
    return ok({ received: true, error: 'stripe_key_not_configured' });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return ok({ received: true, error: 'webhook_secret_not_configured' });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.error('[stripe-webhook] Missing stripe-signature');
    return ok({ received: true, error: 'missing_signature' });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    // Return 200 anyway so Stripe doesn't keep retrying a bad secret
    return ok({ received: true, error: 'signature_failed', message: err.message });
  }

  console.log('[stripe-webhook] Event received', { event_id: event.id, event_type: event.type });

  await logEvent(supabase, 'info', 'payment', 'Stripe webhook event received', {
    event_id: event.id, event_type: event.type, livemode: event.livemode,
  });

  // ══════════════════════════════════════════════════════════
  // checkout.session.completed → CREATE order + mark as paid
  // ══════════════════════════════════════════════════════════
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

    const ensured = await upsertPaidOrderFromSession(stripe, supabase, session);

    if (!ensured.orderId) {
      console.error('[stripe-webhook] Failed to create order for session:', session.id);
      await logEvent(supabase, 'error', 'order', 'Failed to create order from webhook', {
        stripe_session: session.id, event_id: event.id,
      });
      return ok({ received: true, error: ensured.error || 'order_creation_failed' });
    }

    if (!ensured.duplicate) {
      await logEvent(
        supabase,
        'success',
        'order',
        'Payment confirmed — order created from Stripe webhook',
        {
          order_number: ensured.order?.order_number || null,
          stripe_session_id: session.id,
          payment_intent_id: paymentIntentId,
          amount: ensured.order?.total_amount || null,
        },
        ensured.orderId,
      );

      // Send order confirmation email
      try {
        const emailFnUrl = `${supabaseUrl}/functions/v1/send-order-email`;
        await fetch(emailFnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            order_id: ensured.orderId,
            email_type: 'order_confirmation',
          }),
        });
        console.log('[stripe-webhook] Order confirmation email triggered for', ensured.order?.order_number);
      } catch (emailErr: any) {
        console.warn('[stripe-webhook] Failed to trigger order email:', emailErr?.message);
      }
    }

    return ok({
      received: true,
      duplicate: ensured.duplicate,
      order_id: ensured.orderId,
      order_number: ensured.order?.order_number || null,
      stripe_session_id: session.id,
    });
  }

  // ══════════════════════════════════════════════════════════
  // checkout.session.expired → release reserved stock
  // ══════════════════════════════════════════════════════════
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Release reserved stock using metadata
    const reservedMeta = session.metadata?.reserved_items || "";
    if (reservedMeta) {
      const pairs = reservedMeta.split(",").filter(Boolean);
      for (const pair of pairs) {
        const [productId, qtyStr] = pair.split(":");
        const qty = parseInt(qtyStr) || 1;
        if (!productId) continue;

        const { data: product } = await supabase
          .from('products')
          .select('reserved_stock')
          .eq('id', productId)
          .maybeSingle();

        if (product) {
          await supabase
            .from('products')
            .update({ reserved_stock: Math.max(0, product.reserved_stock - qty) })
            .eq('id', productId);
        }
      }

      await logEvent(supabase, 'warning', 'payment',
        'Payment session expired — reserved stock released',
        { stripe_session: session.id, reserved_items: reservedMeta },
      );
    }

    return ok({ received: true });
  }

  // ══════════════════════════════════════════════════════════
  // payment_intent.payment_failed → log failure
  // ══════════════════════════════════════════════════════════
  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';

    await logEvent(supabase, 'error', 'payment', `Payment failed: ${failureMessage}`, {
      payment_intent_id: paymentIntent.id,
      failure_code: paymentIntent.last_payment_error?.code,
    });

    return ok({ received: true });
  }

  // ══════════════════════════════════════════════════════════
  // charge.refunded → update order refund status
  // ══════════════════════════════════════════════════════════
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = charge.payment_intent as string | null;

    if (paymentIntentId) {
      const { data: order } = await supabase
        .from('orders')
        .select('id, status_history')
        .eq('payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (order) {
        const refundAmount = (charge.amount_refunded || 0) / 100;
        const isFullRefund = charge.refunded;
        const history = Array.isArray(order.status_history) ? [...order.status_history] : [];
        history.push({
          status: isFullRefund ? 'refunded' : 'partially_refunded',
          timestamp: new Date().toISOString(),
          note: `Refund processed: ${refundAmount} SEK${isFullRefund ? ' (full)' : ' (partial)'}`,
        });

        await supabase
          .from('orders')
          .update({
            refund_status: isFullRefund ? 'refunded' : 'partially_refunded',
            refund_amount: refundAmount,
            refunded_at: new Date().toISOString(),
            status_history: history,
          })
          .eq('id', order.id);

        await logEvent(supabase, 'info', 'payment', `Refund processed: ${refundAmount} SEK`, {
          payment_intent_id: paymentIntentId, full_refund: isFullRefund,
        }, order.id);
      }
    }

    return ok({ received: true });
  }

  console.log('[stripe-webhook] Ignored event type:', event.type);
  return ok({ received: true, ignored: true, event_type: event.type });

 } catch (fatalErr: any) {
   console.error('[stripe-webhook] FATAL unhandled error:', fatalErr?.message || fatalErr);
   // ALWAYS return 200 so Stripe doesn't retry endlessly
   return new Response(JSON.stringify({ received: true, error: 'internal_error', message: fatalErr?.message }), {
     status: 200,
     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
   });
 }
});

// ── Helpers ──

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isUniqueViolation(error: any): boolean {
  const code = error?.code;
  const message = String(error?.message || '').toLowerCase();
  return code === '23505' || message.includes('duplicate key value');
}

async function findOrderBySession(supabase: any, sessionId: string): Promise<string | null> {
  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();
  return data?.id || null;
}

async function fetchTrackableOrderById(supabase: any, orderId: string) {
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, shopify_order_number, stripe_session_id, order_email, status, tracking_number, estimated_delivery, created_at, items, total_amount, currency, shipping_address, payment_status')
    .eq('id', orderId)
    .maybeSingle();

  return data || null;
}

async function settleReservedStockFromMetadata(supabase: any, reservedMeta: string) {
  if (!reservedMeta) return;

  const pairs = reservedMeta.split(',').filter(Boolean);
  for (const pair of pairs) {
    const [productId, qtyStr] = pair.split(':');
    const qty = parseInt(qtyStr, 10) || 1;
    if (!productId) continue;

    const { data: product } = await supabase
      .from('products')
      .select('stock, reserved_stock')
      .eq('id', productId)
      .maybeSingle();

    if (product) {
      await supabase
        .from('products')
        .update({
          stock: Math.max(0, product.stock - qty),
          reserved_stock: Math.max(0, product.reserved_stock - qty),
        })
        .eq('id', productId);
    }
  }
}

async function upsertPaidOrderFromSession(
  stripe: Stripe,
  supabase: any,
  session: Stripe.Checkout.Session,
): Promise<{ orderId: string | null; order: any | null; duplicate: boolean; error?: string }> {
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

  const existingOrderId = await findOrderBySession(supabase, session.id);
  if (existingOrderId) {
    const existingOrder = await fetchTrackableOrderById(supabase, existingOrderId);
    if (existingOrder?.payment_status === 'paid') {
      return { orderId: existingOrderId, order: existingOrder, duplicate: true };
    }
  }

  if (paymentIntentId) {
    const { data: existingByPI } = await supabase
      .from('orders')
      .select('id, payment_status')
      .eq('payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existingByPI?.id && existingByPI.payment_status === 'paid') {
      const order = await fetchTrackableOrderById(supabase, existingByPI.id);
      return { orderId: existingByPI.id, order, duplicate: true };
    }
  }

  const orderId = await createOrderFromSession(stripe, supabase, session);
  if (!orderId) {
    return { orderId: null, order: null, duplicate: false, error: 'order_creation_failed' };
  }

  await settleReservedStockFromMetadata(supabase, session.metadata?.reserved_items || '');
  const order = await fetchTrackableOrderById(supabase, orderId);

  return { orderId, order, duplicate: false };
}

/**
 * Create a new order directly from the completed Stripe session.
 * This is the ONLY place orders are created — after payment is confirmed.
 */
async function createOrderFromSession(
  stripe: Stripe,
  supabase: any,
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const email = session.customer_email
    || session.customer_details?.email
    || session.metadata?.email
    || 'unknown@guest.local';

  const currency = (session.currency || 'sek').toUpperCase();
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

  // Resolve user_id
  let userId = session.metadata?.user_id || null;
  if (!userId) {
    try {
      const { data: foundUsers } = await supabase.rpc('admin_search_users', { p_query: email });
      if (foundUsers && foundUsers.length > 0) {
        userId = foundUsers[0].user_id;
      }
    } catch {}
  }
  const orderUserId = userId || '00000000-0000-0000-0000-000000000000';

  // Try to get items from metadata first, then fall back to Stripe line items
  let items: Array<{ id: string | null; title: string; price: number; quantity: number; image: string }> = [];

  const itemsMeta = session.metadata?.order_items;
  if (itemsMeta) {
    try {
      items = JSON.parse(itemsMeta);
    } catch {}
  }

  if (items.length === 0) {
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      items = lineItems.data.map((line) => ({
        id: line.price?.id || null,
        title: line.description || 'Produkt',
        price: (line.amount_total || line.amount_subtotal || 0) / 100,
        quantity: line.quantity || 1,
        image: '',
      }));
    } catch (err) {
      console.warn('[stripe-webhook] Could not fetch line items:', err);
    }
  }

  // Resolve payment method
  let paymentMethodType: string | null = null;
  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.payment_method) {
        const pm = await stripe.paymentMethods.retrieve(pi.payment_method as string);
        paymentMethodType = pm.type;
      }
    } catch {}
  }

  const shippingAddress = {
    name: session.metadata?.shipping_name || session.customer_details?.name || '',
    address: session.metadata?.shipping_address || session.customer_details?.address?.line1 || '',
    zip: session.metadata?.shipping_zip || session.customer_details?.address?.postal_code || '',
    city: session.metadata?.shipping_city || session.customer_details?.address?.city || '',
    country: session.metadata?.shipping_country || session.customer_details?.address?.country || 'SE',
    phone: session.metadata?.shipping_phone || session.customer_details?.phone || '',
  };

  const orderData = {
    order_email: email,
    user_id: orderUserId,
    total_amount: (session.amount_total || 0) / 100,
    currency,
    status: 'confirmed',
    payment_status: 'paid',
    payment_method: paymentMethodType,
    stripe_session_id: session.id,
    payment_intent_id: paymentIntentId,
    items,
    shipping_address: shippingAddress,
    status_history: [{
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      note: `Order created from checkout.session.completed webhook (payment confirmed, user: ${orderUserId === '00000000-0000-0000-0000-000000000000' ? 'guest' : 'authenticated'})`,
    }],
    notes: `Created by webhook after payment — session ${session.id}`,
  };

  const { data: insertedOrder, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select('id')
    .maybeSingle();

  if (error) {
    if (isUniqueViolation(error)) {
      // Idempotency safety for concurrent duplicate deliveries
      const existingBySession = await findOrderBySession(supabase, session.id);
      if (existingBySession) {
        return existingBySession;
      }

      if (paymentIntentId) {
        const { data: existingByPI } = await supabase
          .from('orders')
          .select('id')
          .eq('payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (existingByPI?.id) {
          return existingByPI.id;
        }
      }
    }

    console.error('[stripe-webhook] Failed to create order:', error);
    await logEvent(supabase, 'error', 'order', 'Failed to create order from webhook', {
      stripe_session_id: session.id, email, amount: (session.amount_total || 0) / 100, error: error.message,
    });
    return null;
  }

  return insertedOrder?.id || null;
}

async function logEvent(
  supabase: any,
  logType: string,
  category: string,
  message: string,
  details: any = {},
  orderId?: string,
) {
  try {
    await supabase.from('activity_logs').insert({
      log_type: logType, category, message, details, order_id: orderId || null,
    });
  } catch (err) {
    console.error('[stripe-webhook] Failed to persist log:', err);
  }
}
