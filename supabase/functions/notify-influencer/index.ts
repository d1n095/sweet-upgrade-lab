import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotifyInfluencerRequest {
  email: string;
  name: string;
  code: string;
  maxProducts: number;
  validUntil?: string;
  isUpdate?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: require service role or valid staff JWT
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!data?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  try {
    const { email, name, code, maxProducts, validUntil, isUpdate }: NotifyInfluencerRequest = await req.json();

    const validUntilText = validUntil 
      ? `Giltig till: ${new Date(validUntil).toLocaleDateString('sv-SE')}`
      : 'Ingen utgångstid';

    const subject = isUpdate 
      ? `Din influencer-kod har uppdaterats - ${code}`
      : `Välkommen som VIP-influencer! Din kod: ${code}`;

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
              Hej <strong>${name}</strong>! 👋
            </p>
            
            <p style="font-size: 16px; color: #64748b; line-height: 1.6; margin-bottom: 24px;">
              ${isUpdate 
                ? 'Din influencer-kod har uppdaterats. Här är dina nya detaljer:'
                : 'Vi är superglada att ha dig med i vårt influencer-program! Här är din personliga kod för att hämta gratisprodukter:'
              }
            </p>
            
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #22c55e; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Din personliga kod</p>
              <p style="font-size: 32px; font-weight: bold; color: #1a5f3f; margin: 0; font-family: monospace; letter-spacing: 2px;">${code}</p>
            </div>
            
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #64748b;">Antal gratisprodukter:</span>
                <strong style="color: #1e293b;">${maxProducts} st</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Giltighet:</span>
                <strong style="color: #1e293b;">${validUntilText}</strong>
              </div>
            </div>
            
            <h3 style="color: #1e293b; font-size: 18px; margin-bottom: 16px;">📋 Så här använder du koden:</h3>
            
            <ol style="color: #64748b; line-height: 1.8; padding-left: 20px; margin-bottom: 24px;">
              <li>Besök vår hemsida och logga in med din email</li>
              <li>Lägg till önskade produkter i varukorgen</li>
              <li>I kassan, skriv in din kod <strong>${code}</strong> i rabattfältet</li>
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
            © ${new Date().getFullYear()} Ditt Företag. Alla rättigheter förbehållna.
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
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in notify-influencer function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
