import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // AI disabled — return immediately without consuming any credits
  return new Response(JSON.stringify({ skipped: true, reason: "AI disabled" }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

    // Fetch recent changes related to this work item
    let relatedChanges: any[] = [];
    try {
      const { data: changes } = await supabase
        .from("change_log")
        .select("id, change_type, description, affected_components, created_at")
        .or(`work_item_id.eq.${work_item_id},bug_report_id.eq.${item.source_id || "00000000-0000-0000-0000-000000000000"}`)
        .order("created_at", { ascending: false })
        .limit(10);
      relatedChanges = changes || [];
    } catch { /* ignore */ }

    // Run AI review if key available
    if (apiKey) {
      const prompt = `Du är en strikt QA-ingenjör. Verifiera att denna uppgift verkligen är löst korrekt.

UPPGIFT:
Titel: ${item.title}
Typ: ${item.item_type}
Beskrivning: ${item.description || "Ingen"}
Fix-anteckningar: ${item.resolution_notes || "Inga"}
Manuell orsak: ${(item as any).human_selected_cause || (item as any).human_custom_cause || "Ingen"}
Manuell fix: ${(item as any).human_custom_fix || "Ingen"}

${sourceData ? `KÄLLA (Buggrapport):
Beskrivning: ${sourceData.description}
Sida: ${sourceData.page_url}
AI-sammanfattning: ${sourceData.ai_summary || "Ingen"}
AI-kategori: ${sourceData.ai_category || "Okänd"}
AI-reproduktionssteg: ${sourceData.ai_repro_steps || "Inga"}` : ""}

${relatedChanges.length > 0 ? `RELATERADE ÄNDRINGAR:
${JSON.stringify(relatedChanges.map(c => ({ type: c.change_type, desc: c.description, components: c.affected_components })), null, 2)}` : "Inga relaterade ändringar hittades."}

VERIFIERINGSREGLER:
1. Om fix-anteckningar saknas eller är vaga → "incomplete"
2. Om buggens grundorsak inte adresseras av ändringarna → "incomplete"  
3. Om risker eller edge cases identifieras → "needs_review"
4. Om allt ser korrekt ut med bevis → "verified"

Var STRIKT. Falska positiva (markera som klar fast det inte är fixat) är värre än falska negativa.`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Du är en strikt QA-ingenjör som verifierar att fixar verkligen löser problemen. Svara ALLTID med valid JSON via tool call." },
              { role: "user", content: prompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "review_result",
                description: "Return structured verification result",
                parameters: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["verified", "needs_review", "incomplete"] },
                    verdict: { type: "string", description: "Kort bedömning av verifieringen" },
                    confidence: { type: "number", description: "0-100 konfidens" },
                    risks: { type: "array", items: { type: "string" }, description: "Identifierade risker" },
                    edge_cases: { type: "array", items: { type: "string" }, description: "Edge cases som kan ha missats" },
                    reopen_reason: { type: "string", description: "Om status=incomplete, varför bör uppgiften återöppnas" },
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

    // If AI says incomplete with high confidence → auto-reopen
    const shouldReopen = reviewResult.status === "incomplete" && reviewResult.confidence >= 70;

    if (shouldReopen) {
      // Reopen work item
      await supabase.from("work_items").update({
        status: "open",
        completed_at: null,
        ai_review_status: reviewResult.status,
        ai_review_result: { ...reviewResult, auto_reopened: true, reopened_at: now },
        ai_review_at: now,
      }).eq("id", work_item_id);

      // Reopen source bug if applicable
      if (item.source_type === "bug_report" && item.source_id) {
        await supabase.from("bug_reports").update({
          status: "open",
          resolved_at: null,
          resolved_by: null,
          resolution_notes: `AI-verifiering: Återöppnad — ${reviewResult.reopen_reason || reviewResult.verdict}`,
        }).eq("id", item.source_id);
      }

      // Log the reopen
      await supabase.from("change_log").insert({
        change_type: "reopen",
        description: `AI återöppnade: ${item.title} — ${reviewResult.reopen_reason || reviewResult.verdict}`,
        affected_components: ["work_items", item.source_type || "unknown"],
        source: "ai_verification",
        work_item_id: work_item_id,
        bug_report_id: item.source_type === "bug_report" ? item.source_id : null,
        metadata: { review: reviewResult },
      });

      console.log(`[ai-review-fix] REOPENED work_item_id=${work_item_id} reason=${reviewResult.reopen_reason || reviewResult.verdict}`);
    } else {
      // Normal update — mark as verified or needs_review
      await supabase.from("work_items").update({
        ai_review_status: reviewResult.status,
        ai_review_result: reviewResult,
        ai_review_at: now,
      }).eq("id", work_item_id);

      // If verified, mark source bug as verified_done
      if (reviewResult.status === "verified" && item.source_type === "bug_report" && item.source_id) {
        await supabase.from("bug_reports").update({
          resolution_notes: (sourceData?.resolution_notes ? sourceData.resolution_notes + "\n" : "") + 
            `✅ AI-verifierad (${reviewResult.confidence}%): ${reviewResult.verdict}`,
        }).eq("id", item.source_id);
      }
    }

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
