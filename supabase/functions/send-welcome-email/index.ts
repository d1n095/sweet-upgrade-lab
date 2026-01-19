import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  language?: 'sv' | 'en';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, language = 'sv' }: WelcomeEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Missing required field: email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending welcome email to: ${email} (language: ${language})`);

    const baseUrl = Deno.env.get("SITE_URL") || "https://4thepeople.se";
    const shopUrl = `${baseUrl}/shop`;

    const content = {
      sv: {
        subject: 'Välkommen till 4thepeople! 🌿',
        greeting: 'Välkommen till familjen!',
        intro: 'Tack för att du registrerade dig hos oss. Du är nu medlem och har tillgång till exklusiva fördelar.',
        benefits: [
          '💰 Exklusiva medlemspriser på alla produkter',
          '📦 Automatiska mängdrabatter',
          '🎁 Tillgång till paketpriser och erbjudanden',
          '⭐ Möjlighet att skriva recensioner och få rabatter'
        ],
        cta: 'Börja handla',
        footer: 'Vi är glada att ha dig med oss! 💚',
        team: '4thepeople-teamet',
        contact: 'Har du frågor? Kontakta oss på support@4thepeople.se'
      },
      en: {
        subject: 'Welcome to 4thepeople! 🌿',
        greeting: 'Welcome to the family!',
        intro: 'Thank you for signing up with us. You are now a member with access to exclusive benefits.',
        benefits: [
          '💰 Exclusive member prices on all products',
          '📦 Automatic volume discounts',
          '🎁 Access to bundle pricing and offers',
          '⭐ Ability to write reviews and earn discounts'
        ],
        cta: 'Start shopping',
        footer: 'We\'re happy to have you with us! 💚',
        team: 'The 4thepeople team',
        contact: 'Have questions? Contact us at support@4thepeople.se'
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
      
      <!-- Welcome banner -->
      <div style="background: linear-gradient(135deg, #1a5f3f 0%, #2d8659 100%); border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 32px;">
        <h2 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">
          ${t.greeting}
        </h2>
      </div>
      
      <!-- Intro -->
      <p style="color: #475569; margin-bottom: 24px; font-size: 16px;">
        ${t.intro}
      </p>
      
      <!-- Benefits -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
        <p style="font-weight: 600; color: #166534; margin: 0 0 16px 0; font-size: 16px;">
          ${language === 'sv' ? 'Dina medlemsfördelar:' : 'Your member benefits:'}
        </p>
        ${t.benefits.map(b => `<p style="color: #166534; margin: 8px 0; font-size: 14px;">${b}</p>`).join('')}
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${shopUrl}" 
           style="display: inline-block; background-color: #1a5f3f; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px;">
          ${t.cta} →
        </a>
      </div>
      
      <!-- Footer -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 24px;">
        <p style="color: #1a5f3f; font-weight: 600; margin: 0 0 8px 0;">
          ${t.footer}
        </p>
        <p style="color: #64748b; font-size: 14px; margin: 0 0 16px 0;">
          ${t.team}
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          ${t.contact}
        </p>
      </div>
      
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

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
