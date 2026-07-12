import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { getDefault, setDefault } from "@/lib/defaults";
import { createTransaction } from "@/modules/finance/finance-service";
import { cn } from "@/lib/utils";

const CATS = [
  { value: "food", label: "Mat", emoji: "🍔" },
  { value: "transport", label: "Resa", emoji: "🚗" },
  { value: "home", label: "Hem", emoji: "🏠" },
  { value: "fun", label: "Nöje", emoji: "🎬" },
  { value: "health", label: "Hälsa", emoji: "💊" },
  { value: "other", label: "Annat", emoji: "✨" },
] as const;

export function ExpenseFlow({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<string>("food");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    getDefault<{ category: string }>("expense.lastCategory").then((d) => {
      if (d?.category) setCat(d.category);
    });
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Ange belopp");
      await createTransaction({
        direction: "out",
        amount: amt,
        description: desc || null,
        categoryName: cat,   // servicen slår upp category_id från namn
      });
      await setDefault("expense.lastCategory", { category: cat });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["cal-expenses"] });
      toast.success("Utgift sparad");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      className="space-y-5"
    >
      {/* Belopp — stort, fokuserat */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Hur mycket?</div>
        <div className="mt-2 flex items-baseline gap-2">
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", "."))}
            placeholder="0"
            className="display w-full bg-transparent text-4xl outline-none placeholder:text-muted-foreground/30"
          />
          <span className="text-lg text-muted-foreground">kr</span>
        </div>
      </div>

      {/* Kategori — emoji-chips */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Vad?</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCat(c.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition",
                cat === c.value
                  ? "border-[oklch(0.78_0.105_85/0.5)] bg-[oklch(0.78_0.105_85/0.12)] text-foreground"
                  : "border-border bg-white/[0.02] text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="mr-1">{c.emoji}</span>{c.label}
            </button>
          ))}
        </div>
      </div>

      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Beskrivning (valfritt)"
        className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm"
      />

      <button
        type="submit"
        disabled={save.isPending || !amount}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[oklch(0.88_0.1_85)] to-[oklch(0.7_0.12_75)] py-3 text-sm font-medium text-background disabled:opacity-50"
      >
        <Check className="h-4 w-4" /> Spara utgift
      </button>
    </form>
  );
}
