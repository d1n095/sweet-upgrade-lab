import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await anonClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Only founder can delete
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "founder");
    if (!roleData || roleData.length === 0) return new Response(JSON.stringify({ error: "forbidden (founder only)" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { user_id } = await req.json();
    if (!user_id) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Anonymize orders (keep for finance), delete personal
    await supabase.from("orders").update({ user_id: null, customer_email: "deleted@gdpr.local", customer_name: "Deleted", customer_phone: null, shipping_address: null }).eq("user_id", user_id);

    const cascadeTables = ["wishlists", "life_goals", "life_routines", "life_reminders", "journal_entries", "product_usage_logs", "customer_notes", "reviews", "referrals", "lifecycle_stages"];
    for (const t of cascadeTables) {
      await supabase.from(t).delete().or(`user_id.eq.${user_id},customer_id.eq.${user_id}`);
    }

    await supabase.from("profiles").delete().eq("id", user_id);
    await supabase.auth.admin.deleteUser(user_id);

    await supabase.from("access_audit_log").insert({ action: "gdpr_delete", resource_type: "user", resource_id: user_id, actor_id: userData.user.id });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
