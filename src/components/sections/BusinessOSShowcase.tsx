import { Link } from "react-router-dom";
import { ArrowUpRight, Wallet, Users, BookOpen, Activity, Zap, Shield, Sparkles } from "lucide-react";

const modules = [
  { to: "/admin/erp", title: "ERP & Bokföring", desc: "Huvudbok, fakturor, kassaflöde.", icon: Wallet, sprint: "01" },
  { to: "/admin/customers-360", title: "Kunder 360", desc: "RFM-segment och tidslinje.", icon: Users, sprint: "03" },
  { to: "/kunskap", title: "Kunskap", desc: "Guider och artiklar.", icon: BookOpen, sprint: "02" },
  { to: "/admin/mission-control", title: "Mission Control", desc: "Insikter och avvikelser.", icon: Activity, sprint: "04" },
  { to: "/admin/automation", title: "Automation", desc: "Arbetsflöden och autonomi.", icon: Zap, sprint: "05" },
  { to: "/admin/gdpr", title: "GDPR", desc: "Export och radering.", icon: Shield, sprint: "06" },
  { to: "/mitt-liv", title: "Mitt Liv", desc: "Mål, rutiner, journal.", icon: Sparkles, sprint: "07" },
];

export default function BusinessOSShowcase() {
  return (
    <section className="relative border-y border-border overflow-hidden" style={{ background: 'var(--gradient-noir)' }}>
      <div className="absolute inset-0 grain opacity-40" />
      <div className="premium-shell py-16 md:py-24 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <div className="chip-gold mb-4" style={{ borderColor: 'hsl(var(--gold) / 0.4)' }}>Business OS · Sprint 8–17</div>
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-white tracking-tight text-balance">
              Ett operativsystem för <span className="gradient-text-gold">hela verksamheten</span>.
            </h2>
            <p className="mt-4 text-white/70 text-base md:text-lg max-w-xl">
              ERP, kunder, kunskap, insikter, automation, GDPR och en personlig hub – allt sömlöst kopplat.
            </p>
          </div>
          <Link to="/admin/business-os" className="btn-gold self-start md:self-auto">
            Testhub <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-[hsl(var(--gold)/0.5)] hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between mb-8">
                <div className="w-11 h-11 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-gold">
                  <m.icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Sprint {m.sprint}</span>
              </div>
              <div className="text-white font-display text-lg font-medium mb-1">{m.title}</div>
              <div className="text-white/60 text-sm">{m.desc}</div>
              <ArrowUpRight className="absolute top-6 right-6 w-4 h-4 text-white/30 opacity-0 group-hover:opacity-100 transition" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
