// Salary Engine — OB-beräkning, raster, total. Helt regelstyrd via användarens egna regler.
import { isHelg, isRedDay } from "../calendar/holidays";

export type OBRule = {
  id: string;
  label: string;
  // Veckodagar (0=sön..6=lör). Tom array = alla.
  days: number[];
  // Tidsfönster (HH:MM), kan vara över midnatt
  from: string; // "18:00"
  to: string; // "22:00"
  // Tillägg
  type: "percent" | "amount"; // procent på timlön ELLER kronor/timme
  value: number;
  // Helg/röd dag triggers (utöver days)
  onlyHelg?: boolean;
  onlyRedDay?: boolean;
};

export type CalcInput = {
  startsAt: Date;
  endsAt: Date;
  breakMinutes: number;
  hourlyRate: number;
  obRules: OBRule[];
};

export type CalcResult = {
  hours: number; // betalda timmar (efter rast)
  baseAmount: number; // grundlön
  obAmount: number; // OB-tillägg totalt
  totalAmount: number; // grund + OB
  breakdown: Array<{ rule: string; minutes: number; amount: number }>;
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

// Returnerar alla minutsegment som faller inom regelns fönster för en given dag
function minutesInWindow(
  segStart: Date,
  segEnd: Date,
  ruleFrom: number,
  ruleTo: number,
): number {
  // Hela dygnet [segStart, segEnd] inom en kalenderdag — fönstret är i minuter sedan dagens 00:00
  const dayStart = new Date(segStart);
  dayStart.setHours(0, 0, 0, 0);

  const segS = (segStart.getTime() - dayStart.getTime()) / 60000;
  let segE = (segEnd.getTime() - dayStart.getTime()) / 60000;
  if (segE < segS) segE += 24 * 60; // segment över midnatt

  // Ett regelfönster kan passera midnatt (22:00–06:00). Ett sådant fönster
  // täcker TVÅ intervall räknat från dygnets start: [ruleFrom, 24:00) OCH
  // [0, ruleTo). För att även matcha ett segment som går över midnatt
  // (segE > 1440) speglar vi varje fönster ett dygn framåt också.
  const baseWindows: Array<[number, number]> =
    ruleTo <= ruleFrom
      ? [[ruleFrom, 24 * 60], [0, ruleTo]]
      : [[ruleFrom, ruleTo]];

  const windows: Array<[number, number]> = [];
  for (const [f, t] of baseWindows) {
    windows.push([f, t]);              // detta dygn
    windows.push([f + 1440, t + 1440]); // spegling för midnattssegment
  }

  let overlap = 0;
  for (const [wFrom, wTo] of windows) {
    overlap += Math.max(0, Math.min(segE, wTo) - Math.max(segS, wFrom));
  }
  return overlap;
}

// Delar passet i sektioner per kalenderdygn så att helg/röd-dag-regler kan utvärderas per dag
function splitByDay(start: Date, end: Date): Array<{ s: Date; e: Date }> {
  const out: Array<{ s: Date; e: Date }> = [];
  let cur = new Date(start);
  while (cur < end) {
    const next = new Date(cur);
    next.setHours(24, 0, 0, 0);
    const segEnd = next < end ? next : end;
    out.push({ s: new Date(cur), e: new Date(segEnd) });
    cur = next;
  }
  return out;
}

export function calculateShift(input: CalcInput): CalcResult {
  const grossMinutes = Math.max(0, (input.endsAt.getTime() - input.startsAt.getTime()) / 60000);
  const paidMinutes = Math.max(0, grossMinutes - input.breakMinutes);
  const hours = paidMinutes / 60;
  const baseAmount = +(hours * input.hourlyRate).toFixed(2);

  const segments = splitByDay(input.startsAt, input.endsAt);
  const breakdown: CalcResult["breakdown"] = [];
  let obAmount = 0;

  for (const rule of input.obRules) {
    const ruleFrom = toMinutes(rule.from);
    const ruleTo = toMinutes(rule.to);
    let ruleMinutes = 0;
    for (const seg of segments) {
      const weekday = seg.s.getDay();
      if (rule.days?.length && !rule.days.includes(weekday)) continue;
      if (rule.onlyHelg && !isHelg(seg.s)) continue;
      if (rule.onlyRedDay && !isRedDay(seg.s)) continue;
      ruleMinutes += minutesInWindow(seg.s, seg.e, ruleFrom, ruleTo);
    }
    if (ruleMinutes <= 0) continue;
    // Proportionera rasten över hela passet (förenkling): drag av rast i samma andel
    const adjusted = ruleMinutes * (paidMinutes / Math.max(1, grossMinutes));
    const ruleHours = adjusted / 60;
    const amount =
      rule.type === "percent"
        ? ruleHours * input.hourlyRate * (rule.value / 100)
        : ruleHours * rule.value;
    const rounded = +amount.toFixed(2);
    obAmount += rounded;
    breakdown.push({ rule: rule.label, minutes: Math.round(adjusted), amount: rounded });
  }

  return {
    hours: +hours.toFixed(2),
    baseAmount,
    obAmount: +obAmount.toFixed(2),
    totalAmount: +(baseAmount + obAmount).toFixed(2),
    breakdown,
  };
}

// Smarta standardregler om användaren inte satt egna (Sverige, vanliga branscher)
export const DEFAULT_OB_RULES: OBRule[] = [
  { id: "vardag-kvall", label: "Kväll vardag (18–22)", days: [1, 2, 3, 4, 5], from: "18:00", to: "22:00", type: "amount", value: 25 },
  { id: "natt", label: "Natt (22–06)", days: [0, 1, 2, 3, 4, 5, 6], from: "22:00", to: "06:00", type: "amount", value: 45 },
  { id: "lordag", label: "Lördag", days: [6], from: "00:00", to: "23:59", type: "amount", value: 40 },
  { id: "sondag-rod", label: "Söndag & röd dag", days: [0], from: "00:00", to: "23:59", type: "percent", value: 100, onlyHelg: true },
];
