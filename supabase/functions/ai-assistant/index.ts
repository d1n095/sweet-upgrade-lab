import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AI-assistant endpoint — permanently disabled.
 * All AI functionality has been replaced with deterministic scanners.
 * Returns 403 for any non-OPTIONS request.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.error("[ai-assistant] BLOCKED — AI is disabled. Use run-full-scan instead.");

  return new Response(
    JSON.stringify({
      error: "AI assistant is disabled. Use the scanner engine (run-full-scan) instead.",
      code: "AI_DISABLED",
    }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
