import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = ['admin', 'founder', 'it', 'manager', 'marketing'];

interface NotifyInfluencerRequest {
  email: string;
  name: string;
  code: string;
  maxProducts: number;
  validUntil?: string;
  isUpdate?: boolean;
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
    const { email, name, code, maxProducts, validUntil, isUpdate } = body as NotifyInfluencerRequest;

    // Input validation
    if (!email || !email.includes("@") || !name || !code) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const safeName = escapeHtml(name);
    const safeCode = escapeHtml(code);
    const safeMaxProducts = Number(maxProducts) || 1;

    const validUntilText = validUntil 
      ? `Giltig till: ${new Date(validUntil).toLocaleDateString('sv-SE')}`
      : 'Ingen utgångstid';

    const subject = isUpdate 
      ? `Din influencer-kod har uppdaterats - ${safeCode}`
      : `Välkommen som VIP-influencer! Din kod: ${safeCode}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: linear-gradient(135deg, #1a5f3f 0%, #2d7a52 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">
              ${isUpdate ? '🎁 Din kod har uppdaterats!' : '🌟 Välkommen som VIP-influencer!'}
            </h1>
          </div>
          
          <div style="background: white; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <p style="font-size: 18px; color: #1e293b; margin-bottom: 24px;">
              Hej <strong>${safeName}</strong>! 👋
            </p>
            
            <p style="font-size: 16px; color: #64748b; line-height: 1.6; margin-bottom: 24px;">
              ${isUpdate 
                ? 'Din influencer-kod har uppdaterats. Här är dina nya detaljer:'
                : 'Vi är superglada att ha dig med i vårt influencer-program! Här är din personliga kod för att hämta gratisprodukter:'
              }
            </p>
            
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #22c55e; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Din personliga kod</p>
              <p style="font-size: 32px; font-weight: bold; color: #1a5f3f; margin: 0; font-family: monospace; letter-spacing: 2px;">${safeCode}</p>
            </div>
            
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #64748b;">Antal gratisprodukter:</span>
                <strong style="color: #1e293b;">${safeMaxProducts} st</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Giltighet:</span>
                <strong style="color: #1e293b;">${escapeHtml(validUntilText)}</strong>
              </div>
            </div>
            
            <h3 style="color: #1e293b; font-size: 18px; margin-bottom: 16px;">📋 Så här använder du koden:</h3>
            
            <ol style="color: #64748b; line-height: 1.8; padding-left: 20px; margin-bottom: 24px;">
              <li>Besök vår hemsida och logga in med din email</li>
              <li>Lägg till önskade produkter i varukorgen</li>
              <li>I kassan, skriv in din kod <strong>${safeCode}</strong> i rabattfältet</li>
              <li>Välj vilka produkter du vill ha gratis</li>
              <li>Klart! Produkten läggs till utan kostnad 🎉</li>
            </ol>
            
            <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                💡 <strong>Tips:</strong> Systemet håller reda på vilka produkter du redan fått, så du kan bara välja nya produkter varje gång!
              </p>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">
              Har du frågor? Svara på detta mail så hjälper vi dig!
            </p>
          </div>
          
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px;">
            © ${new Date().getFullYear()} 4ThePeople. Alla rättigheter förbehållna.
          </p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "VIP Program <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const emailData = await emailResponse.json();
    console.log("Influencer notification sent:", emailData);

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in notify-influencer function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
