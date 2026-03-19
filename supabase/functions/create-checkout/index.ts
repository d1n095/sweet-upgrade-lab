import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Keep these outside try so we can rollback on *any* failure
  const reservedItems: { id: string; quantity: number }[] = [];
  let orderId: string | null = null;

  let supabase: ReturnType<typeof createClient> | null = null;

  const releaseReservedStock = async () => {
    if (!supabase) return;
    for (const reserved of reservedItems) {
      const { data: p } = await supabase
        .from("products")
        .select("reserved_stock")
        .eq("id", reserved.id)
        .single();
      if (!p) continue;
      await supabase
        .from("products")
        .update({ reserved_stock: Math.max(0, (p as any).reserved_stock - reserved.quantity) })
        .eq("id", reserved.id);
    }
  };

  const deleteOrderIfCreated = async () => {
    if (!supabase || !orderId) return;
    await supabase.from("orders").delete().eq("id", orderId);
  };

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, supabaseKey);

    const { items, shipping, email, language = "sv", paymentMethod } = await req.json();

    if (!items || items.length === 0) {
      return json({ error: "No items provided" }, 400);
    }

    if (!email) {
      return json({ error: "Email is required" }, 400);
    }

    const ALLOWED_METHODS: Record<string, string[]> = {
      card: ["card"],
      klarna: ["klarna"],
    };

    if (!paymentMethod || !ALLOWED_METHODS[paymentMethod]) {
      return json({ error: "Unsupported payment method. Use card or klarna." }, 400);
    }

    const selectedMethods = ALLOWED_METHODS[paymentMethod];

    // 1) Fetch trusted prices from DB and reserve stock
    const trustedItems: { id: string; title: string; price: number; quantity: number; image: string }[] = [];

    for (const item of items) {
      if (!item?.id) continue;

      const { data: product } = await supabase
        .from("products")
        .select("stock, reserved_stock, allow_overselling, price, title_sv, title_en, image_urls, is_visible")
        .eq("id", item.id)
        .single();

      if (!product || !(product as any).is_visible) {
        await releaseReservedStock();
        return json({ error: "Product not found or unavailable" }, 400);
      }

      const p: any = product;
      const available = p.stock - p.reserved_stock;
      if (available < item.quantity && !p.allow_overselling) {
        await releaseReservedStock();
        return json({ error: `${p.title_sv || item.title} is out of stock` }, 400);
      }

      // Reserve stock immediately to avoid overselling; we will rollback on any later failure.
      await supabase
        .from("products")
        .update({ reserved_stock: p.reserved_stock + item.quantity })
        .eq("id", item.id);

      reservedItems.push({ id: item.id, quantity: item.quantity });

      trustedItems.push({
        id: item.id,
        title: language === "en" && p.title_en ? p.title_en : p.title_sv,
        price: p.price,
        quantity: item.quantity,
        image: p.image_urls?.[0] || item.image || "",
      });
    }

    // 2) Calculate totals using TRUSTED prices + DB shipping config
    const subtotal = trustedItems.reduce((sum: number, item) => sum + item.price * item.quantity, 0);

    let shippingCostValue = 39;
    let freeShippingThreshold = 500;
    const { data: shippingSettings } = await supabase
      .from("store_settings")
      .select("key, text_value")
      .in("key", ["shipping_cost", "free_shipping_threshold"]);

    if (shippingSettings) {
      for (const s of shippingSettings as any[]) {
        if (s.key === "shipping_cost" && s.text_value) shippingCostValue = parseFloat(s.text_value);
        if (s.key === "free_shipping_threshold" && s.text_value) freeShippingThreshold = parseFloat(s.text_value);
      }
    }

    const shippingCost = subtotal >= freeShippingThreshold ? 0 : shippingCostValue;
    const totalAmount = subtotal + shippingCost;

    // Stripe has a minimum amount in SEK; fail early with a friendly message.
    if (totalAmount < 3) {
      await releaseReservedStock();
      await supabase.from("activity_logs").insert({
        log_type: "warn",
        category: "payment",
        message: "Checkout rejected: amount too small",
        details: { email, subtotal, shippingCost, totalAmount, currency: "SEK" },
      });

      const msg =
        language === "sv"
          ? "Minsta totalbelopp är 3 kr. Lägg till fler varor eller öka antal."
          : "Minimum total amount is 3 SEK. Add more items or increase quantity.";
      return json({ error: msg }, 400);
    }

    // 3) Create order with status "pending", payment_status "unpaid"
    const orderData = {
      order_email: email,
      user_id: "00000000-0000-0000-0000-000000000000",
      total_amount: totalAmount,
      currency: "SEK",
      status: "pending",
      payment_status: "unpaid",
      items: trustedItems.map((i) => ({
        id: i.id,
        title: i.title,
        price: i.price,
        quantity: i.quantity,
        image: i.image,
      })),
      shipping_address: {
        name: shipping?.name || "",
        address: shipping?.address || "",
        zip: shipping?.zip || "",
        city: shipping?.city || "",
        country: shipping?.country || "SE",
        phone: shipping?.phone || "",
      },
      status_history: [
        {
          status: "pending",
          timestamp: new Date().toISOString(),
          note: "Order created — payment_status: unpaid, stock reserved",
        },
      ],
      notes: "",
    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderData)
      .select("id")
      .single();

    if (orderError) {
      await releaseReservedStock();
      console.error("Failed to create order:", orderError);
      await supabase.from("activity_logs").insert({
        log_type: "error",
        category: "order",
        message: "Failed to create pre-payment order",
        details: { error: orderError.message, email },
      });
      throw new Error("Failed to create order");
    }

    orderId = (order as any).id;
    console.log("Pre-payment order created with stock reserved:", orderId);

    // 4) Create Stripe session
    const lineItems = trustedItems.map((item) => ({
      price_data: {
        currency: "sek",
        product_data: {
          name: item.title,
          ...(item.image ? { images: [item.image] } : {}),
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const origin = req.headers.get("origin") || "https://4thepeople.se";

    let session: any;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: selectedMethods,
        mode: "payment",
        customer_email: email,
        line_items: lineItems,
        locale: language === "sv" ? "sv" : "en",
        success_url: `${origin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout`,
        metadata: {
          order_id: orderId,
          shipping_name: shipping?.name || "",
          shipping_address: shipping?.address || "",
          shipping_zip: shipping?.zip || "",
          shipping_city: shipping?.city || "",
          shipping_country: shipping?.country || "SE",
          shipping_phone: shipping?.phone || "",
        },
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: Math.round(shippingCost * 100), currency: "sek" },
              display_name:
                shippingCost === 0
                  ? language === "sv"
                    ? "Fri frakt"
                    : "Free shipping"
                  : language === "sv"
                    ? "Standardfrakt"
                    : "Standard shipping",
              delivery_estimate: {
                minimum: { unit: "business_day", value: 7 },
                maximum: { unit: "business_day", value: 10 },
              },
            },
          },
        ],
      });
    } catch (stripeErr: any) {
      console.error("Stripe session create failed:", stripeErr);
      await releaseReservedStock();
      await deleteOrderIfCreated();

      await supabase.from("activity_logs").insert({
        log_type: "error",
        category: "payment",
        message: "Stripe session creation failed",
        details: {
          email,
          totalAmount,
          stripe_error: stripeErr?.message || String(stripeErr),
          stripe_code: stripeErr?.code,
          stripe_type: stripeErr?.type,
        },
        order_id: orderId,
      });

      const userMessage =
        language === "sv"
          ? "Betalningen kunde inte startas. Försök igen."
          : "Payment could not be started. Please try again.";

      return json({ error: userMessage }, 500);
    }

    // 5) Save stripe_session_id on the order
    await supabase
      .from("orders")
      .update({ stripe_session_id: session.id, notes: `Stripe session: ${session.id}` })
      .eq("id", orderId);

    await supabase.from("activity_logs").insert({
      log_type: "info",
      category: "order",
      message: "Checkout session created, stock reserved",
      details: {
        order_id: orderId,
        stripe_session: session.id,
        total: totalAmount,
        reserved_items: reservedItems,
        payment_methods: ["card", "klarna", "apple_pay", "google_pay"],
      },
      order_id: orderId,
    });

    return json({ url: session.url, sessionId: session.id, orderId });
  } catch (error: any) {
    console.error("Checkout error:", error);

    // Best-effort rollback to avoid stuck stock / orphan orders
    try {
      await releaseReservedStock();
    } catch {}
    try {
      await deleteOrderIfCreated();
    } catch {}

    const userMessage = error?.message?.includes("payment_method_types")
      ? "En betalningsmetod stöds inte just nu. Försök med kort eller Klarna."
      : error?.message || "Något gick fel vid checkout";

    return json({ error: userMessage }, 500);
  }
});
