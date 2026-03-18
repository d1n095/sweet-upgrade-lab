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

  // Only process events we care about
  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Duplicate check: has this Stripe session already been processed?
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .ilike('notes', `%${session.id}%`)
    .maybeSingle();

  if (existingOrder) {
    console.log('Duplicate webhook — order already exists for session:', session.id);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const metadata = session.metadata || {};
  let items: any[] = [];
  try {
    items = JSON.parse(metadata.items_json || '[]');
  } catch {}

  const orderData = {
    order_email: session.customer_email || '',
    user_id: '00000000-0000-0000-0000-000000000000',
    total_amount: (session.amount_total || 0) / 100,
    currency: 'SEK',
    status: 'pending',
    items,
    shipping_address: {
      name: metadata.shipping_name,
      address: metadata.shipping_address,
      zip: metadata.shipping_zip,
      city: metadata.shipping_city,
      country: metadata.shipping_country,
      phone: metadata.shipping_phone,
    },
    status_history: [{ status: 'pending', timestamp: new Date().toISOString(), note: 'Order received via Stripe' }],
    notes: `Stripe session: ${session.id}`,
  };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select('id')
    .single();

  if (orderError) {
    console.error('Failed to create order:', orderError);
    return new Response(JSON.stringify({ error: 'Order creation failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('Order created:', order.id);

  // Update stock
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
          .update({ stock: Math.max(0, product.stock - item.quantity) })
          .eq('id', item.id);
      }
    }
  }

  return new Response(JSON.stringify({ received: true, order_id: order.id }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
