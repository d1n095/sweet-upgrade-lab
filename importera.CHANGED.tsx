import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, X, Check, Loader2, ArrowLeft, AlertCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/modules/core/db";
import { createShifts } from "@/modules/salary/shift-service";
import { currentOwner } from "@/modules/core/session";
import { parseScheduleImage } from "@/lib/schedule-ocr.functions";
import { computeShiftAmounts, type ShiftType } from "@/modules/salary/compute";
import { sek } from "@/lib/format";
import { cn } from "@/lib/utils";

type ConflictAction = "skip" | "replace";

type ParsedShift = {
  date: string;
  from: string;
  to: string;
  shift_type: ShiftType;
  break_minutes: number;
  active_minutes: number;
  note: string;
  confidence: number;
  conflict?: { id: string; label: string } | null;
  action?: ConflictAction;
};

const TYPE_LABEL: Record<ShiftType, string> = {
  regular: "Vanligt",
  waking_on_call: "Vaken jour",
  sleeping_on_call: "Sovande jour",
  standby: "Beredskap",
};

export const Route = createFileRoute("/_app/importera")({
  head: () => ({
    meta: [
      { title: "Importera schema — My Money Master" },
      { name: "description", content: "Ladda upp en bild på ditt schema och lägg in alla pass automatiskt." },
    ],
  }),
  component: ImportSchedulePage,
});

function toRange(r: { date: string; from: string; to: string }) {
  const start = new Date(`${r.date}T${r.from}:00`);
  let end = new Date(`${r.date}T${r.to}:00`);
  if (end <= start) end = new Date(end.getTime() + 86400000);
  return { start, end };
}

function ImportSchedulePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const parse = useServerFn(parseScheduleImage);
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedShift[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  const profileQ = useQuery({
    queryKey: ["wp-active"],
    queryFn: async () => {
      const { data } = await supabase.from("work_profiles").select("*").order("is_default", { ascending: false });
      return data ?? [];
    },
  });
  const profile: any = profileQ.data?.find((p: any) => p.is_default) ?? profileQ.data?.[0] ?? null;

  const analyze = useMutation({
    mutationFn: async (dataUrl: string) => parse({ data: { imageDataUrl: dataUrl } }),
    onSuccess: (res) => {
      setRows(res.shifts.map((s: any) => ({
        ...s,
        active_minutes: 0,
        conflict: null,
        action: "skip" as ConflictAction,
      })));
      setWarning(res.warning ?? null);
      if (res.shifts.length > 0) toast.success(`Hittade ${res.shifts.length} pass`);
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte tolka bilden"),
  });

  // Krock-koll mot befintliga pass när rader ändras
  useEffect(() => {
    if (rows.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ranges = rows.map(toRange);
      const minStart = new Date(Math.min(...ranges.map((r) => r.start.getTime())) - 86400000);
      const maxEnd = new Date(Math.max(...ranges.map((r) => r.end.getTime())) + 86400000);
      const { data: existing } = await supabase
        .from("shifts")
        .select("id, starts_at, ends_at")
        .gte("starts_at", minStart.toISOString())
        .lte("ends_at", maxEnd.toISOString());
      if (cancelled) return;
      setRows((prev) => prev.map((r, i) => {
        const { start, end } = ranges[i];
        const hit = (existing ?? []).find((ex: any) => {
          const es = new Date(ex.starts_at).getTime();
          const ee = new Date(ex.ends_at).getTime();
          return es < end.getTime() && ee > start.getTime();
        });
        if (!hit) return { ...r, conflict: null };
        const from = new Date(hit.starts_at);
        const to = new Date(hit.ends_at);
        const label = `${from.toLocaleDateString("sv-SE",{day:"numeric",month:"short"})} ${String(from.getHours()).padStart(2,"0")}:${String(from.getMinutes()).padStart(2,"0")}–${String(to.getHours()).padStart(2,"0")}:${String(to.getMinutes()).padStart(2,"0")}`;
        return { ...r, conflict: { id: hit.id, label }, action: r.action ?? "skip" };
      }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  const previewByRow = useMemo(() => rows.map((r) => {
    const { start, end } = toRange(r);
    return computeShiftAmounts({
      startsAt: start, endsAt: end,
      breakMinutes: r.break_minutes, shiftType: r.shift_type, activeMinutes: r.active_minutes,
      profile,
    });
  }), [rows, profile]);

  const totals = useMemo(() => {
    const applicable = rows.map((r, i) => ({ r, calc: previewByRow[i] }))
      .filter(({ r }) => !r.conflict || r.action === "replace");
    return {
      count: applicable.length,
      base: applicable.reduce((s, x) => s + x.calc.base_amount, 0),
      ob: applicable.reduce((s, x) => s + x.calc.ob_amount, 0),
      total: applicable.reduce((s, x) => s + x.calc.total_amount, 0),
    };
  }, [rows, previewByRow]);

  const save = useMutation({
    mutationFn: async () => {
      const { userId, contextId } = await currentOwner();

      // Skapa en import-batch så hela importen kan ångras samlat (SCAN-UNDO-001).
      const { data: batch } = await db.from("import_batches").insert({
        user_id: userId,
        owner_context_id: contextId,
        detected_type: "schema",
        confirmed_type: "schema",
        status: "importing",
        items_proposed: rows.length,
      }).select().single();

      const toCreate: any[] = [];
      const replaceIds: string[] = [];
      let skipped = 0;

      rows.forEach((r, i) => {
        if (r.conflict && r.action === "skip") { skipped++; return; }
        if (r.conflict && r.action === "replace") replaceIds.push(r.conflict.id);
        toCreate.push({
          userId,
          ownerContextId: contextId,
          workProfileId: profile?.id ?? null,
          date: r.date,
          from: r.from,
          to: r.to,
          breakMinutes: previewByRow[i].break_minutes,
          shiftType: r.shift_type,
          notes: r.note || null,
          source: "ocr" as const,
          importBatchId: batch?.id ?? null,
          profile: (profile ?? null) as any,
        });
      });

      // Ersätt: soft delete (ångringsbart) istället for hård radering.
      if (replaceIds.length > 0) {
        const { error } = await db.from("shifts")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", replaceIds);
        if (error) throw error;
      }

      // Skapa alla via den centrala servicen (tidszon, snapshot, timeline, ägarskap).
      if (toCreate.length > 0) await createShifts(toCreate);

      // Uppdatera batch-status.
      await db.from("import_batches").update({
        status: "imported",
        items_imported: toCreate.length,
        items_skipped_dupe: skipped,
      }).eq("id", batch?.id);

      return { inserted: toCreate.length, replaced: replaceIds.length, skipped };
    },
    onSuccess: ({ inserted, replaced, skipped }) => {
      const parts = [`${inserted} pass sparade`];
      if (replaced > 0) parts.push(`${replaced} ersatta`);
      if (skipped > 0) parts.push(`${skipped} hoppades över`);
      toast.success(parts.join(" · "));
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["cal-shifts"] });
      navigate({ to: "/kalender" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function onFile(file: File) {
    const dataUrl = await fileToDataUrl(file);
    setPreview(dataUrl);
    setRows([]);
    setWarning(null);
    analyze.mutate(dataUrl);
  }

  const conflictCount = rows.filter((r) => r.conflict).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-6 sm:pt-10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/idag" })}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-white/[0.02] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold">Importera schema</h1>
          <p className="text-sm text-muted-foreground">Ladda upp en bild — appen läser passen, räknar lön och varnar för krockar.</p>
        </div>
      </div>

      {!preview && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border bg-white/[0.02] px-6 py-16 text-center transition hover:border-[oklch(0.78_0.105_85/0.5)] hover:bg-[oklch(0.78_0.105_85/0.04)]">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[oklch(0.85_0.12_85/0.15)] text-[oklch(0.85_0.12_85)]">
            <Upload className="h-6 w-6" />
          </div>
          <div className="text-sm">
            <div className="font-medium">Välj bild eller ta foto</div>
            <div className="text-xs text-muted-foreground">PNG, JPG, HEIC eller screenshot av schemat</div>
          </div>
          <input
            type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
        </label>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-black/40">
            <img src={preview} alt="Uppladdat schema" className="max-h-72 w-full object-contain" />
            <button
              type="button"
              onClick={() => { setPreview(null); setRows([]); setWarning(null); }}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Ta bort"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {analyze.isPending && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-white/[0.02] px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-[oklch(0.85_0.12_85)]" />
              Läser schemat…
            </div>
          )}

          {warning && !analyze.isPending && (
            <div className="flex items-start gap-3 rounded-2xl border border-[oklch(0.7_0.15_25/0.3)] bg-[oklch(0.7_0.15_25/0.06)] px-4 py-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.7_0.15_25)]" />
              <div>{warning}</div>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="grid gap-2 rounded-2xl border border-border bg-white/[0.02] p-3 sm:grid-cols-4">
                <Stat label="Pass" value={String(totals.count)} sub={conflictCount > 0 ? `${conflictCount} krock` : "inga krockar"} accent={conflictCount > 0} />
                <Stat label="Grund" value={sek(totals.base)} />
                <Stat label="OB" value={sek(totals.ob)} />
                <Stat label="Totalt" value={sek(totals.total)} accent />
              </div>

              {!profile?.hourly_rate && (
                <div className="flex items-start gap-3 rounded-2xl border border-[oklch(0.7_0.15_25/0.3)] bg-[oklch(0.7_0.15_25/0.06)] px-4 py-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.7_0.15_25)]" />
                  <div>
                    Ingen timlön är satt på din arbetsprofil — passen sparas men lönebeloppen blir 0.
                    <button type="button" onClick={() => navigate({ to: "/installningar/lon-arbete" })} className="ml-2 underline">Fyll i timlön →</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Hittade pass ({rows.length}) — kolla igenom och rätta vid behov
                </div>
                <div className="space-y-2">
                  {rows.map((r, i) => (
                    <ShiftRow
                      key={i}
                      row={r}
                      calc={previewByRow[i]}
                      onChange={(next) => setRows((rs) => rs.map((x, j) => (j === i ? next : x)))}
                      onDelete={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>
              </div>

              <div className="sticky bottom-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPreview(null); setRows([]); }}
                  className="rounded-xl border border-border bg-background/60 px-4 py-3 text-sm backdrop-blur"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  disabled={save.isPending || totals.count === 0}
                  onClick={() => save.mutate()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[oklch(0.88_0.1_85)] to-[oklch(0.7_0.12_75)] py-3 text-sm font-medium text-background disabled:opacity-60"
                >
                  {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Spara {totals.count} pass
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-base font-semibold", accent && "text-[oklch(0.85_0.12_85)]")}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ShiftRow({
  row, calc, onChange, onDelete,
}: {
  row: ParsedShift;
  calc: { total_amount: number };
  onChange: (r: ParsedShift) => void;
  onDelete: () => void;
}) {
  const uncertain = row.confidence < 0.7;
  const hasConflict = !!row.conflict;
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white/[0.02] p-3",
        hasConflict
          ? "border-[oklch(0.7_0.15_25/0.5)] bg-[oklch(0.7_0.15_25/0.06)]"
          : uncertain
          ? "border-[oklch(0.85_0.12_85/0.5)] bg-[oklch(0.85_0.12_85/0.05)]"
          : "border-border",
      )}
    >
      <div className="grid grid-cols-[1fr_auto] items-start gap-2">
        <div className="grid grid-cols-3 gap-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Datum
            <input type="date" value={row.date}
              onChange={(e) => onChange({ ...row, date: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Från
            <input type="time" value={row.from}
              onChange={(e) => onChange({ ...row, from: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background/50 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Till
            <input type="time" value={row.to}
              onChange={(e) => onChange({ ...row, to: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background/50 px-2 py-1.5 text-sm" />
          </label>
        </div>
        <button type="button" onClick={onDelete}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
          aria-label="Ta bort">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(Object.keys(TYPE_LABEL) as ShiftType[]).map((t) => (
          <button key={t} type="button"
            onClick={() => onChange({ ...row, shift_type: t })}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              row.shift_type === t
                ? "border-[oklch(0.78_0.105_85/0.6)] bg-[oklch(0.78_0.105_85/0.12)] text-foreground"
                : "border-border bg-white/[0.02] text-muted-foreground hover:text-foreground",
            )}>
            {TYPE_LABEL[t]}
          </button>
        ))}
        {row.shift_type === "regular" && (
          <label className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            Rast
            <input type="number" min={0} value={row.break_minutes}
              onChange={(e) => onChange({ ...row, break_minutes: Math.max(0, Number(e.target.value) || 0) })}
              className="w-14 rounded-lg border border-border bg-background/50 px-2 py-1 text-xs" />
            min
          </label>
        )}
        {(row.shift_type === "sleeping_on_call" || row.shift_type === "standby") && (
          <label className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            Aktiv tid
            <input type="number" min={0} value={row.active_minutes}
              onChange={(e) => onChange({ ...row, active_minutes: Math.max(0, Number(e.target.value) || 0) })}
              className="w-14 rounded-lg border border-border bg-background/50 px-2 py-1 text-xs" />
            min
          </label>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <div className="text-muted-foreground">
          Beräknad lön: <span className="text-foreground font-medium">{sek(calc.total_amount)}</span>
        </div>
        {uncertain && !hasConflict && (
          <span className="inline-flex items-center gap-1 text-[oklch(0.85_0.12_85)]">
            <AlertCircle className="h-3 w-3" /> Kontrollera
          </span>
        )}
      </div>

      {hasConflict && (
        <div className="mt-2 rounded-xl border border-[oklch(0.7_0.15_25/0.3)] bg-black/20 p-2 text-[11px]">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.7_0.15_25)]" />
            <div>
              Krockar med befintligt pass <span className="text-foreground">{row.conflict!.label}</span>
            </div>
          </div>
          <div className="mt-2 flex gap-1.5">
            <button type="button"
              onClick={() => onChange({ ...row, action: "skip" })}
              className={cn(
                "flex-1 rounded-lg border px-2 py-1.5",
                row.action === "skip"
                  ? "border-foreground/40 bg-white/[0.06] text-foreground"
                  : "border-border text-muted-foreground",
              )}>
              Hoppa över
            </button>
            <button type="button"
              onClick={() => onChange({ ...row, action: "replace" })}
              className={cn(
                "flex-1 rounded-lg border px-2 py-1.5",
                row.action === "replace"
                  ? "border-[oklch(0.7_0.15_25/0.6)] bg-[oklch(0.7_0.15_25/0.12)] text-foreground"
                  : "border-border text-muted-foreground",
              )}>
              Ersätt befintligt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
