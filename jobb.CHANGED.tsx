import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateShift, DEFAULT_OB_RULES, type OBRule } from "@/modules/salary/ob";
import { BUILTIN_TEMPLATES, type ShiftTemplate } from "@/modules/salary/templates";
import { parseQuickCommand, parsePastedSchedule, isoDate } from "@/modules/salary/parser";
import { detectWarnings, daySummaries, type ShiftWarning } from "@/modules/salary/conflicts";
import { createShifts } from "@/modules/salary/shift-service";
import { currentOwner } from "@/modules/core/session";
import { sek, sekPrecise, sweDate, sweTime } from "@/lib/format";
import {
  Plus, Trash2, Clock, Calculator, X, Repeat, CalendarRange, Wand2, ClipboardPaste,
  Copy, Bookmark, AlertTriangle, Sparkles, Save,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/jobb")({ component: JobbPage });

function todayStr(offsetDays = 0) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return isoDate(d);
}
function addDaysStr(s: string, days: number) {
  const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + days);
  return isoDate(d);
}

type Planned = { date: string; from?: string; to?: string; breakMinutes?: number; note?: string };

function JobbPage() {
  const qc = useQueryClient();
  const [engineOpen, setEngineOpen] = useState(false);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const shifts = useQuery({
    queryKey: ["shifts", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").order("starts_at", { ascending: false }).limit(100);
      if (error) throw error; return data ?? [];
    },
  });

  const templates = useQuery({
    queryKey: ["shift_templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shift_templates").select("*").order("sort_order");
      if (error) throw error;
      return [...BUILTIN_TEMPLATES, ...(data ?? []).map((r: any) => ({ ...r }))] as ShiftTemplate[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("shifts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); toast.success("Pass borttaget"); },
  });

  const summary = useMemo(() => {
    const now = new Date(); const ms = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthShifts = (shifts.data ?? []).filter((s: any) => new Date(s.starts_at).getTime() >= ms);
    const hours = monthShifts.reduce((sum, s: any) => {
      const h = (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3600000 - (s.break_minutes ?? 0) / 60;
      return sum + h;
    }, 0);
    const base = monthShifts.reduce((s, r: any) => s + Number(r.base_amount || 0), 0);
    const ob = monthShifts.reduce((s, r: any) => s + Number(r.ob_amount || 0), 0);
    const total = base + ob;
    const taxRate = Number(profile.data?.tax_rate ?? 30) / 100;
    const net = total * (1 - taxRate);
    return { hours, base, ob, total, net, count: monthShifts.length };
  }, [shifts.data, profile.data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Jobb & lön</div>
          <h1 className="display text-4xl">Ditt schema</h1>
          <p className="mt-1 text-sm text-muted-foreground">Snabbmotorn lägger in pass på sex olika sätt — vi räknar OB, rast och netto åt dig.</p>
        </div>
        <button onClick={() => setEngineOpen(v => !v)} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[oklch(0.88_0.1_85)] to-[oklch(0.7_0.12_75)] px-5 py-2.5 text-sm font-semibold text-background shadow-[0_10px_30px_-10px_oklch(0.78_0.105_85/0.5)]">
          <Sparkles className="h-4 w-4" /> {engineOpen ? "Stäng motor" : "Snabbmotor"}
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        <Stat label="Timmar" value={summary.hours.toFixed(1)} sub={`${summary.count} pass`} />
        <Stat label="Grundlön" value={sek(summary.base)} />
        <Stat label="OB-tillägg" value={sek(summary.ob)} accent />
        <Stat label="Netto (est.)" value={sek(summary.net)} sub={`Efter ${profile.data?.tax_rate ?? 30}% skatt`} />
      </section>

      {engineOpen && (
        <ShiftEngine
          defaultRate={Number(profile.data?.hourly_rate ?? 0)}
          taxRate={Number(profile.data?.tax_rate ?? 30)}
          obRules={(profile.data?.ob_rules as OBRule[] | null)?.length ? (profile.data!.ob_rules as OBRule[]) : DEFAULT_OB_RULES}
          existing={shifts.data ?? []}
          templates={templates.data ?? BUILTIN_TEMPLATES}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["shifts"] });
            qc.invalidateQueries({ queryKey: ["shift_templates"] });
          }}
        />
      )}

      <section className="glass rounded-3xl p-6">
        <h2 className="display text-xl">Senaste pass</h2>
        {shifts.isLoading ? (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-white/[0.03]" />
        ) : (shifts.data ?? []).length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Inga pass än. Tryck "Snabbmotor" ovan.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {shifts.data!.map((s: any) => (
              <li key={s.id} className="flex items-center gap-4 py-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/[0.04]">
                  <Clock className="h-5 w-5 text-[oklch(0.85_0.12_85)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.title || "Arbetspass"}{s.is_extra && <span className="ml-2 rounded-full bg-[oklch(0.78_0.105_85/0.15)] px-2 py-0.5 text-[10px] text-[oklch(0.85_0.12_85)]">Extra</span>}</div>
                  <div className="text-xs text-muted-foreground">{sweDate(s.starts_at)} · {sweTime(s.starts_at)}–{sweTime(s.ends_at)} · rast {s.break_minutes}min</div>
                </div>
                <div className="text-right">
                  <div className="num gold-text">{sek(Number(s.total_amount || 0))}</div>
                  <div className="text-[10px] text-muted-foreground">grund {sek(Number(s.base_amount || 0))} + OB {sek(Number(s.ob_amount || 0))}</div>
                </div>
                <button onClick={() => del.mutate(s.id)} className="ml-2 grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-white/[0.05] hover:text-[oklch(0.7_0.12_28)]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`num mt-2 text-3xl ${accent ? "gold-text" : ""}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ============================================================================
// SHIFT ENGINE
// ============================================================================

type Mode = "snabb" | "intervall" | "monster" | "kopiera" | "klistra" | "kommando";

const MODES: Array<{ id: Mode; label: string; icon: any }> = [
  { id: "snabb", label: "Snabb", icon: Plus },
  { id: "intervall", label: "Intervall", icon: CalendarRange },
  { id: "monster", label: "Mönster", icon: Repeat },
  { id: "kopiera", label: "Kopiera", icon: Copy },
  { id: "klistra", label: "Klistra in", icon: ClipboardPaste },
  { id: "kommando", label: "Kommando", icon: Wand2 },
];

const WEEKDAYS = [
  { i: 1, label: "Mån" }, { i: 2, label: "Tis" }, { i: 3, label: "Ons" },
  { i: 4, label: "Tor" }, { i: 5, label: "Fre" }, { i: 6, label: "Lör" }, { i: 0, label: "Sön" },
];

function ShiftEngine({
  defaultRate, taxRate, obRules, existing, templates, onDone,
}: {
  defaultRate: number;
  taxRate: number;
  obRules: OBRule[];
  existing: any[];
  templates: ShiftTemplate[];
  onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>("snabb");
  const [planned, setPlanned] = useState<Planned[]>([]);

  // Gemensam config (gäller pass utan egen tid)
  const [title, setTitle] = useState("");
  const [from, setFrom] = useState("08:00");
  const [to, setTo] = useState("16:00");
  const [breakMin, setBreakMin] = useState(30);
  const [rate, setRate] = useState(defaultRate || 180);
  const [isExtra, setIsExtra] = useState(false);

  // Lägger till datum (utan duplikater)
  function addDates(dates: string[], times?: { from?: string; to?: string }) {
    if (dates.length === 0) return;
    setPlanned(prev => {
      const seen = new Set(prev.map(p => p.date + "@" + (p.from ?? "") + "-" + (p.to ?? "")));
      const adds: Planned[] = [];
      for (const d of dates) {
        const item: Planned = { date: d, from: times?.from, to: times?.to };
        const key = item.date + "@" + (item.from ?? "") + "-" + (item.to ?? "");
        if (!seen.has(key)) { seen.add(key); adds.push(item); }
      }
      return [...prev, ...adds].sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  function removeAt(idx: number) {
    setPlanned(prev => prev.filter((_, i) => i !== idx));
  }

  function applyTemplate(t: ShiftTemplate) {
    setFrom(t.starts_time); setTo(t.ends_time); setBreakMin(t.break_minutes);
    if (t.hourly_rate) setRate(Number(t.hourly_rate));
    toast.success(`Mall "${t.name}" applicerad`);
  }

  // Sammanfattning av alla planerade pass
  const calc = useMemo(() => {
    let total = 0, ob = 0, base = 0, hours = 0;
    const perDate: Array<{ p: Planned; total: number; ob: number; hours: number }> = [];
    for (const p of planned) {
      try {
        const f = p.from ?? from; const t = p.to ?? to; const br = p.breakMinutes ?? breakMin;
        const startsAt = new Date(`${p.date}T${f}:00`);
        let endsAt = new Date(`${p.date}T${t}:00`);
        if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86400000);
        const c = calculateShift({ startsAt, endsAt, breakMinutes: br, hourlyRate: rate, obRules });
        total += c.totalAmount; ob += c.obAmount; base += c.baseAmount; hours += c.hours;
        perDate.push({ p, total: c.totalAmount, ob: c.obAmount, hours: c.hours });
      } catch {}
    }
    return { total, ob, base, hours, perDate, net: total * (1 - taxRate / 100) };
  }, [planned, from, to, breakMin, rate, obRules, taxRate]);

  const days = useMemo(() => daySummaries(planned.map(p => p.date)), [planned]);

  const warnings = useMemo<ShiftWarning[]>(() => detectWarnings(
    planned.map(p => ({ date: p.date, from: p.from ?? from, to: p.to ?? to, breakMinutes: p.breakMinutes ?? breakMin })),
    existing,
  ), [planned, existing, from, to, breakMin]);

  const redCount = days.filter(d => d.isRed).length;
  const weekendCount = days.filter(d => d.isWeekend && !d.isRed).length;
  const overtimeCount = calc.perDate.filter(p => p.hours > 10).length;

  const [saving, setSaving] = useState(false);

  async function saveAll() {
    if (planned.length === 0) { toast.error("Inga pass att spara"); return; }
    setSaving(true);
    try {
      const { userId, contextId } = await currentOwner();

      // Skapa alla pass via den centrala servicen: tidszons-säkert, ägarskap,
      // oföränderlig lönesnapshot och timeline i synk — allt på ETT ställe.
      await createShifts(planned.map(p => ({
        userId,
        ownerContextId: contextId,
        title: title || null,
        date: p.date,
        from: p.from ?? from,
        to: p.to ?? to,
        breakMinutes: p.breakMinutes ?? breakMin,
        shiftType: "regular" as const,
        isExtra,
        profile: { hourly_rate: rate, ob_rules: obRules } as any,
        source: "manual",
      })));

      toast.success(`${planned.length} pass sparade`);
      setPlanned([]);
      onDone();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="glass rounded-3xl p-6">
      <div className="mb-4 flex items-center gap-2">
        <Calculator className="h-5 w-5 text-[oklch(0.85_0.12_85)]" />
        <h2 className="display text-xl">Snabbmotor</h2>
        <span className="ml-2 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{planned.length} planerade</span>
      </div>

      {/* Mall-strip */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Mallar — klicka för att applicera</span>
          <TemplateSaver from={from} to={to} breakMin={breakMin} rate={rate} onSaved={onDone} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {templates.map(t => (
            <button key={t.id} type="button" onClick={() => applyTemplate(t)}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.02] px-3 py-1.5 text-xs hover:border-[oklch(0.78_0.105_85/0.5)]">
              <span className="h-2 w-2 rounded-full" style={{ background: t.color ?? "oklch(0.78 0.105 85)" }} />
              <span className="font-medium">{t.name}</span>
              <span className="text-[10px] text-muted-foreground">{t.starts_time}–{t.ends_time}</span>
              {!t.builtin && (
                <button type="button" onClick={async (e) => {
                  e.stopPropagation();
                  await supabase.from("shift_templates").delete().eq("id", t.id);
                  toast.success("Mall borttagen"); onDone();
                }} className="opacity-0 group-hover:opacity-100"><X className="h-3 w-3 text-muted-foreground" /></button>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Gemensam tid/lön */}
      <div className="mb-5 grid gap-3 rounded-2xl border border-border bg-white/[0.02] p-3 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Titel"><input value={title} onChange={e => setTitle(e.target.value)} className="inp" placeholder="t.ex. Kvällspass" /></Field>
        <Field label="Från"><input type="time" value={from} onChange={e => setFrom(e.target.value)} className="inp" /></Field>
        <Field label="Till"><input type="time" value={to} onChange={e => setTo(e.target.value)} className="inp" /></Field>
        <Field label="Rast (min)"><input type="number" min={0} value={breakMin} onChange={e => setBreakMin(+e.target.value)} className="inp" /></Field>
        <Field label="Timlön"><input type="number" min={0} value={rate} onChange={e => setRate(+e.target.value)} className="inp" /></Field>
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" checked={isExtra} onChange={e => setIsExtra(e.target.checked)} className="h-4 w-4 accent-[oklch(0.78_0.105_85)]" />
          Extrapass
        </label>
      </div>

      {/* Mode-tabs */}
      <div className="mb-3 flex flex-wrap gap-1 rounded-full border border-border bg-white/[0.02] p-1">
        {MODES.map(m => {
          const Icon = m.icon; const on = mode === m.id;
          return (
            <button key={m.id} type="button" onClick={() => setMode(m.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${on ? "bg-[oklch(0.78_0.105_85)] text-background" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" /> {m.label}
            </button>
          );
        })}
      </div>

      <div className="mb-5 rounded-2xl border border-border bg-white/[0.02] p-4">
        {mode === "snabb" && <ModeSnabb onAdd={addDates} />}
        {mode === "intervall" && <ModeIntervall onAdd={addDates} />}
        {mode === "monster" && <ModeMonster onAdd={addDates} />}
        {mode === "kopiera" && <ModeKopiera existing={existing} onAdd={(items) => setPlanned(prev => [...prev, ...items].sort((a, b) => a.date.localeCompare(b.date)))} />}
        {mode === "klistra" && <ModeKlistra onAdd={(items) => setPlanned(prev => [...prev, ...items].sort((a, b) => a.date.localeCompare(b.date)))} />}
        {mode === "kommando" && <ModeKommando onAdd={addDates} />}
      </div>

      {/* Planerade pass */}
      {planned.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Planerade pass ({planned.length})</span>
            <button type="button" onClick={() => setPlanned([])} className="text-xs text-muted-foreground hover:text-foreground">Töm</button>
          </div>
          <ul className="max-h-64 space-y-1 overflow-auto rounded-xl border border-border bg-white/[0.02] p-2">
            {planned.map((p, i) => {
              const day = days[i];
              const item = calc.perDate[i];
              return (
                <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/[0.03]">
                  <span className="w-28 truncate font-medium">{sweDate(p.date)}</span>
                  <span className="text-muted-foreground">{p.from ?? from}–{p.to ?? to}</span>
                  {day?.isRed && <span className="rounded-full bg-[oklch(0.7_0.12_28/0.15)] px-1.5 py-0.5 text-[10px] text-[oklch(0.78_0.12_28)]">{day.redName ?? "Helg"}</span>}
                  {day?.isWeekend && !day.isRed && <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[10px]">Helg</span>}
                  <span className="ml-auto num text-muted-foreground">{item?.hours.toFixed(1)}h</span>
                  <span className="num w-20 text-right text-[oklch(0.85_0.12_85)]">{sek(item?.total ?? 0)}</span>
                  <button type="button" onClick={() => removeAt(i)} className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-white/[0.05]"><X className="h-3 w-3" /></button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Smart summering */}
      {planned.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[oklch(0.78_0.105_85/0.25)] bg-[oklch(0.78_0.105_85/0.05)] p-5">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Sammanfattning innan du sparar</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryStat label="Pass" value={String(planned.length)} />
            <SummaryStat label="Timmar" value={calc.hours.toFixed(1)} />
            <SummaryStat label="Grund" value={sekPrecise(calc.base)} />
            <SummaryStat label="OB" value={sekPrecise(calc.ob)} accent />
            <SummaryStat label="Brutto" value={sekPrecise(calc.total)} />
            <SummaryStat label="Netto (est.)" value={sekPrecise(calc.net)} accent />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {redCount > 0 && <Tag color="red">{redCount} röd dag{redCount > 1 ? "ar" : ""}</Tag>}
            {weekendCount > 0 && <Tag>{weekendCount} helg-pass</Tag>}
            {overtimeCount > 0 && <Tag color="amber">{overtimeCount} långa pass (10h+)</Tag>}
            {warnings.length === 0 && <Tag color="green">Inga konflikter</Tag>}
          </div>
          {warnings.length > 0 && (
            <ul className="mt-3 space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-[oklch(0.7_0.12_28/0.08)] px-2.5 py-1.5 text-xs text-[oklch(0.85_0.1_28)]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium">{sweDate(w.date)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={saving || planned.length === 0} onClick={saveAll}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? "Sparar..." : `Spara alla ${planned.length} pass`}
        </button>
      </div>

      <style>{`.inp { width:100%; background:transparent; outline:none; border:1px solid var(--color-border); padding:0.5rem 0.625rem; border-radius:0.625rem; font-size:0.875rem; }`}</style>
    </div>
  );
}

// ============================================================================
// MODE-PANELER
// ============================================================================

function ModeSnabb({ onAdd }: { onAdd: (dates: string[]) => void }) {
  const [d, setD] = useState(todayStr());
  return (
    <div className="flex items-end gap-2">
      <Field label="Lägg till datum"><input type="date" value={d} onChange={e => setD(e.target.value)} className="inp" /></Field>
      <button type="button" onClick={() => { onAdd([d]); setD(addDaysStr(d, 1)); }}
        className="rounded-lg bg-[oklch(0.78_0.105_85)] px-4 py-2 text-sm font-semibold text-background">
        Lägg till
      </button>
      <span className="text-xs text-muted-foreground">Tryck flera gånger för att lägga in dag efter dag.</span>
    </div>
  );
}

function ModeIntervall({ onAdd }: { onAdd: (dates: string[]) => void }) {
  const [s, setS] = useState(todayStr());
  const [e, setE] = useState(todayStr(13));
  const [skipWeekends, setSkipWeekends] = useState(false);

  function apply() {
    if (e < s) { toast.error("Slutdatum före startdatum"); return; }
    const out: string[] = [];
    for (let i = 0; ; i++) {
      const ds = addDaysStr(s, i);
      if (ds > e) break;
      const wd = new Date(`${ds}T00:00:00`).getDay();
      if (skipWeekends && (wd === 0 || wd === 6)) continue;
      out.push(ds);
    }
    onAdd(out);
    toast.success(`${out.length} datum tillagda`);
  }
  return (
    <div className="grid items-end gap-3 sm:grid-cols-4">
      <Field label="Från"><input type="date" value={s} onChange={ev => setS(ev.target.value)} className="inp" /></Field>
      <Field label="Till"><input type="date" value={e} onChange={ev => setE(ev.target.value)} className="inp" /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={skipWeekends} onChange={ev => setSkipWeekends(ev.target.checked)} className="h-4 w-4 accent-[oklch(0.78_0.105_85)]" />
        Hoppa över helger
      </label>
      <button type="button" onClick={apply} className="rounded-lg bg-[oklch(0.78_0.105_85)] px-4 py-2 text-sm font-semibold text-background">Lägg till</button>
    </div>
  );
}

function ModeMonster({ onAdd }: { onAdd: (dates: string[]) => void }) {
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [start, setStart] = useState(todayStr());
  const [weeks, setWeeks] = useState(4);

  function apply() {
    if (days.length === 0) { toast.error("Välj minst en veckodag"); return; }
    const out: string[] = [];
    for (let w = 0; w < weeks; w++) {
      for (let i = 0; i < 7; i++) {
        const ds = addDaysStr(start, w * 7 + i);
        const wd = new Date(`${ds}T00:00:00`).getDay();
        if (days.includes(wd)) out.push(ds);
      }
    }
    onAdd(out);
    toast.success(`${out.length} datum tillagda`);
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map(w => {
          const on = days.includes(w.i);
          return (
            <button key={w.i} type="button"
              onClick={() => setDays(prev => on ? prev.filter(x => x !== w.i) : [...prev, w.i])}
              className={`rounded-full px-3 py-1 text-xs ${on ? "bg-[oklch(0.78_0.105_85)] text-background" : "border border-border text-muted-foreground hover:text-foreground"}`}>
              {w.label}
            </button>
          );
        })}
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-3">
        <Field label="Från"><input type="date" value={start} onChange={e => setStart(e.target.value)} className="inp" /></Field>
        <Field label="Antal veckor"><input type="number" min={1} max={52} value={weeks} onChange={e => setWeeks(+e.target.value)} className="inp" /></Field>
        <button type="button" onClick={apply} className="rounded-lg bg-[oklch(0.78_0.105_85)] px-4 py-2 text-sm font-semibold text-background">Lägg till</button>
      </div>
    </div>
  );
}

function ModeKopiera({ existing, onAdd }: { existing: any[]; onAdd: (items: Planned[]) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [offsetDays, setOffsetDays] = useState(7);

  const sorted = useMemo(() => [...existing].slice(0, 30), [existing]);

  function apply() {
    if (picked.size === 0) { toast.error("Välj minst ett pass"); return; }
    const items: Planned[] = [];
    for (const id of picked) {
      const s = existing.find((x: any) => x.id === id);
      if (!s) continue;
      const start = new Date(s.starts_at); const end = new Date(s.ends_at);
      const newDateBase = new Date(start); newDateBase.setDate(newDateBase.getDate() + offsetDays);
      const pad = (n: number) => String(n).padStart(2, "0");
      items.push({
        date: isoDate(newDateBase),
        from: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
        to: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
        breakMinutes: s.break_minutes,
      });
    }
    onAdd(items);
    toast.success(`${items.length} pass kopierade`);
    setPicked(new Set());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <Field label="Förskjut antal dagar"><input type="number" value={offsetDays} onChange={e => setOffsetDays(+e.target.value)} className="inp w-32" /></Field>
        <span className="text-xs text-muted-foreground">+7 = nästa vecka, +14 = veckan därpå…</span>
        <button type="button" onClick={apply} className="ml-auto rounded-lg bg-[oklch(0.78_0.105_85)] px-4 py-2 text-sm font-semibold text-background">Kopiera valda</button>
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga tidigare pass att kopiera.</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-auto rounded-lg border border-border p-2">
          {sorted.map((s: any) => {
            const on = picked.has(s.id);
            return (
              <li key={s.id}>
                <label className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs ${on ? "bg-[oklch(0.78_0.105_85/0.1)]" : "hover:bg-white/[0.03]"}`}>
                  <input type="checkbox" checked={on} onChange={() => {
                    setPicked(prev => { const n = new Set(prev); on ? n.delete(s.id) : n.add(s.id); return n; });
                  }} className="h-3.5 w-3.5 accent-[oklch(0.78_0.105_85)]" />
                  <span className="font-medium">{sweDate(s.starts_at)}</span>
                  <span className="text-muted-foreground">{sweTime(s.starts_at)}–{sweTime(s.ends_at)}</span>
                  <span className="ml-auto num text-[oklch(0.85_0.12_85)]">{sek(Number(s.total_amount || 0))}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ModeKlistra({ onAdd }: { onAdd: (items: Planned[]) => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Planned[]>([]);

  function parse() {
    const rows = parsePastedSchedule(text);
    const items: Planned[] = rows.map(r => ({ date: r.date, from: r.from, to: r.to }));
    setPreview(items);
    if (items.length === 0) toast.error("Inga datum hittades");
    else toast.success(`${items.length} rader hittade`);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Klistra in ett schema — en rad per dag. T.ex. <code className="rounded bg-white/[0.05] px-1">2025-07-15 14:00-22:00</code> eller <code className="rounded bg-white/[0.05] px-1">Mån 15/7 14-22</code>.</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
        className="w-full rounded-lg border border-border bg-transparent p-3 text-sm font-mono"
        placeholder={"Mån 15/7 14-22\nTis 16/7 14-22\n17/7 08-16"} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={parse} className="rounded-lg border border-border px-3 py-2 text-xs">Förhandsgranska</button>
        {preview.length > 0 && (
          <button type="button" onClick={() => { onAdd(preview); setPreview([]); setText(""); }}
            className="rounded-lg bg-[oklch(0.78_0.105_85)] px-3 py-2 text-xs font-semibold text-background">
            Lägg till {preview.length} pass
          </button>
        )}
      </div>
      {preview.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {preview.map((p, i) => (
            <li key={i}>· {sweDate(p.date)} {p.from && p.to ? `${p.from}–${p.to}` : "(använder gemensam tid)"}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModeKommando({ onAdd }: { onAdd: (dates: string[], times?: { from?: string; to?: string }) => void }) {
  const [cmd, setCmd] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof parseQuickCommand> | null>(null);

  function run() {
    const r = parseQuickCommand(cmd);
    setPreview(r);
    if (r.dates.length === 0) toast.error("Inga datum kunde härledas");
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Skriv naturligt:
        <code className="ml-1 rounded bg-white/[0.05] px-1">07-16 varje måndag, tisdag och fredag i juli</code>,
        <code className="ml-1 rounded bg-white/[0.05] px-1">kvällspass 15-22 vecka 28</code>,
        <code className="ml-1 rounded bg-white/[0.05] px-1">09-17 lör sön v 30-32</code>.
      </p>
      <div className="flex gap-2">
        <input value={cmd} onChange={e => setCmd(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
          className="inp flex-1" placeholder="t.ex. 07-16 mån tis fre i juli" />
        <button type="button" onClick={run} className="rounded-lg border border-border px-3 py-2 text-xs">Tolka</button>
        {preview && preview.dates.length > 0 && (
          <button type="button" onClick={() => { onAdd(preview.dates, { from: preview.from, to: preview.to }); setPreview(null); setCmd(""); }}
            className="rounded-lg bg-[oklch(0.78_0.105_85)] px-3 py-2 text-xs font-semibold text-background">
            Lägg till {preview.dates.length}
          </button>
        )}
      </div>
      {preview && (
        <div className="text-xs text-muted-foreground">
          {preview.from && preview.to && <p>Tid: <span className="text-foreground">{preview.from}–{preview.to}</span></p>}
          {preview.dates.length > 0 && <p>{preview.dates.length} datum: {preview.dates.slice(0, 6).map(d => sweDate(d)).join(", ")}{preview.dates.length > 6 ? "…" : ""}</p>}
          {preview.notes.map((n, i) => <p key={i} className="text-[oklch(0.78_0.1_60)]">⚠ {n}</p>)}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HJÄLPKOMPONENTER
// ============================================================================

function TemplateSaver({ from, to, breakMin, rate, onSaved }: {
  from: string; to: string; breakMin: number; rate: number; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  async function save() {
    if (!name.trim()) { toast.error("Ange namn"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("shift_templates").insert({
      user_id: user.id, name: name.trim(), starts_time: from, ends_time: to,
      break_minutes: breakMin, hourly_rate: rate,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Mall sparad");
    setName(""); setOpen(false); onSaved();
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-1 text-xs text-[oklch(0.85_0.12_85)] hover:underline">
        <Bookmark className="h-3.5 w-3.5" /> Spara som mall
      </button>
      {open && (
        <div className="absolute right-6 mt-6 flex items-center gap-1 rounded-lg border border-border bg-background p-2 shadow-lg">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Mallens namn" className="rounded border border-border bg-transparent px-2 py-1 text-xs" autoFocus />
          <button type="button" onClick={save} className="grid h-7 w-7 place-items-center rounded bg-[oklch(0.78_0.105_85)] text-background"><Save className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`num mt-0.5 text-lg ${accent ? "text-[oklch(0.85_0.12_85)]" : ""}`}>{value}</div>
    </div>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color?: "red" | "amber" | "green" }) {
  const c = color === "red" ? "bg-[oklch(0.7_0.12_28/0.15)] text-[oklch(0.85_0.1_28)]"
    : color === "amber" ? "bg-[oklch(0.78_0.105_85/0.15)] text-[oklch(0.92_0.08_85)]"
    : color === "green" ? "bg-[oklch(0.65_0.15_145/0.15)] text-[oklch(0.85_0.13_145)]"
    : "bg-white/[0.05] text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 ${c}`}>{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
