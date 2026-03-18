import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    console.warn('Rejected: missing stripe-signature header');
    return new Response('Missing stripe-signature', { status: 400, headers: corsHeaders });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Signature verification failed:', err.message);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── checkout.session.completed → convert reserved to sold ──
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    const paymentIntentId = session.payment_intent as string | null;

    // ── PRIMARY idempotency: check payment_intent_id ──
    if (paymentIntentId) {
      const { data: existingByPI } = await supabase
        .from('orders')
        .select('id, status')
        .eq('payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (existingByPI && ['confirmed', 'processing', 'shipped', 'delivered'].includes(existingByPI.status)) {
        console.log('Duplicate payment_intent_id, skipping:', paymentIntentId);
        await logEvent(supabase, 'warning', 'payment', 'Duplicate webhook blocked by payment_intent_id', {
          payment_intent_id: paymentIntentId,
          order_id: existingByPI.id,
        }, existingByPI.id);
        return ok({ received: true, duplicate: true, method: 'payment_intent_id' });
      }
    }

    const resolvedOrderId = orderId || await findOrderBySession(supabase, session.id);
    if (!resolvedOrderId) {
      console.error('No order found for session:', session.id);
      await logEvent(supabase, 'error', 'order', 'Webhook: no matching order', { stripe_session: session.id });
      return ok({ received: true, error: 'no_order' });
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, status, status_history, items')
      .eq('id', resolvedOrderId)
      .maybeSingle();

    if (!order) return ok({ received: true, error: 'order_not_found' });

    // ── SECONDARY idempotency: check order status ──
    if (['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status)) {
      console.log('Duplicate webhook (status check), skipping:', resolvedOrderId);
      await logEvent(supabase, 'warning', 'payment', 'Duplicate webhook blocked by status check', {
        payment_intent_id: paymentIntentId,
        stripe_session: session.id,
      }, resolvedOrderId);
      return ok({ received: true, duplicate: true, method: 'status_check' });
    }

    // Update status to confirmed + store payment_intent_id
    const history = Array.isArray(order.status_history) ? [...order.status_history] : [];
    history.push({ status: 'confirmed', timestamp: new Date().toISOString(), note: 'Payment confirmed via Stripe' });

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        status_history: history,
        total_amount: (session.amount_total || 0) / 100,
        stripe_session_id: session.id,
        payment_intent_id: paymentIntentId,
      })
      .eq('id', resolvedOrderId);

    if (updateError) {
      console.error('Failed to confirm order:', updateError);
      await logEvent(supabase, 'error', 'order', 'Failed to confirm order', { error: updateError.message }, resolvedOrderId);
      return new Response(JSON.stringify({ error: 'Update failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Convert reserved → sold: reduce stock, release reservation
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      if (!item.id) continue;
      const { data: product } = await supabase
        .from('products')
        .select('stock, reserved_stock')
        .eq('id', item.id)
        .single();

      if (product) {
        const qty = item.quantity || 1;
        await supabase
          .from('products')
          .update({
            stock: Math.max(0, product.stock - qty),
            reserved_stock: Math.max(0, product.reserved_stock - qty),
          })
          .eq('id', item.id);
      }
    }

    console.log('Order confirmed, stock converted:', resolvedOrderId);
    await logEvent(supabase, 'success', 'order', 'Payment confirmed — reserved stock converted to sold', {
      email: session.customer_email,
      total: (session.amount_total || 0) / 100,
      payment_intent_id: paymentIntentId,
    }, resolvedOrderId);

    return ok({ received: true, order_id: resolvedOrderId });
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
        // Release reserved stock
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          if (!item.id) continue;
          const { data: product } = await supabase
            .from('products')
            .select('reserved_stock')
            .eq('id', item.id)
            .single();

          if (product) {
            await supabase
              .from('products')
              .update({ reserved_stock: Math.max(0, product.reserved_stock - (item.quantity || 1)) })
              .eq('id', item.id);
          }
        }

        // Update order to failed
        const history = Array.isArray(order.status_history) ? [...order.status_history] : [];
        history.push({ status: 'failed', timestamp: new Date().toISOString(), note: 'Payment session expired — reserved stock released' });

        await supabase
          .from('orders')
          .update({ status: 'failed', status_history: history })
          .eq('id', orderId);

        await logEvent(supabase, 'warning', 'payment', 'Payment expired — reserved stock released', { stripe_session: session.id }, orderId);
      }
    }

    return ok({ received: true });
  }

  return ok({ received: true, ignored: true });
});

// ── Helpers ──

function ok(body: any) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
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

async function logEvent(supabase: any, logType: string, category: string, message: string, details: any = {}, orderId?: string) {
  await supabase.from('activity_logs').insert({
    log_type: logType,
    category,
    message,
    details,
    order_id: orderId || null,
  });
}
