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
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured');

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // 1. Fetch trusted prices from DB and reserve stock
    const reservedItems: { id: string; quantity: number }[] = [];
    const trustedItems: { id: string; title: string; price: number; quantity: number; image: string }[] = [];

    for (const item of items) {
      if (!item.id) continue;

      const { data: product } = await supabase
        .from('products')
        .select('stock, reserved_stock, allow_overselling, price, title_sv, title_en, image_urls, is_visible')
        .eq('id', item.id)
        .single();

      if (!product || !product.is_visible) {
        // Release any already-reserved items
        for (const reserved of reservedItems) {
          const { data: p } = await supabase.from('products').select('reserved_stock').eq('id', reserved.id).single();
          if (p) await supabase.from('products').update({ reserved_stock: Math.max(0, p.reserved_stock - reserved.quantity) }).eq('id', reserved.id);
        }
        return new Response(JSON.stringify({ error: `Product not found or unavailable` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const available = product.stock - product.reserved_stock;
      if (available < item.quantity && !product.allow_overselling) {
        for (const reserved of reservedItems) {
          const { data: p } = await supabase.from('products').select('reserved_stock').eq('id', reserved.id).single();
          if (p) await supabase.from('products').update({ reserved_stock: Math.max(0, p.reserved_stock - reserved.quantity) }).eq('id', reserved.id);
        }
        return new Response(JSON.stringify({ error: `${product.title_sv || item.title} is out of stock` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('products')
        .update({ reserved_stock: product.reserved_stock + item.quantity })
        .eq('id', item.id);

      reservedItems.push({ id: item.id, quantity: item.quantity });
      trustedItems.push({
        id: item.id,
        title: (language === 'en' && product.title_en) ? product.title_en : product.title_sv,
        price: product.price, // TRUSTED price from DB
        quantity: item.quantity,
        image: product.image_urls?.[0] || item.image || '',
      });
    }

    // 2. Calculate totals using TRUSTED prices
    const subtotal = trustedItems.reduce((sum: number, item) => sum + item.price * item.quantity, 0);
    const freeShippingThreshold = 500;
    const shippingCost = subtotal >= freeShippingThreshold ? 0 : 39;
    const totalAmount = subtotal + shippingCost;

    // 3. Create order with status "pending", payment_status "unpaid"
    const orderData = {
      order_email: email,
      user_id: '00000000-0000-0000-0000-000000000000',
      total_amount: totalAmount,
      currency: 'SEK',
      status: 'pending',
      payment_status: 'unpaid',
      items: trustedItems.map((i) => ({
        id: i.id,
        title: i.title,
        price: i.price,
        quantity: i.quantity,
        image: i.image,
      })),
      shipping_address: {
        name: shipping?.name || '',
        address: shipping?.address || '',
        zip: shipping?.zip || '',
        city: shipping?.city || '',
        country: shipping?.country || 'SE',
        phone: shipping?.phone || '',
      },
      status_history: [{ status: 'pending', timestamp: new Date().toISOString(), note: 'Order created — payment_status: unpaid, stock reserved' }],
      notes: '',
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select('id')
      .single();

    if (orderError) {
      // Release reserved stock on order creation failure
      for (const reserved of reservedItems) {
        const { data: p } = await supabase.from('products').select('reserved_stock').eq('id', reserved.id).single();
        if (p) {
          await supabase.from('products').update({ reserved_stock: Math.max(0, p.reserved_stock - reserved.quantity) }).eq('id', reserved.id);
        }
      }
      console.error('Failed to create order:', orderError);
      await supabase.from('activity_logs').insert({
        log_type: 'error', category: 'order',
        message: 'Failed to create pre-payment order',
        details: { error: orderError.message, email },
      });
      throw new Error('Failed to create order');
    }

    console.log('Pre-payment order created with stock reserved:', order.id);

    // 4. Create Stripe session with all payment methods
    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: 'sek',
        product_data: {
          name: item.title,
          ...(item.image ? { images: [item.image] } : {}),
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const origin = req.headers.get('origin') || 'https://4thepeople.se';

    // Payment methods: card (covers Apple Pay & Google Pay via Stripe), Klarna, Swish
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'klarna', 'swish'],
      mode: 'payment',
      customer_email: email,
      line_items: lineItems,
      locale: language === 'sv' ? 'sv' : 'en',
      success_url: `${origin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      metadata: {
        order_id: order.id,
        shipping_name: shipping?.name || '',
        shipping_address: shipping?.address || '',
        shipping_zip: shipping?.zip || '',
        shipping_city: shipping?.city || '',
        shipping_country: shipping?.country || 'SE',
        shipping_phone: shipping?.phone || '',
      },
      payment_method_options: {
        card: {
          // Apple Pay and Google Pay are automatically available when card is enabled
          // They show up based on the customer's device/browser
        },
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
    });

    // 5. Save stripe_session_id on the order
    await supabase
      .from('orders')
      .update({ stripe_session_id: session.id, notes: `Stripe session: ${session.id}` })
      .eq('id', order.id);

    await supabase.from('activity_logs').insert({
      log_type: 'info', category: 'order',
      message: 'Checkout session created, stock reserved',
      details: { order_id: order.id, stripe_session: session.id, total: totalAmount, reserved_items: reservedItems, payment_methods: ['card', 'klarna', 'swish', 'apple_pay', 'google_pay'] },
      order_id: order.id,
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id, orderId: order.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
