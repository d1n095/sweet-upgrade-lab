import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── AI-USER-MANAGEMENT: DISABLED — AI removed from system ──
// User management recommendations are now manual.

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
      message: "AI user management is disabled. Perform user role changes manually in the admin panel.",
      recommendations: [],
      summary: "AI-driven recommendations disabled. Manual review required.",
      mode: "rule_based",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
