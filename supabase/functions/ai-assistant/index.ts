import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * AI assistant is disabled. Returns a static message.
 * All scanning is handled by run-full-scan.
 * All task management is handled by ai-task-manager (rule-based).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return new Response(JSON.stringify({
    message: "Denna funktion är avaktiverad. Använd Scan Center för skanningar.",
    disabled: true,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
