import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReviewReminderRequest {
  email: string;
  customerName?: string;
  productName: string;
  productHandle: string;
  orderId?: string;
  language?: 'sv' | 'en';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      customerName, 
      productName, 
      productHandle, 
      orderId,
      language = 'sv' 
    }: ReviewReminderRequest = await req.json();

    if (!email || !productName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, productName" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const baseUrl = Deno.env.get("SITE_URL") || "https://4thepeople.se";
    const reviewUrl = `${baseUrl}/product/${productHandle}#reviews`;

    const content = {
      sv: {
        subject: `Hur var din ${productName}? 🌿 Få 10% rabatt!`,
        greeting: customerName ? `Hej ${customerName}!` : 'Hej!',
        intro: `Vi hoppas att du är nöjd med din beställning av ${productName}. Nu har du haft tid att prova produkten, och vi skulle uppskatta om du delar din upplevelse.`,
        reward: '🎁 Som tack för din recension får du 10% rabatt på din nästa beställning!',
        cta: 'Skriv din recension',
        benefits: [
          '✓ Hjälp andra att fatta rätt beslut',
          '✓ Få 10% rabattkod direkt',
          '✓ Påverka vårt sortiment'
        ],
        footer: 'Tack för att du handlar hos oss! 💚',
        team: '4thepeople-teamet',
        unsubscribe: 'Om du inte vill få fler påminnelser, kontakta oss på hej@4thepeople.se'
      },
      en: {
        subject: `How was your ${productName}? 🌿 Get 10% off!`,
        greeting: customerName ? `Hi ${customerName}!` : 'Hi!',
        intro: `We hope you're enjoying your ${productName}. Now that you've had time to try it, we'd love to hear about your experience.`,
        reward: '🎁 As a thank you for your review, you\'ll receive 10% off your next order!',
        cta: 'Write your review',
        benefits: [
          '✓ Help others make the right choice',
          '✓ Get 10% discount code instantly',
          '✓ Influence our product selection'
        ],
        footer: 'Thank you for shopping with us! 💚',
        team: 'The 4thepeople team',
        unsubscribe: 'If you don\'t want to receive reminders, contact us at hej@4thepeople.se'
      }
    };

    const t = content[language];

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
      
      <!-- Logo -->
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1a5f3f; font-size: 28px; font-weight: 700; margin: 0;">4thepeople</h1>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Giftfria produkter som fungerar</p>
      </div>
      
      <!-- Greeting -->
      <p style="font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 16px;">
        ${t.greeting}
      </p>
      
      <!-- Intro -->
      <p style="color: #475569; margin-bottom: 24px;">
        ${t.intro}
      </p>
      
      <!-- Reward highlight -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="font-size: 16px; font-weight: 600; color: #166534; margin: 0;">
          ${t.reward}
        </p>
      </div>
      
      <!-- Benefits -->
      <div style="margin-bottom: 32px;">
        ${t.benefits.map(b => `<p style="color: #475569; margin: 8px 0;">${b}</p>`).join('')}
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${reviewUrl}" 
           style="display: inline-block; background-color: #1a5f3f; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
          ${t.cta} →
        </a>
      </div>
      
      <!-- Footer -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
        <p style="color: #1a5f3f; font-weight: 600; margin: 0 0 8px 0;">
          ${t.footer}
        </p>
        <p style="color: #64748b; font-size: 14px; margin: 0;">
          ${t.team}
        </p>
      </div>
      
      <!-- Unsubscribe -->
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; text-align: center;">
        ${t.unsubscribe}
      </p>
      
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "4thepeople <no-reply@4thepeople.se>",
      to: [email],
      subject: t.subject,
      html: emailHtml,
    });

    console.log("Review reminder email sent:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending review reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
