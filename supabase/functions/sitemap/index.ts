import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const siteUrl = "https://4thepeople.se";

  const { data: products } = await supabase
    .from("products")
    .select("handle, updated_at, status")
    .eq("is_visible", true)
    .in("status", ["active", "coming_soon", "info"])
    .order("updated_at", { ascending: false });

  const { data: categories } = await supabase
    .from("categories")
    .select("slug, updated_at")
    .eq("is_visible", true);

  const staticPages = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/produkter", priority: "0.9", changefreq: "daily" },
    { loc: "/om-oss", priority: "0.6", changefreq: "monthly" },
    { loc: "/kontakt", priority: "0.5", changefreq: "monthly" },
    { loc: "/butik", priority: "0.8", changefreq: "weekly" },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  for (const page of staticPages) {
    xml += `  <url>
    <loc>${siteUrl}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  for (const p of products || []) {
    if (!p.handle) continue;
    xml += `  <url>
    <loc>${siteUrl}/product/${p.handle}</loc>
    <lastmod>${new Date(p.updated_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  for (const c of categories || []) {
    xml += `  <url>
    <loc>${siteUrl}/produkter?category=${c.slug}</loc>
    <lastmod>${new Date(c.updated_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  }

  xml += `</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
