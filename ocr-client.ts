// =====================================================================
// modules/scan/ocr-client.ts — Robust klientlager runt OCR (ADR-006).
// Retry med backoff, tydliga fel, content-hash för dubblettskydd.
// OCR-motorn själv (server-funktion) är utbytbar; detta är klientkontraktet.
// =====================================================================

/** SHA-256 av en fil → hex. Används för dokument-dubblettskydd. */
export async function fileContentHash(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type OcrError = {
  kind: "rate_limit" | "no_credits" | "parse" | "network" | "empty" | "unknown";
  message: string;
  canManualFallback: boolean;
};

/** Klassificera ett fel från OCR-anropet till något UI kan agera på. */
export function classifyOcrError(e: any): OcrError {
  const msg = String(e?.message ?? e ?? "");
  if (/429|för många/i.test(msg))
    return { kind: "rate_limit", message: "För många förfrågningar. Vänta en stund.", canManualFallback: true };
  if (/402|krediter/i.test(msg))
    return { kind: "no_credits", message: "Inga AI-krediter kvar. Du kan mata in manuellt.", canManualFallback: true };
  if (/tolka|parse/i.test(msg))
    return { kind: "parse", message: "Kunde inte tolka svaret. Prova igen eller mata in manuellt.", canManualFallback: true };
  if (/network|fetch|timeout/i.test(msg))
    return { kind: "network", message: "Nätverksfel. Kontrollera anslutningen.", canManualFallback: true };
  return { kind: "unknown", message: msg || "Okänt fel vid tolkning.", canManualFallback: true };
}

/**
 * Kör en OCR-funktion med retry + backoff. Retryar bara transienta fel
 * (rate limit, nätverk, 5xx) — inte 402 (slut på krediter) eller parse.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const base = opts.baseDelayMs ?? 800;
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const err = classifyOcrError(e);
      // Retrya inte permanenta fel.
      if (err.kind === "no_credits" || err.kind === "parse") throw e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, base * Math.pow(2, attempt)));
        continue;
      }
    }
  }
  throw lastErr;
}
