import { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface Crumb { to?: string; label: string }

interface Props {
  title: string;
  eyebrow?: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
  metaDescription?: string;
}

export default function PremiumPageShell({ title, eyebrow, description, breadcrumbs = [], actions, children, metaDescription }: Props) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <Helmet>
        <title>{title} · 4ThePeople</title>
        {metaDescription && <meta name="description" content={metaDescription} />}
      </Helmet>

      {/* Hero band */}
      <div className="relative overflow-hidden border-b border-border" style={{ background: 'var(--gradient-hero)' }}>
        <div className="premium-shell py-10 md:py-14 relative z-10">
          {breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
              {breadcrumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {c.to ? <Link to={c.to} className="hover:text-foreground transition">{c.label}</Link> : <span>{c.label}</span>}
                  {i < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3" />}
                </span>
              ))}
            </nav>
          )}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-2xl">
              {eyebrow && <div className="chip-gold mb-4">{eyebrow}</div>}
              <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight text-balance">{title}</h1>
              {description && <p className="mt-3 text-muted-foreground text-base md:text-lg text-pretty max-w-xl">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </div>
      </div>

      <div className="premium-shell py-8 md:py-12">{children}</div>
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "gold" | "success" | "warning" }) {
  const toneClass = tone === "gold" ? "text-gold" : tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="premium-card">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-medium">{label}</div>
      <div className={`mt-3 font-display text-3xl font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function SectionCard({ title, subtitle, actions, children, className = "" }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`premium-card ${className}`}>
      <header className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
