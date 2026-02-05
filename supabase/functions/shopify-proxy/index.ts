import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOPIFY_API_VERSION = '2025-01';
const SHOPIFY_STORE_PERMANENT_DOMAIN = 'lovable-project-m6htx.myshopify.com';
const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
const SHOPIFY_ADMIN_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SHOPIFY_STOREFRONT_TOKEN = Deno.env.get('SHOPIFY_STOREFRONT_ACCESS_TOKEN');
    const SHOPIFY_ADMIN_TOKEN = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    
    if (!SHOPIFY_STOREFRONT_TOKEN) {
      console.error('SHOPIFY_STOREFRONT_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Shopify configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const body = await req.json();
    
    // Check if this is an action-based request (Admin API operations)
    if (body.action) {
      if (!SHOPIFY_ADMIN_TOKEN) {
        console.error('SHOPIFY_ACCESS_TOKEN not configured for admin operations');
        return new Response(
          JSON.stringify({ error: 'Shopify admin configuration error' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return handleAdminAction(body, SHOPIFY_ADMIN_TOKEN);
    }

    // Storefront GraphQL request
    const { query, variables } = body;

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid query parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const response = await fetch(SHOPIFY_STOREFRONT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: 'Payment required', code: 'PAYMENT_REQUIRED' }),
        { 
          status: 402, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!response.ok) {
      console.error(`Shopify API error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Shopify API error' }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleAdminAction(body: { action: string; productId?: string; data?: Record<string, unknown> }, adminToken: string) {
  const { action, productId, data } = body;

  try {
    switch (action) {
      case 'createProduct': {
        const response = await fetch(`${SHOPIFY_ADMIN_URL}/products.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': adminToken,
          },
          body: JSON.stringify({ product: data }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Create product error:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to create product', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await response.json();
        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateProduct': {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: 'Product ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const productPayload = {
          ...(data ?? {}),
          id: Number(productId),
        };

        const response = await fetch(`${SHOPIFY_ADMIN_URL}/products/${productId}.json`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': adminToken,
          },
          body: JSON.stringify({ product: productPayload }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Update product error:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to update product', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await response.json();
        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteProduct': {
        if (!productId) {
          return new Response(
            JSON.stringify({ error: 'Product ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(`${SHOPIFY_ADMIN_URL}/products/${productId}.json`, {
          method: 'DELETE',
          headers: {
            'X-Shopify-Access-Token': adminToken,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Delete product error:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to delete product', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateInventory': {
        // First get the inventory item ID for the variant
        const variantId = body.data?.variantId;
        const quantity = body.data?.quantity;
        
        if (!variantId || quantity === undefined) {
          return new Response(
            JSON.stringify({ error: 'Variant ID and quantity required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get the inventory item ID from the variant
        const variantResponse = await fetch(`${SHOPIFY_ADMIN_URL}/variants/${variantId}.json`, {
          headers: {
            'X-Shopify-Access-Token': adminToken,
          },
        });

        if (!variantResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to get variant' }),
            { status: variantResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const variantData = await variantResponse.json();
        const inventoryItemId = variantData.variant?.inventory_item_id;

        if (!inventoryItemId) {
          return new Response(
            JSON.stringify({ error: 'No inventory item found for variant' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get the location ID (we need at least one location)
        const locationsResponse = await fetch(`${SHOPIFY_ADMIN_URL}/locations.json`, {
          headers: {
            'X-Shopify-Access-Token': adminToken,
          },
        });

        if (!locationsResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to get locations' }),
            { status: locationsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const locationsData = await locationsResponse.json();
        const locationId = locationsData.locations?.[0]?.id;

        if (!locationId) {
          return new Response(
            JSON.stringify({ error: 'No location found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Set the inventory level
        const inventoryResponse = await fetch(`${SHOPIFY_ADMIN_URL}/inventory_levels/set.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': adminToken,
          },
          body: JSON.stringify({
            location_id: locationId,
            inventory_item_id: inventoryItemId,
            available: quantity,
          }),
        });

        if (!inventoryResponse.ok) {
          const errorText = await inventoryResponse.text();
          console.error('Update inventory error:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to update inventory', details: errorText }),
            { status: inventoryResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await inventoryResponse.json();
        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Admin action error:', error);
    return new Response(
      JSON.stringify({ error: 'Admin operation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
