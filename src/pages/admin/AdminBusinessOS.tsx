import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Users, BookOpen, Activity, Zap, Shield, Sparkles, ExternalLink } from "lucide-react";

const modules = [
  { to: "/admin/erp", title: "ERP & Bokföring", desc: "Huvudbok, fakturor, utgifter, leverantörer.", icon: Wallet, sprint: "Sprint 1 · Del 8", role: "Founder" },
  { to: "/admin/kunskap", title: "Kunskap (Admin)", desc: "Skapa och publicera artiklar.", icon: BookOpen, sprint: "Sprint 2 · Del 9", role: "Admin" },
  { to: "/kunskap", title: "Kunskap (Publikt)", desc: "Läsvy för publicerade artiklar.", icon: ExternalLink, sprint: "Sprint 2 · Del 9", role: "Publik" },
  { to: "/admin/customers-360", title: "Kunder 360", desc: "RFM-segment, tidslinje, anteckningar.", icon: Users, sprint: "Sprint 3 · Del 10", role: "Admin" },
  { to: "/admin/mission-control", title: "Mission Control", desc: "Insikter, åtgärder, avvikelser.", icon: Activity, sprint: "Sprint 4 · Del 11+12", role: "Admin" },
  { to: "/admin/automation", title: "Automation", desc: "Arbetsflöden och autonominivåer.", icon: Zap, sprint: "Sprint 5 · Del 13+14", role: "Admin" },
  { to: "/admin/gdpr", title: "GDPR", desc: "Export och radering av användardata.", icon: Shield, sprint: "Sprint 6 · Del 16", role: "Founder" },
  { to: "/mitt-liv", title: "Mitt Liv (Life Hub)", desc: "Mål, rutiner, journal, påminnelser.", icon: Sparkles, sprint: "Sprint 7 · Del 17", role: "Inloggad" },
];

export default function AdminBusinessOS() {
  return (
    <div className="p-4 md:p-8 space-y-6">
      <Helmet><title>Business OS · Sprintar 8–17</title><meta name="description" content="Testhub för alla nya moduler." /></Helmet>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business OS – Testhub</h1>
        <p className="text-muted-foreground mt-1">Alla nya sidor från Sprint 1–7. Klicka för att öppna och verifiera.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map(m => (
          <Link key={m.to} to={m.to}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <m.icon className="w-6 h-6 text-primary" />
                  <Badge variant="outline">{m.role}</Badge>
                </div>
                <CardTitle className="mt-2">{m.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{m.desc}</p>
                <p className="text-xs text-muted-foreground mt-3 font-mono">{m.sprint}</p>
                <p className="text-xs text-primary mt-1">{m.to}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
