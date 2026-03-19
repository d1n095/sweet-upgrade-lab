import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (v: string) => UUID_RE.test(v);

const extractUuid = (v: string): string | null => {
  if (!v) return null;
  const m = v.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return m?.[0] ?? null;
};

const isPreviewOrigin = (origin: string) =>
  origin.includes("id-preview--") || origin.includes("localhost") || origin.includes("127.0.0.1");

/**
 * Resolve user_id from the Authorization header.
 */
async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const { data, error } = await anonClient.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Track reserved items for rollback on failure
  const reservedItems: { id: string; quantity: number }[] = [];
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

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY not configured", code: "CONFIG" });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, supabaseKey);

    const authenticatedUserId = await resolveUserId(req);

    const body = await req.json().catch(() => ({}));
    const { items, shipping, email, language = "sv", paymentMethod } = body ?? {};

    const origin = req.headers.get("origin") || "https://4thepeople.se";
    const previewMode = isPreviewOrigin(origin);

    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: "No items provided", code: "NO_ITEMS" });
    }
    if (!email || typeof email !== "string") {
      return json({ error: "Email is required", code: "EMAIL_REQUIRED" });
    }

    const ALLOWED_METHODS: Record<string, string[]> = {
      card: ["card"],
      klarna: ["klarna"],
    };

    if (!paymentMethod || !ALLOWED_METHODS[paymentMethod]) {
      return json({ error: "Unsupported payment method. Use card or klarna.", code: "BAD_METHOD" });
    }

    const selectedMethods = ALLOWED_METHODS[paymentMethod];

    // 1) Fetch trusted prices from DB and reserve stock
    const trustedItems: { id: string; title: string; price: number; quantity: number; image: string; source: "db" | "client" }[] = [];
    const warnings: string[] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const rawId = typeof item?.id === "string" ? item.id : "";
      const extracted = extractUuid(rawId);
      const productId = extracted ?? rawId;
      const quantityRaw = Number(item?.quantity ?? 1);
      const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.floor(quantityRaw)) : 1;

      if (!rawId) {
        return json({ error: "Item id is required", code: "ITEM_ID_REQUIRED" });
      }

      if (isUuid(productId)) {
        const { data: product } = await supabase
          .from("products")
          .select("stock, reserved_stock, allow_overselling, price, title_sv, title_en, image_urls, is_visible")
          .eq("id", productId)
          .single();

        if (!product || !(product as any).is_visible) {
          if (!previewMode) {
            await releaseReservedStock();
            return json({ error: "Product not found or unavailable", code: "PRODUCT_NOT_FOUND" });
          }
          warnings.push(`fallback_client_item:${productId}`);
        } else {
          const p: any = product;
          const available = p.stock - p.reserved_stock;

          if (available < quantity && !p.allow_overselling) {
            if (!previewMode) {
              await releaseReservedStock();
              return json({ error: `${p.title_sv || item.title} is out of stock`, code: "OUT_OF_STOCK" });
            }
            warnings.push(`stock_check_skipped:${productId}`);
          } else {
            await supabase
              .from("products")
              .update({ reserved_stock: p.reserved_stock + quantity })
              .eq("id", productId);
            reservedItems.push({ id: productId, quantity });
          }

          trustedItems.push({
            id: productId,
            title: language === "en" && p.title_en ? p.title_en : p.title_sv,
            price: Number(p.price),
            quantity,
            image: p.image_urls?.[0] || item.image || "",
            source: "db",
          });
          continue;
        }
      }

      // Client fallback (preview only)
      if (!previewMode) {
        await releaseReservedStock();
        return json({ error: "Invalid product id", code: "INVALID_PRODUCT_ID" });
      }

      const clientPrice = Number(item?.price);
      const clientTitle = typeof item?.title === "string" ? item.title : `Item ${idx + 1}`;
      const clientImage = typeof item?.image === "string" ? item.image : "";

      if (!Number.isFinite(clientPrice) || clientPrice <= 0) {
        await releaseReservedStock();
        return json({
          error: language === "sv"
            ? "Kunde inte starta betalning: pris saknas för en vara."
            : "Could not start payment: missing price for an item.",
          code: "MISSING_PRICE",
        });
      }

      trustedItems.push({
        id: productId || `client_item_${idx + 1}`,
        title: clientTitle,
        price: clientPrice,
        quantity,
        image: clientImage,
        source: "client",
      });
      warnings.push(`client_pricing_used:${productId || idx}`);
    }

    if (trustedItems.length === 0) {
      return json({ error: "No valid items", code: "NO_VALID_ITEMS" });
    }

    // 2) Calculate totals
    const subtotal = trustedItems.reduce((sum: number, item) => sum + item.price * item.quantity, 0);

    let shippingCostValue = 39;
    let freeShippingThreshold = 500;
    try {
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
    } catch { /* keep defaults */ }

    const shippingCost = subtotal >= freeShippingThreshold ? 0 : shippingCostValue;
    const totalAmount = subtotal + shippingCost;

    if (totalAmount < 3) {
      await releaseReservedStock();
      return json({
        error: language === "sv"
          ? "Minsta totalbelopp är 3 kr. Lägg till fler varor eller öka antal."
          : "Minimum total amount is 3 SEK. Add more items or increase quantity.",
        code: "MIN_AMOUNT",
      });
    }

    // 3) Build metadata for webhook to create order later
    // Encode reserved items compactly: "uuid:qty,uuid:qty"
    const reservedMeta = reservedItems.map(r => `${r.id}:${r.quantity}`).join(",");
    // Encode items as JSON for the webhook (Stripe metadata value limit: 500 chars)
    // We'll store items compactly and also pass them as line items
    const itemsMeta = JSON.stringify(trustedItems.map(i => ({
      id: i.id, title: i.title, price: i.price, quantity: i.quantity, image: i.image, source: i.source,
    })));

    const metadata: Record<string, string> = {
      email,
      user_id: authenticatedUserId || "",
      shipping_name: shipping?.name || "",
      shipping_address: shipping?.address || "",
      shipping_zip: shipping?.zip || "",
      shipping_city: shipping?.city || "",
      shipping_country: shipping?.country || "SE",
      shipping_phone: shipping?.phone || "",
      reserved_items: reservedMeta,
    };

    // Items metadata might exceed 500 chars — split or truncate
    if (itemsMeta.length <= 500) {
      metadata.order_items = itemsMeta;
    } else {
      // Store first 500 chars — webhook will fall back to Stripe line items
      metadata.order_items_truncated = "true";
    }

    if (warnings.length) {
      metadata.warnings = warnings.join(",").substring(0, 500);
    }

    // 4) Create Stripe session — NO order created yet
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

    let session: any;
    try {
      console.log("Creating Stripe session (no pre-order)...", { items: trustedItems.length, totalAmount, paymentMethod });

      session = await stripe.checkout.sessions.create({
        payment_method_types: selectedMethods,
        mode: "payment",
        customer_email: email,
        line_items: lineItems,
        locale: language === "sv" ? "sv" : "en",
        success_url: `${origin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout`,
        metadata,
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: Math.round(shippingCost * 100), currency: "sek" },
              display_name: shippingCost === 0
                ? (language === "sv" ? "Fri frakt" : "Free shipping")
                : (language === "sv" ? "Standardfrakt" : "Standard shipping"),
              delivery_estimate: {
                minimum: { unit: "business_day", value: 7 },
                maximum: { unit: "business_day", value: 10 },
              },
            },
          },
        ],
      });

      console.log("Stripe session created:", session?.id, "url:", session?.url ? "YES" : "NO");
    } catch (stripeErr: any) {
      console.error("Stripe session create failed:", stripeErr);
      try { await releaseReservedStock(); } catch {}

      await supabase.from("activity_logs").insert({
        log_type: "error",
        category: "payment",
        message: "Stripe session creation failed",
        details: {
          email,
          totalAmount,
          stripe_error: stripeErr?.message || String(stripeErr),
          stripe_code: stripeErr?.code,
          previewMode,
        },
      });

      return json({
        error: language === "sv"
          ? "Betalningen kunde inte startas. Försök igen."
          : "Payment could not be started. Please try again.",
        code: "STRIPE_ERROR",
        ...(previewMode ? { debug: { stripe_message: stripeErr?.message } } : {}),
      });
    }

    await supabase.from("activity_logs").insert({
      log_type: "info",
      category: "order",
      message: "Checkout session created (no pre-order)",
      details: {
        stripe_session: session.id,
        total: totalAmount,
        reserved_items: reservedItems,
        warnings,
        user_id: authenticatedUserId || "guest",
        authenticated: !!authenticatedUserId,
      },
    });

    return json({
      url: session.url,
      sessionId: session.id,
      ...(warnings.length ? { warnings } : {}),
      ...(previewMode ? { debug: { previewMode, itemSources: trustedItems.map((i) => i.source), authenticated: !!authenticatedUserId } } : {}),
    });
  } catch (error: any) {
    console.error("Checkout error:", error);
    try { await releaseReservedStock(); } catch {}

    return json({
      error: error?.message?.includes("payment_method_types")
        ? "En betalningsmetod stöds inte just nu. Försök med kort eller Klarna."
        : error?.message || "Något gick fel vid checkout",
      code: "INTERNAL",
    });
  }
});
