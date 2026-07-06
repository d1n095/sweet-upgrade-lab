import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { toast } from "sonner";

type Lifecycle = {
  customer_id: string;
  stage: string;
  segment_code: string | null;
  rfm_recency: number | null;
  rfm_frequency: number | null;
  rfm_monetary: number | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
};

type Segment = { id: string; code: string; name: string; color: string | null; description: string | null };

export default function AdminCustomer360() {
  const { isStaff, loading: staffLoading } = useStaffAccess();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [customers, setCustomers] = useState<Lifecycle[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [touchpoints, setTouchpoints] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [s, l] = await Promise.all([
      supabase.from("customer_segments").select("*").eq("is_active", true),
      supabase.from("lifecycle_stages").select("*").order("total_spent", { ascending: false }).limit(200),
    ]);
    if (s.data) setSegments(s.data as Segment[]);
    if (l.data) setCustomers(l.data as Lifecycle[]);
    setLoading(false);
  };

  useEffect(() => { if (isStaff) load(); }, [isStaff]);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const [tp, nt] = await Promise.all([
        supabase.from("customer_touchpoints").select("*").eq("customer_id", selected).order("occurred_at", { ascending: false }).limit(50),
        supabase.from("customer_notes").select("*").eq("customer_id", selected).order("created_at", { ascending: false }),
      ]);
      setTouchpoints(tp.data ?? []);
      setNotes(nt.data ?? []);
    })();
  }, [selected]);

  const recompute = async (id: string) => {
    const { error } = await supabase.rpc("recompute_lifecycle_stage" as any, { _customer_id: id });
    if (error) toast.error(error.message); else { toast.success("Uppdaterat"); load(); }
  };

  const addNote = async () => {
    if (!selected || !noteText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("customer_notes").insert({ customer_id: selected, note: noteText, author_id: user?.id });
    if (error) toast.error(error.message);
    else { setNoteText(""); const { data } = await supabase.from("customer_notes").select("*").eq("customer_id", selected).order("created_at", { ascending: false }); setNotes(data ?? []); }
  };

  if (staffLoading) return <div className="p-8">Laddar…</div>;
  if (!isStaff) return <div className="p-8">Endast personal.</div>;

  const fmt = (n: number) => new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Helmet><title>Kunder 360 – Business OS</title><meta name="description" content="Customer 360, RFM-segment, tidslinje." /></Helmet>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kunder 360</h1>
        <p className="text-muted-foreground mt-1">RFM-segment, livscykel och kundtidslinje.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {segments.map(s => {
          const count = customers.filter(c => c.segment_code === s.code).length;
          return <Badge key={s.id} variant="secondary" style={{ borderColor: s.color ?? undefined }}>{s.name}: {count}</Badge>;
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Kunder</CardTitle></CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            {loading ? "Laddar…" : customers.length === 0 ? <p className="text-muted-foreground text-sm">Inga kunder ännu.</p> : (
              <ul className="divide-y">
                {customers.map(c => (
                  <li key={c.customer_id} className={`py-2 cursor-pointer ${selected === c.customer_id ? "bg-muted/50" : ""}`} onClick={() => setSelected(c.customer_id)}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-mono truncate max-w-[180px]">{c.customer_id.slice(0, 8)}…</div>
                        <div className="text-xs text-muted-foreground">{c.total_orders} order · {fmt(Number(c.total_spent))}</div>
                      </div>
                      <Badge variant="outline">{c.segment_code}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Detalj</CardTitle>
            {selected && <Button size="sm" variant="outline" onClick={() => recompute(selected)}>Räkna om RFM</Button>}
          </CardHeader>
          <CardContent>
            {!selected ? <p className="text-muted-foreground text-sm">Välj en kund.</p> : (
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">Anteckningar</h3>
                  <div className="flex gap-2 mb-2">
                    <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Intern anteckning…" className="min-h-[60px]" />
                    <Button onClick={addNote}>Lägg till</Button>
                  </div>
                  <ul className="space-y-2">
                    {notes.map(n => <li key={n.id} className="text-sm p-2 bg-muted/40 rounded">{n.note}<div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("sv-SE")}</div></li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Tidslinje</h3>
                  {touchpoints.length === 0 ? <p className="text-sm text-muted-foreground">Ingen aktivitet loggad.</p> : (
                    <ul className="space-y-1">
                      {touchpoints.map(t => (
                        <li key={t.id} className="text-sm border-l-2 border-primary pl-3 py-1">
                          <span className="font-medium">{t.touchpoint_type}</span> {t.subject && <span>– {t.subject}</span>}
                          <div className="text-xs text-muted-foreground">{new Date(t.occurred_at).toLocaleString("sv-SE")}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
