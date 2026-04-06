/**
 * Shipmondo API v3 – modular shipping service
 *
 * Auth:   Basic Auth  →  base64(SHIPMONDO_API_USER:SHIPMONDO_API_KEY)
 * Endpoint: POST https://app.shipmondo.com/api/public/v3/shipments
 */

export interface ShipmondoAddress {
  name: string;
  address1: string;
  zipcode: string;
  city: string;
  country_code: string;
  email?: string;
  mobile?: string;
}

export interface ShipmondoParcel {
  weight: number; // grams
}

export interface ShipmondoShipmentInput {
  service_code: string;
  sender: ShipmondoAddress;
  receiver: ShipmondoAddress;
  parcels: ShipmondoParcel[];
}

export interface ShipmondoResult {
  shipment_id: string | null;
  tracking_number: string | null;
  label_url: string | null;
  carrier_code: string | null;
}

/**
 * Map an order's shipping_method to a Shipmondo service code.
 *   "pickup_point"   → DHL Service Point (DHLF_SP)
 *   "home_delivery"  → UPS Standard      (UPSS)
 *   <anything else>  → DHL Service Point (safe default)
 */
export function resolveServiceCode(shippingMethod?: string | null): string {
  if (shippingMethod === "home_delivery") return "UPSS";
  return "DHLF_SP"; // pickup_point and all other methods → DHL Service Point
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a Shipmondo shipment with automatic retry (up to maxRetries) and
 * a per-request timeout.
 *
 * Credentials are read exclusively from environment variables:
 *   SHIPMONDO_API_USER  – API username
 *   SHIPMONDO_API_KEY   – API password / key
 */
export async function createShipmondoShipment(
  input: ShipmondoShipmentInput,
  maxRetries = 2,
  timeoutMs = 10_000,
): Promise<ShipmondoResult> {
  const apiUser = Deno.env.get("SHIPMONDO_API_USER");
  const apiKey = Deno.env.get("SHIPMONDO_API_KEY");

  if (!apiUser || !apiKey) {
    throw new Error(
      "Shipmondo credentials not configured – set SHIPMONDO_API_USER and SHIPMONDO_API_KEY",
    );
  }

  const credentials = btoa(`${apiUser}:${apiKey}`);
  const payload = JSON.stringify({ shipment: input });

  let lastError: Error = new Error("Shipmondo: unreachable");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`[shipmondo] Retry ${attempt}/${maxRetries} …`);
      // small exponential back-off: 500 ms, 1000 ms
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }

    try {
      const resp = await fetchWithTimeout(
        "https://app.shipmondo.com/api/public/v3/shipments",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: payload,
        },
        timeoutMs,
      );

      if (resp.ok) {
        const data = await resp.json();
        const shipment_id =
          data.id?.toString() ?? data.shipment_id?.toString() ?? null;
        const tracking_number = data.pkg_no ?? data.tracking_number ?? null;
        const label_url = data.labels?.[0]?.base64
          ? `data:application/pdf;base64,${data.labels[0].base64}`
          : (data.labels?.[0]?.file_url ?? null);
        const carrier_code = data.carrier_code ?? null;

        console.log(
          `[shipmondo] Shipment created: id=${shipment_id} tracking=${tracking_number}`,
        );
        return { shipment_id, tracking_number, label_url, carrier_code };
      }

      const errBody = await resp.text();
      console.error(`[shipmondo] API error ${resp.status}: ${errBody}`);

      // 4xx = client error – do not retry
      if (resp.status >= 400 && resp.status < 500) {
        throw new Error(
          `Shipmondo client error ${resp.status}: ${errBody}`,
        );
      }

      lastError = new Error(`Shipmondo server error ${resp.status}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Propagate client errors immediately
      if (msg.includes("client error")) throw err;
      console.error(`[shipmondo] Request failed (attempt ${attempt}): ${msg}`);
      lastError = err instanceof Error ? err : new Error(msg);
    }
  }

  throw lastError;
}
