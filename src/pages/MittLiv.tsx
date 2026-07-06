import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Target, Repeat, Bell, BookOpen, Plus, Flame } from "lucide-react";
import { SectionCard } from "@/components/premium/PremiumPageShell";

export default function MittLiv() {
  const { user, loading } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [journal, setJournal] = useState<any[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [journalText, setJournalText] = useState("");
  const [mood, setMood] = useState(7);

  const load = async () => {
    if (!user) return;
    const [g, r, rm, j] = await Promise.all([
      supabase.from("life_goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("life_routines").select("*").eq("user_id", user.id).eq("is_active", true),
      supabase.from("life_reminders").select("*").eq("user_id", user.id).eq("is_completed", false).order("remind_at").limit(20),
      supabase.from("journal_entries").select("*").eq("user_id", user.id).order("entry_date", { ascending: false }).limit(10),
    ]);
    setGoals(g.data ?? []); setRoutines(r.data ?? []); setReminders(rm.data ?? []); setJournal(j.data ?? []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  if (loading) return <div className="p-8">Laddar…</div>;
  if (!user) return <Navigate to="/" replace />;

  const addGoal = async () => {
    if (!newGoal.trim()) return;
    const { error } = await supabase.from("life_goals").insert({ user_id: user.id, title: newGoal });
    if (error) toast.error(error.message); else { setNewGoal(""); load(); }
  };
  const saveJournal = async () => {
    if (!journalText.trim()) return;
    const { error } = await supabase.from("journal_entries").insert({ user_id: user.id, content: journalText, mood, entry_date: new Date().toISOString().slice(0, 10) });
    if (error) toast.error(error.message); else { setJournalText(""); toast.success("Sparat"); load(); }
  };

  const totalStreak = goals.reduce((s, g) => s + (g.streak_days ?? 0), 0) + routines.reduce((s, r) => s + (r.streak_days ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Mitt Liv · 4ThePeople</title><meta name="description" content="Din personliga hub – mål, rutiner, journal och påminnelser." /></Helmet>
      <Header />
      <main>
        <section className="relative border-b border-border overflow-hidden" style={{ background: 'var(--gradient-noir)' }}>
          <div className="absolute inset-0 grain opacity-30" />
          <div className="premium-shell py-16 md:py-20 relative z-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <div className="chip-gold mb-4">Life Hub · Sprint 07</div>
                <h1 className="font-display text-5xl md:text-6xl font-semibold text-white tracking-tight">
                  Din <span className="gradient-text-gold">resa</span>
                </h1>
                <p className="mt-4 text-white/70 max-w-lg text-pretty">Mål, rutiner och journal. Framsteg som byggs dag för dag.</p>
              </div>
              <div className="flex gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 min-w-[140px]">
                  <div className="text-xs uppercase tracking-widest text-white/50">Aktiva mål</div>
                  <div className="mt-1 font-display text-3xl font-semibold text-white">{goals.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 min-w-[140px]">
                  <div className="text-xs uppercase tracking-widest text-white/50 flex items-center gap-1"><Flame className="w-3 h-3" /> Streak</div>
                  <div className="mt-1 font-display text-3xl font-semibold text-gold">{totalStreak}d</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="premium-shell py-10 md:py-14">
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard
              title="Mål"
              subtitle={`${goals.length} aktiva`}
              actions={<Target className="w-4 h-4 text-gold" />}
            >
              <div className="flex gap-2 mb-4">
                <Input placeholder="Nytt mål…" value={newGoal} onChange={e => setNewGoal(e.target.value)} onKeyDown={e => e.key === "Enter" && addGoal()} />
                <Button onClick={addGoal}><Plus className="w-4 h-4" /></Button>
              </div>
              {goals.length === 0 ? <p className="text-sm text-muted-foreground">Sätt ditt första mål ovan.</p> : (
                <ul className="space-y-2">
                  {goals.map(g => (
                    <li key={g.id} className="flex justify-between items-center p-3 rounded-xl bg-secondary/40">
                      <span className="font-medium">{g.title}</span>
                      <div className="flex items-center gap-2">
                        {g.streak_days > 0 && <span className="chip-gold text-[10px]"><Flame className="w-3 h-3" /> {g.streak_days}d</span>}
                        <Badge variant="outline">{g.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Rutiner" subtitle={`${routines.length} aktiva`} actions={<Repeat className="w-4 h-4 text-gold" />}>
              {routines.length === 0 ? <p className="text-sm text-muted-foreground">Inga aktiva rutiner ännu.</p> : (
                <ul className="space-y-2">
                  {routines.map(r => (
                    <li key={r.id} className="p-3 rounded-xl bg-secondary/40 flex justify-between">
                      <span>{r.name} <span className="text-xs text-muted-foreground">({r.cadence})</span></span>
                      <span className="chip-gold text-[10px]"><Flame className="w-3 h-3" /> {r.streak_days}d</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Påminnelser" actions={<Bell className="w-4 h-4 text-gold" />}>
              {reminders.length === 0 ? <p className="text-sm text-muted-foreground">Inga påminnelser.</p> : (
                <ul className="space-y-2">
                  {reminders.map(r => (
                    <li key={r.id} className="p-3 rounded-xl bg-secondary/40 text-sm">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{new Date(r.remind_at).toLocaleString("sv-SE")}</div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Journal" actions={<BookOpen className="w-4 h-4 text-gold" />}>
              <Textarea placeholder="Hur mår du idag?" value={journalText} onChange={e => setJournalText(e.target.value)} className="mb-3" />
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm text-muted-foreground">Humör</span>
                <Input type="number" min={1} max={10} value={mood} onChange={e => setMood(Number(e.target.value))} className="w-20" />
                <Button onClick={saveJournal} className="ml-auto">Spara</Button>
              </div>
              <ul className="space-y-2">
                {journal.map(j => (
                  <li key={j.id} className="p-3 rounded-xl bg-secondary/40 text-sm">
                    <div className="flex justify-between mb-1"><span className="text-xs text-muted-foreground">{j.entry_date}</span>{j.mood && <span className="chip-gold text-[10px]">{j.mood}/10</span>}</div>
                    <div className="whitespace-pre-wrap">{j.content}</div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
