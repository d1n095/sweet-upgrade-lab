import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: require valid JWT
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    const { createClient: createAuthClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const authSupabase = createAuthClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data } = await authSupabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!data?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  try {
    const { texts, targetLang, productId } = await req.json();

    if (!texts || !targetLang || typeof texts !== "object") {
      return new Response(JSON.stringify({ error: "Missing texts or targetLang" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Don't translate if target is Swedish
    if (targetLang === "sv") {
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check DB cache first (if productId provided)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    if (productId) {
      const { data: cached } = await sb
        .from("product_translation_cache")
        .select("translated_fields")
        .eq("product_id", productId)
        .eq("language_code", targetLang)
        .maybeSingle();

      if (cached?.translated_fields && Object.keys(cached.translated_fields).length > 0) {
        return new Response(JSON.stringify({ translations: cached.translated_fields, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const langNames: Record<string, string> = {
      en: "English", no: "Norwegian", da: "Danish", fi: "Finnish",
      de: "German", fr: "French", es: "Spanish", nl: "Dutch",
      pt: "Portuguese", it: "Italian", pl: "Polish", ja: "Japanese",
      ko: "Korean", zh: "Chinese",
    };
    const langName = langNames[targetLang] || targetLang;

    const entries = Object.entries(texts).filter(([_, v]) => v && String(v).trim());
    if (entries.length === 0) {
      return new Response(JSON.stringify({ translations: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jsonInput = JSON.stringify(Object.fromEntries(entries));

    const systemPrompt = `You are a professional product translator for an e-commerce store. Translate the provided JSON values from Swedish to ${langName}. Keep the JSON keys exactly the same. Only translate the values. Maintain product marketing tone, keep brand names untranslated. Return ONLY valid JSON, no markdown or extra text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: jsonInput },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Translation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let jsonStr = rawContent.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const translations = JSON.parse(jsonStr);

      // Save to DB cache (fire-and-forget)
      if (productId) {
        sb.from("product_translation_cache")
          .upsert({
            product_id: productId,
            language_code: targetLang,
            translated_fields: translations,
          }, { onConflict: "product_id,language_code" })
          .then(() => {})
          .catch((err: unknown) => console.error("Cache save error:", err));
      }

      return new Response(JSON.stringify({ translations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      console.error("Failed to parse AI response:", jsonStr);
      return new Response(JSON.stringify({ translations: Object.fromEntries(entries) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("translate-product error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});