import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";

export default function KunskapArticle() {
  const { slug } = useParams();
  const [article, setArticle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    supabase.from("knowledge_articles").select("*").eq("slug", slug).eq("status", "published").maybeSingle()
      .then(({ data }) => { setArticle(data); setLoading(false); });
  }, [slug]);

  if (loading) return <div className="container mx-auto p-8">Laddar…</div>;
  if (!article) return <div className="container mx-auto p-8">Artikel hittades inte.</div>;

  return (
    <article className="container mx-auto px-4 py-8 max-w-3xl">
      <Helmet>
        <title>{article.meta_title || article.title} · 4ThePeople</title>
        <meta name="description" content={article.meta_description || article.excerpt || article.title} />
        <link rel="canonical" href={`https://4thepeople.se/kunskap/${article.slug}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": article.title,
          "datePublished": article.published_at,
          "dateModified": article.updated_at,
        })}</script>
      </Helmet>
      <h1 className="text-4xl font-bold mb-4">{article.title}</h1>
      {article.excerpt && <p className="text-lg text-muted-foreground mb-6">{article.excerpt}</p>}
      <div className="prose prose-neutral max-w-none whitespace-pre-wrap">{article.body}</div>
    </article>
  );
}
