import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Auth helper
function verifyServiceRole(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") || "";
  return authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
}

const BRAND = {
  primary: "hsl(220, 20%, 10%)",
  primaryFg: "#ffffff",
  accent: "hsl(157, 72%, 37%)",
  muted: "hsl(220, 8%, 55%)",
  bg: "#ffffff",
  border: "#e5e7eb",
  font: "'Plus Jakarta Sans', Arial, sans-serif",
};

function renderPostDeliveryEmail(orderNumber: string, items: any[]): string {
  const itemList = items.map((i: any) => `<li style="margin-bottom:4px;">${i.title}</li>`).join("");
  return `
  <div style="font-family:${BRAND.font};max-width:560px;margin:0 auto;padding:32px 24px;background:${BRAND.bg};">
    <h1 style="font-size:22px;color:${BRAND.primary};margin-bottom:8px;">Hur gick det med din beställning?</h1>
    <p style="color:${BRAND.muted};font-size:14px;line-height:1.6;">
      Vi hoppas du är nöjd med din order <strong>${orderNumber}</strong>! Här är några tips:
    </p>
    <ul style="color:${BRAND.primary};font-size:14px;line-height:1.8;padding-left:20px;">
      ${itemList}
    </ul>
    <p style="color:${BRAND.muted};font-size:14px;margin-top:16px;">
      💡 <strong>Tips:</strong> Förvara produkterna svalt och torrt för bästa hållbarhet.
    </p>
    <p style="color:${BRAND.muted};font-size:14px;margin-top:16px;">
      ⭐ Lämna gärna en recension – det hjälper andra kunder!
    </p>
    <hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0;" />
    <p style="color:${BRAND.muted};font-size:12px;">4thePeople – Naturliga produkter med mening</p>
  </div>`;
}

function renderRepeatReminderEmail(items: any[], daysSince: number): string {
  const itemList = items.slice(0, 3).map((i: any) => `<li style="margin-bottom:4px;">${i.title}</li>`).join("");
  return `
  <div style="font-family:${BRAND.font};max-width:560px;margin:0 auto;padding:32px 24px;background:${BRAND.bg};">
    <h1 style="font-size:22px;color:${BRAND.primary};margin-bottom:8px;">Dags att fylla på? 🔄</h1>
    <p style="color:${BRAND.muted};font-size:14px;line-height:1.6;">
      Det har gått ${daysSince} dagar sedan ditt senaste köp. Dina favoriter väntar:
    </p>
    <ul style="color:${BRAND.primary};font-size:14px;line-height:1.8;padding-left:20px;">
      ${itemList}
    </ul>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://4thepeople.se/produkter" style="display:inline-block;padding:12px 32px;background:${BRAND.primary};color:${BRAND.primaryFg};text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Handla igen →
      </a>
    </div>
    <hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0;" />
    <p style="color:${BRAND.muted};font-size:12px;">4thePeople – Naturliga produkter med mening</p>
  </div>`;
}

function renderUpsellEmail(purchasedItems: any[], suggestedProducts: any[]): string {
  const suggestions = suggestedProducts.slice(0, 3).map((p: any) => `
    <div style="display:inline-block;width:150px;margin:8px;text-align:center;vertical-align:top;">
      ${p.image_urls?.[0] ? `<img src="${p.image_urls[0]}" width="120" height="120" style="border-radius:8px;object-fit:cover;" />` : ''}
      <p style="font-size:13px;font-weight:600;margin:8px 0 4px;">${p.title_sv}</p>
      <p style="font-size:13px;color:${BRAND.accent};font-weight:600;">${p.price} kr</p>
    </div>
  `).join("");

  return `
  <div style="font-family:${BRAND.font};max-width:560px;margin:0 auto;padding:32px 24px;background:${BRAND.bg};">
    <h1 style="font-size:22px;color:${BRAND.primary};margin-bottom:8px;">Du kanske också gillar… ✨</h1>
    <p style="color:${BRAND.muted};font-size:14px;line-height:1.6;">
      Baserat på ditt senaste köp tror vi att du kommer älska dessa:
    </p>
    <div style="text-align:center;margin:16px 0;">
      ${suggestions}
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://4thepeople.se/produkter" style="display:inline-block;padding:12px 32px;background:${BRAND.primary};color:${BRAND.primaryFg};text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
        Utforska produkter →
      </a>
    </div>
    <hr style="border:none;border-top:1px solid ${BRAND.border};margin:24px 0;" />
    <p style="color:${BRAND.muted};font-size:12px;">4thePeople – Naturliga produkter med mening</p>
  </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: require service role
  if (!verifyServiceRole(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const { type } = await req.json();

    if (type === "post_delivery") {
      // Find orders delivered 2-3 days ago
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, order_email, items, user_id")
        .eq("status", "delivered")
        .gte("delivered_at", threeDaysAgo)
        .lte("delivered_at", twoDaysAgo)
        .eq("review_reminder_sent", false)
        .is("deleted_at", null);

      let sent = 0;
      for (const order of orders || []) {
        const items = Array.isArray(order.items) ? order.items : [];
        const html = renderPostDeliveryEmail(order.order_number || order.id.slice(0, 8), items);

        if (resendKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "4thePeople <noreply@notify.4thepeople.se>",
              to: [order.order_email],
              subject: "Hur gick det med din beställning? ⭐",
              html,
            }),
          });
        }

        await supabase.from("orders").update({ review_reminder_sent: true }).eq("id", order.id);
        sent++;
      }

      return new Response(JSON.stringify({ success: true, type: "post_delivery", sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "repeat_reminder") {
      // Find users whose last order was 30+ days ago
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentOrders } = await supabase
        .from("orders")
        .select("user_id, order_email, items, created_at")
        .eq("payment_status", "paid")
        .is("deleted_at", null)
        .lte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false });

      // Group by user, take the latest
      const userMap = new Map<string, any>();
      for (const order of recentOrders || []) {
        if (!userMap.has(order.user_id)) {
          userMap.set(order.user_id, order);
        }
      }

      let sent = 0;
      for (const [, order] of userMap) {
        const items = Array.isArray(order.items) ? order.items : [];
        const daysSince = Math.floor((Date.now() - new Date(order.created_at).getTime()) / (24 * 60 * 60 * 1000));
        const html = renderRepeatReminderEmail(items, daysSince);

        if (resendKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "4thePeople <noreply@notify.4thepeople.se>",
              to: [order.order_email],
              subject: "Dags att fylla på? 🔄",
              html,
            }),
          });
          sent++;
        }
      }

      return new Response(JSON.stringify({ success: true, type: "repeat_reminder", sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "upsell") {
      // Find orders delivered 5-7 days ago for upsell
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_email, items, user_id")
        .eq("status", "delivered")
        .gte("delivered_at", sevenDaysAgo)
        .lte("delivered_at", fiveDaysAgo)
        .is("deleted_at", null);

      // Get suggested products
      const { data: products } = await supabase
        .from("products")
        .select("id, title_sv, price, image_urls")
        .eq("is_visible", true)
        .eq("is_sellable", true)
        .limit(6);

      let sent = 0;
      for (const order of orders || []) {
        const items = Array.isArray(order.items) ? order.items : [];
        const purchasedIds = items.map((i: any) => i.id).filter(Boolean);
        const suggestions = (products || []).filter((p) => !purchasedIds.includes(p.id)).slice(0, 3);

        if (suggestions.length === 0) continue;

        const html = renderUpsellEmail(items, suggestions);

        if (resendKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "4thePeople <noreply@notify.4thepeople.se>",
              to: [order.order_email],
              subject: "Du kanske också gillar… ✨",
              html,
            }),
          });
          sent++;
        }
      }

      return new Response(JSON.stringify({ success: true, type: "upsell", sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown type. Use: post_delivery, repeat_reminder, upsell" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Retention email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
