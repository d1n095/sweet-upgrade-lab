import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguages: string[];
  context?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, sourceLanguage = "sv", targetLanguages, context = "e-commerce product/category" } = await req.json() as TranslationRequest;

    if (!text || !targetLanguages || targetLanguages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: text and targetLanguages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const languageNames: Record<string, string> = {
      sv: "Swedish",
      en: "English",
      no: "Norwegian",
      da: "Danish",
      de: "German",
      fi: "Finnish",
      nl: "Dutch",
      fr: "French",
      es: "Spanish",
      pl: "Polish",
    };

    const targetLangList = targetLanguages
      .map((code) => `${code} (${languageNames[code] || code})`)
      .join(", ");

    const systemPrompt = `You are a professional translator for an eco-friendly e-commerce store. 
Translate the given text from ${languageNames[sourceLanguage] || sourceLanguage} to the requested languages.
Context: ${context}
Keep translations natural, concise, and appropriate for ${context}.
Return ONLY a valid JSON object with language codes as keys and translations as values.
Do not include any markdown formatting or code blocks.`;

    const userPrompt = `Translate this text to ${targetLangList}:
"${text}"

Return JSON format like: {"en": "translation", "no": "translation", ...}`;

    console.log("Calling Lovable AI for translation...");
    
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
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response content:", content);

    // Parse the JSON from the response, handling potential markdown formatting
    let translations: Record<string, string>;
    try {
      // Remove potential markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      translations = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse translation response");
    }

    // Include the source text
    translations[sourceLanguage] = text;

    console.log("Translations completed:", Object.keys(translations));

    return new Response(
      JSON.stringify({ translations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
