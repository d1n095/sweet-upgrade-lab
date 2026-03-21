import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
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

      const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:se&language=sv&key=${apiKey}`;
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

      const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=address_components,formatted_address&language=sv&key=${apiKey}`;
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
