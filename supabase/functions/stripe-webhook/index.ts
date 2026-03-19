import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const COMPLETED_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── HEALTH CHECK (GET) ──
  // Allows admin panel to verify webhook is reachable + secrets are configured
  if (req.method === 'GET') {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    // Fetch last webhook events from activity_logs
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
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY not configured');
    return new Response('Server misconfigured', { status: 500, headers: corsHeaders });
  }
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Webhook secret not configured', { status: 500, headers: corsHeaders });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.warn('[stripe-webhook] Rejected: missing stripe-signature header');
    return new Response('Missing stripe-signature', { status: 400, headers: corsHeaders });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[stripe-webhook] Event received', {
    event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
  });

  await logEvent(
    supabase,
    'info',
    'payment',
    'Stripe webhook event received',
    {
      event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
    },
  );

  // ── checkout.session.completed → ensure order exists + mark paid ──
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentIntentId = session.payment_intent as string | null;

    let resolvedOrderId = session.metadata?.order_id || await findOrderBySession(supabase, session.id);

    if (!resolvedOrderId) {
      resolvedOrderId = await createOrderFromCompletedSession(stripe, supabase, session);
      if (resolvedOrderId) {
        console.log('[stripe-webhook] Created missing order from session', {
          session_id: session.id,
          order_id: resolvedOrderId,
        });
      }
    }

    if (!resolvedOrderId) {
      console.error('[stripe-webhook] No order found or created for session:', session.id);
      await logEvent(
        supabase,
        'error',
        'order',
        'Webhook: no matching order could be resolved',
        { stripe_session: session.id, event_id: event.id },
      );
      return ok({ received: true, error: 'no_order' });
    }

    // ── PRIMARY idempotency: check payment_intent_id ──
    if (paymentIntentId) {
      const { data: existingByPI } = await supabase
        .from('orders')
        .select('id, status')
        .eq('payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (existingByPI && COMPLETED_STATUSES.includes(existingByPI.status)) {
        console.log('[stripe-webhook] Duplicate payment_intent_id, skipping', {
          payment_intent_id: paymentIntentId,
          order_id: existingByPI.id,
        });

        await logEvent(
          supabase,
          'warning',
          'payment',
          'Duplicate webhook blocked by payment_intent_id',
          {
            payment_intent_id: paymentIntentId,
            stripe_session: session.id,
          },
          existingByPI.id,
        );

        return ok({ received: true, duplicate: true, method: 'payment_intent_id', order_id: existingByPI.id });
      }
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, status, payment_status, status_history, items, order_number, user_id')
      .eq('id', resolvedOrderId)
      .maybeSingle();

    if (!order) {
      await logEvent(
        supabase,
        'error',
        'order',
        'Resolved order not found during webhook processing',
        { order_id: resolvedOrderId, stripe_session: session.id },
      );
      return ok({ received: true, error: 'order_not_found' });
    }

    // ── SECONDARY idempotency: check status + payment status ──
    if (COMPLETED_STATUSES.includes(order.status) && order.payment_status === 'paid') {
      console.log('[stripe-webhook] Duplicate webhook (status check), skipping', resolvedOrderId);
      await logEvent(
        supabase,
        'warning',
        'payment',
        'Duplicate webhook blocked by status check',
        {
          payment_intent_id: paymentIntentId,
          stripe_session: session.id,
        },
        resolvedOrderId,
      );
      return ok({ received: true, duplicate: true, method: 'status_check', order_id: resolvedOrderId });
    }

    // ── Try to resolve real user_id if order has placeholder ──
    let finalUserId = order.user_id;
    if (finalUserId === '00000000-0000-0000-0000-000000000000') {
      // Check metadata first
      const metadataUserId = session.metadata?.user_id;
      if (metadataUserId && metadataUserId !== '00000000-0000-0000-0000-000000000000') {
        finalUserId = metadataUserId;
      } else {
        // Try to find user by email
        const customerEmail = session.customer_email || session.customer_details?.email;
        if (customerEmail) {
          try {
            const { data: foundUsers } = await supabase.rpc('admin_search_users', { p_query: customerEmail });
            if (foundUsers && foundUsers.length > 0) {
              finalUserId = foundUsers[0].user_id;
            }
          } catch {}
        }
      }
    }

    // Resolve payment method from Stripe
    let paymentMethodType: string | null = null;
    if (paymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.payment_method) {
          const pm = await stripe.paymentMethods.retrieve(pi.payment_method as string);
          paymentMethodType = pm.type;
        }
      } catch (e) {
        console.warn('[stripe-webhook] Could not resolve payment method:', e);
      }
    }

    const history = Array.isArray(order.status_history) ? [...order.status_history] : [];
    history.push({
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      note: `Payment confirmed via Stripe (${paymentMethodType || 'unknown'}) — payment_status: paid`,
    });

    const updatePayload: Record<string, any> = {
      status: 'confirmed',
      payment_status: 'paid',
      payment_method: paymentMethodType,
      status_history: history,
      total_amount: (session.amount_total || 0) / 100,
      stripe_session_id: session.id,
      payment_intent_id: paymentIntentId,
    };

    // Update user_id if we resolved a real one
    if (finalUserId !== order.user_id) {
      updatePayload.user_id = finalUserId;
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', resolvedOrderId);

    if (updateError) {
      console.error('[stripe-webhook] Failed to confirm order:', updateError);
      await logEvent(
        supabase,
        'error',
        'order',
        'Failed to confirm order from webhook',
        { error: updateError.message, stripe_session: session.id },
        resolvedOrderId,
      );
      return new Response(JSON.stringify({ error: 'Update failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Convert reserved → sold only for reserved stock flow
    if (order.status === 'pending') {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        if (!item?.id) continue;

        const { data: product } = await supabase
          .from('products')
          .select('stock, reserved_stock')
          .eq('id', item.id)
          .maybeSingle();

        if (!product) continue;

        const qty = Number.isFinite(item.quantity) ? Math.max(1, Math.floor(item.quantity)) : 1;
        await supabase
          .from('products')
          .update({
            stock: Math.max(0, product.stock - qty),
            reserved_stock: Math.max(0, product.reserved_stock - qty),
          })
          .eq('id', item.id);
      }
    }

    const { data: confirmedOrder } = await supabase
      .from('orders')
      .select('id, order_number, order_email, total_amount, status, user_id')
      .eq('id', resolvedOrderId)
      .maybeSingle();

    console.log('[stripe-webhook] Order confirmed', {
      order_id: resolvedOrderId,
      order_number: confirmedOrder?.order_number,
      email: confirmedOrder?.order_email,
      amount: confirmedOrder?.total_amount,
      status: confirmedOrder?.status,
      user_id: confirmedOrder?.user_id,
      stripe_session_id: session.id,
      payment_intent_id: paymentIntentId,
      payment_method: paymentMethodType,
    });

    await logEvent(
      supabase,
      'success',
      'order',
      'Payment confirmed — order updated from Stripe webhook',
      {
        order_number: confirmedOrder?.order_number,
        stripe_session_id: session.id,
        payment_intent_id: paymentIntentId,
        payment_method: paymentMethodType,
        amount: confirmedOrder?.total_amount,
        user_id: confirmedOrder?.user_id,
      },
      resolvedOrderId,
    );

    return ok({
      received: true,
      order_id: resolvedOrderId,
      order_number: confirmedOrder?.order_number || null,
      stripe_session_id: session.id,
      email: confirmedOrder?.order_email || null,
      amount: confirmedOrder?.total_amount || null,
      status: confirmedOrder?.status || 'confirmed',
    });
  }

  // ── checkout.session.expired → release reserved stock ──
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;

    if (orderId) {
      const { data: order } = await supabase
        .from('orders')
        .select('id, status, status_history, items')
        .eq('id', orderId)
        .maybeSingle();

      if (order && order.status === 'pending') {
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          if (!item?.id) continue;
          const { data: product } = await supabase
            .from('products')
            .select('reserved_stock')
            .eq('id', item.id)
            .maybeSingle();

          if (!product) continue;

          const qty = Number.isFinite(item.quantity) ? Math.max(1, Math.floor(item.quantity)) : 1;
          await supabase
            .from('products')
            .update({ reserved_stock: Math.max(0, product.reserved_stock - qty) })
            .eq('id', item.id);
        }

        const history = Array.isArray(order.status_history) ? [...order.status_history] : [];
        history.push({ status: 'abandoned', timestamp: new Date().toISOString(), note: 'Payment session expired — reserved stock released' });

        await supabase
          .from('orders')
          .update({ status: 'abandoned', payment_status: 'abandoned', status_history: history })
          .eq('id', orderId);

        await logEvent(
          supabase,
          'warning',
          'payment',
          'Payment abandoned — session expired, reserved stock released',
          { stripe_session: session.id },
          orderId,
        );
      }
    }

    return ok({ received: true });
  }

  // ── payment_intent.payment_failed → mark order as failed ──
  if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const failureMessage = paymentIntent.last_payment_error?.message || 'Payment failed';

    const { data: order } = await supabase
      .from('orders')
      .select('id, status, status_history')
      .eq('payment_intent_id', paymentIntent.id)
      .maybeSingle();

    if (order && order.status === 'pending') {
      const history = Array.isArray(order.status_history) ? [...order.status_history] : [];
      history.push({ status: 'failed', timestamp: new Date().toISOString(), note: `Payment failed: ${failureMessage}` });

      await supabase
        .from('orders')
        .update({ status: 'failed', payment_status: 'failed', status_history: history })
        .eq('id', order.id);

      await logEvent(
        supabase,
        'error',
        'payment',
        `Payment failed: ${failureMessage}`,
        {
          payment_intent_id: paymentIntent.id,
          failure_code: paymentIntent.last_payment_error?.code,
        },
        order.id,
      );
    }

    return ok({ received: true });
  }

  // ── charge.refunded → mark order as refunded ──
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

        await logEvent(
          supabase,
          'info',
          'payment',
          `Refund processed: ${refundAmount} SEK`,
          {
            payment_intent_id: paymentIntentId,
            full_refund: isFullRefund,
          },
          order.id,
        );
      }
    }

    return ok({ received: true });
  }

  console.log('[stripe-webhook] Ignored event type:', event.type);
  return ok({ received: true, ignored: true, event_type: event.type });
});

// ── Helpers ──

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function findOrderBySession(supabase: any, sessionId: string): Promise<string | null> {
  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();
  return data?.id || null;
}

async function createOrderFromCompletedSession(
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

  // Try to resolve user_id from metadata or email lookup
  let userId = session.metadata?.user_id || null;
  if (!userId || userId === '00000000-0000-0000-0000-000000000000') {
    try {
      const { data: foundUsers } = await supabase.rpc('admin_search_users', { p_query: email });
      if (foundUsers && foundUsers.length > 0) {
        userId = foundUsers[0].user_id;
      }
    } catch {}
  }
  const orderUserId = userId || '00000000-0000-0000-0000-000000000000';

  let items: Array<{ id: string | null; title: string; price: number; quantity: number; image: string }> = [];
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
    console.warn('[stripe-webhook] Could not fetch line items for fallback order creation:', err);
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
    payment_method: null,
    stripe_session_id: session.id,
    payment_intent_id: paymentIntentId,
    items,
    shipping_address: shippingAddress,
    status_history: [{
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      note: `Order auto-created from checkout.session.completed webhook (user: ${orderUserId === '00000000-0000-0000-0000-000000000000' ? 'guest' : 'authenticated'})`,
    }],
    notes: `Auto-created by stripe-webhook from session ${session.id}`,
  };

  const { data: insertedOrder, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select('id')
    .single();

  if (error) {
    console.error('[stripe-webhook] Failed to auto-create order from session:', error);
    await logEvent(
      supabase,
      'error',
      'order',
      'Failed to auto-create order from checkout.session.completed',
      {
        stripe_session_id: session.id,
        email,
        amount: (session.amount_total || 0) / 100,
        error: error.message,
      },
    );
    return null;
  }

  await logEvent(
    supabase,
    'info',
    'order',
    'Order auto-created from checkout.session.completed',
    {
      order_id: insertedOrder.id,
      stripe_session_id: session.id,
      email,
      amount: (session.amount_total || 0) / 100,
      status: 'confirmed',
      user_id: orderUserId,
    },
    insertedOrder.id,
  );

  return insertedOrder.id;
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
      log_type: logType,
      category,
      message,
      details,
      order_id: orderId || null,
    });
  } catch (err) {
    console.error('[stripe-webhook] Failed to persist activity log:', err);
  }
}
