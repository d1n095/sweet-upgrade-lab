// Shipmondo API v3 client (Node.js)

const user = process.env.SHIPMONDO_API_USER;
const key = process.env.SHIPMONDO_API_KEY;

if (!user || !key) {
  throw new Error("SHIPMONDO_API_USER and SHIPMONDO_API_KEY must be configured");
}

export interface ShipmondoOrder {
  shippingMethod?: string;
  weight_in_grams?: number;
  customer: {
    name: string;
    address: string;
    zipcode: string;
    city: string;
    email: string;
  };
}

export interface ShipmentResult {
  shipment_id: string | null;
  tracking_number: string | null;
  label_url: string | null;
}

function getServiceCode(method: string): string {
  if (method === "pickup_point") return "GLS_PAKKESHOP";
  if (method === "home_delivery") return "UPS_STANDARD";
  return "GLS_PAKKESHOP";
}

async function callWithRetry(
  payload: unknown,
  authHeader: string,
  attempt = 0,
): Promise<any> {
  const resp = await fetch("https://app.shipmondo.com/api/public/v3/shipments", {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const details = await resp.text();
    if (attempt < 2) {
      return callWithRetry(payload, authHeader, attempt + 1);
    }
    throw new Error(`Shipmondo API error ${resp.status}: ${details}`);
  }

  return resp.json();
}

export async function createShipment(order: ShipmondoOrder): Promise<ShipmentResult> {
  const authHeader = `Basic ${Buffer.from(`${user}:${key}`).toString("base64")}`;

  const payload = {
    shipment: {
      service_code: getServiceCode(order.shippingMethod || ""),
      sender: {
        name: "4ThePeople",
        address1: "YOUR_ADDRESS",
        zipcode: "11122",
        city: "Stockholm",
        country_code: "SE",
      },
      receiver: {
        name: order.customer.name,
        address1: order.customer.address,
        zipcode: order.customer.zipcode,
        city: order.customer.city,
        country_code: "SE",
        email: order.customer.email,
      },
      parcels: [{ weight: order.weight_in_grams || 1000 }],
    },
  };

  console.log("Shipmondo request:", payload);

  const data = await callWithRetry(payload, authHeader);

  console.log("Shipmondo response:", data);

  return {
    shipment_id: data.shipment_id || data.id || null,
    tracking_number: data.pkg_no || data.tracking_number || null,
    label_url: data.labels?.[0]?.base64
      ? `data:application/pdf;base64,${data.labels[0].base64}`
      : data.labels?.[0]?.file_url || null,
  };
}
