import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotifyAffiliateRequest {
  email: string;
  name: string;
  code: string;
  commissionPercent: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, code, commissionPercent }: NotifyAffiliateRequest = await req.json();

    const subject = `Välkommen som affiliate! Din kod: ${code}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">
              🎉 Välkommen till vårt affiliate-program!
            </h1>
          </div>
          
          <div style="background: white; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <p style="font-size: 18px; color: #1e293b; margin-bottom: 24px;">
              Hej <strong>${name}</strong>! 👋
            </p>
            
            <p style="font-size: 16px; color: #64748b; line-height: 1.6; margin-bottom: 24px;">
              Vi är glada att ha dig som affiliate! Här är din personliga kod som du kan dela med dina följare:
            </p>
            
            <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Din affiliate-kod</p>
              <p style="font-size: 32px; font-weight: bold; color: #ea580c; margin: 0; font-family: monospace; letter-spacing: 2px;">${code}</p>
            </div>
            
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h3 style="color: #1e293b; margin: 0 0 12px 0;">Dina förmåner:</h3>
              <ul style="color: #64748b; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>${commissionPercent}% provision</strong> på varje försäljning</li>
                <li><strong>10% rabatt</strong> för dina kunder</li>
                <li>Utbetalning när du nått <strong>500 kr</strong></li>
                <li>Realtime tracking av dina intäkter</li>
              </ul>
            </div>
            
            <h3 style="color: #1e293b; font-size: 18px; margin-bottom: 16px;">📋 Så här kommer du igång:</h3>
            
            <ol style="color: #64748b; line-height: 1.8; padding-left: 20px; margin-bottom: 24px;">
              <li>Dela din kod <strong>${code}</strong> med dina följare</li>
              <li>De använder koden i kassan och får 10% rabatt</li>
              <li>Du tjänar ${commissionPercent}% på varje köp</li>
              <li>Logga in för att se dina intäkter i realtid</li>
            </ol>
            
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
        from: "Affiliate Program <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const emailData = await emailResponse.json();
    console.log("Affiliate notification sent:", emailData);

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in notify-affiliate function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
