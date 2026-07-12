// =====================================================================
// finance-service.ts — ENDA källan för penningrörelser (ADR-003).
// Ersätter direkt-skrivning till `expenses`. Hanterar inkomst OCH utgift
// via transactions, med valuta, kategori, kontext-ägarskap och timeline.
// =====================================================================

import { db } from "@/modules/core/db";
import { currentOwner } from "@/modules/core/session";

export type TxDirection = "in" | "out";

export type CreateTransactionInput = {
  direction: TxDirection;
  amount: number;                 // positivt belopp
  currency?: string;              // default användarens standardvaluta
  fxRate?: number;                // mot SEK; default 1 om SEK
  categoryId?: string | null;
  categoryName?: string | null;   // alternativ: slå upp id från namn (legacy-UI)
  description?: string | null;
  merchant?: string | null;
  occurredAt?: string;            // ISO; default nu
  source?: string;                // manual/salary/ocr/import/recurring
  sourceTable?: string | null;
  sourceId?: string | null;
  isRecurring?: boolean;
  recurrencePattern?: string | null;
};

/** Beräkna SEK-belopp (fryst kurs). SEK → 1:1. */
function toSek(amount: number, currency: string, fxRate?: number): { fx: number; sek: number } {
  const fx = currency === "SEK" ? 1 : (fxRate ?? 1);
  return { fx, sek: Math.round(amount * fx * 100) / 100 };
}

/** Skapa en transaktion (inkomst eller utgift) — enda vägen. */
export async function createTransaction(input: CreateTransactionInput) {
  const { userId, contextId } = await currentOwner();
  const currency = input.currency ?? "SEK";
  const { fx, sek } = toSek(input.amount, currency, input.fxRate);

  // Lös kategori: explicit id vinner, annars slå upp via namn (legacy-UI).
  let categoryId = input.categoryId ?? null;
  if (!categoryId && input.categoryName) {
    const { data: cat } = await db.from("categories")
      .select("id")
      .is("deleted_at", null)
      .ilike("name", input.categoryName)
      .limit(1)
      .maybeSingle();
    categoryId = cat?.id ?? null;
  }

  const { data, error } = await db.from("transactions").insert({
    owner_context_id: contextId,
    user_id: userId,
    direction: input.direction,
    amount: input.amount,
    currency,
    fx_rate: fx,
    amount_sek: sek,
    category_id: categoryId,
    description: input.description ?? null,
    merchant: input.merchant ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    source: input.source ?? "manual",
    source_table: input.sourceTable ?? null,
    source_id: input.sourceId ?? null,
    is_recurring: input.isRecurring ?? false,
    recurrence_pattern: input.recurrencePattern ?? null,
  }).select().single();
  if (error) throw error;

  // Timeline i synk (income/expense-kind efter riktning).
  try {
    await db.from("timeline_events").insert({
      user_id: userId,
      owner_context_id: contextId,
      kind: input.direction === "in" ? "income" : "expense",
      title: input.description || (input.direction === "in" ? "Inkomst" : "Utgift"),
      occurs_at: data.occurred_at,
      amount: input.direction === "in" ? sek : -sek,
      source_table: "transactions",
      source_id: data.id,
    });
  } catch { /* timeline sekundär */ }

  return data;
}

/** Läs transaktioner för aktiv kontext (soft delete respekteras). */
export async function listTransactions(opts: { limit?: number; direction?: TxDirection } = {}) {
  let q = db.from("transactions")
    .select("*, categories(name, icon, color, kind)")
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.direction) q = q.eq("direction", opts.direction);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Soft-delete en transaktion. */
export async function deleteTransaction(id: string) {
  const { error } = await db.from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Läs kategorier (system + kontextens egna). */
export async function listCategories(kind?: "income" | "expense") {
  let q = db.from("categories").select("*").is("deleted_at", null).order("sort_order");
  if (kind) q = q.in("kind", [kind, "both"]);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Nettoekonomi för en period (allt i SEK). */
export async function periodSummary(fromISO: string, toISO: string) {
  const { data, error } = await db.from("transactions")
    .select("direction, amount_sek")
    .is("deleted_at", null)
    .gte("occurred_at", fromISO)
    .lte("occurred_at", toISO);
  if (error) throw error;
  let income = 0, expense = 0;
  for (const t of data ?? []) {
    if (t.direction === "in") income += Number(t.amount_sek);
    else expense += Number(t.amount_sek);
  }
  return { income, expense, net: income - expense };
}
