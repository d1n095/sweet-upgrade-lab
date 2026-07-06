import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export default function Kunskap() {
  const [articles, setArticles] = useState<any[]>([]);
  useEffect(() => {
    (supabase.from("knowledge_articles" as any).select("*").eq("status", "published").order("published_at", { ascending: false }) as any)
      .then(({ data }: any) => setArticles(data ?? []));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Helmet>
        <title>Kunskap · 4ThePeople</title>
        <meta name="description" content="Guider, artiklar och kunskap om våra produkter." />
      </Helmet>
      <h1 className="text-4xl font-bold mb-6">Kunskap</h1>
      {articles.length === 0 ? <p className="text-muted-foreground">Inga artiklar publicerade ännu.</p> : (
        <div className="grid gap-4">
          {articles.map(a => (
            <Link key={a.id} to={`/kunskap/${a.slug}`}>
              <Card className="hover:border-primary transition-colors">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold">{a.title}</h2>
                  {a.excerpt && <p className="text-muted-foreground mt-2 text-sm">{a.excerpt}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
