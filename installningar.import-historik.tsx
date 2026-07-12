import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, Undo2, FileText, Loader2 } from "lucide-react";
import { db } from "@/modules/core/db";
import { revertBatch } from "@/modules/scan/import-router";
import { sweDate } from "@/lib/format";

export const Route = createFileRoute("/_app/installningar/import-historik")({
  component: ImportHistoryPage,
});

const TYPE_LABEL: Record<string, string> = {
  schema: "Arbetsschema", payslip: "Lönespec", receipt: "Kvitto",
  invoice: "Faktura", contract: "Avtal", other: "Dokument",
};

function ImportHistoryPage() {
  const qc = useQueryClient();

  const batches = useQuery({
    queryKey: ["import_batches"],
    queryFn: async () => {
      const { data, error } = await db.from("import_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const undo = useMutation({
    mutationFn: async (batchId: string) => revertBatch(batchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["import_batches"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Importen ångrad");
    },
    onError: (e: any) => toast.error(e.message ?? "Kunde inte ångra"),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <History className="h-5 w-5 text-muted-foreground" />
        <h1 className="display text-2xl">Importhistorik</h1>
      </div>

      {batches.isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      )}

      {batches.data?.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Inga importer än. När du scannar dokument dyker de upp här och kan ångras.
        </div>
      )}

      <div className="space-y-2">
        {(batches.data ?? []).map((b: any) => {
          const reverted = b.status === "reverted";
          return (
            <div key={b.id} className="glass flex items-center justify-between rounded-2xl px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">
                    {TYPE_LABEL[b.confirmed_type ?? b.detected_type] ?? "Import"}
                    {reverted && <span className="ml-2 text-xs text-muted-foreground">(ångrad)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sweDate(b.created_at)} · {b.items_imported} sparade
                    {b.items_skipped_dupe > 0 ? `, ${b.items_skipped_dupe} hoppade` : ""}
                  </div>
                </div>
              </div>
              {!reverted && b.items_imported > 0 && (
                <button
                  onClick={() => undo.mutate(b.id)}
                  disabled={undo.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition hover:bg-white/[0.03] disabled:opacity-50"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Ångra
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
