// =====================================================================
// datetime.ts — ENDA källan för tid ↔ tidszon i appen.
// Löser en korrekthetsbugg: `new Date(`${date}T${time}`)` tolkar tiden i
// körmiljöns lokala zon (server=UTC, browser=användarens zon) → samma pass
// kunde lagras på olika absoluta tider. En löneapp får ALDRIG ha det.
//
// Regel (spec Del 27/42): användaren tänker i Europe/Stockholm. Vi tolkar
// ALLTID inmatade datum/tider som Stockholm-tid, lagrar som UTC (ISO), och
// visar tillbaka i Stockholm. DST hanteras korrekt av @date-fns/tz.
// =====================================================================

import { TZDate } from "@date-fns/tz";

export const APP_TZ = "Europe/Stockholm";

/**
 * Tolka ett lokalt datum + klockslag (Stockholm) och ge en korrekt UTC-Date.
 * @param date "yyyy-mm-dd"
 * @param time "HH:MM"
 * Exempel: ("2026-07-10","22:00") → Date som är 20:00Z (sommar, UTC+2).
 */
export function stockholmToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // TZDate tolkar komponenterna I angiven zon; .getTime() ger korrekt UTC.
  const zoned = new TZDate(y, m - 1, d, hh, mm, 0, APP_TZ);
  return new Date(zoned.getTime());
}

/**
 * Bygg start/slut för ett pass. Slut ≤ start ⇒ passet korsar midnatt ⇒
 * slut nästa dygn (EN post). DST-säkert eftersom vi räknar i Stockholm.
 */
export function shiftRange(date: string, from: string, to: string): {
  startsAt: Date;
  endsAt: Date;
  crossesMidnight: boolean;
} {
  const startsAt = stockholmToUtc(date, from);
  let endsAt = stockholmToUtc(date, to);
  let crossesMidnight = false;
  if (endsAt.getTime() <= startsAt.getTime()) {
    // Lägg ett dygn i Stockholm-tid (ej +86400000, som spricker över DST-skiften).
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = to.split(":").map(Number);
    const next = new TZDate(y, m - 1, d, hh, mm, 0, APP_TZ);
    next.setDate(next.getDate() + 1);
    endsAt = new Date(next.getTime());
    crossesMidnight = true;
  }
  return { startsAt, endsAt, crossesMidnight };
}

/** Visa en UTC-tid som HH:MM i Stockholm. */
export function toStockholmTime(utc: Date | string): string {
  const dt = new TZDate(new Date(utc).getTime(), APP_TZ);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

/** Visa en UTC-tid som yyyy-mm-dd i Stockholm. */
export function toStockholmDate(utc: Date | string): string {
  const dt = new TZDate(new Date(utc).getTime(), APP_TZ);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Vilken veckodag (0=sön..6=lör) är denna UTC-tidpunkt i Stockholm? */
export function stockholmWeekday(utc: Date | string): number {
  return new TZDate(new Date(utc).getTime(), APP_TZ).getDay();
}
