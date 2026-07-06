import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { ArrowUpRight, BookOpen } from "lucide-react";

export default function Kunskap() {
  const [articles, setArticles] = useState<any[]>([]);
  useEffect(() => {
    (supabase.from("knowledge_articles" as any).select("*").eq("status", "published").order("published_at", { ascending: false }) as any)
      .then(({ data }: any) => setArticles(data ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Kunskap · 4ThePeople</title>
        <meta name="description" content="Guider, artiklar och kunskap om våra produkter." />
      </Helmet>
      <Header />
      <main>
        <section className="relative border-b border-border overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
          <div className="premium-shell py-20 md:py-28 relative z-10 text-center">
            <div className="chip-gold mx-auto mb-6"><BookOpen className="w-3 h-3" /> Kunskap</div>
            <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tight text-balance">
              Din guide till <span className="gradient-text-gold">giftfria val</span>
            </h1>
            <p className="mt-5 text-muted-foreground text-lg max-w-xl mx-auto text-pretty">
              Artiklar, guider och forskning – utan mellanhänder.
            </p>
          </div>
        </section>

        <section className="premium-shell py-16 md:py-20">
          {articles.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Inga artiklar publicerade ännu.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles.map(a => (
                <Link key={a.id} to={`/kunskap/${a.slug}`} className="premium-card group">
                  <div className="flex flex-col h-full">
                    <div className="chip mb-4">Artikel</div>
                    <h2 className="font-display text-xl font-semibold group-hover:text-gold transition">{a.title}</h2>
                    {a.excerpt && <p className="text-muted-foreground mt-3 text-sm text-pretty flex-1">{a.excerpt}</p>}
                    <div className="mt-6 flex items-center gap-2 text-sm font-medium text-gold">
                      Läs artikel <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
