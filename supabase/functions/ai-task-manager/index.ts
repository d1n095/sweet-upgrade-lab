import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // AI disabled — return immediately without consuming any credits
  return new Response(JSON.stringify({ skipped: true, reason: "AI disabled" }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// ─── Helpers ───

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function buildFallbackOrchestration(activeItems: any[]) {
  const priorityScore: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const sorted = [...activeItems].sort((a, b) => {
    const pa = priorityScore[a.priority] ?? 2;
    const pb = priorityScore[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;

    const aBug = a.item_type === "bug" ? 0 : 1;
    const bBug = b.item_type === "bug" ? 0 : 1;
    if (aBug !== bBug) return aBug - bBug;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const blockers = sorted.filter((it) => {
    const text = `${it.title || ""} ${it.description || ""}`.toLowerCase();
    return text.includes("payment") || text.includes("checkout") || text.includes("auth") || text.includes("login");
  });

  return sorted.map((item, index) => {
    const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
    const isFeatureLike = ["feature", "improvement", "upgrade"].includes(item.ai_type_classification || "");

    const depends_on = blockers
      .filter((b) => b.id !== item.id)
      .filter((b) => {
        if (isFeatureLike) return true;
        if (text.includes("order") || text.includes("shipping") || text.includes("warehouse")) {
          const bText = `${b.title || ""} ${b.description || ""}`.toLowerCase();
          return bText.includes("payment") || bText.includes("checkout");
        }
        return false;
      })
      .slice(0, 3)
      .map((b) => b.id);

    return {
      id: item.id,
      execution_order: index + 1,
      depends_on,
      blocks: [],
      duplicate_of: null,
      conflict_with: null,
      parallel_group: depends_on.length ? null : `lane_${(index % 3) + 1}`,
      reason: depends_on.length
        ? "Fallback: beroende upptäckta mot blockerande uppgifter"
        : "Fallback: prioriterad efter severity + ålder",
    };
  });
}

async function autoAssign(supabase: any, item: any): Promise<string | null> {
  const categoryRoleMap: Record<string, string[]> = {
    payment: ["finance", "admin", "founder"],
    checkout: ["it", "admin", "founder"],
    fulfillment: ["warehouse", "admin", "founder"],
    UI: ["it", "admin", "founder"],
    system: ["it", "admin", "founder"],
    support: ["support", "moderator", "admin", "founder"],
  };

  const typeRoleMap: Record<string, string[]> = {
    bug: ["it", "admin", "founder"],
    incident: ["support", "admin", "founder"],
    order_action: ["warehouse", "admin", "founder"],
    pack_order: ["warehouse", "admin", "founder"],
    anomaly: ["it", "admin", "founder"],
    manual: ["admin", "founder"],
  };

  const roles = categoryRoleMap[item.ai_category] || typeRoleMap[item.item_type] || ["admin", "founder"];

  const { data: candidates } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", roles);

  if (!candidates?.length) return null;

  let bestUser: string | null = null;
  let minTasks = Infinity;

  for (const c of candidates) {
    const { count } = await supabase
      .from("work_items")
      .select("id", { count: "exact", head: true })
      .or(`assigned_to.eq.${c.user_id},claimed_by.eq.${c.user_id}`)
      .in("status", ["open", "claimed", "in_progress"]);

    if ((count || 0) < minTasks) {
      minTasks = count || 0;
      bestUser = c.user_id;
    }
  }

  return bestUser;
}
