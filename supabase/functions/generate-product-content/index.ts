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
    return new Response(JSON.stringify({ error: "Ej tillgänglig" }), {
      status: 501,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

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
    const isConcentrate = existingData?.isConcentrate === true;

    const systemPrompt = `You are an elite conversion copywriter for a Swedish natural/organic products brand called 4ThePeople. Write in ${lang}. Your ONLY goal is to make people BUY while following a STRICT product content structure.

MANDATORY STRUCTURE — every product MUST follow this exact section order:

Return a JSON object with these exact keys:

1. "hook": A powerful one-liner that immediately communicates the product's #1 benefit. Max 60 chars. This is the FIRST thing the customer sees. Examples: "Öppnar luftvägarna direkt" or "Ren lugn i varje droppe".

2. "description": Short sales-focused description (2-3 sentences, max 200 chars). Focus on EFFECT + WHY it's good. Create desire.

3. "extended_description": Full product description (3-5 sentences). Start with the hook concept. Explain: what the product does, how it works, why it's better. Storytelling that sells.

4. "usage": Step-by-step usage instructions. Simple, numbered. ALWAYS include clear dosage. Example: "1. Tillsätt 2-3 kristaller i bastun. 2. Andas djupt. 3. Känn effekten direkt." Max 3-4 steps.

5. "dosage": Dosage & reach info. Include conversions (ml → drops etc.), how long the product lasts, recommended amounts. Example: "10ml = ca 200 droppar. 2-3 droppar per användning. Räcker ca 2-3 månader vid daglig användning."

6. "variants": If applicable, list scent/product variants with a short description per variant. Newline-separated. Example: "🌿 Eukalyptus – Fräsch och uppfriskande\\n🍊 Citrus – Energigivande och upplyftande". Leave empty string if not applicable.

7. "specifications": Product specifications as a JSON string with keys like "volume", "type", "base", "format". Example: {"volume": "10ml", "type": "Eterisk olja", "base": "100% ren", "format": "Glasflaska med droppkork"}

8. "effects": Benefits as newline-separated bullet points (4-5 points). Each must be scannable, concrete, start with result. Example: "✓ Öppnar luftvägarna direkt\\n✓ Renande och antiseptisk".

9. "storage": Storage instructions. Short and clear. Example: "Förvaras svalt och mörkt. Undvik direkt solljus. Hållbarhet: 24 månader efter öppning."

10. "safety": Safety warnings. MUST include correct usage warnings. Example: "Endast för utvärtes bruk. Undvik kontakt med ögon. ${isConcentrate ? 'VIKTIGT: Detta är ett koncentrat och ska ALLTID blandas med vatten före användning. ' : ''}Förvaras utom räckhåll för barn."

11. "feeling": Sensory/emotional description (1-2 sentences). What does it smell/feel like? What emotion does it trigger?

12. "seo_title": SEO page title (max 60 chars). Format: "Product Name + benefit | 4thepeople"
13. "meta_description": SEO meta description (max 155 chars). Compelling, includes keyword and CTA.
14. "meta_keywords": 6-8 relevant SEO keywords, comma-separated.

RULES:
- Every sentence must earn its place. If it doesn't sell, cut it.
- Use "du/din" to speak directly to the customer.
- No fluff. No filler paragraphs.
- Same structure EVERY time. No exceptions.
- Adapt text to product type but KEEP the structure.
- All text in ${lang}. Premium but approachable tone.
${isConcentrate ? '- CRITICAL: This product is a CONCENTRATE. You MUST clearly state in safety and usage that it must ALWAYS be diluted with water before use.' : ''}`;

    const userPrompt = `Generate standardized product content for:
Product name: ${productName}${categoryInfo}${ingredientInfo}${existingInfo}

Follow the EXACT structure. Return ONLY valid JSON, no markdown fences.`;

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
