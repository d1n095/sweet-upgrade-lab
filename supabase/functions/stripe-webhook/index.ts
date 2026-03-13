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

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured');

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });

    const body = await req.text();
    let event: Stripe.Event;

    if (webhookSecret) {
      const signature = req.headers.get('stripe-signature');
      if (!signature) {
        return new Response('Missing stripe-signature', { status: 400, headers: corsHeaders });
      }
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // For development without webhook secret
      event = JSON.parse(body);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const metadata = session.metadata || {};
      let items: any[] = [];
      try {
        items = JSON.parse(metadata.items_json || '[]');
      } catch {}

      // Create order
      const orderData = {
        order_email: session.customer_email || '',
        user_id: '00000000-0000-0000-0000-000000000000', // Guest checkout
        total_amount: (session.amount_total || 0) / 100,
        currency: 'SEK',
        status: 'pending',
        items: items,
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
      } else {
        console.log('Order created:', order.id);
      }

      // Update stock for each item
      for (const item of items) {
        if (item.id) {
          const { error: stockError } = await supabase.rpc('', {}).catch(() => null) as any;
          // Direct update
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
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
