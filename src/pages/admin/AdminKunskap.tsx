import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { toast } from "sonner";

export default function AdminKunskap() {
  const { hasAccess: isStaff, isLoading } = useStaffAccess();
  const [articles, setArticles] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");

  const load = async () => {
    const { data } = await supabase.from("knowledge_articles").select("*").order("created_at", { ascending: false }).limit(50);
    setArticles(data ?? []);
  };
  useEffect(() => { if (isStaff) load(); }, [isStaff]);

  const create = async () => {
    if (!title || !slug) { toast.error("Titel och slug krävs"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("knowledge_articles").insert({ title, slug, body, status: "draft", author_id: user?.id });
    if (error) toast.error(error.message); else { toast.success("Skapad"); setTitle(""); setSlug(""); setBody(""); load(); }
  };

  const publish = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    const { error } = await supabase.from("knowledge_articles").update({ status: newStatus, published_at: newStatus === "published" ? new Date().toISOString() : null }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  if (isLoading) return <div className="p-8">Laddar…</div>;
  if (!isStaff) return <div className="p-8">Endast personal.</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Helmet><title>Kunskap – Admin</title><meta name="description" content="Hantera kunskapsartiklar." /></Helmet>
      <div><h1 className="text-3xl font-bold tracking-tight">Kunskap</h1><p className="text-muted-foreground">Artiklar och guider.</p></div>

      <Card>
        <CardHeader><CardTitle>Ny artikel</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Titel" value={title} onChange={e => setTitle(e.target.value)} />
          <Input placeholder="slug-i-url" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
          <Textarea placeholder="Innehåll (markdown)" value={body} onChange={e => setBody(e.target.value)} className="min-h-[200px]" />
          <Button onClick={create}>Skapa utkast</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Artiklar</CardTitle></CardHeader>
        <CardContent>
          {articles.length === 0 ? <p className="text-sm text-muted-foreground">Inga artiklar.</p> : (
            <ul className="divide-y">
              {articles.map(a => (
                <li key={a.id} className="py-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">/{a.slug}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant={a.status === "published" ? "default" : "secondary"}>{a.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => publish(a.id, a.status)}>{a.status === "published" ? "Avpublicera" : "Publicera"}</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
