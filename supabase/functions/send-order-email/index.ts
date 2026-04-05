import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Auth helper: require service role key for internal email sends
function verifyServiceRole(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return authHeader === `Bearer ${serviceRoleKey}`;
}

interface OrderItem {
  id?: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
}

interface ShippingAddress {
  name?: string;
  address?: string;
  zip?: string;
  city?: string;
  country?: string;
  phone?: string;
}

function formatPrice(amount: number, currency = "SEK"): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Brand colors from index.css
const BRAND = {
  primary: "hsl(220, 20%, 10%)",
  primaryFg: "hsl(0, 0%, 99%)",
  accent: "hsl(157, 72%, 37%)",
  muted: "hsl(220, 8%, 55%)",
  bg: "#ffffff",
  cardBg: "#f8f9fa",
  border: "#e5e7eb",
  font: "'Plus Jakarta Sans', Arial, sans-serif",
};

function renderOrderConfirmationEmail(order: any, items: OrderItem[], shipping: ShippingAddress): string {
  const itemRows = items.map((item) => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid ${BRAND.border};font-family:${BRAND.font};font-size:14px;">
        ${item.title}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid ${BRAND.border};font-family:${BRAND.font};font-size:14px;text-align:center;">
        ${item.quantity}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid ${BRAND.border};font-family:${BRAND.font};font-size:14px;text-align:right;">
        ${formatPrice(item.price * item.quantity, order.currency)}
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.cardBg};font-family:${BRAND.font};">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:${BRAND.bg};border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};">
    <!-- Header -->
    <div style="background:${BRAND.primary};padding:32px 24px;text-align:center;">
      <h1 style="color:${BRAND.primaryFg};margin:0;font-size:20px;font-weight:700;font-family:${BRAND.font};">
        4ThePeople
      </h1>
    </div>

    <!-- Status badge -->
    <div style="padding:32px 24px 0;text-align:center;">
      <div style="display:inline-block;background:hsl(157,72%,95%);color:${BRAND.accent};padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;">
        ✓ Orderbekräftelse
      </div>
      <h2 style="margin:16px 0 8px;font-size:22px;color:${BRAND.primary};font-family:${BRAND.font};">
        Tack för din beställning!
      </h2>
      <p style="color:${BRAND.muted};margin:0;font-size:14px;">
        Order-ID: <strong style="color:${BRAND.primary};">#${(order.payment_intent_id || order.id || '').slice(-8).toUpperCase()}</strong>
      </p>
      <p style="color:${BRAND.muted};margin:4px 0 0;font-size:13px;">
        ${formatDate(order.created_at)}
      </p>
    </div>

    <!-- Items table -->
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:8px;text-align:left;font-size:12px;color:${BRAND.muted};border-bottom:2px solid ${BRAND.border};font-family:${BRAND.font};">Produkt</th>
            <th style="padding:8px;text-align:center;font-size:12px;color:${BRAND.muted};border-bottom:2px solid ${BRAND.border};font-family:${BRAND.font};">Antal</th>
            <th style="padding:8px;text-align:right;font-size:12px;color:${BRAND.muted};border-bottom:2px solid ${BRAND.border};font-family:${BRAND.font};">Summa</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="margin-top:16px;padding-top:16px;border-top:2px solid ${BRAND.primary};">
        <table style="width:100%;">
          <tr>
            <td style="padding:4px 0;font-size:16px;font-weight:700;color:${BRAND.primary};font-family:${BRAND.font};">Totalt</td>
            <td style="padding:4px 0;font-size:16px;font-weight:700;color:${BRAND.primary};text-align:right;font-family:${BRAND.font};">
              ${formatPrice(order.total_amount, order.currency)}
            </td>
          </tr>
          ${order.payment_method ? `<tr><td style="padding:2px 0;font-size:12px;color:${BRAND.muted};font-family:${BRAND.font};">Betalmetod</td><td style="padding:2px 0;font-size:12px;color:${BRAND.muted};text-align:right;font-family:${BRAND.font};">${order.payment_method === 'klarna' ? 'Klarna' : order.payment_method === 'card' ? 'Kort' : order.payment_method}</td></tr>` : ""}
        </table>
      </div>
    </div>

    ${shipping.name ? `
    <!-- Shipping info -->
    <div style="padding:0 24px 24px;">
      <div style="background:${BRAND.cardBg};border-radius:8px;padding:16px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${BRAND.primary};font-family:${BRAND.font};">Leveransadress</p>
        <p style="margin:0;font-size:13px;color:${BRAND.muted};line-height:1.6;font-family:${BRAND.font};">
          ${shipping.name}<br>
          ${shipping.address || ""}<br>
          ${shipping.zip || ""} ${shipping.city || ""}<br>
          ${shipping.country || ""}
        </p>
      </div>
    </div>
    ` : ""}

    <!-- CTA -->
    <div style="padding:0 24px 32px;text-align:center;">
      <a href="https://4thepeople.se/track-order?q=${encodeURIComponent(order.payment_intent_id || order.id || "")}"
         style="display:inline-block;background:${BRAND.primary};color:${BRAND.primaryFg};padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;font-family:${BRAND.font};">
        Spåra din order →
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:${BRAND.muted};font-family:${BRAND.font};">
        Beräknad leveranstid: 7–10 arbetsdagar
      </p>
    </div>

    <!-- Footer -->
    <div style="background:${BRAND.cardBg};padding:20px 24px;text-align:center;border-top:1px solid ${BRAND.border};">
      <p style="margin:0;font-size:12px;color:${BRAND.muted};font-family:${BRAND.font};">
        4ThePeople · support@4thepeople.se · Giftfria produkter för hela Europa
      </p>
    </div>
  </div>
</div>
</body></html>`;
}

function renderStatusUpdateEmail(order: any, newStatus: string): string {
  const statusLabels: Record<string, { label: string; emoji: string; desc: string }> = {
    processing: { label: "Behandlas", emoji: "📦", desc: "Din beställning förbereds nu för leverans." },
    shipped: { label: "Skickad", emoji: "🚚", desc: "Din order har skickats!" },
    delivered: { label: "Levererad", emoji: "✅", desc: "Din order har levererats. Vi hoppas du älskar produkterna!" },
    returned: { label: "Retur mottagen", emoji: "↩️", desc: "Vi har mottagit din retur och behandlar den." },
    lost: { label: "Undersöks", emoji: "🔍", desc: "Vi undersöker din leverans. Vi återkommer så snart vi vet mer." },
  };

  const status = statusLabels[newStatus] || { label: newStatus, emoji: "📋", desc: "Din orderstatus har uppdaterats." };

  // Carrier display names
  const carrierNames: Record<string, string> = {
    postnord: "PostNord", dhl: "DHL", bring: "Bring", budbee: "Budbee", other: "Fraktbolag",
  };

  const carrierLabel = carrierNames[order.shipping_method] || order.shipping_method || "";

  // Build tracking URL
  const trackingBases: Record<string, string> = {
    postnord: "https://tracking.postnord.com/tracking.html?id=",
    dhl: "https://www.dhl.com/se-sv/home/tracking.html?tracking-id=",
    bring: "https://tracking.bring.se/tracking/",
  };
  const trackingUrl = order.tracking_number && trackingBases[order.shipping_method]
    ? `${trackingBases[order.shipping_method]}${order.tracking_number}`
    : null;

  // Shipping tracking section (only for shipped status)
  const trackingSection = newStatus === "shipped" && order.tracking_number ? `
    <div style="background:${BRAND.cardBg};border-radius:8px;padding:20px;margin:0 24px 24px;text-align:left;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:${BRAND.primary};font-family:${BRAND.font};">
        📦 Fraktinformation
      </p>
      ${carrierLabel ? `<p style="margin:0 0 6px;font-size:13px;color:${BRAND.muted};font-family:${BRAND.font};">Fraktbolag: <strong style="color:${BRAND.primary};">${carrierLabel}</strong></p>` : ""}
      <p style="margin:0 0 6px;font-size:13px;color:${BRAND.muted};font-family:${BRAND.font};">Spårningsnummer: <strong style="color:${BRAND.primary};font-family:monospace;">${order.tracking_number}</strong></p>
      ${trackingUrl ? `
      <div style="margin-top:16px;text-align:center;">
        <a href="${trackingUrl}" style="display:inline-block;background:${BRAND.accent};color:#fff;padding:10px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;font-family:${BRAND.font};">
          Spåra ditt paket →
        </a>
      </div>` : ""}
    </div>
  ` : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.cardBg};font-family:${BRAND.font};">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:${BRAND.bg};border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};">
    <div style="background:${BRAND.primary};padding:32px 24px;text-align:center;">
      <h1 style="color:${BRAND.primaryFg};margin:0;font-size:20px;font-weight:700;font-family:${BRAND.font};">4ThePeople</h1>
    </div>

    <div style="padding:32px 24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">${status.emoji}</div>
      <h2 style="margin:0 0 8px;font-size:20px;color:${BRAND.primary};font-family:${BRAND.font};">
        ${newStatus === "shipped" ? "Din order är på väg!" : status.label}
      </h2>
      <p style="color:${BRAND.muted};margin:0 0 16px;font-size:14px;font-family:${BRAND.font};">
        ${status.desc}
      </p>
      <p style="color:${BRAND.muted};margin:0;font-size:13px;font-family:${BRAND.font};">
        Order: <strong style="color:${BRAND.primary};">#${(order.payment_intent_id || order.id || '').slice(-8).toUpperCase()}</strong>
      </p>
    </div>

    ${trackingSection}

    <div style="padding:0 24px 32px;text-align:center;">
      <a href="https://4thepeople.se/track-order?q=${encodeURIComponent(order.payment_intent_id || order.id || "")}"
         style="display:inline-block;background:${BRAND.primary};color:${BRAND.primaryFg};padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;font-family:${BRAND.font};">
        Se orderstatus →
      </a>
      ${newStatus === "shipped" ? `<p style="margin:12px 0 0;font-size:12px;color:${BRAND.muted};font-family:${BRAND.font};">Beräknad leveranstid: 2–5 arbetsdagar</p>` : ""}
    </div>

    <div style="background:${BRAND.cardBg};padding:20px 24px;text-align:center;border-top:1px solid ${BRAND.border};">
      <p style="margin:0;font-size:12px;color:${BRAND.muted};font-family:${BRAND.font};">
        4ThePeople · support@4thepeople.se
      </p>
    </div>
  </div>
</div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: only service role can send order emails
  if (!verifyServiceRole(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { order_id, email_type } = body;

    if (!order_id || !email_type) {
      return new Response(JSON.stringify({ error: "Missing order_id or email_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    const shipping: ShippingAddress =
      order.shipping_address && typeof order.shipping_address === "object"
        ? order.shipping_address as ShippingAddress
        : {};

    let html = "";
    let subject = "";

    switch (email_type) {
      case "order_confirmation":
        subject = `Orderbekräftelse ${order.order_number} — 4ThePeople`;
        html = renderOrderConfirmationEmail(order, items, shipping);
        break;
      case "status_update":
        subject = order.status === "shipped"
          ? `Din order #${(order.payment_intent_id || order.id || '').slice(-8).toUpperCase()} är skickad 🚚`
          : `Din order ${order.order_number} — statusuppdatering`;
        html = renderStatusUpdateEmail(order, order.status);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown email_type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Idempotency: check if this exact email was already sent/enqueued
    const messageId = email_type === 'status_update'
      ? `order-${email_type}-${order.id}-${order.status || 'unknown'}`
      : `order-${email_type}-${order.id}`;
    const { data: existing } = await supabase
      .from("email_send_log")
      .select("id")
      .eq("message_id", messageId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[send-order-email] Already sent ${messageId}, skipping`);
      return new Response(JSON.stringify({ success: true, message_id: messageId, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enqueue to transactional_emails queue via pgmq
    const payload = {
      to: order.order_email,
      from: "order@notify.4thepeople.se",
      sender_domain: "notify.4thepeople.se",
      subject,
      html,
      message_id: messageId,
      idempotency_key: messageId,
      label: `order_${email_type}`,
      purpose: "transactional",
    };

    const { data: queueResult, error: queueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload,
    });

    if (queueError) {
      console.error("[send-order-email] Failed to enqueue:", queueError);
      return new Response(JSON.stringify({ error: "Failed to enqueue email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log to email_send_log
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: `order_${email_type}`,
      recipient_email: order.order_email,
      status: "pending",
      metadata: { order_id: order.id, order_number: order.order_number, email_type },
    });

    console.log(`[send-order-email] Enqueued ${email_type} for order ${order.order_number}`);

    return new Response(JSON.stringify({ success: true, message_id: messageId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-order-email] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
