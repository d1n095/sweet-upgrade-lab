import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * AI task manager — permanently disabled.
 * GitHub is the source of truth. No external AI services are used.
 * Returns 403 for any non-OPTIONS request.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.error("[ai-task-manager] BLOCKED — AI is disabled. GitHub controls code.");

  return new Response(
    JSON.stringify({
      error: "AI task manager is disabled. GitHub is the source of truth.",
      code: "AI_DISABLED",
    }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
