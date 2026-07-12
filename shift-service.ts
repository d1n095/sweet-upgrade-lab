// =====================================================================
// shift-service.ts — ENDA källan för att skapa, beräkna och räkna om pass.
// Se docs/ADR-001-salary-architecture.md.
//
// Princip: ingen route skapar pass direkt mot supabase längre. Allt går
// genom denna service så att (1) beräkningen sker likadant överallt,
// (2) en oföränderlig pay_snapshot sparas, (3) timeline hålls i synk.
// Motorn (compute.ts/ob.ts) återanvänds — den är korrekt.
// =====================================================================

import { supabase } from "@/integrations/supabase/client";
import { computeShiftAmounts, type ShiftType } from "./compute";
import { calculateShift, DEFAULT_OB_RULES, type OBRule } from "./ob";
import { shiftRange } from "@/modules/core/datetime";
import { db } from "@/modules/core/db";

// Motorversion. v2 = midnatts-OB-buggen fixad (se ADR-001, 2026-07-11).
// Snapshots med engine_version < 2 kan innehålla underräknad natt-OB.
export const PAY_ENGINE_VERSION = 2;

export type WorkProfileLike = {
  id?: string;
  hourly_rate?: number | null;
  waking_on_call_rate?: number | null;
  sleeping_on_call_rate?: number | null;
  standby_rate?: number | null;
  on_call_rate?: number | null;
  callout_rate?: number | null;
  ob_rules?: unknown;
};

export type CreateShiftInput = {
  userId: string;
  ownerContextId: string;  // ägarskap (ADR-002) — sätts alltid
  workProfileId?: string | null;
  workplaceId?: string | null;
  payPeriodId?: string | null;
  title?: string | null;
  date: string;            // yyyy-mm-dd
  from: string;            // HH:MM
  to: string;              // HH:MM
  breakMinutes: number;
  shiftType: ShiftType;
  shiftCategory?: string;  // ordinary/extra/overtime/on_call/standby/inbeordrad
  activeMinutes?: number;
  isExtra?: boolean;
  notes?: string | null;
  source?: "manual" | "ocr" | "import";
  importBatchId?: string | null;
  profile: WorkProfileLike | null;
};

/** Bygg start/slut som Date. Tidszons-säkert via core/datetime (Stockholm→UTC).
 *  Pass över midnatt: slut nästa dag (EN post). Se ADR + datetime.ts. */
export function toDateRange(date: string, from: string, to: string) {
  const { startsAt, endsAt } = shiftRange(date, from, to);
  return { startsAt, endsAt };
}

/** Räkna ut lön + bygg den oföränderliga snapshoten. Ren funktion (ingen I/O). */
export function computePaySnapshot(input: CreateShiftInput) {
  const { startsAt, endsAt } = toDateRange(input.date, input.from, input.to);
  const obRules = normalizeRules(input.profile?.ob_rules);
  const result = computeShiftAmounts({
    startsAt,
    endsAt,
    breakMinutes: input.breakMinutes,
    shiftType: input.shiftType,
    activeMinutes: input.activeMinutes ?? 0,
    profile: input.profile ?? undefined,
    fallbackObRules: obRules,
  });

  // Detaljerad breakdown för spårbarhet (vilka regler gav vilket belopp)
  const detail = calculateShift({
    startsAt,
    endsAt,
    breakMinutes: input.shiftType === "regular" ? input.breakMinutes : 0,
    hourlyRate: result.hourly_rate,
    obRules,
  });

  const snapshot = {
    engine_version: PAY_ENGINE_VERSION,
    computed_at: new Date().toISOString(),
    hourly_rate: result.hourly_rate,
    shift_type: input.shiftType,
    shift_category: input.shiftCategory ?? (input.isExtra ? "extra" : "ordinary"),
    hours_paid: detail.hours,
    break_minutes: result.break_minutes,
    base_amount: result.base_amount,
    ob_amount: result.ob_amount,
    total_amount: result.total_amount,
    on_call_hours: result.on_call_hours,
    active_minutes: result.active_minutes,
    breakdown: detail.breakdown,
    rules_applied: detail.breakdown.map((b) => b.rule),
  };

  return { startsAt, endsAt, result, snapshot };
}

function normalizeRules(x: unknown): OBRule[] {
  if (Array.isArray(x) && x.length > 0) return x as OBRule[];
  return DEFAULT_OB_RULES;
}

/** Bygg DB-raden (utan att skriva). Används av create och recompute. */
function buildRow(input: CreateShiftInput) {
  const { startsAt, endsAt, result, snapshot } = computePaySnapshot(input);
  return {
    row: {
      user_id: input.userId,
      owner_context_id: input.ownerContextId,
      work_profile_id: input.workProfileId ?? null,
      workplace_id: input.workplaceId ?? null,
      pay_period_id: input.payPeriodId ?? null,
      title: input.title ?? null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      break_minutes: input.breakMinutes,
      hourly_rate: result.hourly_rate,
      base_amount: result.base_amount,
      ob_amount: result.ob_amount,
      total_amount: result.total_amount,
      is_extra: input.isExtra ?? false,
      shift_category: snapshot.shift_category,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
      import_batch_id: input.importBatchId ?? null,
      pay_snapshot: snapshot,
      pay_engine_version: PAY_ENGINE_VERSION,
      pay_computed_at: snapshot.computed_at,
    },
    snapshot,
    hours: snapshot.hours_paid,
  };
}

/** Skapa ett eller flera pass — ENDA vägen. Synkar timeline. */
export async function createShifts(inputs: CreateShiftInput[]) {
  if (inputs.length === 0) return [];
  const built = inputs.map(buildRow);
  const { data: inserted, error } = await db
    .from("shifts")
    .insert(built.map((b) => b.row))
    .select();
  if (error) throw error;

  // Håll timeline i synk (Life Feed) — best effort, blockerar inte skapandet.
  try {
    const tl = (inserted ?? []).map((s: any, i: number) => ({
      user_id: s.user_id,
      owner_context_id: s.owner_context_id,
      kind: "shift" as const,
      title: s.title || "Arbetspass",
      subtitle: `${built[i].hours.toFixed(1)}h · ${s.total_amount} kr`,
      occurs_at: s.starts_at,
      ends_at: s.ends_at,
      amount: Number(s.total_amount),
      source_table: "shifts",
      source_id: s.id,
    }));
    if (tl.length) await db.from("timeline_events").insert(tl);
  } catch {
    /* timeline är sekundär; fel här får aldrig fälla pass-skapandet */
  }

  return inserted ?? [];
}

/**
 * Räkna om VALDA pass med nya regler/lön — avsiktligt och spårbart.
 * Skriver pay_recompute_log (före/efter). Hoppar över pass i låst period
 * (DB-triggern skyddar dessutom hårt). Kräver användarens reason.
 */
export async function recomputeShifts(opts: {
  userId: string;
  shiftIds: string[];
  profile: WorkProfileLike | null;
  reason: string;
}) {
  const { data: shifts, error } = await db
    .from("shifts")
    .select("*, pay_periods(is_locked)")
    .in("id", opts.shiftIds)
    .is("deleted_at", null);
  if (error) throw error;

  const results: Array<{ id: string; status: "recomputed" | "skipped_locked"; oldTotal: number; newTotal: number }> = [];

  for (const s of shifts ?? []) {
    if (s.pay_periods?.is_locked) {
      results.push({ id: s.id, status: "skipped_locked", oldTotal: Number(s.total_amount), newTotal: Number(s.total_amount) });
      continue;
    }
    const start = new Date(s.starts_at);
    const end = new Date(s.ends_at);
    const input: CreateShiftInput = {
      userId: opts.userId,
      ownerContextId: s.owner_context_id,
      date: start.toISOString().slice(0, 10),
      from: start.toTimeString().slice(0, 5),
      to: end.toTimeString().slice(0, 5),
      breakMinutes: s.break_minutes ?? 0,
      shiftType: ((s.pay_snapshot as any)?.shift_type as ShiftType) ?? "regular",
      shiftCategory: s.shift_category ?? undefined,
      isExtra: s.is_extra ?? false,
      profile: opts.profile,
    };
    const { row, snapshot } = buildRow(input);

    const { error: upErr } = await db
      .from("shifts")
      .update({
        hourly_rate: row.hourly_rate,
        base_amount: row.base_amount,
        ob_amount: row.ob_amount,
        total_amount: row.total_amount,
        pay_snapshot: snapshot,
        pay_computed_at: snapshot.computed_at,
      })
      .eq("id", s.id);
    if (upErr) throw upErr;

    await db.from("pay_recompute_log").insert({
      user_id: opts.userId,
      shift_id: s.id,
      reason: opts.reason,
      old_total: Number(s.total_amount),
      new_total: row.total_amount,
      old_snapshot: s.pay_snapshot,
      new_snapshot: snapshot,
    });

    results.push({ id: s.id, status: "recomputed", oldTotal: Number(s.total_amount), newTotal: row.total_amount });
  }

  return results;
}
