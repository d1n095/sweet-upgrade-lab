import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── AI-REVIEW-FIX: DISABLED — AI removed from system ──
// All reviews are now deterministic rule-based checks via run-full-scan.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve((_req) => {
  if (_req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: "AI_DISABLED",
      message: "AI review is disabled. Use rule-based scan results from run-full-scan.",
      review: {
        status: "needs_review",
        verdict: "Rule-based review required — AI disabled",
        confidence: 0,
        mode: "rule_based",
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
