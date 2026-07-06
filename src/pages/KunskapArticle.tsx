import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { ArrowLeft } from "lucide-react";

export default function KunskapArticle() {
  const { slug } = useParams();
  const [article, setArticle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (supabase.from("knowledge_articles" as any).select("*").eq("slug", slug).eq("status", "published").maybeSingle() as any)
      .then(({ data }: any) => { setArticle(data); setLoading(false); });
  }, [slug]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {loading ? <div className="premium-shell py-20 text-center text-muted-foreground">Laddar…</div>
         : !article ? <div className="premium-shell py-20 text-center text-muted-foreground">Artikel hittades inte.</div>
         : (
          <>
            <Helmet>
              <title>{article.meta_title || article.title} · 4ThePeople</title>
              <meta name="description" content={article.meta_description || article.excerpt || article.title} />
              <link rel="canonical" href={`https://4thepeople.se/kunskap/${article.slug}`} />
              <script type="application/ld+json">{JSON.stringify({
                "@context": "https://schema.org", "@type": "Article",
                "headline": article.title, "datePublished": article.published_at, "dateModified": article.updated_at,
              })}</script>
            </Helmet>

            <section className="border-b border-border" style={{ background: 'var(--gradient-hero)' }}>
              <div className="premium-shell py-16 md:py-24 max-w-3xl">
                <Link to="/kunskap" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-6">
                  <ArrowLeft className="w-3.5 h-3.5" /> Tillbaka till Kunskap
                </Link>
                <div className="chip-gold mb-5">Artikel</div>
                <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-balance">{article.title}</h1>
                {article.excerpt && <p className="mt-5 text-lg text-muted-foreground text-pretty">{article.excerpt}</p>}
              </div>
            </section>

            <article className="premium-shell py-16 max-w-3xl">
              <div className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap text-base leading-relaxed">{article.body}</div>
            </article>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
