import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw } from "lucide-react";
import PremiumPageShell, { StatCard, SectionCard } from "@/components/premium/PremiumPageShell";

export default function AdminCustomer360() {
  const { hasAccess: isStaff, isLoading: staffLoading } = useStaffAccess();
  const [segments, setSegments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [touchpoints, setTouchpoints] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState("");

  const load = async () => {
    const [s, l] = await Promise.all([
      supabase.from("customer_segments").select("*").eq("is_active", true),
      supabase.from("lifecycle_stages").select("*").order("total_spent", { ascending: false }).limit(200),
    ]);
    setSegments(s.data ?? []); setCustomers(l.data ?? []);
  };
  useEffect(() => { if (isStaff) load(); }, [isStaff]);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const [tp, nt] = await Promise.all([
        supabase.from("customer_touchpoints").select("*").eq("customer_id", selected).order("occurred_at", { ascending: false }).limit(50),
        supabase.from("customer_notes").select("*").eq("customer_id", selected).order("created_at", { ascending: false }),
      ]);
      setTouchpoints(tp.data ?? []); setNotes(nt.data ?? []);
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

  if (staffLoading) return <PremiumPageShell title="Kunder 360"><div>Laddar…</div></PremiumPageShell>;
  if (!isStaff) return <PremiumPageShell title="Kunder 360"><div className="premium-card">Endast personal.</div></PremiumPageShell>;

  const fmt = (n: number) => new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);

  return (
    <PremiumPageShell
      eyebrow="Sprint 03 · Del 10"
      title="Kunder 360"
      description="RFM-segment, livscykel och komplett kundtidslinje."
      breadcrumbs={[{ to: "/admin", label: "Admin" }, { to: "/admin/business-os", label: "Business OS" }, { label: "Kunder 360" }]}
    >
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5 mb-8">
        {segments.map((s: any) => {
          const count = customers.filter(c => c.segment_code === s.code).length;
          return <StatCard key={s.id} label={s.name} value={count} hint={s.description ?? undefined} tone={s.code === "vip" ? "gold" : s.code === "at_risk" || s.code === "lost" ? "warning" : "default"} />;
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title={`Kunder (${customers.length})`} className="lg:col-span-1">
          <div className="max-h-[600px] overflow-y-auto -mx-2">
            {customers.length === 0 ? <p className="text-muted-foreground text-sm px-2">Inga kunder ännu.</p> : (
              <ul className="space-y-1">
                {customers.map((c: any) => (
                  <li key={c.customer_id}>
                    <button
                      onClick={() => setSelected(c.customer_id)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 transition ${selected === c.customer_id ? "bg-secondary border border-gold/40" : "hover:bg-secondary/60 border border-transparent"}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-mono">{c.customer_id.slice(0, 8)}…</div>
                          <div className="text-xs text-muted-foreground">{c.total_orders} order · {fmt(Number(c.total_spent))}</div>
                        </div>
                        <Badge variant="outline" className={c.segment_code === "vip" ? "border-gold text-gold" : ""}>{c.segment_code}</Badge>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Detalj"
          className="lg:col-span-2"
          actions={selected ? <Button size="sm" variant="outline" onClick={() => recompute(selected)}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Räkna om RFM</Button> : undefined}
        >
          {!selected ? <p className="text-muted-foreground text-sm">Välj en kund till vänster.</p> : (
            <div className="space-y-8">
              <div>
                <h3 className="font-display text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">Anteckningar</h3>
                <div className="flex gap-2 mb-3">
                  <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Intern anteckning…" className="min-h-[60px]" />
                  <Button onClick={addNote}>Lägg till</Button>
                </div>
                <ul className="space-y-2">
                  {notes.map(n => <li key={n.id} className="text-sm p-3 bg-secondary/50 rounded-xl">{n.note}<div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("sv-SE")}</div></li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">Tidslinje</h3>
                {touchpoints.length === 0 ? <p className="text-sm text-muted-foreground">Ingen aktivitet loggad.</p> : (
                  <ul className="space-y-2">
                    {touchpoints.map((t: any) => (
                      <li key={t.id} className="text-sm border-l-2 border-gold/60 pl-4 py-1.5">
                        <span className="font-medium">{t.touchpoint_type}</span> {t.subject && <span>· {t.subject}</span>}
                        <div className="text-xs text-muted-foreground">{new Date(t.occurred_at).toLocaleString("sv-SE")}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </PremiumPageShell>
  );
}
