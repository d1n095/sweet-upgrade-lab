import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const topic = req.headers.get('x-shopify-topic');
    const body = await req.json();

    console.log(`Received webhook: ${topic}`);

    // Handle order paid/fulfilled events
    if (topic === 'orders/paid' || topic === 'orders/fulfilled') {
      const order = body;
      
      // Track product sales for bestseller logic
      const lineItems = order.line_items || [];
      for (const item of lineItems) {
        const productId = item.product_id?.toString();
        const productTitle = item.title || 'Unknown';
        const quantity = item.quantity || 1;

        if (!productId) continue;

        // Upsert product sales data
        const { data: existing } = await supabase
          .from('product_sales')
          .select('id, total_quantity_sold')
          .eq('shopify_product_id', productId)
          .single();

        if (existing) {
          await supabase
            .from('product_sales')
            .update({
              total_quantity_sold: existing.total_quantity_sold + quantity,
              last_sale_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('product_sales')
            .insert({
              shopify_product_id: productId,
              product_title: productTitle,
              total_quantity_sold: quantity,
              last_sale_at: new Date().toISOString()
            });
        }

        console.log(`Updated sales for ${productTitle}: +${quantity}`);
      }

      // Check for discount code (affiliate code)
      const discountCodes = order.discount_codes || [];
      
      for (const discount of discountCodes) {
        const code = discount.code?.toUpperCase();
        
        if (!code) continue;

        // Check if this is an affiliate code
        const { data: affiliate, error: affiliateError } = await supabase
          .from('affiliates')
          .select('*')
          .eq('code', code)
          .eq('is_active', true)
          .single();

        if (affiliateError || !affiliate) {
          console.log(`Code ${code} is not an affiliate code`);
          continue;
        }

        console.log(`Found affiliate: ${affiliate.name} (${affiliate.code})`);

        // Calculate order total (excluding shipping and tax)
        const orderTotal = parseFloat(order.subtotal_price || '0');
        
        // Calculate customer discount (10% standard)
        const customerDiscountPercent = 10;
        const customerDiscountAmount = orderTotal * (customerDiscountPercent / 100);
        
        // Calculate commission on discounted amount
        const discountedTotal = orderTotal - customerDiscountAmount;
        const commissionAmount = discountedTotal * (affiliate.commission_percent / 100);

        console.log(`Order total: ${orderTotal}, Commission: ${commissionAmount}`);

        // Check if we already tracked this order
        const { data: existingOrder } = await supabase
          .from('affiliate_orders')
          .select('id')
          .eq('shopify_order_id', order.id.toString())
          .single();

        if (existingOrder) {
          console.log(`Order ${order.id} already tracked`);
          continue;
        }

        // Create affiliate order record
        const { error: orderError } = await supabase
          .from('affiliate_orders')
          .insert({
            affiliate_id: affiliate.id,
            shopify_order_id: order.id.toString(),
            order_total: discountedTotal,
            commission_amount: commissionAmount,
            customer_discount: customerDiscountAmount,
            status: topic === 'orders/fulfilled' ? 'completed' : 'pending'
          });

        if (orderError) {
          console.error('Failed to create affiliate order:', orderError);
          continue;
        }

        // Update affiliate stats
        const { error: updateError } = await supabase
          .from('affiliates')
          .update({
            total_orders: affiliate.total_orders + 1,
            total_sales: affiliate.total_sales + discountedTotal,
            total_earnings: affiliate.total_earnings + commissionAmount,
            pending_earnings: affiliate.pending_earnings + commissionAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', affiliate.id);

        if (updateError) {
          console.error('Failed to update affiliate stats:', updateError);
        } else {
          console.log(`Updated affiliate ${affiliate.name}: +${commissionAmount} kr commission`);
        }
      }

      return new Response(JSON.stringify({ success: true, message: 'Order processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Handle order refund
    if (topic === 'refunds/create') {
      const refund = body;
      const orderId = refund.order_id?.toString();

      if (!orderId) {
        return new Response(JSON.stringify({ success: true, message: 'No order ID' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Find the affiliate order
      const { data: affiliateOrder, error } = await supabase
        .from('affiliate_orders')
        .select('*, affiliates(*)')
        .eq('shopify_order_id', orderId)
        .single();

      if (error || !affiliateOrder) {
        console.log(`No affiliate order found for refund: ${orderId}`);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Update affiliate order status
      await supabase
        .from('affiliate_orders')
        .update({ status: 'refunded' })
        .eq('id', affiliateOrder.id);

      // Reduce affiliate earnings
      if (affiliateOrder.affiliates) {
        const affiliate = affiliateOrder.affiliates;
        await supabase
          .from('affiliates')
          .update({
            total_orders: Math.max(0, affiliate.total_orders - 1),
            total_sales: Math.max(0, affiliate.total_sales - affiliateOrder.order_total),
            total_earnings: Math.max(0, affiliate.total_earnings - affiliateOrder.commission_amount),
            pending_earnings: Math.max(0, affiliate.pending_earnings - affiliateOrder.commission_amount),
            updated_at: new Date().toISOString()
          })
          .eq('id', affiliate.id);

        console.log(`Refund processed for affiliate ${affiliate.name}`);
      }

      return new Response(JSON.stringify({ success: true, message: 'Refund processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ success: true, message: `Unhandled topic: ${topic}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
