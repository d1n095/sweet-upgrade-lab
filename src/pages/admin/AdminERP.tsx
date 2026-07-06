import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useFounderRole } from "@/hooks/useFounderRole";
import PremiumPageShell, { StatCard, SectionCard } from "@/components/premium/PremiumPageShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminERP() {
  const { isFounder } = useFounderRole();
  const [ledger, setLedger] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [summary, setSummary] = useState({ revenue: 0, expenses: 0, unpaidInvoices: 0, cash: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [l, inv, exp, sup] = await Promise.all([
          supabase.from("ledger_entries").select("*").order("entry_date", { ascending: false }).limit(100),
          supabase.from("invoices").select("*").order("due_date", { ascending: true }).limit(100),
          supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(100),
          supabase.from("suppliers").select("*").order("name").limit(100),
        ]);
        setLedger(l.data ?? []); setInvoices(inv.data ?? []); setExpenses(exp.data ?? []); setSuppliers(sup.data ?? []);
        const rev = (l.data ?? []).filter((r: any) => r.source_type === "order").reduce((s: number, r: any) => s + Number(r.credit), 0);
        const expTotal = (exp.data ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
        const unpaid = (inv.data ?? []).filter((r: any) => !["paid", "cancelled"].includes(r.status)).reduce((s: number, r: any) => s + Number(r.amount_total), 0);
        setSummary({ revenue: rev, expenses: expTotal, unpaidInvoices: unpaid, cash: rev - expTotal });
      } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (!isFounder) {
    return <PremiumPageShell title="ERP & Ekonomi" eyebrow="Restricted">
      <div className="premium-card text-center text-muted-foreground">Endast tillgängligt för finance/founder.</div>
    </PremiumPageShell>;
  }

  const fmt = (n: number) => new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);

  return (
    <PremiumPageShell
      eyebrow="Sprint 01 · Del 8"
      title="ERP & Ekonomi"
      description="Bokföring, fakturor, utgifter och kassaflöde – automatiskt från Stripe-flödet."
      breadcrumbs={[{ to: "/admin", label: "Admin" }, { to: "/admin/business-os", label: "Business OS" }, { label: "ERP" }]}
    >
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard label="Intäkter" value={fmt(summary.revenue)} hint="bokförda från order" tone="gold" />
        <StatCard label="Utgifter" value={fmt(summary.expenses)} />
        <StatCard label="Obetalda fakturor" value={fmt(summary.unpaidInvoices)} tone="warning" />
        <StatCard label="Netto" value={fmt(summary.cash)} tone={summary.cash >= 0 ? "success" : "warning"} />
      </div>

      <Tabs defaultValue="ledger">
        <TabsList className="mb-4">
          <TabsTrigger value="ledger">Huvudbok</TabsTrigger>
          <TabsTrigger value="invoices">Fakturor</TabsTrigger>
          <TabsTrigger value="expenses">Utgifter</TabsTrigger>
          <TabsTrigger value="suppliers">Leverantörer</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <SectionCard title="Senaste verifikationer" subtitle="Skapas automatiskt vid betald order.">
            {loading ? <p className="text-muted-foreground">Laddar…</p> : ledger.length === 0 ? <p className="text-muted-foreground">Inga verifikationer ännu.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border"><th className="py-3 pr-4">Ver.nr</th><th className="py-3 pr-4">Datum</th><th className="py-3 pr-4">Konto</th><th className="py-3 pr-4 text-right">Debet</th><th className="py-3 pr-4 text-right">Kredit</th><th className="py-3">Beskrivning</th></tr></thead>
                  <tbody>
                    {ledger.map((r: any) => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/40 transition">
                        <td className="py-3 pr-4 font-mono text-xs">{r.verification_number}</td>
                        <td className="py-3 pr-4">{r.entry_date}</td>
                        <td className="py-3 pr-4">{r.account} <span className="text-muted-foreground text-xs">{r.account_name}</span></td>
                        <td className="py-3 pr-4 text-right tabular-nums">{r.debit > 0 ? fmt(Number(r.debit)) : ""}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-gold">{r.credit > 0 ? fmt(Number(r.credit)) : ""}</td>
                        <td className="py-3 text-muted-foreground">{r.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="invoices">
          <SectionCard title="Fakturor">
            {invoices.length === 0 ? <p className="text-muted-foreground">Inga fakturor.</p> : (
              <ul className="divide-y divide-border">
                {invoices.map((i: any) => (
                  <li key={i.id} className="py-3 flex justify-between items-center">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{i.invoice_number}</div>
                      <div className="text-sm font-medium">{i.counterparty_name}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{i.due_date}</span>
                      <span className="font-medium tabular-nums">{fmt(Number(i.amount_total))}</span>
                      <Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="expenses">
          <SectionCard title="Utgifter">
            {expenses.length === 0 ? <p className="text-muted-foreground">Inga utgifter registrerade.</p> : (
              <ul className="divide-y divide-border">
                {expenses.map((e: any) => (
                  <li key={e.id} className="py-3 flex justify-between items-center">
                    <div><div className="text-sm">{e.description}</div><div className="text-xs text-muted-foreground">{e.category} · {e.expense_date}</div></div>
                    <div className="flex items-center gap-3"><span className="font-medium tabular-nums">{fmt(Number(e.amount))}</span><Badge variant={e.payment_status === "paid" ? "default" : "secondary"}>{e.payment_status}</Badge></div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="suppliers">
          <SectionCard title="Leverantörer">
            {suppliers.length === 0 ? <p className="text-muted-foreground">Inga leverantörer.</p> : (
              <ul className="divide-y divide-border">
                {suppliers.map((s: any) => (
                  <li key={s.id} className="py-3 flex justify-between"><span>{s.name} <span className="text-muted-foreground text-xs">{s.org_number}</span></span>{!s.is_active && <Badge variant="secondary">Inaktiv</Badge>}</li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </PremiumPageShell>
  );
}
