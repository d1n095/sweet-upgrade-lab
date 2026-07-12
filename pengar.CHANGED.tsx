import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listTransactions, createTransaction, deleteTransaction } from "@/modules/finance/finance-service";
import { stockholmToUtc } from "@/modules/core/datetime";
import { sek, sweDate } from "@/lib/format";
import { Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/pengar")({ component: PengarPage });

const CATS = [
  { value: "mat", label: "Mat", emoji: "🍽" },
  { value: "transport", label: "Transport", emoji: "🚇" },
  { value: "boende", label: "Boende", emoji: "🏠" },
  { value: "noje", label: "Nöje", emoji: "🎬" },
  { value: "prenumeration", label: "Prenumeration", emoji: "🔁" },
  { value: "klader", label: "Kläder", emoji: "👕" },
  { value: "halsa", label: "Hälsa", emoji: "💊" },
  { value: "sparande", label: "Sparande", emoji: "💎" },
  { value: "overforing", label: "Överföring", emoji: "↔️" },
  { value: "annat", label: "Annat", emoji: "•" },
];

function PengarPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | "">("");
  const [cat, setCat] = useState("mat");
  const [desc, setDesc] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [recurring, setRecurring] = useState(false);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("hourly_rate").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const expenses = useQuery({
    queryKey: ["transactions", "out"],
    queryFn: async () => {
      // Läs utgifter från den enhetliga transaktionsmodellen (ADR-003).
      const rows = await listTransactions({ direction: "out", limit: 100 });
      // Mappa till formen resten av vyn förväntar (amount/category/occurred_at).
      return rows.map((t: any) => ({
        id: t.id,
        amount: Number(t.amount),
        category: t.categories?.name ?? "Annat",
        description: t.description,
        merchant: t.merchant,
        occurred_at: t.occurred_at,
        is_recurring: t.is_recurring,
      }));
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!amount || amount <= 0) throw new Error("Ange ett belopp");
      await createTransaction({
        direction: "out",
        amount: Number(amount),
        categoryName: cat,
        description: desc || null,
        merchant: merchant || null,
        occurredAt: stockholmToUtc(date, "12:00").toISOString(),
        isRecurring: recurring,
      });
    },
    onSuccess: () => {
      toast.success("Utgift sparad");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setAmount(""); setDesc(""); setMerchant(""); setRecurring(false); setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await deleteTransaction(id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); toast.success("Borttagen"); },
  });

  const summary = useMemo(() => {
    const now = new Date(); const ms = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const month = (expenses.data ?? []).filter((e: any) => new Date(e.occurred_at).getTime() >= ms);
    const total = month.reduce((s: number, r: any) => s + Number(r.amount), 0);
    const byCat = CATS.map(c => ({ ...c, total: month.filter((e: any) => e.category === c.value).reduce((s: number, r: any) => s + Number(r.amount), 0) })).filter(c => c.total > 0).sort((a,b) => b.total - a.total);
    const subs = month.filter((e: any) => e.is_recurring).reduce((s: number, r: any) => s + Number(r.amount), 0);
    return { total, byCat, subs };
  }, [expenses.data]);

  const rate = Number(profile.data?.hourly_rate ?? 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Pengar</div>
          <h1 className="display text-4xl">Utgifter</h1>
          <p className="mt-1 text-sm text-muted-foreground">Varje krona räknad. Ser du var de tar vägen, ser du sanningen.</p>
        </div>
        <button onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[oklch(0.88_0.1_85)] to-[oklch(0.7_0.12_75)] px-5 py-2.5 text-sm font-semibold text-background">
          <Plus className="h-4 w-4" /> Ny utgift
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl p-5"><div className="text-[11px] uppercase tracking-widest text-muted-foreground">Totalt denna månad</div><div className="num mt-2 text-3xl text-[oklch(0.7_0.12_28)]">{sek(summary.total)}</div></div>
        <div className="glass rounded-2xl p-5"><div className="text-[11px] uppercase tracking-widest text-muted-foreground">Prenumerationer</div><div className="num mt-2 text-3xl">{sek(summary.subs)}</div></div>
        <div className="glass rounded-2xl p-5"><div className="text-[11px] uppercase tracking-widest text-muted-foreground">Snitt per dag</div><div className="num mt-2 text-3xl">{sek(summary.total / Math.max(1, new Date().getDate()))}</div></div>
      </section>

      {open && (
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="glass rounded-3xl p-6">
          <h2 className="display mb-4 text-xl">Lägg till utgift</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Belopp (kr)"><input type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value === "" ? "" : +e.target.value)} className="inp" required /></Field>
            <Field label="Kategori">
              <select value={cat} onChange={e => setCat(e.target.value)} className="inp">
                {CATS.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
              </select>
            </Field>
            <Field label="Datum"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="inp" /></Field>
            <Field label="Beskrivning"><input value={desc} onChange={e => setDesc(e.target.value)} className="inp" placeholder="Vad köpte du?" /></Field>
            <Field label="Var?"><input value={merchant} onChange={e => setMerchant(e.target.value)} className="inp" placeholder="t.ex. ICA" /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="h-4 w-4 accent-[oklch(0.78_0.105_85)]" />
              Återkommande (t.ex. Netflix)
            </label>
          </div>
          {amount && rate > 0 && (
            <div className="mt-4 rounded-xl border border-[oklch(0.78_0.105_85/0.25)] bg-[oklch(0.78_0.105_85/0.05)] px-4 py-3 text-sm">
              Det här kostar dig <span className="gold-text font-semibold">{(Number(amount)/rate).toFixed(1)} arbetstimmar</span>.
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-border px-4 py-2 text-sm">Avbryt</button>
            <button disabled={add.isPending} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Spara</button>
          </div>
          <style>{`.inp { width:100%; background:transparent; outline:none; border:1px solid var(--color-border); padding:0.625rem 0.75rem; border-radius:0.75rem; font-size:0.875rem; }`}</style>
        </form>
      )}

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="glass lg:col-span-2 rounded-3xl p-6">
          <h2 className="display mb-3 text-xl">Senaste utgifter</h2>
          {expenses.isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />
          ) : (expenses.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Inga utgifter än.</div>
          ) : (
            <ul className="divide-y divide-border">
              {expenses.data!.map((e: any) => {
                const c = CATS.find(c => c.value === e.category);
                return (
                  <li key={e.id} className="flex items-center gap-3 py-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.04] text-base">{c?.emoji}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{e.description || e.merchant || c?.label}</div>
                      <div className="text-xs text-muted-foreground">{sweDate(e.occurred_at)} · {c?.label}{e.is_recurring && " · återkommande"}</div>
                    </div>
                    <div className="num text-[oklch(0.7_0.12_28)]">−{sek(Number(e.amount))}</div>
                    <button onClick={() => del.mutate(e.id)} className="ml-1 grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-white/[0.05] hover:text-[oklch(0.7_0.12_28)]"><Trash2 className="h-4 w-4" /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="glass rounded-3xl p-6">
          <h2 className="display mb-3 text-xl">Per kategori</h2>
          {summary.byCat.length === 0 ? (
            <div className="text-sm text-muted-foreground">Ingen data än.</div>
          ) : (
            <ul className="space-y-3">
              {summary.byCat.map(c => {
                const pct = (c.total / summary.total) * 100;
                return (
                  <li key={c.value}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2"><Tag className="h-3 w-3 text-muted-foreground" />{c.emoji} {c.label}</span>
                      <span className="num">{sek(c.total)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                      <div className="h-full bg-gradient-to-r from-[oklch(0.85_0.12_85)] to-[oklch(0.7_0.12_75)]" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
