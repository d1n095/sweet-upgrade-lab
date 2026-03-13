import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured');

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });

    const { items, shipping, email, language = 'sv' } = await req.json();

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: 'No items provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build line items
    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: 'sek',
        product_data: {
          name: item.title,
          ...(item.image ? { images: [item.image] } : {}),
        },
        unit_amount: Math.round(item.price * 100), // Convert to öre
      },
      quantity: item.quantity,
    }));

    // Add shipping cost if applicable
    const subtotal = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    const freeShippingThreshold = 500;
    const shippingCost = subtotal >= freeShippingThreshold ? 0 : 39;

    // Determine success/cancel URLs
    const origin = req.headers.get('origin') || 'https://4thepeople.se';

    const sessionParams: any = {
      payment_method_types: ['card', 'klarna'],
      mode: 'payment',
      customer_email: email,
      line_items: lineItems,
      locale: language === 'sv' ? 'sv' : 'en',
      success_url: `${origin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      metadata: {
        shipping_name: shipping?.name || '',
        shipping_address: shipping?.address || '',
        shipping_zip: shipping?.zip || '',
        shipping_city: shipping?.city || '',
        shipping_country: shipping?.country || 'SE',
        shipping_phone: shipping?.phone || '',
        items_json: JSON.stringify(items.map((i: any) => ({
          id: i.id,
          title: i.title,
          price: i.price,
          quantity: i.quantity,
        }))),
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: shippingCost * 100, currency: 'sek' },
            display_name: shippingCost === 0
              ? (language === 'sv' ? 'Fri frakt' : 'Free shipping')
              : (language === 'sv' ? 'Standardfrakt' : 'Standard shipping'),
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 7 },
              maximum: { unit: 'business_day', value: 10 },
            },
          },
        },
      ],
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
