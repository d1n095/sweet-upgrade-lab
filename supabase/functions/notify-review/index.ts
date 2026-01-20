import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReviewNotification {
  productTitle: string;
  rating: number;
  comment: string;
  userEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productTitle, rating, comment, userEmail }: ReviewNotification = await req.json();

    // Get admin emails from user_roles table
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Fetch admin user IDs
    const rolesResponse = await fetch(`${supabaseUrl}/rest/v1/user_roles?role=eq.admin&select=user_id`, {
      headers: {
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
    });

    const adminRoles = await rolesResponse.json();
    
    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admins found to notify");
      return new Response(JSON.stringify({ success: true, message: "No admins to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For each admin, we'd ideally fetch their email from auth.users
    // Since we can't access auth.users directly, we'll send to a configured admin email
    // or use the profiles table if it has email
    
    // For now, we'll use a simpler approach - send to torildssondennis@gmail.com
    // In production, you'd want to store admin emails somewhere accessible
    
    const adminEmail = "torildssondennis@gmail.com"; // Primary admin

    const stars = "⭐".repeat(rating);

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
                  <!-- Logo -->
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #16a34a, #22c55e); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                        <span style="font-size: 24px;">🌿</span>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Content Card -->
                  <tr>
                    <td style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                      <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #18181b; text-align: center;">
                        📝 Ny recension att granska
                      </h1>
                      <p style="margin: 0 0 24px; font-size: 14px; color: #71717a; text-align: center;">
                        En kund har lämnat en recension som väntar på godkännande.
                      </p>
                      
                      <!-- Review Details -->
                      <div style="background: #f4f4f5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                        <p style="margin: 0 0 12px; font-size: 14px; color: #71717a;">
                          <strong style="color: #18181b;">Produkt:</strong> ${productTitle}
                        </p>
                        <p style="margin: 0 0 12px; font-size: 14px; color: #71717a;">
                          <strong style="color: #18181b;">Betyg:</strong> ${stars} (${rating}/5)
                        </p>
                        <p style="margin: 0 0 12px; font-size: 14px; color: #71717a;">
                          <strong style="color: #18181b;">Från:</strong> ${userEmail}
                        </p>
                        <p style="margin: 0; font-size: 14px; color: #71717a;">
                          <strong style="color: #18181b;">Recension:</strong>
                        </p>
                        <p style="margin: 8px 0 0; font-size: 14px; color: #18181b; font-style: italic;">
                          "${comment}"
                        </p>
                      </div>
                      
                      <!-- CTA Button -->
                      <a href="https://4thepeople.se/profile?tab=overview" 
                         style="display: block; width: 100%; padding: 14px; background: linear-gradient(135deg, #16a34a, #22c55e); color: white; text-align: center; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 14px; box-sizing: border-box;">
                        Granska i Admin-panelen
                      </a>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
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
        subject: `📝 Ny recension att granska: ${productTitle}`,
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
