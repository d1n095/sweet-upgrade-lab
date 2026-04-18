import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limit per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // max requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Security event logging via shared limiter (10 req / 10s)
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (await checkRateLimit(sb, req, "google-places")) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (_) { /* non-blocking */ }

  // Rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);
  if (entry && entry.resetAt > now) {
    entry.count++;
    if (entry.count > RATE_LIMIT) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_WINDOW_MS });
  }

  // Require at least anon key
  const authHeader = req.headers.get("Authorization") || "";
  const apiKey = req.headers.get("apikey") || "";
  if (!authHeader && !apiKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const googleApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!googleApiKey) {
    return new Response(JSON.stringify({ error: "Google Maps API key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "autocomplete") {
      const input = url.searchParams.get("input") || "";
      if (input.length < 2) {
        return new Response(JSON.stringify({ predictions: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:se&language=sv&key=${googleApiKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();

      return new Response(JSON.stringify({ predictions: data.predictions || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "details") {
      const placeId = url.searchParams.get("place_id") || "";
      if (!placeId) {
        return new Response(JSON.stringify({ error: "Missing place_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=address_components,formatted_address&language=sv&key=${googleApiKey}`;
      const res = await fetch(apiUrl);
      const data = await res.json();

      const result = data.result;
      if (!result) {
        return new Response(JSON.stringify({ error: "Place not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const components = result.address_components || [];
      let street = "";
      let streetNumber = "";
      let postalCode = "";
      let city = "";

      for (const c of components) {
        const types: string[] = c.types || [];
        if (types.includes("route")) street = c.long_name;
        if (types.includes("street_number")) streetNumber = c.long_name;
        if (types.includes("postal_code")) postalCode = c.long_name;
        if (types.includes("postal_town") || types.includes("locality")) city = c.long_name;
      }

      return new Response(JSON.stringify({
        address: streetNumber ? `${street} ${streetNumber}` : street,
        postal_code: postalCode,
        city,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Google Places error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
