import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCAN_STALE_MINUTES = 120;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const failures: string[] = [];
  let db_ok = true;
  let scan_ok = true;
  let queue_ok = true;
  let api_ms: number | null = null;
  let queue_depth = 0;

  // 1) DB connection + RPC
  const t0 = Date.now();
  try {
    const { data, error } = await supabase.rpc("system_health_check");
    api_ms = Date.now() - t0;
    if (error) {
      db_ok = false;
      failures.push(`db_rpc:${error.message}`);
    } else if (data && typeof data === "object") {
      queue_ok = (data as any).queue_ok !== false;
      queue_depth = Number((data as any).queue_depth ?? 0);
      if (!queue_ok) failures.push(`queue_depth_${queue_depth}`);
    }
  } catch (e: any) {
    db_ok = false;
    api_ms = Date.now() - t0;
    failures.push(`db_exception:${e?.message || "unknown"}`);
  }

  // 2) API response time threshold
  if (api_ms !== null && api_ms > 5000) {
    failures.push(`api_slow_${api_ms}ms`);
  }

  // 3) Scanner liveness — distinguish BLIND (truly broken) from IDLE (no run yet).
  //    Scans are on-demand, not scheduled, so absence of a recent run is NOT a
  //    failure. We only flag scan_ok=false when:
  //      • a run is stuck in `running` past SCAN_STALE_MINUTES (real hang), or
  //      • the most recent run finished with status `failed`.
  //    "No scan in 6h" is reported as an informational note in `failures`
  //    but does not flip scan_ok — eliminating the false-negative loop that
  //    kept overall_status pinned to "failed".
  try {
    const { data: lastScan } = await supabase
      .from("scan_runs")
      .select("id, status, completed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastScan) {
      failures.push("no_scan_runs_yet"); // informational; scan_ok stays true
    } else if (lastScan.status === "failed") {
      scan_ok = false;
      failures.push(`last_scan_failed:${lastScan.id}`);
    } else if (lastScan.status === "running") {
      const startedMs = new Date(lastScan.created_at).getTime();
      if (Date.now() - startedMs > SCAN_STALE_MINUTES * 60 * 1000) {
        scan_ok = false;
        failures.push("scan_stuck_running");
      }
    }
    // Note: scans older than 6h are normal for an on-demand scanner; no flag.
  } catch (e: any) {
    scan_ok = false;
    failures.push(`scan_check:${e?.message}`);
  }

  const overall_status = failures.length === 0 ? "ok" : (db_ok && scan_ok ? "degraded" : "failed");

  // Persist health record
  await supabase.from("system_health_checks").insert({
    overall_status,
    db_ok,
    api_ms,
    scan_ok,
    queue_ok,
    details: { failures, queue_depth },
  });

  // Log security_event on failure
  if (overall_status === "failed") {
    await supabase.from("security_events").insert({
      type: "system",
      severity: "critical",
      message: `System health check failed: ${failures.join(", ")}`,
      endpoint: "system-health-check",
    });
  } else if (overall_status === "degraded") {
    await supabase.from("security_events").insert({
      type: "system",
      severity: "medium",
      message: `System health degraded: ${failures.join(", ")}`,
      endpoint: "system-health-check",
    });
  }

  return new Response(
    JSON.stringify({ overall_status, db_ok, api_ms, scan_ok, queue_ok, failures, queue_depth }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
