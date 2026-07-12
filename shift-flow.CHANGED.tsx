import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Briefcase, Check, Moon, Phone, Radio, Sun } from "lucide-react";
import { getDefault, getTopShiftPatterns, learnFromShift } from "@/lib/defaults";
import { computeShiftAmounts } from "@/modules/salary/compute";
import { createShifts } from "@/modules/salary/shift-service";
import { currentOwner } from "@/modules/core/session";
import { shiftRange } from "@/modules/core/datetime";
import { sweDate, sweTime } from "@/modules/core/i18n/format";
import { cn } from "@/lib/utils";

type Preset = { label: string; from: string; to: string; badge?: string };
type ShiftType = "regular" | "waking_on_call" | "sleeping_on_call" | "standby";

const FALLBACK_PRESETS: Preset[] = [
  { label: "Dagpass", from: "07:00", to: "16:00", badge: "07–16" },
  { label: "Kvällspass", from: "14:00", to: "22:00", badge: "14–22" },
  { label: "Nattpass", from: "22:00", to: "06:00", badge: "22–06" },
];

const TYPE_META: Record<ShiftType, { label: string; icon: typeof Sun; hint: string }> = {
  regular:          { label: "Vanligt",     icon: Sun,   hint: "Ordinarie arbete" },
  waking_on_call:   { label: "Vaken jour",  icon: Phone, hint: "Aktiv jour hela passet" },
  sleeping_on_call: { label: "Sovande jour",icon: Moon,  hint: "Sover på plats, aktiv tid räknas separat" },
  standby:          { label: "Beredskap",   icon: Radio, hint: "Hemma, kan bli inkallad" },
};

export function ShiftFlow({ defaultDate, onDone }: { defaultDate?: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [presets, setPresets] = useState<Preset[]>(FALLBACK_PRESETS);
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [shiftType, setShiftType] = useState<ShiftType>("regular");
  const [activeMinutes, setActiveMinutes] = useState(0);

  const profiles = useQuery({
    queryKey: ["wp-active"],
    queryFn: async () => {
      const { data } = await supabase.from("work_profiles").select("*").order("is_default", { ascending: false });
      return data ?? [];
    },
  });
  const defaultProfile = profiles.data?.find((p: any) => p.is_default) ?? profiles.data?.[0];

  useEffect(() => {
    (async () => {
      const [last, top] = await Promise.all([
        getDefault<{ from: string; to: string; breakMinutes: number }>("shift.last"),
        getTopShiftPatterns(),
      ]);
      if (last?.breakMinutes !== undefined) setBreakMinutes(last.breakMinutes);

      const learned: Preset[] = top.map((p) => ({
        label: presetName(p.from, p.to),
        from: p.from, to: p.to,
        badge: `${p.from.replace(":", "")}–${p.to.replace(":", "")}`,
      }));
      if (last) {
        const exists = learned.some((p) => p.from === last.from && p.to === last.to);
        if (!exists) learned.unshift({ label: "Senaste", from: last.from, to: last.to, badge: `${last.from}–${last.to}` });
      }
      const merged = [...learned, ...FALLBACK_PRESETS].slice(0, 4);
      const seen = new Set<string>();
      setPresets(merged.filter((p) => {
        const k = `${p.from}-${p.to}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      }));
    })();
  }, []);

  // Preview av spänn/midnatt för aktuellt tidsval
  const timePreview = useMemo(() => {
    const t = custom ?? presets[0];
    if (!t) return null;
    const [sh, sm] = t.from.split(":").map(Number);
    const [eh, em] = t.to.split(":").map(Number);
    const startsAt = new Date(`${date}T${t.from}:00`);
    let endsAt = new Date(`${date}T${t.to}:00`);
    if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86400000);
    const spansMidnight = endsAt.getDate() !== startsAt.getDate();
    const totalH = (endsAt.getTime() - startsAt.getTime()) / 3600000;
    return { spansMidnight, totalH, endsAt };
  }, [custom, presets, date]);

  const save = useMutation({
    mutationFn: async (input: { from: string; to: string }) => {
      const { userId, contextId } = await currentOwner();

      // Tidszons-säker start/slut via core/datetime (ersätter buggig inline-logik).
      const { startsAt, endsAt } = shiftRange(date, input.from, input.to);

      // Krock-koll mot befintliga pass (soft delete respekteras).
      const winStart = new Date(startsAt.getTime() - 86400000).toISOString();
      const winEnd = new Date(endsAt.getTime() + 86400000).toISOString();
      const { data: existing } = await supabase
        .from("shifts")
        .select("id, starts_at, ends_at")
        .is("deleted_at", null)
        .gte("starts_at", winStart)
        .lte("ends_at", winEnd);
      const clash = (existing ?? []).find((ex: any) => {
        const es = new Date(ex.starts_at).getTime();
        const ee = new Date(ex.ends_at).getTime();
        return es < endsAt.getTime() && ee > startsAt.getTime();
      });
      if (clash) {
        const label = `${sweDate(clash.starts_at)} ${sweTime(clash.starts_at)}–${sweTime(clash.ends_at)}`;
        throw new Error(`Krock med pass ${label} — ta bort det först eller välj annan tid`);
      }

      // Skapa via den centrala servicen: snapshot, ägarskap, timeline i ETT.
      await createShifts([{
        userId,
        ownerContextId: contextId,
        workProfileId: defaultProfile?.id ?? null,
        date,
        from: input.from,
        to: input.to,
        breakMinutes,
        shiftType,
        activeMinutes,
        profile: (defaultProfile ?? null) as any,
        source: "manual",
      }]);

      await learnFromShift({
        from: input.from, to: input.to,
        breakMinutes,
        workProfileId: defaultProfile?.id ?? null,
      });
      return { from: input.from, to: input.to };
    },
    onSuccess: async (saved) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["cal-shifts"] });
      toast.success("Pass sparat");
      if (saved) {
        const top = await getTopShiftPatterns();
        const match = top.find((p) => p.from === saved.from && p.to === saved.to);
        if (match && match.count === 3) {
          toast(`Du har lagt ${saved.from}–${saved.to} tre gånger`, {
            description: "Vill du göra detta till standardpass?",
            action: { label: "Ja, spara", onClick: () => toast.success("Sparat som standard") },
            duration: 8000,
          });
        }
      }
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const showActive = shiftType === "sleeping_on_call" || shiftType === "standby";

  return (
    <div className="space-y-5">
      {/* Datum + profil */}
      <div className="flex items-center justify-between gap-3 text-sm">
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-border bg-background/50 px-3 py-2"
        />
        {defaultProfile && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground">
            <Briefcase className="h-3 w-3" /> {defaultProfile.name}
          </span>
        )}
      </div>

      {/* Passtyp */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Passtyp</div>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(TYPE_META) as ShiftType[]).map((t) => {
            const Meta = TYPE_META[t];
            const Icon = Meta.icon;
            const active = shiftType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setShiftType(t)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[10px] transition",
                  active
                    ? "border-[oklch(0.78_0.105_85/0.6)] bg-[oklch(0.78_0.105_85/0.1)] text-foreground"
                    : "border-border bg-white/[0.02] text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-center leading-tight">{Meta.label}</span>
              </button>
            );
          })}
        </div>
        <div className="text-[11px] text-muted-foreground">{TYPE_META[shiftType].hint}</div>
      </div>

      {/* Pass-mallar */}
      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Vilket pass?</div>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p, i) => (
            <button
              key={i}
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate({ from: p.from, to: p.to })}
              className={cn(
                "group flex items-center justify-between rounded-2xl border border-border bg-white/[0.02] px-4 py-4 text-left transition",
                "hover:border-[oklch(0.78_0.105_85/0.5)] hover:bg-[oklch(0.78_0.105_85/0.08)]",
                i === 0 && "border-[oklch(0.78_0.105_85/0.4)] bg-[oklch(0.78_0.105_85/0.06)]",
              )}
            >
              <div>
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-muted-foreground">{p.badge}</div>
              </div>
              {i === 0 && <span className="text-[10px] uppercase tracking-wider text-[oklch(0.85_0.12_85)]">Standard</span>}
            </button>
          ))}
        </div>
        {timePreview?.spansMidnight && (
          <div className="rounded-lg border border-[oklch(0.78_0.105_85/0.3)] bg-[oklch(0.78_0.105_85/0.06)] px-3 py-2 text-[11px] text-[oklch(0.85_0.12_85)]">
            → Går över midnatt. Slutar {timePreview.endsAt.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })} kl {String(timePreview.endsAt.getHours()).padStart(2,"0")}:{String(timePreview.endsAt.getMinutes()).padStart(2,"0")} ({timePreview.totalH.toFixed(1)} h)
          </div>
        )}
      </div>

      {/* Aktiv tid för sovande jour / beredskap */}
      {showActive && (
        <label className="block text-xs text-muted-foreground">
          Aktiv tid / utryckning (minuter)
          <input
            type="number" min={0}
            value={activeMinutes}
            onChange={(e) => setActiveMinutes(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[10px] text-muted-foreground/70">
            Tid du faktiskt blev inkallad / vaknade och arbetade under passet.
          </span>
        </label>
      )}

      {/* Egen tid */}
      {!custom ? (
        <button
          type="button"
          onClick={() => setCustom({ from: "09:00", to: "17:00" })}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Egen tid…
        </button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-border bg-white/[0.02] p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">Från
              <input type="time" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">Till
              <input type="time" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
            </label>
          </div>
          {shiftType === "regular" && (
            <label className="block text-xs text-muted-foreground">Rast (minuter)
              <input type="number" value={breakMinutes} onChange={(e) => setBreakMinutes(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm" />
            </label>
          )}
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate({ from: custom.from, to: custom.to })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[oklch(0.88_0.1_85)] to-[oklch(0.7_0.12_75)] py-2.5 text-sm font-medium text-background"
          >
            <Check className="h-4 w-4" /> Spara
          </button>
        </div>
      )}
    </div>
  );
}

function presetName(from: string, to: string) {
  const h = Number(from.slice(0, 2));
  if (h < 10) return "Dagpass";
  if (h < 16) return "Mellanpass";
  if (h < 22) return "Kvällspass";
  return "Nattpass";
}
