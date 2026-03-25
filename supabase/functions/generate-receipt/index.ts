import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // Auth: service role or authenticated staff
    const authHeader = req.headers.get("authorization") || "";
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;

    if (!isServiceRole) {
      const client = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const staffRoles = ["admin", "founder", "it", "warehouse", "finance"];
      if (!roles?.some((r: any) => staffRoles.includes(r.role))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { order_id, action } = body;

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const shipping: any = order.shipping_address && typeof order.shipping_address === "object"
      ? order.shipping_address : {};

    // Generate receipt HTML suitable for PDF rendering
    const receiptHtml = generateReceiptHtml(order, items, shipping);

    // Store receipt in storage bucket (idempotent — overwrites if exists)
    const displayId = getDisplayId(order);
    const storagePath = `${order.user_id}/${order.id}-${displayId}.html`;
    let receiptUrl: string | null = null;

    try {
      const encoder = new TextEncoder();
      const htmlBytes = encoder.encode(receiptHtml);

      const { error: uploadErr } = await supabase.storage
        .from("receipts")
        .upload(storagePath, htmlBytes, {
          contentType: "text/html",
          upsert: true,
        });

      if (uploadErr) {
        console.warn("[generate-receipt] Storage upload failed:", uploadErr.message);
      } else {
        receiptUrl = `${supabaseUrl}/storage/v1/object/receipts/${storagePath}`;
        // Save reference on order
        await supabase
          .from("orders")
          .update({ receipt_url: receiptUrl })
          .eq("id", order.id);
        console.log("[generate-receipt] Receipt stored:", storagePath);
      }
    } catch (storageErr: any) {
      console.warn("[generate-receipt] Storage error (non-blocking):", storageErr.message);
    }

    if (action === "resend_email") {
      // Resend the receipt email to the customer
      const messageId = `receipt-resend-${order.id}-${Date.now()}`;
      const payload = {
        to: order.order_email,
        from: "order@notify.4thepeople.se",
        sender_domain: "notify.4thepeople.se",
        subject: `Kvitto — Order #${displayId}`,
        html: receiptHtml,
        message_id: messageId,
        idempotency_key: messageId,
        label: "order_receipt_resend",
        purpose: "transactional",
      };

      const { error: queueError } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload,
      });

      if (queueError) {
        console.error("[generate-receipt] Queue error:", queueError);
        return new Response(JSON.stringify({ error: "Failed to enqueue receipt email" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "order_receipt_resend",
        recipient_email: order.order_email,
        status: "pending",
        metadata: { order_id: order.id, action: "resend" },
      });

      return new Response(JSON.stringify({ success: true, action: "resend_email", message_id: messageId, receipt_url: receiptUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: return receipt HTML for PDF generation client-side
    return new Response(JSON.stringify({
      success: true,
      html: receiptHtml,
      order_id: order.id,
      order_email: order.order_email,
      display_id: displayId,
      receipt_url: receiptUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[generate-receipt] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getDisplayId(order: any): string {
  return (order.payment_intent_id || order.id || "").slice(-8).toUpperCase();
}

function formatPrice(amount: number, currency = "SEK"): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency", currency, minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function generateReceiptHtml(order: any, items: any[], shipping: any): string {
  const displayId = getDisplayId(order);
  const subtotal = items.reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 1), 0);

  const itemRows = items.map((item: any) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${item.title || 'Produkt'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:center;">${item.quantity || 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;">${formatPrice(item.price || 0, order.currency)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;font-weight:600;">
        ${formatPrice((item.price || 0) * (item.quantity || 1), order.currency)}
      </td>
    </tr>
  `).join("");

  const paymentLabel = order.payment_method === "klarna" ? "Klarna" :
    order.payment_method === "card" ? "Kort" : order.payment_method || "—";

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <title>Kvitto #${displayId}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; }
  </style>
</head>
<body>
<div style="max-width:680px;margin:0 auto;padding:40px 32px;">
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;border-bottom:3px solid #1a1a2e;padding-bottom:24px;">
    <div>
      <h1 style="font-size:28px;font-weight:800;color:#1a1a2e;margin:0;">4ThePeople</h1>
      <p style="font-size:12px;color:#888;margin-top:4px;">Giftfria produkter för hela Europa</p>
    </div>
    <div style="text-align:right;">
      <h2 style="font-size:22px;font-weight:700;color:#1a1a2e;margin:0;">KVITTO</h2>
      <p style="font-size:13px;color:#666;margin-top:4px;">Order #${displayId}</p>
      <p style="font-size:12px;color:#888;">${formatDate(order.created_at)}</p>
    </div>
  </div>

  <!-- Info columns -->
  <div style="display:flex;gap:32px;margin-bottom:28px;">
    <div style="flex:1;">
      <p style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Från</p>
      <p style="font-size:13px;line-height:1.6;">
        4ThePeople<br>
        support@4thepeople.se
      </p>
    </div>
    <div style="flex:1;">
      <p style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Till</p>
      <p style="font-size:13px;line-height:1.6;">
        ${shipping.name || order.order_email}<br>
        ${shipping.address ? `${shipping.address}<br>` : ""}
        ${shipping.zip || ""} ${shipping.city || ""}${shipping.country ? `<br>${shipping.country}` : ""}
      </p>
    </div>
    <div style="flex:1;">
      <p style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Betalning</p>
      <p style="font-size:13px;line-height:1.6;">
        Metod: ${paymentLabel}<br>
        Status: ${order.payment_status === 'paid' ? '✓ Betald' : order.payment_status}<br>
        Valuta: ${order.currency || 'SEK'}
      </p>
    </div>
  </div>

  <!-- Items table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Produkt</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Antal</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Styckpris</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Summa</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:32px;">
    <div style="width:260px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;">
        <span style="color:#666;">Delsumma</span>
        <span>${formatPrice(subtotal, order.currency)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;">
        <span style="color:#666;">Frakt</span>
        <span>${order.total_amount > subtotal ? formatPrice(order.total_amount - subtotal, order.currency) : 'Inkl.'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 0 6px;border-top:2px solid #1a1a2e;font-size:18px;font-weight:700;">
        <span>Totalt</span>
        <span>${formatPrice(order.total_amount, order.currency)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;font-size:11px;color:#888;">
        <span>Varav moms (25%)</span>
        <span>${formatPrice(order.total_amount * 0.2, order.currency)}</span>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #e5e7eb;padding-top:20px;text-align:center;">
    <p style="font-size:12px;color:#888;line-height:1.6;">
      4ThePeople · support@4thepeople.se<br>
      Tack för ditt köp! 💚
    </p>
  </div>
</div>
</body>
</html>`;
}
