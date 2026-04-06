import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const shipmondoUser = Deno.env.get("SHIPMONDO_API_USER");
    const shipmondoKey = Deno.env.get("SHIPMONDO_API_KEY");

    // Verify caller is staff
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    // Check staff role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const staffRoles = [
      "admin",
      "founder",
      "it",
      "moderator",
      "warehouse",
      "manager",
    ];
    const isStaff = roles?.some((r: any) => staffRoles.includes(r.role));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order
    const { data: order, error: orderErr } = await adminClient
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .is("deleted_at", null)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate payment
    if (order.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ error: "Order not paid – cannot pack" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prevent double shipment
    if (
      order.fulfillment_status === "shipped" ||
      (order.fulfillment_status === "packed" && order.tracking_number)
    ) {
      return new Response(
        JSON.stringify({
          error: "Shipment already created",
          tracking_number: order.tracking_number,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let tracking_number: string | null = null;
    let label_url: string | null = null;
    let carrier = "postnord";
    let shipmondo_used = false;

    // Try Shipmondo API if both user and key are configured
    if (shipmondoUser && shipmondoKey) {
      try {
        const addr = order.shipping_address as any;
        const shipmentPayload = {
          own_agreement: true,
          label_format: "a4_pdf",
          product_code: "MYPACK_HOME",
          service_codes: "EMAIL_NT,SMS_NT",
          sender: {
            name: "Naturligt Snygg",
            address1: "Företagsvägen 1",
            zipcode: "11122",
            city: "Stockholm",
            country_code: "SE",
            email: "info@naturligtsnygg.se",
          },
          receiver: {
            name: addr?.name || order.order_email,
            address1: addr?.address || "",
            zipcode: addr?.zip || "",
            city: addr?.city || "",
            country_code: addr?.country || "SE",
            email: order.order_email,
            mobile: addr?.phone || "",
          },
          parcels: [{ weight: 1000 }],
        };

        const shipmondoResp = await fetch(
          "https://app.shipmondo.com/api/public/v3/shipments",
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(shipmondoUser + ":" + shipmondoKey)}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(shipmentPayload),
          }
        );

        if (shipmondoResp.ok) {
          const shipData = await shipmondoResp.json();
          tracking_number = shipData.pkg_no || shipData.shipment_id || null;
          label_url = shipData.labels?.[0]?.base64
            ? `data:application/pdf;base64,${shipData.labels[0].base64}`
            : shipData.labels?.[0]?.file_url || null;
          carrier = shipData.carrier_code || "postnord";
          shipmondo_used = true;
        } else {
          const errBody = await shipmondoResp.text();
          console.error("Shipmondo API error:", shipmondoResp.status, errBody);
          // Fall through to manual flow
        }
      } catch (apiErr) {
        console.error("Shipmondo call failed:", apiErr);
      }
    }

    // Update order: mark as packed with shipment data
    const existingHistory = Array.isArray(order.status_history)
      ? order.status_history
      : [];
    const newHistory = [
      ...existingHistory,
      {
        status: "packed",
        timestamp: new Date().toISOString(),
        note: shipmondo_used
          ? "Packad & frakt skapad via Shipmondo"
          : "Packad (Shipmondo ej konfigurerad)",
      },
    ];

    const updateData: Record<string, any> = {
      fulfillment_status: "packed",
      packed_at: new Date().toISOString(),
      packed_by: userId,
      status: "processing",
      status_history: newHistory,
    };

    if (tracking_number) updateData.tracking_number = tracking_number;

    const { error: updateErr } = await adminClient
      .from("orders")
      .update(updateData)
      .eq("id", order_id);

    if (updateErr) {
      console.error("DB update error:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to update order" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log activity
    await adminClient.from("activity_logs").insert({
      log_type: "success",
      category: "fulfillment",
      message: shipmondo_used
        ? `Order packad & frakt skapad via Shipmondo`
        : `Order packad (Shipmondo ej konfigurerad)`,
      order_id: order_id,
      user_id: userId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        tracking_number,
        label_url,
        carrier,
        shipmondo_used,
        fulfillment_status: "packed",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("create-shipment error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
