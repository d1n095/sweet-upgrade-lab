import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const systemPrompt = `You are a professional e-commerce copywriter for a Swedish natural/organic products brand called 4ThePeople. Write in ${lang}. Be natural, sales-focused but not spammy. Use a warm, authentic tone. The brand values sustainability, quality, and Nordic craftsmanship.

Return a JSON object with these exact keys:
- description: A compelling product description (2-3 sentences, max 200 chars)
- extended_description: A longer storytelling description (3-5 sentences, focuses on experience and philosophy)
- effects: Benefits/effects as newline-separated bullet points (3-5 points)
- feeling: A sensory/emotional description of the product experience (1-2 sentences)
- usage: Clear usage instructions (1-2 sentences)
- seo_title: SEO-optimized page title (max 60 chars). Format: "Product Name + Category + 1-2 modifiers (e.g. naturlig, premium) | 4thepeople"
- meta_description: SEO meta description (max 155 chars). Compelling, includes main keyword and call-to-action.
- meta_keywords: 6-8 relevant SEO keywords, comma-separated. Include product name, category, key ingredients, and intent words like "köp" or "bästa".

All text should be in ${lang}. Make it feel premium but approachable.`;

    const userPrompt = `Generate product content for:
Product name: ${productName}${categoryInfo}${ingredientInfo}${existingInfo}

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
