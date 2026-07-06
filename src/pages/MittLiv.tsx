import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function MittLiv() {
  const { user, loading } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [journal, setJournal] = useState<any[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [journalText, setJournalText] = useState("");
  const [mood, setMood] = useState(5);

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

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <Helmet><title>Mitt Liv · 4ThePeople</title><meta name="description" content="Din personliga hub – mål, rutiner, journal och påminnelser." /></Helmet>
      <div>
        <h1 className="text-4xl font-bold">Mitt Liv</h1>
        <p className="text-muted-foreground mt-1">Din resa. Följ mål, rutiner och må-bra-anteckningar.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Mål ({goals.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Nytt mål…" value={newGoal} onChange={e => setNewGoal(e.target.value)} />
              <Button onClick={addGoal}>Lägg till</Button>
            </div>
            <ul className="space-y-2">
              {goals.map(g => (
                <li key={g.id} className="flex justify-between items-center p-2 border rounded">
                  <span>{g.title}</span>
                  <Badge variant="outline">{g.status} · streak {g.streak_days}d</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rutiner ({routines.length})</CardTitle></CardHeader>
          <CardContent>
            {routines.length === 0 ? <p className="text-sm text-muted-foreground">Inga aktiva rutiner ännu.</p> : (
              <ul className="space-y-2">
                {routines.map(r => (
                  <li key={r.id} className="p-2 border rounded flex justify-between">
                    <span>{r.name} <span className="text-xs text-muted-foreground">({r.cadence})</span></span>
                    <Badge variant="outline">streak {r.streak_days}d</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Påminnelser</CardTitle></CardHeader>
          <CardContent>
            {reminders.length === 0 ? <p className="text-sm text-muted-foreground">Inga påminnelser.</p> : (
              <ul className="space-y-2">
                {reminders.map(r => (
                  <li key={r.id} className="text-sm p-2 border rounded">
                    <div>{r.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.remind_at).toLocaleString("sv-SE")}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Journal</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="Hur mår du idag?" value={journalText} onChange={e => setJournalText(e.target.value)} />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Humör:</span>
              <Input type="number" min={1} max={10} value={mood} onChange={e => setMood(Number(e.target.value))} className="w-20" />
              <Button onClick={saveJournal}>Spara</Button>
            </div>
            <ul className="space-y-2 mt-4">
              {journal.map(j => (
                <li key={j.id} className="p-2 border rounded text-sm">
                  <div className="flex justify-between"><span className="text-xs text-muted-foreground">{j.entry_date}</span>{j.mood && <Badge variant="outline">{j.mood}/10</Badge>}</div>
                  <div className="mt-1 whitespace-pre-wrap">{j.content}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
