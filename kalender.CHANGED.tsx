import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createShifts } from "@/modules/salary/shift-service";
import { createTransaction } from "@/modules/finance/finance-service";
import { currentOwner } from "@/modules/core/session";
import { stockholmToUtc } from "@/modules/core/datetime";
import { buildDayIndex, isoDateLocal, KIND_META, type DaySummary, type EventKind, type DayEvent } from "@/modules/calendar/source";
import { calculateShift, DEFAULT_OB_RULES, type OBRule } from "@/modules/salary/ob";
import { sek, num } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, Briefcase, Wallet, TrendingUp,
  Bell, Plane, StickyNote, X, Sparkles, Trash2,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/kalender")({ component: KalenderPage });

const WEEK_LABELS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const MONTH_LABELS = ["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"];

type QuickKind = "shift" | "expense" | "income" | "reminder" | "absence" | "note";

function KalenderPage() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [selected, setSelected] = useState<Date | null>(null);
  const [quick, setQuick] = useState<QuickKind | null>(null);
  const todayRef = useRef<HTMLButtonElement>(null);

  const start = useMemo(() => { const d = new Date(cursor); d.setDate(1); return d; }, [cursor]);
  const end = useMemo(() => { const d = new Date(cursor); d.setMonth(d.getMonth()+1); d.setDate(0); d.setHours(23,59,59,999); return d; }, [cursor]);

  // Build 6×7 grid starting Monday
  const grid: Date[] = useMemo(() => {
    const first = new Date(start);
    const dow = (first.getDay() + 6) % 7;
    first.setDate(first.getDate() - dow);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(first); d.setDate(d.getDate() + i); return d; });
  }, [start]);

  const gridStart = grid[0];
  const gridEnd = grid[grid.length - 1];

  const shifts = useQuery({
    queryKey: ["cal-shifts", isoDateLocal(gridStart)],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*")
        .gte("starts_at", gridStart.toISOString())
        .lte("starts_at", new Date(gridEnd.getTime() + 86400000).toISOString())
        .order("starts_at");
      if (error) throw error; return data ?? [];
    },
  });

  const expenses = useQuery({
    queryKey: ["cal-expenses", isoDateLocal(gridStart)],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*")
        .gte("occurred_at", gridStart.toISOString())
        .lte("occurred_at", new Date(gridEnd.getTime() + 86400000).toISOString());
      if (error) throw error; return data ?? [];
    },
  });

  const reminders = useQuery({
    queryKey: ["cal-reminders", isoDateLocal(gridStart)],
    queryFn: async () => {
      const { data, error } = await supabase.from("reminders").select("*")
        .gte("remind_at", gridStart.toISOString())
        .lte("remind_at", new Date(gridEnd.getTime() + 86400000).toISOString());
      if (error) throw error; return data ?? [];
    },
  });

  const absences = useQuery({
    queryKey: ["cal-absences", isoDateLocal(gridStart)],
    queryFn: async () => {
      const { data, error } = await supabase.from("absences").select("*")
        .lte("starts_on", isoDateLocal(gridEnd))
        .gte("ends_on", isoDateLocal(gridStart));
      if (error) throw error; return data ?? [];
    },
  });

  const timeline = useQuery({
    queryKey: ["cal-timeline", isoDateLocal(gridStart)],
    queryFn: async () => {
      const { data, error } = await supabase.from("timeline_events").select("*")
        .gte("occurs_at", gridStart.toISOString())
        .lte("occurs_at", new Date(gridEnd.getTime() + 86400000).toISOString())
        .in("kind", ["income","note","signal","health","travel","document"]);
      if (error) throw error; return data ?? [];
    },
  });

  const dayIndex = useMemo(() => buildDayIndex(gridStart, gridEnd, {
    shifts: shifts.data as any, expenses: expenses.data as any,
    reminders: reminders.data as any, absences: absences.data as any,
    timeline: timeline.data as any,
  }), [gridStart, gridEnd, shifts.data, expenses.data, reminders.data, absences.data, timeline.data]);

  // Auto-scroll till idag första gången
  useEffect(() => {
    const t = setTimeout(() => todayRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
    return () => clearTimeout(t);
  }, []);

  const monthName = `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const todayKey = isoDateLocal(new Date());

  const selectedDay: DaySummary | null = selected
    ? dayIndex.get(isoDateLocal(selected)) ?? null
    : null;

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["cal-shifts"] });
    qc.invalidateQueries({ queryKey: ["cal-expenses"] });
    qc.invalidateQueries({ queryKey: ["cal-reminders"] });
    qc.invalidateQueries({ queryKey: ["cal-absences"] });
    qc.invalidateQueries({ queryKey: ["cal-timeline"] });
    qc.invalidateQueries({ queryKey: ["shifts"] });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Kalender</div>
          <h1 className="display text-3xl capitalize sm:text-4xl">{monthName}</h1>
          <p className="mt-1 text-xs text-muted-foreground">Ditt liv på en sida — klicka på en dag för detaljer.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(d => { const n = new Date(d); n.setMonth(n.getMonth()-1); return n; })}
            className="grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-white/[0.05]">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => { const t = new Date(); t.setDate(1); t.setHours(0,0,0,0); setCursor(t); setSelected(new Date()); }}
            className="rounded-full border border-[oklch(0.78_0.105_85/0.5)] bg-[oklch(0.78_0.105_85/0.1)] px-4 py-2 text-xs text-[oklch(0.85_0.12_85)] hover:bg-[oklch(0.78_0.105_85/0.18)]">
            Idag
          </button>
          <button onClick={() => setCursor(d => { const n = new Date(d); n.setMonth(n.getMonth()+1); return n; })}
            className="grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-white/[0.05]">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Legend */}
      <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-2 text-[11px] text-muted-foreground">
        {(["shift","income","expense","reminder","absence","holiday","nameday"] as EventKind[]).map(k => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", KIND_META[k].dot)} /> {KIND_META[k].label}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="glass overflow-hidden rounded-3xl p-3 sm:p-5">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          {WEEK_LABELS.map(w => <div key={w}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((d) => {
            const key = isoDateLocal(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = key === todayKey;
            const day = dayIndex.get(key);
            const dots = day?.events.filter(e => e.kind !== "nameday").slice(0, 4) ?? [];
            const isSunday = d.getDay() === 0;
            return (
              <button
                key={key}
                ref={isToday ? todayRef : undefined}
                onClick={() => setSelected(new Date(d))}
                className={cn(
                  "group relative flex aspect-square flex-col rounded-xl border p-1.5 text-left transition sm:p-2",
                  isToday
                    ? "border-[oklch(0.85_0.12_85/0.7)] bg-gradient-to-br from-[oklch(0.85_0.12_85/0.18)] to-[oklch(0.78_0.105_85/0.04)] shadow-[0_0_24px_-6px_oklch(0.85_0.12_85/0.5)]"
                    : "border-transparent hover:border-border hover:bg-white/[0.03]",
                  !inMonth && "opacity-30",
                )}
              >
                <div className="flex items-start justify-between">
                  <span className={cn(
                    "num text-sm",
                    isToday && "font-bold text-[oklch(0.9_0.14_85)]",
                    !isToday && (day?.redDay || isSunday) && "text-[oklch(0.7_0.12_28)]",
                  )}>
                    {d.getDate()}
                  </span>
                  {isToday && (
                    <span className="rounded-full bg-[oklch(0.85_0.12_85)] px-1.5 py-px text-[8px] font-semibold uppercase tracking-wider text-background">
                      Idag
                    </span>
                  )}
                </div>
                {day?.redDay && (
                  <div className="mt-0.5 line-clamp-1 hidden text-[9px] text-[oklch(0.7_0.12_28)] sm:block">{day.redDay.name}</div>
                )}
                {day?.namedays.length ? (
                  <div className="mt-0.5 line-clamp-1 hidden text-[9px] text-muted-foreground sm:block">{day.namedays.join(", ")}</div>
                ) : null}
                {dots.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-1 pt-1">
                    {dots.map((e, i) => (
                      <span key={i} className={cn("h-1.5 w-1.5 rounded-full", e.dot)} title={e.title} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* DayPanel (Sheet) */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-background/95 backdrop-blur-xl sm:max-w-md">
          {selectedDay && selected && (
            <DayPanel
              day={selectedDay} date={selected}
              onClose={() => setSelected(null)}
              onQuick={(k) => setQuick(k)}
              onRefresh={refreshAll}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Quick-add dialogs */}
      {selected && quick && (
        <QuickAddDialog
          kind={quick}
          date={selected}
          onClose={() => setQuick(null)}
          onSaved={() => { setQuick(null); refreshAll(); }}
        />
      )}
    </div>
  );
}

/* ===================== DAY PANEL ===================== */
function DayPanel({ day, date, onClose, onQuick, onRefresh }: {
  day: DaySummary; date: Date;
  onClose: () => void;
  onQuick: (k: QuickKind) => void;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const weekday = date.toLocaleDateString("sv-SE", { weekday: "long" });
  const fullDate = date.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });

  const groups: Record<string, DayEvent[]> = {};
  for (const ev of day.events) {
    if (ev.kind === "nameday") continue;
    (groups[ev.kind] ??= []).push(ev);
  }

  async function removeEvent(ev: DayEvent) {
    if (!ev.refTable || !ev.refId) return;
    if (!confirm(`Ta bort "${ev.title}"?`)) return;
    const { error } = await supabase.from(ev.refTable as any).delete().eq("id", ev.refId);
    if (error) return toast.error(error.message);
    toast.success("Borttaget");
    onRefresh();
  }

  const quickButtons: { k: QuickKind; label: string; icon: any }[] = [
    { k: "shift",    label: "Pass",        icon: Briefcase },
    { k: "expense",  label: "Utgift",      icon: Wallet },
    { k: "income",   label: "Inkomst",     icon: TrendingUp },
    { k: "reminder", label: "Påminnelse",  icon: Bell },
    { k: "absence",  label: "Semester",    icon: Plane },
    { k: "note",     label: "Anteckning",  icon: StickyNote },
  ];

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{weekday}</div>
          <h2 className="display text-3xl">{fullDate}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {day.redDay && <span className="rounded-full bg-[oklch(0.7_0.12_28/0.15)] px-2 py-0.5 text-[oklch(0.75_0.14_28)]">{day.redDay.name}</span>}
            {day.tradition && <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-muted-foreground">{day.tradition.name}</span>}
            {day.namedays.length > 0 && <span className="text-muted-foreground">Namnsdag: {day.namedays.join(", ")}</span>}
          </div>
        </div>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/[0.05]"><X className="h-4 w-4" /></button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2">
        <Mini label="Timmar" value={`${num(day.totals.hours, 1)} h`} />
        <Mini label="Brutto" value={sek(day.totals.gross)} accent />
        <Mini label="OB" value={sek(day.totals.ob)} />
        <Mini label="Utgifter" value={sek(day.totals.expenses)} />
      </div>

      {/* Quick add */}
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Lägg till</div>
        <div className="grid grid-cols-3 gap-2">
          {quickButtons.map(({ k, label, icon: Icon }) => (
            <button key={k} onClick={() => onQuick(k)}
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-white/[0.02] p-3 text-[11px] transition hover:border-[oklch(0.85_0.12_85/0.4)] hover:bg-[oklch(0.85_0.12_85/0.05)]">
              <Icon className="h-4 w-4 text-[oklch(0.85_0.12_85)]" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Events */}
      <div className="flex-1 space-y-4">
        {Object.entries(groups).length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Inga händelser den här dagen.
          </div>
        )}
        {Object.entries(groups).map(([kind, list]) => (
          <div key={kind}>
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", KIND_META[kind as EventKind]?.dot)} />
              {KIND_META[kind as EventKind]?.label}
            </div>
            <ul className="space-y-1.5">
              {list.map((ev) => (
                <li key={ev.id} className="group flex items-center justify-between rounded-xl border border-border bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{ev.title}</div>
                    {ev.subtitle && <div className="truncate text-xs text-muted-foreground">{ev.subtitle}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {ev.amount != null && (
                      <span className={cn("num text-sm", ev.amount < 0 ? "text-[oklch(0.7_0.14_28)]" : "gold-text")}>
                        {ev.amount < 0 ? "−" : ""}{sek(Math.abs(ev.amount))}
                      </span>
                    )}
                    {ev.refTable && (
                      <button onClick={() => removeEvent(ev)} className="opacity-0 transition group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-[oklch(0.7_0.14_28)]" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Insight (deterministic) */}
      {(day.totals.hours > 10 || (day.totals.expenses > 1000 && day.totals.gross === 0)) && (
        <div className="rounded-xl border border-[oklch(0.85_0.12_85/0.3)] bg-[oklch(0.85_0.12_85/0.07)] p-3 text-xs">
          <div className="mb-1 flex items-center gap-1.5 text-[oklch(0.85_0.12_85)]"><Sparkles className="h-3.5 w-3.5" /> Insikt</div>
          {day.totals.hours > 10 && <div>Lång arbetsdag — kom ihåg återhämtning.</div>}
          {day.totals.expenses > 1000 && day.totals.gross === 0 && <div>Hög utgift på en dag utan inkomst.</div>}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("num mt-0.5 text-lg", accent && "gold-text")}>{value}</div>
    </div>
  );
}

/* ===================== QUICK ADD DIALOG ===================== */
function QuickAddDialog({ kind, date, onClose, onSaved }: {
  kind: QuickKind; date: Date; onClose: () => void; onSaved: () => void;
}) {
  const dateKey = isoDateLocal(date);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="display text-2xl">
            {{
              shift: "Nytt arbetspass", expense: "Ny utgift", income: "Ny inkomst",
              reminder: "Ny påminnelse", absence: "Frånvaro / semester", note: "Anteckning",
            }[kind]}
          </DialogTitle>
          <div className="text-xs text-muted-foreground">{date.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}</div>
        </DialogHeader>
        {kind === "shift" && <ShiftForm date={dateKey} onSaved={onSaved} />}
        {kind === "expense" && <ExpenseForm date={dateKey} onSaved={onSaved} />}
        {kind === "income" && <IncomeForm date={dateKey} onSaved={onSaved} />}
        {kind === "reminder" && <ReminderForm date={dateKey} onSaved={onSaved} />}
        {kind === "absence" && <AbsenceForm date={dateKey} onSaved={onSaved} />}
        {kind === "note" && <NoteForm date={dateKey} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function inp(extra = "") { return cn("w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-[oklch(0.85_0.12_85/0.5)]", extra); }
function lbl(s: string) { return <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{s}</div>; }
function saveBtn(loading: boolean, label = "Spara") {
  return (
    <button type="submit" disabled={loading}
      className="w-full rounded-xl bg-gradient-to-r from-[oklch(0.85_0.12_85)] to-[oklch(0.6_0.1_75)] px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
      {loading ? "Sparar..." : label}
    </button>
  );
}

function ShiftForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [from, setFrom] = useState("08:00");
  const [to, setTo] = useState("16:00");
  const [breakMin, setBreakMin] = useState(30);
  const [title, setTitle] = useState("Pass");
  const [rate, setRate] = useState(0);
  const [profileId, setProfileId] = useState<string>("");

  const profiles = useQuery({
    queryKey: ["work-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("work_profiles").select("*").order("is_default", { ascending: false });
      return data ?? [];
    },
  });
  const fallbackProfile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("hourly_rate, ob_rules").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const def = profiles.data?.find((p: any) => p.is_default) ?? profiles.data?.[0];
    if (def) { setProfileId(def.id); setRate(Number(def.hourly_rate ?? 0)); }
    else if (fallbackProfile.data) setRate(Number(fallbackProfile.data.hourly_rate ?? 0));
  }, [profiles.data, fallbackProfile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { userId, contextId } = await currentOwner();
      const def = profiles.data?.find((p: any) => p.id === profileId);
      const obRules = ((def?.ob_rules ?? fallbackProfile.data?.ob_rules) as OBRule[] | null) || DEFAULT_OB_RULES;
      await createShifts([{
        userId,
        ownerContextId: contextId,
        title,
        date,
        from,
        to,
        breakMinutes: breakMin,
        shiftType: "regular" as const,
        workProfileId: profileId || null,
        profile: { hourly_rate: rate, ob_rules: obRules } as any,
        source: "manual",
      }]);
    },
    onSuccess: () => { toast.success("Pass tillagt"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3 pt-2">
      <div>{lbl("Titel")}<input value={title} onChange={(e) => setTitle(e.target.value)} className={inp()} /></div>
      {profiles.data && profiles.data.length > 0 && (
        <div>{lbl("Arbetsprofil")}
          <select value={profileId} onChange={(e) => { setProfileId(e.target.value); const p = profiles.data.find((x: any) => x.id === e.target.value); if (p) setRate(Number(p.hourly_rate ?? 0)); }} className={inp()}>
            {profiles.data.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.is_default ? " ★" : ""}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div>{lbl("Från")}<input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={inp()} /></div>
        <div>{lbl("Till")}<input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={inp()} /></div>
        <div>{lbl("Rast (min)")}<input type="number" value={breakMin} onChange={(e) => setBreakMin(+e.target.value)} className={inp()} /></div>
      </div>
      <div>{lbl("Timlön (kr)")}<input type="number" value={rate} onChange={(e) => setRate(+e.target.value)} className={inp()} /></div>
      {saveBtn(save.isPending, "Spara pass")}
    </form>
  );
}

function ExpenseForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [amount, setAmount] = useState<number>(0);
  const [cat, setCat] = useState("annat");
  const [desc, setDesc] = useState("");
  const [merchant, setMerchant] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      await createTransaction({
        direction: "out",
        amount,
        categoryName: cat,
        description: desc || null,
        merchant: merchant || null,
        occurredAt: stockholmToUtc(date, "12:00").toISOString(),
      });
    },
    onSuccess: () => { toast.success("Utgift tillagd"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3 pt-2">
      <div className="grid grid-cols-2 gap-2">
        <div>{lbl("Belopp (kr)")}<input type="number" step="0.01" value={amount || ""} onChange={(e) => setAmount(+e.target.value)} className={inp()} required /></div>
        <div>{lbl("Kategori")}
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={inp()}>
            {["mat","transport","boende","noje","prenumeration","klader","halsa","sparande","overforing","annat"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>{lbl("Beskrivning")}<input value={desc} onChange={(e) => setDesc(e.target.value)} className={inp()} /></div>
      <div>{lbl("Var?")}<input value={merchant} onChange={(e) => setMerchant(e.target.value)} className={inp()} placeholder="ICA, Spotify…" /></div>
      {saveBtn(save.isPending, "Spara utgift")}
    </form>
  );
}

function IncomeForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [amount, setAmount] = useState<number>(0);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");
      const { error } = await supabase.from("timeline_events").insert({
        user_id: user.id, kind: "income" as any, title: title || "Inkomst", subtitle: note || null,
        amount, occurs_at: new Date(`${date}T12:00:00`).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Inkomst tillagd"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3 pt-2">
      <div>{lbl("Titel")}<input value={title} onChange={(e) => setTitle(e.target.value)} className={inp()} placeholder="Bonus, sidoinkomst…" /></div>
      <div>{lbl("Belopp (kr)")}<input type="number" step="0.01" value={amount || ""} onChange={(e) => setAmount(+e.target.value)} className={inp()} required /></div>
      <div>{lbl("Anteckning")}<input value={note} onChange={(e) => setNote(e.target.value)} className={inp()} /></div>
      {saveBtn(save.isPending, "Spara inkomst")}
    </form>
  );
}

function ReminderForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");
      const { error } = await supabase.from("reminders").insert({
        user_id: user.id, title, notes: notes || null,
        remind_at: new Date(`${date}T${time}:00`).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Påminnelse skapad"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3 pt-2">
      <div>{lbl("Vad?")}<input value={title} onChange={(e) => setTitle(e.target.value)} className={inp()} required /></div>
      <div>{lbl("Kl.")}<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inp()} /></div>
      <div>{lbl("Anteckning")}<input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp()} /></div>
      {saveBtn(save.isPending, "Spara påminnelse")}
    </form>
  );
}

function AbsenceForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [kind, setKind] = useState<"vacation"|"sick"|"vab"|"leave"|"other">("vacation");
  const [from, setFrom] = useState(date);
  const [to, setTo] = useState(date);
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");
      const { error } = await supabase.from("absences").insert({
        user_id: user.id, kind: kind as any, starts_on: from, ends_on: to,
        note: note || null, paid: kind === "vacation", status: "planned" as any,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Frånvaro sparad"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3 pt-2">
      <div>{lbl("Typ")}
        <select value={kind} onChange={(e) => setKind(e.target.value as any)} className={inp()}>
          <option value="vacation">Semester</option>
          <option value="sick">Sjuk</option>
          <option value="vab">VAB</option>
          <option value="leave">Tjänstledig</option>
          <option value="other">Annat</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>{lbl("Från")}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp()} /></div>
        <div>{lbl("Till")}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp()} /></div>
      </div>
      <div>{lbl("Anteckning")}<input value={note} onChange={(e) => setNote(e.target.value)} className={inp()} placeholder="Grekland, läkartid…" /></div>
      {saveBtn(save.isPending, "Spara frånvaro")}
    </form>
  );
}

function NoteForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");
      const { error } = await supabase.from("timeline_events").insert({
        user_id: user.id, kind: "note" as any, title: title || "Anteckning",
        subtitle: body || null, occurs_at: new Date(`${date}T12:00:00`).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Anteckning sparad"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3 pt-2">
      <div>{lbl("Rubrik")}<input value={title} onChange={(e) => setTitle(e.target.value)} className={inp()} /></div>
      <div>{lbl("Anteckning")}<textarea value={body} onChange={(e) => setBody(e.target.value)} className={inp("min-h-[100px] resize-y")} /></div>
      {saveBtn(save.isPending, "Spara anteckning")}
    </form>
  );
}
