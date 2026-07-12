// =====================================================================
// core/events.ts — Nervsystemet. ENDA vägen att skapa händelser (ADR-005).
// Ingen modul skriver till timeline_events direkt längre — de anropar emit().
// Sätter automatiskt owner_context_id + actor från sessionen.
// Förberett för framtida Automation/Rules/Notification via processed_at.
// =====================================================================

import { db } from "./db";
import { currentOwner } from "./session";

export type AppEvent = {
  kind: string;            // fritext; konvention: shift/income/expense/reminder/...
  title: string;
  subtitle?: string | null;
  amount?: number | null;
  occursAt: string;        // ISO
  endsAt?: string | null;
  icon?: string | null;
  color?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  dedupeKey?: string | null; // om satt: skriv inte dubblett (idempotens)
  metadata?: Record<string, unknown>;
};

/** Skapa en händelse. Enda vägen. Best-effort: kastar inte upp i anropar-flödet
 *  om timeline är otillgänglig — händelseloggen är sekundär till kärnhandlingen. */
export async function emit(event: AppEvent): Promise<void> {
  try {
    const { userId, contextId } = await currentOwner();
    await db.from("timeline_events").insert({
      user_id: userId,
      owner_context_id: contextId,
      actor_user_id: userId,
      kind: event.kind,
      title: event.title,
      subtitle: event.subtitle ?? null,
      amount: event.amount ?? null,
      occurs_at: event.occursAt,
      ends_at: event.endsAt ?? null,
      icon: event.icon ?? null,
      color: event.color ?? null,
      source_table: event.sourceTable ?? null,
      source_id: event.sourceId ?? null,
      dedupe_key: event.dedupeKey ?? null,
      metadata: event.metadata ?? {},
    });
  } catch (e) {
    // Om dedupe_key krockar (unik-index) eller timeline nere: svälj tyst.
    // Kärnhandlingen (pass/transaktion) har redan lyckats.
    if (typeof console !== "undefined") console.debug("emit skipped", e);
  }
}

/** Batch-emit (för import av många rader). Idempotent via dedupeKey. */
export async function emitMany(events: AppEvent[]): Promise<void> {
  if (events.length === 0) return;
  try {
    const { userId, contextId } = await currentOwner();
    await db.from("timeline_events").insert(
      events.map((e) => ({
        user_id: userId,
        owner_context_id: contextId,
        actor_user_id: userId,
        kind: e.kind,
        title: e.title,
        subtitle: e.subtitle ?? null,
        amount: e.amount ?? null,
        occurs_at: e.occursAt,
        ends_at: e.endsAt ?? null,
        source_table: e.sourceTable ?? null,
        source_id: e.sourceId ?? null,
        dedupe_key: e.dedupeKey ?? null,
        metadata: e.metadata ?? {},
      }))
    );
  } catch (e) {
    if (typeof console !== "undefined") console.debug("emitMany skipped", e);
  }
}
