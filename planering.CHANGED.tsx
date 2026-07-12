import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createShifts } from "@/modules/salary/shift-service";
import { currentOwner } from "@/modules/core/session";
import { db } from "@/modules/core/db";
import { calculateShift, DEFAULT_OB_RULES } from "@/modules/salary/ob";
import { applyBreakRules, normalizeBreakRules, DEFAULT_BREAK_RULES, type BreakRules } from "@/modules/salary/breaks";
import { NumericField } from "@/components/ui/numeric-field";
import {
  aggregateRange, aggregateByMonth, isoDate, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear, isoWeekNumber,
  type ShiftRow, type AbsenceRow,
} from "@/modules/planning/views";
import { analyzeVacation } from "@/modules/planning/vacation";
import { expandRotation, ROTATION_PRESETS } from "@/modules/planning/rotations";
import { detectWarnings } from "@/modules/salary/conflicts";
import { sek, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon, Save, Plus, Trash2,
  Plane, AlertTriangle, Sparkles, Wand2, Copy, X, Settings as SettingsIcon, Briefcase,
} from "lucide-react";

export const Route = createFileRoute("/_app/planering")({ component: PlaneringPage });

type ViewMode = "week" | "month" | "quarter" | "half" | "year" | "vacation";

const WEEKDAY_LABELS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];

function PlaneringPage() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState<Date>(new Date());

  const range = useMemo(() => {
    const a = anchor;
    if (mode === "week") return { start: startOfWeek(a), end: endOfWeek(a) };
    if (mode === "month" || mode === "vacation") return { start: startOfMonth(a), end: endOfMonth(a) };
    if (mode === "quarter") {
      const q = Math.floor(a.getMonth() / 3);
      return { start: new Date(a.getFullYear(), q * 3, 1), end: new Date(a.getFullYear(), q * 3 + 3, 0) };
    }
    if (mode === "half") {
      const h = a.getMonth() < 6 ? 0 : 6;
      return { start: new Date(a.getFullYear(), h, 1), end: new Date(a.getFullYear(), h + 6, 0) };
    }
    return { start: startOfYear(a.getFullYear()), end: endOfYear(a.getFullYear()) };
  }, [mode, anchor]);

  const profile = useQuery({
    queryKey: ["profile-with-workprofile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data: p }, { data: wps }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("work_profiles").select("*").order("is_default", { ascending: false }),
      ]);
      const def = wps?.find((w: any) => w.is_default) ?? wps?.[0];
      return {
        ...p,
        hourly_rate: def?.hourly_rate ?? p?.hourly_rate ?? 0,
        tax_rate: def?.tax_rate ?? p?.tax_rate ?? 30,
        ob_rules: def?.ob_rules ?? p?.ob_rules,
        break_rules: normalizeBreakRules(def?.break_rules),
        work_profile_id: def?.id,
        work_profile_name: def?.name,
      };
    },
  });

  const shifts = useQuery({
    queryKey: ["planning-shifts", isoDate(range.start), isoDate(range.end)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts").select("*")
        .gte("starts_at", new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate()).toISOString())
        .lte("starts_at", new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() + 1).toISOString())
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as unknown as ShiftRow[];
    },
  });

  const absences = useQuery({
    queryKey: ["planning-absences", isoDate(range.start), isoDate(range.end)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences").select("*")
        .lte("starts_on", isoDate(range.end))
        .gte("ends_on", isoDate(range.start));
      if (error) throw error;
      return (data ?? []) as unknown as AbsenceRow[];
    },
  });

  const agg = useMemo(() => aggregateRange(
    range.start, range.end,
    shifts.data ?? [], absences.data ?? [],
    profile.data?.tax_rate,
  ), [range, shifts.data, absences.data, profile.data]);

  function shiftAnchor(delta: number) {
    const d = new Date(anchor);
    if (mode === "week") d.setDate(d.getDate() + 7 * delta);
    else if (mode === "month" || mode === "vacation") d.setMonth(d.getMonth() + delta);
    else if (mode === "quarter") d.setMonth(d.getMonth() + 3 * delta);
    else if (mode === "half") d.setMonth(d.getMonth() + 6 * delta);
    else d.setFullYear(d.getFullYear() + delta);
    setAnchor(d);
  }

  const periodLabel = useMemo(() => {
    if (mode === "week") return `Vecka ${isoWeekNumber(anchor)} · ${anchor.getFullYear()}`;
    if (mode === "month" || mode === "vacation") return `${MONTH_LABELS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (mode === "quarter") return `Q${Math.floor(anchor.getMonth() / 3) + 1} ${anchor.getFullYear()}`;
    if (mode === "half") return `${anchor.getMonth() < 6 ? "H1" : "H2"} ${anchor.getFullYear()}`;
    return `${anchor.getFullYear()}`;
  }, [mode, anchor]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Planeringsmotor</div>
        <h1 className="display text-3xl sm:text-4xl">
          Planera <span className="gold-text">vecka, månad, år</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Allt på ett ställe — pass, lön, OB, semester och röda dagar.
        </p>
      </header>

      {/* View switcher */}
      <div className="glass rounded-2xl p-2">
        <div className="flex flex-wrap items-center gap-1">
          {([
            ["week", "Vecka"], ["month", "Månad"], ["quarter", "Kvartal"],
            ["half", "Halvår"], ["year", "År"], ["vacation", "Semester"],
          ] as [ViewMode, string][]).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-medium transition",
                mode === m
                  ? "bg-gradient-to-r from-[oklch(0.78_0.105_85/0.25)] to-[oklch(0.78_0.105_85/0.05)] text-foreground"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}>{label}</button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => shiftAnchor(-1)} className="rounded-lg p-2 hover:bg-white/[0.04]"><ChevronLeft className="h-4 w-4" /></button>
            <div className="min-w-[10rem] text-center text-sm">{periodLabel}</div>
            <button onClick={() => shiftAnchor(1)} className="rounded-lg p-2 hover:bg-white/[0.04]"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={() => setAnchor(new Date())} className="ml-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-white/[0.04]">Idag</button>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <SummaryStrip agg={agg} />

      {mode === "week" && (
        <WeekFiller
          key={isoDate(range.start)}
          start={range.start}
          existing={shifts.data ?? []}
          profile={profile.data}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["planning-shifts"] }); qc.invalidateQueries({ queryKey: ["shifts"] }); }}
        />
      )}

      {(mode === "month" || mode === "quarter" || mode === "half") && (
        <MonthsGrid mode={mode} anchor={anchor} shifts={shifts.data ?? []} absences={absences.data ?? []} tax={profile.data?.tax_rate} onPick={(d) => { setAnchor(d); setMode("week"); }} />
      )}

      {mode === "year" && (
        <YearView year={anchor.getFullYear()} shifts={shifts.data ?? []} absences={absences.data ?? []} tax={profile.data?.tax_rate} onPickMonth={(m) => { setAnchor(new Date(anchor.getFullYear(), m, 1)); setMode("month"); }} />
      )}

      {mode === "vacation" && (
        <VacationPanel anchor={anchor} shifts={shifts.data ?? []} onSaved={() => { qc.invalidateQueries({ queryKey: ["planning-absences"] }); }} />
      )}

      {mode === "month" && (
        <PatternApplier
          anchor={anchor}
          existing={shifts.data ?? []}
          profile={profile.data}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["planning-shifts"] }); qc.invalidateQueries({ queryKey: ["shifts"] }); }}
        />
      )}
    </div>
  );
}

/* ---------------- SUMMARY ---------------- */
function SummaryStrip({ agg }: { agg: ReturnType<typeof aggregateRange> }) {
  const items = [
    { label: "Timmar", value: num(agg.hours, 1) + " h" },
    { label: "Brutto", value: sek(agg.gross) },
    { label: "Netto (est.)", value: sek(agg.netEstimate) },
    { label: "OB", value: sek(agg.ob) },
    { label: "Pass", value: String(agg.shiftCount) },
    { label: "Lediga", value: String(agg.freeDays) },
    { label: "Röda", value: String(agg.redDays) },
    { label: "Semester", value: String(agg.vacationDays) },
  ];
  return (
    <div className="glass grid grid-cols-2 gap-4 rounded-2xl p-4 sm:grid-cols-4 lg:grid-cols-8">
      {items.map((it) => (
        <div key={it.label}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{it.label}</div>
          <div className="num mt-1 text-xl">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- WEEK FILLER ---------------- */
type WeekRow = { date: string; from: string; to: string; break_minutes: number; off: boolean };

function WeekFiller({ start, existing, profile, onSaved }: {
  start: Date; existing: ShiftRow[]; profile: any; onSaved: () => void;
}) {
  const rate = Number(profile?.hourly_rate ?? 0) || 0;
  const breakRules: BreakRules = profile?.break_rules ?? DEFAULT_BREAK_RULES;

  const defaultBreakFor = (from: string, to: string): number => {
    const a = new Date(`2000-01-01T${from}:00`);
    let b = new Date(`2000-01-01T${to}:00`);
    if (b <= a) b = new Date(b.getTime() + 86400000);
    const hours = (b.getTime() - a.getTime()) / 3600000;
    if (breakRules.mode === "auto") return applyBreakRules(breakRules, hours);
    if (breakRules.mode === "off") return 0;
    return breakRules.min_break_minutes || 0;
  };

  const [rows, setRows] = useState<WeekRow[]>(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = isoDate(d);
      const exists = existing.find((s) => isoDate(new Date(s.starts_at)) === key);
      if (exists) {
        return {
          date: key,
          from: new Date(exists.starts_at).toTimeString().slice(0, 5),
          to: new Date(exists.ends_at).toTimeString().slice(0, 5),
          break_minutes: exists.break_minutes ?? 0,
          off: false,
        };
      }
      return { date: key, from: "08:00", to: "16:00", break_minutes: defaultBreakFor("08:00", "16:00"), off: true };
    });
  });

  // Auto-uppdatera rast när tider ändras (om automatisk är vald)
  const setRowTimes = (i: number, patch: Partial<WeekRow>) => {
    setRows((prev) => prev.map((x, j) => {
      if (j !== i) return x;
      const next = { ...x, ...patch, off: false };
      if (breakRules.mode === "auto" && (patch.from || patch.to)) {
        next.break_minutes = defaultBreakFor(next.from, next.to);
      }
      return next;
    }));
  };

  const planned = rows.filter((r) => !r.off);
  const calcs = planned.map((r) => {
    const startsAt = new Date(`${r.date}T${r.from}:00`);
    let endsAt = new Date(`${r.date}T${r.to}:00`);
    if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86400000);
    return calculateShift({
      startsAt, endsAt, breakMinutes: r.break_minutes,
      hourlyRate: rate, obRules: DEFAULT_OB_RULES,
    });
  });
  const totalH = calcs.reduce((s, c) => s + c.hours, 0);
  const totalBase = calcs.reduce((s, c) => s + c.baseAmount, 0);
  const totalOB = calcs.reduce((s, c) => s + c.obAmount, 0);
  const taxFrac = (Number(profile?.tax_rate ?? 0.3) > 1 ? Number(profile?.tax_rate) / 100 : Number(profile?.tax_rate ?? 0.3));
  const totalNet = (totalBase + totalOB) * (1 - taxFrac);

  const warnings = useMemo(() => detectWarnings(
    planned.map((r) => ({ date: r.date, from: r.from, to: r.to, breakMinutes: r.break_minutes })),
    existing.filter((s) => !planned.some((p) => p.date === isoDate(new Date(s.starts_at)))) as any,
  ), [planned, existing]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");
      if (!rate) throw new Error("Sätt timlön i Inställningar → Lön & Arbete");
      const datesToReplace = rows.filter((r) => !r.off).map((r) => r.date);
      if (datesToReplace.length) {
        const existingInRange = existing.filter((s) => datesToReplace.includes(isoDate(new Date(s.starts_at))));
        if (existingInRange.length) {
          await db.from("shifts")
            .update({ deleted_at: new Date().toISOString() })
            .in("id", existingInRange.map((s) => s.id));
        }
      }
      const { userId, contextId } = await currentOwner();
      const toCreate = rows.filter((r) => !r.off).map((r) => ({
        userId,
        ownerContextId: contextId,
        title: "Pass",
        date: r.date,
        from: r.from,
        to: r.to,
        breakMinutes: r.break_minutes,
        shiftType: "regular" as const,
        workProfileId: profile?.work_profile_id ?? null,
        profile: { hourly_rate: rate, ob_rules: DEFAULT_OB_RULES } as any,
        source: "manual" as const,
      }));
      if (!toCreate.length) return;
      await createShifts(toCreate);
    },
    onSuccess: () => { toast.success("Vecka sparad"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte spara"),
  });

  const breakModeLabel = breakRules.mode === "auto" ? "Automatisk rast" : breakRules.mode === "off" ? "Ingen rast" : "Manuell rast";

  return (
    <div className="glass space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[oklch(0.85_0.12_85)]" />
          <h2 className="display text-xl">Snabbfyll vecka</h2>
        </div>
        <Link to="/installningar/lon-arbete"
          className="group flex items-center gap-2 rounded-full border border-border bg-white/[0.02] px-3 py-1.5 text-xs hover:border-[oklch(0.85_0.12_85/0.4)]">
          <Briefcase className="h-3.5 w-3.5 text-[oklch(0.85_0.12_85)]" />
          <span className="font-medium">{profile?.work_profile_name ?? "Ingen arbetsprofil"}</span>
          <span className="text-muted-foreground">·</span>
          <span className="tabular-nums">{rate || "–"} kr/h</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{breakModeLabel}</span>
          <SettingsIcon className="h-3 w-3 text-muted-foreground transition group-hover:text-foreground" />
        </Link>
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => {
          const d = new Date(`${r.date}T12:00:00`);
          const breakDisabled = r.off || breakRules.mode === "off";
          return (
            <div key={r.date} className={cn(
              "grid grid-cols-12 items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2",
              r.off && "opacity-60",
            )}>
              <div className="col-span-3 text-sm">
                <div className="font-medium">{WEEKDAY_LABELS[(d.getDay() + 6) % 7]} {d.getDate()}/{d.getMonth() + 1}</div>
                <div className="text-[10px] text-muted-foreground">{r.date}</div>
              </div>
              <input type="time" value={r.from} disabled={r.off}
                onChange={(e) => setRowTimes(i, { from: e.target.value })}
                className="col-span-2 rounded-lg border border-border bg-input/40 px-2 py-1.5 text-sm" />
              <input type="time" value={r.to} disabled={r.off}
                onChange={(e) => setRowTimes(i, { to: e.target.value })}
                className="col-span-2 rounded-lg border border-border bg-input/40 px-2 py-1.5 text-sm" />
              <div className="col-span-4">
                <NumericField
                  value={r.break_minutes}
                  onChange={(v) => setRows((prev) => prev.map((x, j) => j === i ? { ...x, break_minutes: v ?? 0 } : x))}
                  min={0} max={240} step={5} quickSteps={[5, 15, 30]} showQuick={false} suffix="min rast"
                  inputClassName={breakDisabled ? "opacity-40" : ""}
                />
              </div>
              <button
                onClick={() => setRows((prev) => prev.map((x, j) => j === i ? { ...x, off: !x.off } : x))}
                className={cn("col-span-1 rounded-lg border px-2 py-1.5 text-[10px] uppercase tracking-wider",
                  r.off ? "border-border text-muted-foreground" : "border-[oklch(0.85_0.12_85/0.4)] text-[oklch(0.85_0.12_85)]")}>
                {r.off ? "Ledig" : "På"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pass" value={String(planned.length)} />
        <Stat label="Timmar" value={`${num(totalH, 1)} h`} />
        <Stat label="Brutto" value={sek(totalBase + totalOB)} />
        <Stat label="Netto" value={sek(totalNet)} />
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-[oklch(0.65_0.12_28/0.4)] bg-[oklch(0.65_0.12_28/0.07)] px-3 py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-[oklch(0.65_0.12_28)]" />
              <span>{w.date}: {w.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => save.mutate()} disabled={save.isPending || !planned.length}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[oklch(0.85_0.12_85)] to-[oklch(0.6_0.1_75)] px-5 py-2.5 text-sm font-medium text-background shadow-[0_8px_24px_-8px_oklch(0.78_0.105_85/0.6)] disabled:opacity-50">
          <Save className="h-4 w-4" />
          {save.isPending ? "Sparar..." : "Spara vecka"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="num mt-1 text-lg">{value}</div>
    </div>
  );
}

/* ---------------- MONTHS GRID (month/quarter/half) ---------------- */
function MonthsGrid({ mode, anchor, shifts, absences, tax, onPick }: {
  mode: "month" | "quarter" | "half"; anchor: Date;
  shifts: ShiftRow[]; absences: AbsenceRow[]; tax: number | null | undefined;
  onPick: (d: Date) => void;
}) {
  const months: Date[] = [];
  if (mode === "month") months.push(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  else if (mode === "quarter") {
    const q = Math.floor(anchor.getMonth() / 3) * 3;
    for (let i = 0; i < 3; i++) months.push(new Date(anchor.getFullYear(), q + i, 1));
  } else {
    const h = anchor.getMonth() < 6 ? 0 : 6;
    for (let i = 0; i < 6; i++) months.push(new Date(anchor.getFullYear(), h + i, 1));
  }
  return (
    <div className={cn("grid gap-4", months.length === 1 ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {months.map((m) => (
        <MonthCard key={m.toISOString()} month={m} shifts={shifts} absences={absences} tax={tax} expanded={months.length === 1} onPickDay={onPick} />
      ))}
    </div>
  );
}

function MonthCard({ month, shifts, absences, tax, expanded, onPickDay }: {
  month: Date; shifts: ShiftRow[]; absences: AbsenceRow[]; tax: number | null | undefined;
  expanded: boolean; onPickDay: (d: Date) => void;
}) {
  const start = startOfMonth(month), end = endOfMonth(month);
  const agg = aggregateRange(start, end, shifts, absences, tax);
  const firstWd = (start.getDay() + 6) % 7;
  const cells: (typeof agg.days[number] | null)[] = [];
  for (let i = 0; i < firstWd; i++) cells.push(null);
  agg.days.forEach((d) => cells.push(d));

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="display text-lg">{MONTH_LABELS[month.getMonth()]} {month.getFullYear()}</div>
        <div className="text-xs text-muted-foreground">{num(agg.hours, 0)}h · {sek(agg.gross)}</div>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {WEEKDAY_LABELS.map((w) => <div key={w}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const hasShift = d.shifts.length > 0;
          const hasVac = d.absences.some((a) => a.kind === "vacation");
          const hasSick = d.absences.some((a) => a.kind === "sick");
          return (
            <button
              key={d.date}
              onClick={() => onPickDay(new Date(`${d.date}T12:00:00`))}
              className={cn(
                "aspect-square rounded-md text-[10px] transition relative",
                d.isRed ? "bg-[oklch(0.65_0.12_28/0.18)] text-[oklch(0.85_0.06_28)]" : "bg-background/40 hover:bg-white/[0.05]",
                hasShift && "ring-1 ring-[oklch(0.85_0.12_85/0.6)]",
                hasVac && "bg-[oklch(0.85_0.12_85/0.18)]",
                hasSick && "bg-[oklch(0.55_0.1_240/0.18)]",
              )}
              title={d.redName ?? ""}
            >
              <div className="absolute left-1 top-0.5">{Number(d.date.slice(-2))}</div>
              {hasShift && expanded && (
                <div className="absolute inset-x-1 bottom-1 truncate text-[9px] font-medium text-[oklch(0.85_0.12_85)]">
                  {num(d.hours, 1)}h
                </div>
              )}
              {hasVac && <Plane className="absolute right-0.5 top-0.5 h-2.5 w-2.5 text-[oklch(0.85_0.12_85)]" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[10px]">
        <div><div className="text-muted-foreground">Netto</div><div className="num">{sek(agg.netEstimate)}</div></div>
        <div><div className="text-muted-foreground">OB</div><div className="num">{sek(agg.ob)}</div></div>
        <div><div className="text-muted-foreground">Pass</div><div className="num">{agg.shiftCount}</div></div>
      </div>
    </div>
  );
}

/* ---------------- YEAR VIEW ---------------- */
function YearView({ year, shifts, absences, tax, onPickMonth }: {
  year: number; shifts: ShiftRow[]; absences: AbsenceRow[]; tax: number | null | undefined;
  onPickMonth: (m: number) => void;
}) {
  const months = aggregateByMonth(year, shifts, absences, tax);
  const yearH = months.reduce((s, m) => s + m.hours, 0);
  const yearGross = months.reduce((s, m) => s + m.gross, 0);
  const yearNet = months.reduce((s, m) => s + m.netEstimate, 0);
  return (
    <div className="space-y-4">
      <div className="glass grid grid-cols-3 gap-4 rounded-2xl p-4">
        <div><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Året — timmar</div><div className="num text-2xl">{num(yearH, 0)} h</div></div>
        <div><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Året — brutto</div><div className="num text-2xl">{sek(yearGross)}</div></div>
        <div><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Året — netto (est.)</div><div className="num text-2xl gold-text">{sek(yearNet)}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {months.map((m, i) => (
          <button key={i} onClick={() => onPickMonth(i)} className="glass rounded-2xl p-4 text-left transition hover:ring-1 hover:ring-[oklch(0.85_0.12_85/0.5)]">
            <div className="flex items-baseline justify-between">
              <div className="display text-lg">{MONTH_LABELS[i]}</div>
              <div className="text-xs text-muted-foreground">{m.shiftCount} pass</div>
            </div>
            <div className="num mt-2 text-xl">{num(m.hours, 0)} h</div>
            <div className="text-xs text-muted-foreground">{sek(m.gross)} brutto</div>
            <div className="text-xs gold-text">{sek(m.netEstimate)} netto</div>
            <div className="mt-3 flex gap-3 border-t border-border pt-2 text-[10px] text-muted-foreground">
              <span>OB {sek(m.ob)}</span>
              <span>Sem {m.vacationDays}</span>
              <span>Röda {m.redDays}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- VACATION PANEL ---------------- */
function VacationPanel({ anchor, shifts, onSaved }: {
  anchor: Date; shifts: ShiftRow[]; onSaved: () => void;
}) {
  const [from, setFrom] = useState<string>(isoDate(anchor));
  const [to, setTo] = useState<string>(isoDate(anchor));
  const [note, setNote] = useState("");

  const analysis = useMemo(() => {
    const s = new Date(`${from}T00:00:00`);
    const e = new Date(`${to}T00:00:00`);
    if (e < s) return null;
    return analyzeVacation(s, e, shifts);
  }, [from, to, shifts]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");
      const { error } = await supabase.from("absences").insert({
        user_id: user.id, kind: "vacation", starts_on: from, ends_on: to,
        note: note || null, paid: true, status: "planned",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Semester sparad"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte spara"),
  });

  return (
    <div className="glass space-y-4 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Plane className="h-4 w-4 text-[oklch(0.85_0.12_85)]" />
        <h2 className="display text-xl">Planera semester</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs">
          <div className="mb-1 text-muted-foreground">Från</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs">
          <div className="mb-1 text-muted-foreground">Till</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs">
          <div className="mb-1 text-muted-foreground">Anteckning</div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Grekland"
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm" />
        </label>
      </div>

      {analysis && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Semesterdagar" value={String(analysis.vacationDaysUsed)} />
            <Stat label="Lediga totalt" value={String(analysis.totalFreeDays)} />
            <Stat label="Påverkade pass" value={String(analysis.affectedShifts.length)} />
            <Stat label="Förlorad OB" value={sek(analysis.lostOB)} />
          </div>
          {analysis.lostBase + analysis.lostOB > 0 && (
            <div className="rounded-lg border border-[oklch(0.65_0.12_28/0.4)] bg-[oklch(0.65_0.12_28/0.07)] px-3 py-2 text-xs">
              Den här perioden kostar ungefär <strong>{sek(analysis.lostBase + analysis.lostOB)}</strong> i utebliven inkomst (grund + OB).
            </div>
          )}
          {analysis.stretchTips.length > 0 && (
            <div className="space-y-1.5">
              {analysis.stretchTips.map((t, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-[oklch(0.85_0.12_85/0.4)] bg-[oklch(0.85_0.12_85/0.07)] px-3 py-2 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-[oklch(0.85_0.12_85)]" />
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex justify-end">
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[oklch(0.85_0.12_85)] to-[oklch(0.6_0.1_75)] px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50">
          <Save className="h-4 w-4" /> Spara semester
        </button>
      </div>
    </div>
  );
}

/* ---------------- PATTERN APPLIER (month) ---------------- */
function PatternApplier({ anchor, existing, profile, onSaved }: {
  anchor: Date; existing: ShiftRow[]; profile: any; onSaved: () => void;
}) {
  const [presetIdx, setPresetIdx] = useState(0);
  const preset = ROTATION_PRESETS[presetIdx];
  const start = startOfMonth(anchor), end = endOfMonth(anchor);
  const expanded = useMemo(() => expandRotation(start, end, preset), [start, end, preset]);
  const rate = Number(profile?.hourly_rate ?? 0) || 0;

  const apply = useMutation({
    mutationFn: async () => {
      if (!rate) throw new Error("Sätt timlön i Inställningar först");
      const { userId, contextId } = await currentOwner();
      const toCreate = expanded.map((e) => ({
        userId,
        ownerContextId: contextId,
        title: preset.name,
        date: e.date,
        from: e.from,
        to: e.to,
        breakMinutes: e.breakMinutes,
        shiftType: "regular" as const,
        profile: { hourly_rate: rate, ob_rules: DEFAULT_OB_RULES } as any,
        source: "manual" as const,
      }));
      if (!toCreate.length) return;
      await createShifts(toCreate);
    },
    onSuccess: () => { toast.success(`${expanded.length} pass tillagda`); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte applicera"),
  });

  return (
    <div className="glass space-y-4 rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-[oklch(0.85_0.12_85)]" />
        <h2 className="display text-xl">Applicera mönster på månaden</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {ROTATION_PRESETS.map((p, i) => (
          <button key={p.name} onClick={() => setPresetIdx(i)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition",
              presetIdx === i
                ? "border-[oklch(0.85_0.12_85/0.5)] bg-[oklch(0.85_0.12_85/0.12)] text-[oklch(0.85_0.12_85)]"
                : "border-border text-muted-foreground hover:text-foreground",
            )}>{p.name}</button>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        Genererar <strong className="text-foreground">{expanded.length} pass</strong> för {MONTH_LABELS[anchor.getMonth()]} {anchor.getFullYear()}.
        {existing.length > 0 && " Befintliga pass kan krocka — kontrollera först."}
      </div>
      <div className="flex justify-end">
        <button onClick={() => apply.mutate()} disabled={apply.isPending || !expanded.length}
          className="flex items-center gap-2 rounded-xl border border-[oklch(0.85_0.12_85/0.4)] bg-[oklch(0.85_0.12_85/0.08)] px-5 py-2.5 text-sm font-medium text-[oklch(0.85_0.12_85)] disabled:opacity-50">
          <Plus className="h-4 w-4" /> Applicera mönster
        </button>
      </div>
    </div>
  );
}
