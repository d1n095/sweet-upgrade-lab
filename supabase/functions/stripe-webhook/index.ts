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
    console.error('STRIPE_WEBHOOK_SECRET not configured — rejecting request');
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
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Handle checkout.session.completed → mark as paid
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;

    if (!orderId) {
      console.error('No order_id in session metadata:', session.id);
      // Fallback: try to find by stripe_session_id
      const { data: fallbackOrder } = await supabase
        .from('orders')
        .select('id, status')
        .eq('stripe_session_id', session.id)
        .maybeSingle();

      if (!fallbackOrder) {
        console.error('No order found for session:', session.id);
        await supabase.from('activity_logs').insert({
          log_type: 'error',
          category: 'order',
          message: 'Webhook received but no matching order found',
          details: { stripe_session: session.id },
        });
        return new Response(JSON.stringify({ received: true, error: 'no_order' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Use fallback order
      return await updateOrderToPaid(supabase, fallbackOrder.id, fallbackOrder.status, session);
    }

    // Check order exists and isn't already paid (prevent duplicate processing)
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .maybeSingle();

    if (!existingOrder) {
      console.error('Order not found:', orderId);
      return new Response(JSON.stringify({ received: true, error: 'order_not_found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingOrder.status === 'confirmed' || existingOrder.status === 'processing' || existingOrder.status === 'shipped' || existingOrder.status === 'delivered') {
      console.log('Order already processed, skipping duplicate:', orderId);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return await updateOrderToPaid(supabase, orderId, existingOrder.status, session);
  }

  // Handle checkout.session.expired → mark as failed
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;

    if (orderId) {
      const { data: order } = await supabase
        .from('orders')
        .select('id, status, status_history')
        .eq('id', orderId)
        .maybeSingle();

      if (order && order.status === 'pending') {
        const history = Array.isArray(order.status_history) ? order.status_history : [];
        history.push({ status: 'failed', timestamp: new Date().toISOString(), note: 'Payment session expired' });

        await supabase
          .from('orders')
          .update({ status: 'failed', status_history: history })
          .eq('id', orderId);

        await supabase.from('activity_logs').insert({
          log_type: 'warning',
          category: 'payment',
          message: 'Payment session expired — order marked as failed',
          details: { stripe_session: session.id },
          order_id: orderId,
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Ignore other events
  return new Response(JSON.stringify({ received: true, ignored: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

async function updateOrderToPaid(supabase: any, orderId: string, currentStatus: string, session: any) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  // Fetch current order for history
  const { data: order } = await supabase
    .from('orders')
    .select('status_history, items')
    .eq('id', orderId)
    .single();

  const history = Array.isArray(order?.status_history) ? order.status_history : [];
  history.push({ status: 'confirmed', timestamp: new Date().toISOString(), note: 'Payment confirmed via Stripe' });

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'confirmed',
      status_history: history,
      total_amount: (session.amount_total || 0) / 100,
      stripe_session_id: session.id,
    })
    .eq('id', orderId);

  if (updateError) {
    console.error('Failed to update order to paid:', updateError);
    await supabase.from('activity_logs').insert({
      log_type: 'error',
      category: 'order',
      message: 'Failed to update order status to confirmed',
      details: { error: updateError.message, stripe_session: session.id },
      order_id: orderId,
    });
    return new Response(JSON.stringify({ error: 'Update failed' }), {
      status: 500, headers: corsHeaders,
    });
  }

  console.log('Order confirmed:', orderId);

  // Update stock
  const items = Array.isArray(order?.items) ? order.items : [];
  for (const item of items) {
    if (item.id) {
      const { data: product } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.id)
        .single();

      if (product) {
        await supabase
          .from('products')
          .update({ stock: Math.max(0, product.stock - (item.quantity || 1)) })
          .eq('id', item.id);
      }
    }
  }

  await supabase.from('activity_logs').insert({
    log_type: 'success',
    category: 'order',
    message: 'Payment confirmed — order updated to confirmed',
    details: { email: session.customer_email, total: (session.amount_total || 0) / 100 },
    order_id: orderId,
  });

  return new Response(JSON.stringify({ received: true, order_id: orderId }), {
    status: 200, headers: corsHeaders,
  });
}
