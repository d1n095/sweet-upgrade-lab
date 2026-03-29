/**
 * aiGateway — Central AI execution gateway.
 *
 * ALL AI calls must go through this module.
 * System will NEVER call AI unless explicitly allowed via env vars.
 *
 * Control env vars (set in .env / Vercel / Supabase):
 *   VITE_DISABLE_AI=true   → hard-block every AI call
 *   VITE_AI_ENABLED=true   → required flag to allow AI execution
 */

export type AISource =
  | "SCAN"
  | "ADMIN"
  | "USER_ACTION"
  | "SYSTEM"
  | "UNKNOWN";

export interface AIRequest {
  source: AISource;
  feature: string;
  payload?: any;
  /** Override the target edge function name (default: "ai-assistant") */
  functionName?: string;
}

/**
 * Execute an AI request through the central gateway.
 *
 * Throws `Error("AI DISABLED")` when `VITE_DISABLE_AI=true`.
 * Throws `Error("AI NOT ENABLED")` when `VITE_AI_ENABLED` is not set.
 *
 * @param request - structured AI request with source + feature tracking
 */
export async function runAI(request: AIRequest): Promise<Response> {
  console.log("[AI REQUEST]", {
    time: new Date().toISOString(),
    ...request,
  });

  if (import.meta.env.VITE_DISABLE_AI === "true") {
    console.warn("[AI BLOCKED GLOBAL]", request);
    throw new Error("AI DISABLED");
  }

  if (!import.meta.env.VITE_AI_ENABLED) {
    console.warn("[AI NOT ENABLED]", request);
    throw new Error("AI NOT ENABLED");
  }

  const fn = request.functionName ?? "ai-assistant";

  return fetch(`/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

/**
 * Convenience wrapper: run AI and parse JSON response.
 * Returns `null` if AI is blocked or the request fails.
 */
export async function runAISafe(request: AIRequest): Promise<any | null> {
  try {
    const resp = await runAI(request);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[AI ERROR]", resp.status, errText.substring(0, 200));
      return null;
    }
    return resp.json();
  } catch (e: any) {
    console.warn("[AI GATEWAY] blocked or failed:", e?.message ?? e);
    return null;
  }
}
