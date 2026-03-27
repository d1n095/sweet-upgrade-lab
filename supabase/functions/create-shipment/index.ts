import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  createShipmondoShipment,
  resolveServiceCode,
} from "../_shared/shipmondo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STAFF_ROLES = ["admin", "founder", "it", "moderator", "warehouse", "manager"];

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

    // Verify caller is staff via JWT claims
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isStaff = roles?.some((r: any) => STAFF_ROLES.includes(r.role));
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
        },
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
          shipmondo_shipment_id: order.shipmondo_shipment_id ?? null,
          label_url: order.label_url ?? null,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const addr = order.shipping_address as any ?? {};
    const shippingMethod: string | null = order.shipping_method ?? null;
    const serviceCode = resolveServiceCode(shippingMethod);

    let tracking_number: string | null = null;
    let label_url: string | null = null;
    let shipmondo_shipment_id: string | null = null;
    let carrier: string | null = null;
    let shipmondo_used = false;

    // Call Shipmondo API (credentials come from env only)
    try {
      const result = await createShipmondoShipment(
        {
          service_code: serviceCode,
          sender: {
            name: Deno.env.get("STORE_NAME") || "4ThePeople",
            address1: Deno.env.get("STORE_ADDRESS") || "Företagsvägen 1",
            zipcode: Deno.env.get("STORE_ZIPCODE") || "11122",
            city: Deno.env.get("STORE_CITY") || "Stockholm",
            country_code: Deno.env.get("STORE_COUNTRY_CODE") || "SE",
          },
          receiver: {
            name: addr.name || order.order_email,
            address1: addr.address || "",
            zipcode: addr.zip || "",
            city: addr.city || "",
            country_code: addr.country || "SE",
            email: order.order_email,
            mobile: addr.phone || "",
          },
          parcels: [{ weight: order.weight_in_grams ?? 1000 }],
        },
        2, // maxRetries
      );

      tracking_number = result.tracking_number;
      label_url = result.label_url;
      shipmondo_shipment_id = result.shipment_id;
      carrier = result.carrier_code;
      shipmondo_used = true;
    } catch (apiErr: unknown) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      console.error("[create-shipment] Shipmondo call failed:", msg);
      // Continue to update the order as packed even without Shipmondo data
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
          ? `Packad & frakt skapad via Shipmondo (${serviceCode})`
          : "Packad (Shipmondo ej konfigurerad eller ej tillgänglig)",
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
    if (shipmondo_shipment_id) updateData.shipmondo_shipment_id = shipmondo_shipment_id;
    if (label_url) updateData.label_url = label_url;
    if (carrier) updateData.shipping_method = carrier;

    const { error: updateErr } = await adminClient
      .from("orders")
      .update(updateData)
      .eq("id", order_id);

    if (updateErr) {
      console.error("[create-shipment] DB update error:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to update order" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Log activity
    await adminClient.from("activity_logs").insert({
      log_type: "success",
      category: "fulfillment",
      message: shipmondo_used
        ? `Order packad & frakt skapad via Shipmondo (${serviceCode})`
        : `Order packad (Shipmondo ej tillgänglig)`,
      order_id: order_id,
      user_id: userId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        shipmondo_used,
        shipmondo_shipment_id,
        tracking_number,
        label_url,
        carrier,
        service_code: serviceCode,
        fulfillment_status: "packed",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[create-shipment] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
