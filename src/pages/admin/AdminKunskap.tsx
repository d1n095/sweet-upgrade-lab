import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import PremiumPageShell, { SectionCard, StatCard } from "@/components/premium/PremiumPageShell";

export default function AdminKunskap() {
  const { hasAccess: isStaff, isLoading } = useStaffAccess();
  const [articles, setArticles] = useState<any[]>([]);
  const [title, setTitle] = useState(""); const [slug, setSlug] = useState(""); const [body, setBody] = useState("");

  const load = async () => {
    const { data } = await supabase.from("knowledge_articles" as any).select("*").order("created_at", { ascending: false }).limit(50) as any;
    setArticles(data ?? []);
  };
  useEffect(() => { if (isStaff) load(); }, [isStaff]);

  const create = async () => {
    if (!title || !slug) { toast.error("Titel och slug krävs"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("knowledge_articles" as any).insert({ title, slug, body, status: "draft", author_id: user?.id }) as any;
    if (error) toast.error(error.message); else { toast.success("Skapad"); setTitle(""); setSlug(""); setBody(""); load(); }
  };

  const publish = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    const { error } = await supabase.from("knowledge_articles" as any).update({ status: newStatus, published_at: newStatus === "published" ? new Date().toISOString() : null }).eq("id", id) as any;
    if (error) toast.error(error.message); else load();
  };

  if (isLoading) return <PremiumPageShell title="Kunskap"><div>Laddar…</div></PremiumPageShell>;
  if (!isStaff) return <PremiumPageShell title="Kunskap"><div className="premium-card">Endast personal.</div></PremiumPageShell>;

  const published = articles.filter(a => a.status === "published").length;

  return (
    <PremiumPageShell
      eyebrow="Sprint 02 · Del 9"
      title="Kunskap"
      description="Artiklar, guider och kunskapsartiklar för hela plattformen."
      breadcrumbs={[{ to: "/admin", label: "Admin" }, { to: "/admin/business-os", label: "Business OS" }, { label: "Kunskap" }]}
    >
      <div className="grid gap-3 grid-cols-3 mb-8">
        <StatCard label="Totalt" value={articles.length} />
        <StatCard label="Publicerade" value={published} tone="gold" />
        <StatCard label="Utkast" value={articles.length - published} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard title="Ny artikel" className="lg:col-span-2">
          <div className="space-y-3">
            <Input placeholder="Titel" value={title} onChange={e => setTitle(e.target.value)} />
            <Input placeholder="slug-i-url" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
            <Textarea placeholder="Innehåll (markdown)" value={body} onChange={e => setBody(e.target.value)} className="min-h-[220px]" />
            <Button onClick={create} className="w-full">Skapa utkast</Button>
          </div>
        </SectionCard>

        <SectionCard title="Artiklar" className="lg:col-span-3">
          {articles.length === 0 ? <p className="text-sm text-muted-foreground">Inga artiklar ännu.</p> : (
            <ul className="divide-y divide-border">
              {articles.map((a: any) => (
                <li key={a.id} className="py-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">/kunskap/{a.slug}</div>
                  </div>
                  <div className="flex gap-2 items-center shrink-0">
                    <Badge variant={a.status === "published" ? "default" : "secondary"} className={a.status === "published" ? "bg-gold text-gold-foreground" : ""}>{a.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => publish(a.id, a.status)}>{a.status === "published" ? "Avpublicera" : "Publicera"}</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </PremiumPageShell>
  );
}
