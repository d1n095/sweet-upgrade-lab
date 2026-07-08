import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SectionCard } from "@/components/premium/PremiumPageShell";
import { toast } from "sonner";

type Row = {
  id: string;
  verification_number: string;
  entry_date: string;
  account: string;
  account_name: string | null;
  debit: number;
  credit: number;
  description: string | null;
  source_type: string | null;
  fiscal_period: string | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 2 }).format(n);

export default function LedgerJournal() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openVer, setOpenVer] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("ledger_entries").select("*").order("entry_date", { ascending: false }).limit(500);
    if (account) q = q.eq("account", account);
    if (from) q = q.gte("entry_date", from);
    if (to) q = q.lte("entry_date", to);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const balances = useMemo(() => {
    const map = new Map<string, { name: string; debit: number; credit: number }>();
    for (const r of rows) {
      const key = r.account;
      const cur = map.get(key) ?? { name: r.account_name ?? "", debit: 0, credit: 0 };
      cur.debit += Number(r.debit) || 0;
      cur.credit += Number(r.credit) || 0;
      cur.name = cur.name || r.account_name || "";
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([acc, v]) => ({ account: acc, name: v.name, debit: v.debit, credit: v.credit, balance: v.debit - v.credit }))
      .sort((a, b) => a.account.localeCompare(b.account));
  }, [rows]);

  const drilldown = useMemo(() => rows.filter(r => r.verification_number === openVer), [rows, openVer]);
  const drillDebit = drilldown.reduce((s, r) => s + Number(r.debit || 0), 0);
  const drillCredit = drilldown.reduce((s, r) => s + Number(r.credit || 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SectionCard title="Huvudbok" subtitle="Filter: konto / period. Klicka på ver.nr för drilldown." className="lg:col-span-2">
        <div className="flex flex-wrap gap-2 mb-4">
          <Input placeholder="Konto (t.ex. 3001)" value={account} onChange={e => setAccount(e.target.value)} className="w-40" />
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
          <Button onClick={load} disabled={loading}>{loading ? "Laddar…" : "Filtrera"}</Button>
          <Button variant="ghost" onClick={() => { setAccount(""); setFrom(""); setTo(""); setTimeout(load, 0); }}>Rensa</Button>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Laddar…</p> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga verifikationer matchar filtret.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-3 pr-4">Ver.nr</th>
                  <th className="py-3 pr-4">Datum</th>
                  <th className="py-3 pr-4">Konto</th>
                  <th className="py-3 pr-4 text-right">Debet</th>
                  <th className="py-3 pr-4 text-right">Kredit</th>
                  <th className="py-3">Beskrivning</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/40 transition cursor-pointer" onClick={() => setOpenVer(r.verification_number)}>
                    <td className="py-3 pr-4 font-mono text-xs text-gold">{r.verification_number}</td>
                    <td className="py-3 pr-4">{r.entry_date}</td>
                    <td className="py-3 pr-4">{r.account} <span className="text-muted-foreground text-xs">{r.account_name}</span></td>
                    <td className="py-3 pr-4 text-right tabular-nums">{Number(r.debit) > 0 ? fmt(Number(r.debit)) : ""}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">{Number(r.credit) > 0 ? fmt(Number(r.credit)) : ""}</td>
                    <td className="py-3 text-muted-foreground truncate max-w-[280px]">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Saldo per konto" subtitle="Utifrån aktuellt filter">
        {balances.length === 0 ? <p className="text-sm text-muted-foreground">Inga poster.</p> : (
          <ul className="divide-y divide-border">
            {balances.map(b => (
              <li key={b.account} className="py-2.5 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm">{b.account}</div>
                  <div className="text-xs text-muted-foreground truncate">{b.name}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium tabular-nums ${b.balance >= 0 ? "" : "text-warning"}`}>{fmt(b.balance)}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">D {fmt(b.debit)} · K {fmt(b.credit)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={!!openVer} onOpenChange={(o) => !o && setOpenVer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Verifikation {openVer}</DialogTitle></DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">Datum</th>
                  <th className="py-2 pr-4">Konto</th>
                  <th className="py-2 pr-4 text-right">Debet</th>
                  <th className="py-2 pr-4 text-right">Kredit</th>
                  <th className="py-2">Beskrivning</th>
                </tr>
              </thead>
              <tbody>
                {drilldown.map(r => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{r.entry_date}</td>
                    <td className="py-2 pr-4">{r.account} <span className="text-muted-foreground text-xs">{r.account_name}</span></td>
                    <td className="py-2 pr-4 text-right tabular-nums">{Number(r.debit) > 0 ? fmt(Number(r.debit)) : ""}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{Number(r.credit) > 0 ? fmt(Number(r.credit)) : ""}</td>
                    <td className="py-2 text-muted-foreground">{r.description}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td colSpan={2} className="py-2 pr-4 text-right">Summa</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmt(drillDebit)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmt(drillCredit)}</td>
                  <td className="py-2">
                    {drillDebit === drillCredit
                      ? <Badge className="bg-success text-success-foreground">Balanserad</Badge>
                      : <Badge variant="destructive">Obalans {fmt(drillDebit - drillCredit)}</Badge>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {drilldown[0]?.source_type && (
            <div className="text-xs text-muted-foreground">Källa: <span className="font-mono">{drilldown[0].source_type}</span></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
