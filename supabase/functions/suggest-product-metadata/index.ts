import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // AI metadata suggestions are disabled — assign categories and tags manually.
  return new Response(
    JSON.stringify({ error: "AI metadata suggestions are disabled. Please assign categories and tags manually." }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
