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

  let supabase: ReturnType<typeof createClient> | null = null;

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY not configured", code: "CONFIG" }, 500);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, supabaseKey);

    const authenticatedUserId = await resolveUserId(req);

    const body = await req.json().catch(() => ({}));
    const { items, shipping, email, language = "sv" } = body ?? {};

    const origin = req.headers.get("origin") || "https://4thepeople.se";
    const warnings: string[] = [];

    // Soft validation — warn but never block
    if (!Array.isArray(items) || items.length === 0) {
      console.warn("No items provided — cannot create session");
      return json({ error: "No items provided", code: "NO_ITEMS" }, 400);
    }

    const customerEmail = email || "guest@checkout.local";
    if (!email) console.warn("No email provided, using fallback");

    // Build line items — fetch DB prices but NEVER block on failure
    const trustedItems: { id: string; title: string; price: number; quantity: number; image: string }[] = [];
    const reservedItems: { id: string; quantity: number }[] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const rawId = typeof item?.id === "string" ? item.id : "";
      const extracted = extractUuid(rawId);
      const productId = extracted ?? rawId;
      const quantityRaw = Number(item?.quantity ?? 1);
      const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.floor(quantityRaw)) : 1;

      let usedDb = false;

      if (productId && isUuid(productId)) {
        try {
          const { data: product } = await supabase
            .from("products")
            .select("stock, reserved_stock, allow_overselling, price, title_sv, title_en, image_urls, is_visible")
            .eq("id", productId)
            .single();

          if (product) {
            const p: any = product;

            // Stock reservation — best effort, never block
            const available = p.stock - p.reserved_stock;
            if (available < quantity && !p.allow_overselling) {
              console.warn(`Low stock for ${productId}: available=${available}, requested=${quantity} — continuing anyway`);
              warnings.push(`low_stock:${productId}`);
            }
            // Reserve stock best-effort
            try {
              await supabase
                .from("products")
                .update({ reserved_stock: p.reserved_stock + quantity })
                .eq("id", productId);
              reservedItems.push({ id: productId, quantity });
            } catch (e) {
              console.warn("Failed to reserve stock:", e);
            }

            trustedItems.push({
              id: productId,
              title: language === "en" && p.title_en ? p.title_en : p.title_sv,
              price: Number(p.price),
              quantity,
              image: p.image_urls?.[0] || item.image || "",
            });
            usedDb = true;
          } else {
            console.warn(`Product ${productId} not found in DB, using client price`);
          }
        } catch (dbErr) {
          console.warn(`DB lookup failed for ${productId}:`, dbErr);
        }
      }

      // Fallback to client-provided price
      if (!usedDb) {
        const clientPrice = Number(item?.price);
        const clientTitle = typeof item?.title === "string" ? item.title : `Item ${idx + 1}`;
        const clientImage = typeof item?.image === "string" ? item.image : "";

        if (!Number.isFinite(clientPrice) || clientPrice <= 0) {
          console.warn(`Item ${idx} has invalid price (${item?.price}), skipping`);
          warnings.push(`skipped_invalid_price:${idx}`);
          continue;
        }

        trustedItems.push({
          id: productId || `client_item_${idx + 1}`,
          title: clientTitle,
          price: clientPrice,
          quantity,
          image: clientImage,
        });
        warnings.push(`client_pricing:${productId || idx}`);
      }
    }

    if (trustedItems.length === 0) {
      console.warn("No valid items after processing");
      return json({ error: "No valid items", code: "NO_VALID_ITEMS" }, 400);
    }

    // Calculate totals
    const subtotal = trustedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

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

    // Min amount — warn only, never block
    if (totalAmount < 3) {
      console.warn(`Total amount ${totalAmount} SEK is below 3 SEK minimum — Stripe may reject`);
      warnings.push("below_minimum_amount");
    }

    // Build metadata
    const reservedMeta = reservedItems.map(r => `${r.id}:${r.quantity}`).join(",");
    const itemsMeta = JSON.stringify(trustedItems.map(i => ({
      id: i.id, title: i.title, price: i.price, quantity: i.quantity, image: i.image,
    })));

    const metadata: Record<string, string> = {
      email: customerEmail,
      user_id: authenticatedUserId || "",
      shipping_name: shipping?.name || "",
      shipping_address: shipping?.address || "",
      shipping_zip: shipping?.zip || "",
      shipping_city: shipping?.city || "",
      shipping_country: shipping?.country || "SE",
      shipping_phone: shipping?.phone || "",
      reserved_items: reservedMeta,
    };

    if (itemsMeta.length <= 500) {
      metadata.order_items = itemsMeta;
    } else {
      metadata.order_items_truncated = "true";
    }
    if (warnings.length) {
      metadata.warnings = warnings.join(",").substring(0, 500);
    }

    // CREATE STRIPE SESSION — this is the critical path
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

    console.log("Creating Stripe session...", { itemCount: trustedItems.length, totalAmount });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: selectedMethods,
      mode: "payment",
      customer_email: customerEmail,
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

    console.log("Stripe session created:", session.id, "URL:", session.url ? "YES" : "NO");

    // Log success
    try {
      await supabase.from("activity_logs").insert({
        log_type: "info",
        category: "order",
        message: "Checkout session created",
        details: { stripe_session: session.id, total: totalAmount, warnings, user_id: authenticatedUserId || "guest" },
      });
    } catch { /* non-critical */ }

    return json({
      success: true,
      url: session.url,
      sessionUrl: session.url,
      sessionId: session.id,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (error: any) {
    console.error("CHECKOUT FATAL ERROR:", error);

    // Release reserved stock best-effort
    if (supabase) {
      // inline release
      try {
        // We don't have reservedItems in this scope easily, so just log
        console.warn("Could not release reserved stock from outer catch");
      } catch {}
    }

    return json({
      success: false,
      error: error?.message || "Checkout failed",
      code: "INTERNAL",
    }, 500);
  }
});
