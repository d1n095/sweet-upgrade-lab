// Submit Contact — validates, stores, and (if configured) notifies support.
// Public function (no JWT required). Uses service role to insert so that
// anonymous visitors can always submit regardless of RLS edge cases.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPPORT_EMAIL = "support@4thepeople.se";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// In-memory rate limit (per isolate): 5 submissions per IP per 10 minutes.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const rateMap = new Map<string, number[]>();

function clean(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
}

function rateLimitHit(ip: string): boolean {
  const now = Date.now();
  const arr = (rateMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    rateMap.set(ip, arr);
    return true;
  }
  arr.push(now);
  rateMap.set(ip, arr);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  if (rateLimitHit(ip)) {
    return new Response(
      JSON.stringify({ error: "Too many submissions. Please try again later." }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Honeypot — real users leave this empty.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    // Silent success for bots.
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const name = clean(body.name, 100);
  const email = clean(body.email, 255).toLowerCase();
  const subject = clean(body.subject, 200);
  const message = clean(body.message, 5000);

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Name is required";
  if (!email) errors.email = "Email is required";
  else if (!EMAIL_RE.test(email)) errors.email = "Invalid email format";
  if (!message) errors.message = "Message is required";
  else if (message.length < 10) errors.message = "Message must be at least 10 characters";

  if (Object.keys(errors).length > 0) {
    return new Response(JSON.stringify({ error: "Validation failed", fields: errors }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inserted, error: insertError } = await supabase
    .from("contact_messages")
    .insert({
      name,
      email,
      subject: subject || null,
      message,
      status: "new",
      ip_address: ip === "unknown" ? null : ip,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("contact_messages insert failed", insertError);
    return new Response(JSON.stringify({ error: "Failed to save message" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Best-effort notification via existing send-order-email / transactional
  // infra. We do not block success on email delivery.
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const html = `
        <h2>New contact message</h2>
        <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
        ${subject ? `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ""}
        <p><strong>Message:</strong></p>
        <pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>
        <hr />
        <p style="color:#888;font-size:12px">IP: ${escapeHtml(ip)} · UA: ${escapeHtml(userAgent ?? "")}</p>
      `;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "4ThePeople <notify@notify.4thepeople.se>",
          to: [SUPPORT_EMAIL],
          reply_to: email,
          subject: subject
            ? `[Contact] ${subject}`
            : `[Contact] New message from ${name}`,
          html,
        }),
      });
    }
  } catch (err) {
    console.error("notification email failed (non-fatal)", err);
  }

  return new Response(JSON.stringify({ success: true, id: inserted.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
