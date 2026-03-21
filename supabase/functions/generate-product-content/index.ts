import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: require valid JWT
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { productName, category, ingredients, existingData, language } = await req.json();

    if (!productName) {
      return new Response(JSON.stringify({ error: "productName is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = language === "en" ? "English" : "Swedish";
    const ingredientInfo = ingredients ? `\nIngredients/Materials: ${ingredients}` : "";
    const categoryInfo = category ? `\nCategory: ${category}` : "";
    const existingInfo = existingData
      ? `\nExisting product data for context: ${JSON.stringify(existingData)}`
      : "";

    const systemPrompt = `You are an elite conversion copywriter for a Swedish natural/organic products brand called 4ThePeople. Write in ${lang}. Your ONLY goal is to make people BUY. Use psychological triggers: simplicity, instant results, safety, sensory language. Short punchy sentences. No fluff. No long paragraphs. The brand values sustainability, quality, and Nordic craftsmanship.

Return a JSON object with these exact keys:

- hook: A powerful one-liner that immediately communicates the product's #1 benefit. Max 60 chars. Think: "Opens your airways in seconds" or "Pure calm in every drop". This is the FIRST thing the customer sees.

- description: A short sales-focused description (2-3 sentences, max 200 chars). Create desire and urgency. Focus on what the customer GETS, not what the product IS.

- extended_description: A storytelling description (3-5 sentences). Paint the experience. How does the customer's life improve? What ritual does this create? Make them FEEL it.

- effects: Benefits as newline-separated bullet points (4-5 points). Each bullet should be scannable, concrete, and start with an action/result. Example: "✓ Öppnar luftvägarna direkt", NOT "Kan hjälpa med andning".

- feeling: A sensory/emotional description (1-2 sentences). What does it smell/feel/taste like? What emotion does it trigger? Use vivid sensory language.

- usage: Step-by-step usage instructions. Simple, numbered. Example: "1. Tillsätt 2-3 kristaller i bastun. 2. Andas djupt. 3. Känn effekten direkt." Max 3 steps.

- trust_badges: A comma-separated list of 3-4 trust signals. Examples: "100% Naturlig", "Handgjord i Sverige", "Snabb leverans", "Säker att använda".

- upsell_text: A short suggestion for complementary products (1 sentence). Example: "Kombinera med vår bastudoft för en komplett upplevelse."

- seo_title: SEO-optimized page title (max 60 chars). Format: "Product Name + benefit keyword | 4thepeople"
- meta_description: SEO meta description (max 155 chars). Compelling, includes main keyword and call-to-action.
- meta_keywords: 6-8 relevant SEO keywords, comma-separated. Include product name, category, key ingredients, and intent words like "köp" or "bästa".

RULES:
- Every sentence must earn its place. If it doesn't sell, cut it.
- Use "du/din" (you/your) to speak directly to the customer.
- Include at least one psychological trigger per section (simplicity, speed, safety, social proof).
- All text in ${lang}. Premium but approachable tone.`;

    const userPrompt = `Generate conversion-optimized product content for:
Product name: ${productName}${categoryInfo}${ingredientInfo}${existingInfo}

Remember: The goal is SALES. Make the customer feel they NEED this product.
Return ONLY valid JSON, no markdown fences.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    // Parse JSON from the response, stripping markdown fences if present
    const jsonStr = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let content;
    try {
      content = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", raw);
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-product-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
