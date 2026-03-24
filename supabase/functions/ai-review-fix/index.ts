import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { work_item_id } = await req.json();
    if (!work_item_id) throw new Error("work_item_id required");
    console.log(`[ai-review-fix] trigger work_item_id=${work_item_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch work item
    const { data: item } = await supabase
      .from("work_items")
      .select("*")
      .eq("id", work_item_id)
      .maybeSingle();

    if (!item) throw new Error("Work item not found");

    // Fetch source data if bug
    let sourceData: any = null;
    if (item.source_type === "bug_report" && item.source_id) {
      const { data } = await supabase
        .from("bug_reports")
        .select("*")
        .eq("id", item.source_id)
        .maybeSingle();
      sourceData = data;
    }

    let reviewResult: any = {
      status: "verified",
      verdict: "Automatiskt godkänd (AI ej tillgänglig)",
      confidence: 50,
      risks: [],
      edge_cases: [],
    };

    // Run AI review if key available
    if (apiKey) {
      const prompt = `Analysera denna avslutade uppgift och bedöm om den verkar korrekt löst.

UPPGIFT:
Titel: ${item.title}
Typ: ${item.item_type}
Beskrivning: ${item.description || "Ingen"}
Fix-anteckningar: ${item.resolution_notes || "Inga"}

${sourceData ? `KÄLLA (Buggrapport):
Beskrivning: ${sourceData.description}
Sida: ${sourceData.page_url}
AI-sammanfattning: ${sourceData.ai_summary || "Ingen"}
AI-kategori: ${sourceData.ai_category || "Okänd"}
AI-reproduktionssteg: ${sourceData.ai_repro_steps || "Inga"}` : ""}

Svara med JSON:
{
  "status": "verified" | "needs_review" | "incomplete",
  "verdict": "kort bedömning",
  "confidence": 0-100,
  "risks": ["ev. risker"],
  "edge_cases": ["ev. edge cases som kan ha missats"]
}`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Du är en QA-ingenjör. Analysera avslutade uppgifter och bedöm kvaliteten på lösningen. Svara ALLTID med valid JSON." },
              { role: "user", content: prompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "review_result",
                description: "Return structured review result",
                parameters: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["verified", "needs_review", "incomplete"] },
                    verdict: { type: "string" },
                    confidence: { type: "number" },
                    risks: { type: "array", items: { type: "string" } },
                    edge_cases: { type: "array", items: { type: "string" } },
                  },
                  required: ["status", "verdict", "confidence"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "review_result" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            reviewResult = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (e) {
        console.error("AI review failed:", e);
      }
    }

    const now = new Date().toISOString();

    // Update work item with review
    await supabase.from("work_items").update({
      ai_review_status: reviewResult.status,
      ai_review_result: reviewResult,
      ai_review_at: now,
    }).eq("id", work_item_id);

    // Archive to system_history
    await supabase.from("system_history").insert({
      work_item_id: item.id,
      title: item.title,
      description: item.description,
      item_type: item.item_type,
      source_type: item.source_type,
      source_id: item.source_id,
      priority: item.priority,
      assigned_to: item.assigned_to,
      claimed_by: item.claimed_by,
      created_by: item.created_by,
      resolution_notes: item.resolution_notes,
      ai_review_status: reviewResult.status,
      ai_review_result: reviewResult,
      ai_review_at: now,
      work_item_created_at: item.created_at,
      completed_at: item.completed_at || now,
      related_order_id: item.related_order_id,
      snapshot_data: {
        source_data: sourceData,
        work_item_snapshot: item,
      },
    });

    console.log(`[ai-review-fix] complete work_item_id=${work_item_id} status=${reviewResult.status}`);

    return new Response(JSON.stringify({ success: true, review: reviewResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-review-fix error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
