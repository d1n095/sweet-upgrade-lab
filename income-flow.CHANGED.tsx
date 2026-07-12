import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { createTransaction } from "@/modules/finance/finance-service";
import { cn } from "@/lib/utils";

// Inkomst-flöde. Speglar utgiftsflödet men skapar transaction direction='in'.
// Stänger No-Mockups-luckan: "Lägg inkomst"-knappen har nu ett mål som fungerar.
const INCOME_CATEGORIES = ["Lön", "Övrig inkomst"];

export function IncomeFlow({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(INCOME_CATEGORIES[1]);

  const save = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Ange belopp");
      await createTransaction({
        direction: "in",
        amount: amt,
        description: desc || null,
        categoryName: cat,
        source: "manual",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["cal-income"] });
      toast.success("Inkomst sparad");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
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

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Kategori</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {INCOME_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition",
                cat === c
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-white/[0.02] text-muted-foreground hover:text-foreground"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Beskrivning (valfritt)</div>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="t.ex. Swish från Anna"
          className="mt-2 w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-sm outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={save.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        <Check className="h-4 w-4" /> Spara inkomst
      </button>
    </form>
  );
}
