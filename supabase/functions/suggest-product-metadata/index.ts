import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: require admin/founder/it role
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = roles?.some((r: any) => ["admin", "founder", "it"].includes(r.role));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Unauthorized: admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, supabaseKey);

    const { productName, description, ingredients } = await req.json();
    if (!productName) {
      return new Response(JSON.stringify({ error: "productName required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing categories and tags for context
    const [catRes, tagRes] = await Promise.all([
      db.from("categories").select("id, name_sv, slug, parent_id").order("display_order"),
      db.from("product_tags").select("id, name_sv, slug").order("display_order"),
    ]);

    const categories = catRes.data || [];
    const tags = tagRes.data || [];

    const catList = categories.map(c => `${c.id}|${c.name_sv}`).join("\n");
    const tagList = tags.map(t => `${t.id}|${t.name_sv}`).join("\n");

    const systemPrompt = `You are a product metadata assistant for a Swedish natural/organic products brand. Given a product name, description, and ingredients, suggest the most relevant categories and tags from the provided lists. Return JSON only.`;

    const userPrompt = `Product: ${productName}
${description ? `Description: ${description}` : ""}
${ingredients ? `Ingredients: ${ingredients}` : ""}

Available categories (id|name):
${catList}

Available tags (id|name):
${tagList}

Return a JSON object with:
- "categoryIds": array of category IDs that fit this product (1-4 max)
- "tagIds": array of tag IDs that fit this product (2-6 max)
- "suggestedNewTags": array of tag name strings if none of the existing tags fit well (0-3 max, Swedish)

Return ONLY valid JSON, no markdown.`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI suggestion failed");
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const jsonStr = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let suggestions;
    try {
      suggestions = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse:", raw);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-product-metadata error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
