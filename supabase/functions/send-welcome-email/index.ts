import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Auth helper
function verifyServiceRole(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") || "";
  return authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  language?: 'sv' | 'en' | 'no' | 'da' | 'de' | 'fi' | 'nl' | 'fr' | 'es' | 'pl';
}

interface EmailTemplate {
  subject_sv: string;
  subject_en: string;
  greeting_sv: string;
  greeting_en: string;
  intro_sv: string;
  intro_en: string;
  benefits_sv: string[];
  benefits_en: string[];
  cta_text_sv: string;
  cta_text_en: string;
  footer_sv: string;
  footer_en: string;
}

type LanguageContent = {
  subject: string;
  greeting: string;
  intro: string;
  benefits: string[];
  cta: string;
  footer: string;
  team: string;
  contact: string;
  benefitsTitle: string;
};

const getDefaultTemplate = (language: 'sv' | 'en' | 'no' | 'da' | 'de' | 'fi' | 'nl' | 'fr' | 'es' | 'pl'): LanguageContent => {
  const templates: Record<string, LanguageContent> = {
    sv: {
      subject: 'Välkommen till 4thepeople! 🌿',
      greeting: 'Välkommen till familjen!',
      intro: 'Tack för att du registrerade dig hos oss. Du är nu medlem och har tillgång till exklusiva fördelar.',
      benefits: ['💰 Exklusiva medlemspriser på alla produkter', '📦 Automatiska mängdrabatter', '🎁 Tillgång till paketpriser och erbjudanden', '⭐ Möjlighet att skriva recensioner och få rabatter'],
      cta: 'Börja handla',
      footer: 'Vi är glada att ha dig med oss! 💚',
      team: '4thepeople-teamet',
      contact: 'Har du frågor? Kontakta oss på support@4thepeople.se',
      benefitsTitle: 'Dina medlemsfördelar:',
    },
    en: {
      subject: 'Welcome to 4thepeople! 🌿',
      greeting: 'Welcome to the family!',
      intro: 'Thank you for signing up with us. You are now a member with access to exclusive benefits.',
      benefits: ['💰 Exclusive member prices on all products', '📦 Automatic volume discounts', '🎁 Access to bundle pricing and offers', '⭐ Ability to write reviews and earn discounts'],
      cta: 'Start shopping',
      footer: "We're happy to have you with us! 💚",
      team: 'The 4thepeople team',
      contact: 'Questions? Contact us at support@4thepeople.se',
      benefitsTitle: 'Your member benefits:',
    },
    no: {
      subject: 'Velkommen til 4thepeople! 🌿',
      greeting: 'Velkommen til familien!',
      intro: 'Takk for at du registrerte deg hos oss. Du er nå medlem og har tilgang til eksklusive fordeler.',
      benefits: ['💰 Eksklusive medlemspriser på alle produkter', '📦 Automatiske mengderabatter', '🎁 Tilgang til pakkeprisser og tilbud', '⭐ Mulighet til å skrive anmeldelser og få rabatter'],
      cta: 'Begynn å handle',
      footer: 'Vi er glade for å ha deg med oss! 💚',
      team: '4thepeople-teamet',
      contact: 'Har du spørsmål? Kontakt oss på support@4thepeople.se',
      benefitsTitle: 'Dine medlemsfordeler:',
    },
    da: {
      subject: 'Velkommen til 4thepeople! 🌿',
      greeting: 'Velkommen til familien!',
      intro: 'Tak fordi du tilmeldte dig hos os. Du er nu medlem og har adgang til eksklusive fordele.',
      benefits: ['💰 Eksklusive medlemspriser på alle produkter', '📦 Automatiske mængderabatter', '🎁 Adgang til pakkepriser og tilbud', '⭐ Mulighed for at skrive anmeldelser og få rabatter'],
      cta: 'Begynd at handle',
      footer: 'Vi er glade for at have dig med! 💚',
      team: '4thepeople-teamet',
      contact: 'Har du spørgsmål? Kontakt os på support@4thepeople.se',
      benefitsTitle: 'Dine medlemsfordele:',
    },
    de: {
      subject: 'Willkommen bei 4thepeople! 🌿',
      greeting: 'Willkommen in der Familie!',
      intro: 'Vielen Dank für Ihre Anmeldung bei uns. Sie sind jetzt Mitglied und haben Zugang zu exklusiven Vorteilen.',
      benefits: ['💰 Exklusive Mitgliedspreise auf alle Produkte', '📦 Automatische Mengenrabatte', '🎁 Zugang zu Paketpreisen und Angeboten', '⭐ Möglichkeit, Bewertungen zu schreiben und Rabatte zu erhalten'],
      cta: 'Jetzt einkaufen',
      footer: 'Wir freuen uns, Sie bei uns zu haben! 💚',
      team: 'Das 4thepeople-Team',
      contact: 'Fragen? Kontaktieren Sie uns unter support@4thepeople.se',
      benefitsTitle: 'Ihre Mitgliedsvorteile:',
    },
    fi: {
      subject: 'Tervetuloa 4thepeople! 🌿',
      greeting: 'Tervetuloa perheeseen!',
      intro: 'Kiitos rekisteröitymisestä. Olet nyt jäsen ja sinulla on pääsy eksklusiivisiin etuihin.',
      benefits: ['💰 Eksklusiiviset jäsenhinnat kaikille tuotteille', '📦 Automaattiset määräalennukset', '🎁 Pääsy pakettihintaan ja tarjouksiin', '⭐ Mahdollisuus kirjoittaa arvosteluja ja saada alennuksia'],
      cta: 'Aloita ostokset',
      footer: 'Olemme iloisia, että olet mukana! 💚',
      team: '4thepeople-tiimi',
      contact: 'Kysymyksiä? Ota yhteyttä osoitteeseen support@4thepeople.se',
      benefitsTitle: 'Jäsenedusi:',
    },
    nl: {
      subject: 'Welkom bij 4thepeople! 🌿',
      greeting: 'Welkom in de familie!',
      intro: 'Bedankt voor je aanmelding. Je bent nu lid en hebt toegang tot exclusieve voordelen.',
      benefits: ['💰 Exclusieve ledenprijzen op alle producten', '📦 Automatische hoeveelheidskortingen', '🎁 Toegang tot bundelprijzen en aanbiedingen', '⭐ Mogelijkheid om beoordelingen te schrijven en kortingen te verdienen'],
      cta: 'Begin met winkelen',
      footer: 'We zijn blij dat je er bent! 💚',
      team: 'Het 4thepeople-team',
      contact: 'Vragen? Neem contact op via support@4thepeople.se',
      benefitsTitle: 'Jouw ledenvoordelen:',
    },
    fr: {
      subject: 'Bienvenue chez 4thepeople ! 🌿',
      greeting: 'Bienvenue dans la famille !',
      intro: 'Merci de vous être inscrit. Vous êtes maintenant membre et avez accès à des avantages exclusifs.',
      benefits: ['💰 Prix membres exclusifs sur tous les produits', '📦 Remises automatiques sur les volumes', '🎁 Accès aux prix groupés et aux offres', '⭐ Possibilité d\'écrire des avis et d\'obtenir des réductions'],
      cta: 'Commencer à acheter',
      footer: 'Nous sommes heureux de vous avoir parmi nous ! 💚',
      team: 'L\'équipe 4thepeople',
      contact: 'Des questions ? Contactez-nous à support@4thepeople.se',
      benefitsTitle: 'Vos avantages membres :',
    },
    es: {
      subject: '¡Bienvenido a 4thepeople! 🌿',
      greeting: '¡Bienvenido a la familia!',
      intro: 'Gracias por registrarte. Ahora eres miembro y tienes acceso a beneficios exclusivos.',
      benefits: ['💰 Precios exclusivos para miembros en todos los productos', '📦 Descuentos automáticos por volumen', '🎁 Acceso a precios de paquetes y ofertas', '⭐ Posibilidad de escribir reseñas y obtener descuentos'],
      cta: 'Empezar a comprar',
      footer: '¡Estamos felices de tenerte con nosotros! 💚',
      team: 'El equipo de 4thepeople',
      contact: '¿Preguntas? Contáctanos en support@4thepeople.se',
      benefitsTitle: 'Tus beneficios de miembro:',
    },
    pl: {
      subject: 'Witamy w 4thepeople! 🌿',
      greeting: 'Witamy w rodzinie!',
      intro: 'Dziękujemy za rejestrację. Jesteś teraz członkiem i masz dostęp do ekskluzywnych korzyści.',
      benefits: ['💰 Ekskluzywne ceny dla członków na wszystkie produkty', '📦 Automatyczne rabaty ilościowe', '🎁 Dostęp do cen pakietowych i ofert', '⭐ Możliwość pisania recenzji i zdobywania rabatów'],
      cta: 'Zacznij robić zakupy',
      footer: 'Cieszymy się, że jesteś z nami! 💚',
      team: 'Zespół 4thepeople',
      contact: 'Pytania? Skontaktuj się z nami pod adresem support@4thepeople.se',
      benefitsTitle: 'Twoje korzyści jako członka:',
    },
  };
  return templates[language] || templates.en;
};

const handler = async (req: Request): Promise<Response> => {
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
    const { email, language: rawLang = 'en' }: WelcomeEmailRequest = await req.json();
    // Normalize locale codes (e.g. "sv-SE" → "sv") and validate against supported set
    const supported = ['sv', 'en', 'no', 'da', 'de', 'fi', 'nl', 'fr', 'es', 'pl'];
    const normalized = rawLang.slice(0, 2).toLowerCase();
    const language = supported.includes(normalized) ? normalized as 'sv' | 'en' | 'no' | 'da' | 'de' | 'fi' | 'nl' | 'fr' | 'es' | 'pl' : 'en';

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Missing required field: email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[send-welcome-email] Sending (language: ${language})`);

    // Fetch template from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let t = getDefaultTemplate(language);

    const { data: templateData } = await supabase
      .from('email_templates')
      .select('*')
      .eq('template_type', 'welcome')
      .eq('is_active', true)
      .single();

    if (templateData) {
      const tmpl = templateData as EmailTemplate;
      // Database templates only have sv/en, use appropriate fallback
      const useSv = language === 'sv' || language === 'no' || language === 'da';
      t = {
        subject: useSv ? tmpl.subject_sv : tmpl.subject_en,
        greeting: useSv ? tmpl.greeting_sv : tmpl.greeting_en,
        intro: useSv ? tmpl.intro_sv : tmpl.intro_en,
        benefits: useSv ? tmpl.benefits_sv : tmpl.benefits_en,
        cta: useSv ? tmpl.cta_text_sv : tmpl.cta_text_en,
        footer: useSv ? tmpl.footer_sv : tmpl.footer_en,
        team: getDefaultTemplate(language).team,
        contact: getDefaultTemplate(language).contact,
        benefitsTitle: getDefaultTemplate(language).benefitsTitle,
      };
      console.log('Using custom template from database with language fallback');
    } else {
      console.log('Using default template for language:', language);
    }

    const baseUrl = Deno.env.get("SITE_URL") || "https://4thepeople.se";
    const shopUrl = `${baseUrl}/shop`;

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
          ${t.benefitsTitle}
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
