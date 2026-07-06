import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Wallet, Users, BookOpen, Activity, Zap, Shield, Sparkles, ArrowUpRight, ExternalLink } from "lucide-react";
import PremiumPageShell from "@/components/premium/PremiumPageShell";

const modules = [
  { to: "/admin/erp", title: "ERP & Bokföring", desc: "Huvudbok, fakturor, utgifter, leverantörer.", icon: Wallet, sprint: "Sprint 01 · Del 8", role: "Founder", tone: "gold" },
  { to: "/admin/kunskap", title: "Kunskap (Admin)", desc: "Skapa och publicera artiklar.", icon: BookOpen, sprint: "Sprint 02 · Del 9", role: "Admin" },
  { to: "/kunskap", title: "Kunskap (Publikt)", desc: "Läsvy för publicerade artiklar.", icon: ExternalLink, sprint: "Sprint 02 · Del 9", role: "Publik" },
  { to: "/admin/customers-360", title: "Kunder 360", desc: "RFM-segment, tidslinje, anteckningar.", icon: Users, sprint: "Sprint 03 · Del 10", role: "Admin" },
  { to: "/admin/mission-control", title: "Mission Control", desc: "Insikter, åtgärder, avvikelser.", icon: Activity, sprint: "Sprint 04 · Del 11+12", role: "Admin" },
  { to: "/admin/automation", title: "Automation", desc: "Arbetsflöden och autonominivåer.", icon: Zap, sprint: "Sprint 05 · Del 13+14", role: "Admin" },
  { to: "/admin/gdpr", title: "GDPR", desc: "Export och radering av användardata.", icon: Shield, sprint: "Sprint 06 · Del 16", role: "Founder" },
  { to: "/mitt-liv", title: "Mitt Liv", desc: "Mål, rutiner, journal, påminnelser.", icon: Sparkles, sprint: "Sprint 07 · Del 17", role: "Inloggad" },
];

export default function AdminBusinessOS() {
  return (
    <PremiumPageShell
      eyebrow="Business OS"
      title="Sprint 8–17 · Testhub"
      description="Alla nya moduler i det nya designsystemet. Klicka in i valfri modul för att verifiera."
      metaDescription="Business OS testhub"
      breadcrumbs={[{ to: "/admin", label: "Admin" }, { label: "Business OS" }]}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link key={m.to} to={m.to} className="premium-card group flex flex-col">
            <div className="flex items-start justify-between mb-6">
              <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-foreground group-hover:text-gold transition">
                <m.icon className="w-5 h-5" />
              </div>
              <span className="chip">{m.role}</span>
            </div>
            <div className="font-display text-lg font-semibold">{m.title}</div>
            <p className="text-sm text-muted-foreground mt-1 flex-1">{m.desc}</p>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{m.sprint}</span>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-gold transition" />
            </div>
          </Link>
        ))}
      </div>
    </PremiumPageShell>
  );
}
