import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Rule-based review — no AI gateway.
 * Verifies work items based on resolution notes and completion status.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { work_item_id } = await req.json();
    if (!work_item_id) throw new Error("work_item_id required");

    const { data: item, error: fetchError } = await supabase
      .from("work_items")
      .select("id, title, resolution_notes, status, completed_at, source_type, source_id")
      .eq("id", work_item_id)
      .maybeSingle();

    if (fetchError || !item) {
      throw new Error(fetchError?.message || "Work item not found");
    }

    const hasResolution = !!item.resolution_notes && item.resolution_notes.trim().length > 0;
    const isDone = item.status === "done" && !!item.completed_at;

    const reviewResult = {
      status: (hasResolution || isDone) ? "verified" : "needs_review",
      verdict: hasResolution
        ? "Regelbaserad verifiering: resolution notes finns"
        : isDone
          ? "Regelbaserad verifiering: uppgift klarmarkerad"
          : "Kräver manuell granskning",
      confidence: hasResolution ? 70 : isDone ? 60 : 30,
      risks: [] as string[],
      edge_cases: [] as string[],
    };

    await supabase
      .from("work_items")
      .update({
        ai_review_status: reviewResult.status,
        ai_review_result: reviewResult,
        ai_review_at: new Date().toISOString(),
      })
      .eq("id", work_item_id);

    return new Response(JSON.stringify({
      ok: true,
      status: reviewResult.status,
      review: reviewResult,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[review-fix] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
