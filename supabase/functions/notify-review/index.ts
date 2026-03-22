import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = ['admin', 'founder', 'it', 'moderator', 'support', 'manager'];

interface ReviewNotification {
  productTitle: string;
  rating: number;
  comment: string;
  userEmail: string;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (authHeader === `Bearer ${serviceRoleKey}`) {
    // OK - service role
  } else {
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userSupabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claimsData.claims.sub;
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await adminSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ALLOWED_ROLES)
      .limit(1);

    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  try {
    const body = await req.json();
    const { productTitle, rating, comment, userEmail } = body as ReviewNotification;

    // Input validation
    if (!productTitle || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sanitize all user inputs
    const safeTitle = escapeHtml(productTitle);
    const safeComment = escapeHtml(comment || '');
    const safeEmail = escapeHtml(userEmail || 'Anonym');

    const adminEmail = "torildssondennis@gmail.com";
    const stars = "⭐".repeat(Math.min(5, Math.max(1, Math.round(rating))));

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="width: 100%; max-width: 480px; border-collapse: collapse;">
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #16a34a, #22c55e); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                        <span style="font-size: 24px;">🌿</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                      <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #18181b; text-align: center;">
                        📝 Ny recension att granska
                      </h1>
                      <p style="margin: 0 0 24px; font-size: 14px; color: #71717a; text-align: center;">
                        En kund har lämnat en recension som väntar på godkännande.
                      </p>
                      <div style="background: #f4f4f5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                        <p style="margin: 0 0 12px; font-size: 14px; color: #71717a;">
                          <strong style="color: #18181b;">Produkt:</strong> ${safeTitle}
                        </p>
                        <p style="margin: 0 0 12px; font-size: 14px; color: #71717a;">
                          <strong style="color: #18181b;">Betyg:</strong> ${stars} (${rating}/5)
                        </p>
                        <p style="margin: 0 0 12px; font-size: 14px; color: #71717a;">
                          <strong style="color: #18181b;">Från:</strong> ${safeEmail}
                        </p>
                        <p style="margin: 0; font-size: 14px; color: #71717a;">
                          <strong style="color: #18181b;">Recension:</strong>
                        </p>
                        <p style="margin: 8px 0 0; font-size: 14px; color: #18181b; font-style: italic;">
                          "${safeComment}"
                        </p>
                      </div>
                      <a href="https://4thepeople.se/profile?tab=overview" 
                         style="display: block; width: 100%; padding: 14px; background: linear-gradient(135deg, #16a34a, #22c55e); color: white; text-align: center; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px; box-sizing: border-box;">
                        Granska i Admin-panelen
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top: 24px;">
                      <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                        4ThePeople Admin • Automatiskt meddelande
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "4ThePeople <noreply@4thepeople.se>",
        to: [adminEmail],
        subject: `📝 Ny recension att granska: ${safeTitle}`,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to send admin notification:", errorText);
      throw new Error(errorText);
    }

    const data = await res.json();
    console.log("Admin notification sent:", data);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in notify-review function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
