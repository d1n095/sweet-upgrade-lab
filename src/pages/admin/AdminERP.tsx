import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFounderRole } from "@/hooks/useFounderRole";

type LedgerRow = {
  id: string;
  verification_number: string;
  entry_date: string;
  account: string;
  account_name: string | null;
  debit: number;
  credit: number;
  description: string | null;
  source_type: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  counterparty_name: string;
  due_date: string;
  amount_total: number;
  status: string;
};

type Expense = {
  id: string;
  expense_date: string;
  amount: number;
  category: string;
  description: string | null;
  payment_status: string;
};

type Supplier = { id: string; name: string; org_number: string | null; is_active: boolean };

export default function AdminERP() {
  const { isFounder } = useFounderRole();
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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
        if (l.error) throw l.error;
        if (inv.error) throw inv.error;
        if (exp.error) throw exp.error;
        if (sup.error) throw sup.error;
        setLedger((l.data ?? []) as LedgerRow[]);
        setInvoices((inv.data ?? []) as Invoice[]);
        setExpenses((exp.data ?? []) as Expense[]);
        setSuppliers((sup.data ?? []) as Supplier[]);

        const rev = (l.data ?? []).filter((r: any) => r.source_type === "order").reduce((s: number, r: any) => s + Number(r.credit), 0);
        const expTotal = (exp.data ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
        const unpaid = (inv.data ?? []).filter((r: any) => r.status !== "paid" && r.status !== "cancelled").reduce((s: number, r: any) => s + Number(r.amount_total), 0);
        setSummary({ revenue: rev, expenses: expTotal, unpaidInvoices: unpaid, cash: rev - expTotal });
      } catch (e: any) {
        toast.error("Kunde inte ladda ekonomidata: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!isFounder) {
    return (
      <div className="p-8">
        <Card><CardContent className="p-6">Endast tillgängligt för finance/founder.</CardContent></Card>
      </div>
    );
  }

  const fmt = (n: number) => new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Helmet>
        <title>ERP & Ekonomi – Business OS</title>
        <meta name="description" content="Bokföring, fakturor, utgifter och kassaposition." />
      </Helmet>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">ERP & Ekonomi</h1>
        <p className="text-muted-foreground mt-1">Bokföring, fakturor, utgifter och kassaflöde.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Intäkter (bokförda)</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmt(summary.revenue)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Utgifter</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmt(summary.expenses)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Obetalda fakturor</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmt(summary.unpaidInvoices)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Netto</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmt(summary.cash)}</CardContent></Card>
      </div>

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">Huvudbok</TabsTrigger>
          <TabsTrigger value="invoices">Fakturor</TabsTrigger>
          <TabsTrigger value="expenses">Utgifter</TabsTrigger>
          <TabsTrigger value="suppliers">Leverantörer</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger">
          <Card>
            <CardHeader><CardTitle>Senaste verifikationer</CardTitle></CardHeader>
            <CardContent>
              {loading ? "Laddar…" : ledger.length === 0 ? <p className="text-muted-foreground">Inga verifikationer ännu. Bokförs automatiskt när ordrar betalas.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b"><th className="py-2">Ver.nr</th><th>Datum</th><th>Konto</th><th className="text-right">Debet</th><th className="text-right">Kredit</th><th>Beskrivning</th></tr></thead>
                    <tbody>
                      {ledger.map(r => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 font-mono">{r.verification_number}</td>
                          <td>{r.entry_date}</td>
                          <td>{r.account} {r.account_name && <span className="text-muted-foreground text-xs">{r.account_name}</span>}</td>
                          <td className="text-right">{r.debit > 0 ? fmt(Number(r.debit)) : ""}</td>
                          <td className="text-right">{r.credit > 0 ? fmt(Number(r.credit)) : ""}</td>
                          <td className="text-muted-foreground">{r.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card><CardHeader><CardTitle>Fakturor</CardTitle></CardHeader><CardContent>
            {invoices.length === 0 ? <p className="text-muted-foreground">Inga fakturor.</p> : (
              <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b"><th className="py-2">Nummer</th><th>Typ</th><th>Motpart</th><th>Förfaller</th><th className="text-right">Belopp</th><th>Status</th></tr></thead>
              <tbody>{invoices.map(i => (
                <tr key={i.id} className="border-b last:border-0"><td className="py-2 font-mono">{i.invoice_number}</td><td>{i.invoice_type}</td><td>{i.counterparty_name}</td><td>{i.due_date}</td><td className="text-right">{fmt(Number(i.amount_total))}</td><td><Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge></td></tr>
              ))}</tbody></table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card><CardHeader><CardTitle>Utgifter</CardTitle></CardHeader><CardContent>
            {expenses.length === 0 ? <p className="text-muted-foreground">Inga utgifter registrerade.</p> : (
              <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground border-b"><th className="py-2">Datum</th><th>Kategori</th><th>Beskrivning</th><th className="text-right">Belopp</th><th>Status</th></tr></thead>
              <tbody>{expenses.map(e => (
                <tr key={e.id} className="border-b last:border-0"><td className="py-2">{e.expense_date}</td><td>{e.category}</td><td className="text-muted-foreground">{e.description}</td><td className="text-right">{fmt(Number(e.amount))}</td><td><Badge variant={e.payment_status === "paid" ? "default" : "secondary"}>{e.payment_status}</Badge></td></tr>
              ))}</tbody></table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card><CardHeader><CardTitle>Leverantörer</CardTitle></CardHeader><CardContent>
            {suppliers.length === 0 ? <p className="text-muted-foreground">Inga leverantörer.</p> : (
              <ul className="divide-y">{suppliers.map(s => (
                <li key={s.id} className="py-2 flex justify-between"><span>{s.name} <span className="text-muted-foreground text-xs">{s.org_number}</span></span>{!s.is_active && <Badge variant="secondary">Inaktiv</Badge>}</li>
              ))}</ul>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
