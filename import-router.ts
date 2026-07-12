// =====================================================================
// modules/scan/import-router.ts — Router för godkänd, extraherad data.
// Skickar rätt data till rätt modul beroende på dokumenttyp (ADR-006).
// ALL skrivning går via befintliga services + emit — ingen ny DB-väg.
// =====================================================================

import { db } from "@/modules/core/db";
import { currentOwner } from "@/modules/core/session";
import { createShifts, type CreateShiftInput } from "@/modules/salary/shift-service";
import { createTransaction } from "@/modules/finance/finance-service";
import { emit } from "@/modules/core/events";
import type { DocumentType } from "./classify";

export type ImportBatchRef = { id: string };

/** Skapa en import-batch (spårning + ångra). */
export async function startBatch(opts: {
  documentId: string | null;
  detectedType: DocumentType;
  confirmedType: DocumentType;
  itemsProposed: number;
}): Promise<ImportBatchRef> {
  const { userId, contextId } = await currentOwner();
  const { data, error } = await db.from("import_batches").insert({
    user_id: userId,
    owner_context_id: contextId,
    document_id: opts.documentId,
    detected_type: opts.detectedType,
    confirmed_type: opts.confirmedType,
    status: "importing",
    items_proposed: opts.itemsProposed,
  }).select().single();
  if (error) throw error;
  return { id: data.id };
}

export async function finishBatch(batchId: string, counts: { imported: number; skipped: number }) {
  await db.from("import_batches").update({
    status: "imported",
    items_imported: counts.imported,
    items_skipped_dupe: counts.skipped,
  }).eq("id", batchId);
}

/** Ångra en hel import: soft-delete allt som batchen skapade. */
export async function revertBatch(batchId: string) {
  const now = new Date().toISOString();
  // Pass
  await db.from("shifts").update({ deleted_at: now }).eq("import_batch_id", batchId);
  // Transaktioner (om source_id-koppling via metadata batch)
  await db.from("transactions").update({ deleted_at: now })
    .eq("source", "import").contains("metadata", { import_batch_id: batchId });
  await db.from("import_batches").update({ status: "reverted", reverted_at: now }).eq("id", batchId);
}

// ---------------------------------------------------------------------
// ROUTES per dokumenttyp — skickar godkänd data till rätt service.
// ---------------------------------------------------------------------

/** schema → shift-service. Rader måste redan vara dubblettkollade + godkända. */
export async function routeSchedule(
  rows: Array<Omit<CreateShiftInput, "userId" | "ownerContextId">>,
  batchId: string
) {
  const { userId, contextId } = await currentOwner();
  await createShifts(rows.map((r) => ({
    ...r,
    userId,
    ownerContextId: contextId,
    source: "ocr" as const,
    importBatchId: batchId,
  })));
}

/** receipt → finance-service (utgift). */
export async function routeReceipt(
  receipt: { amount: number; merchant?: string; description?: string; occurredAt?: string; categoryName?: string },
  batchId: string
) {
  await createTransaction({
    direction: "out",
    amount: receipt.amount,
    merchant: receipt.merchant ?? null,
    description: receipt.description ?? null,
    categoryName: receipt.categoryName ?? null,
    occurredAt: receipt.occurredAt,
    source: "import",
    metadataBatchId: batchId,
  } as any);
}

/** invoice → finance-service (kommande räkning, markeras recurring=false). */
export async function routeInvoice(
  invoice: { amount: number; merchant?: string; dueDate?: string; description?: string },
  batchId: string
) {
  await createTransaction({
    direction: "out",
    amount: invoice.amount,
    merchant: invoice.merchant ?? null,
    description: invoice.description ?? `Faktura${invoice.dueDate ? ` (förfaller ${invoice.dueDate})` : ""}`,
    occurredAt: invoice.dueDate,
    source: "import",
    metadataBatchId: batchId,
  } as any);
}

/** payslip → payslips-tabell + emit. Inställnings-förslag hanteras separat i UI. */
export async function routePayslip(
  payslip: {
    workProfileId?: string | null;
    periodStart: string; periodEnd: string;
    gross?: number; net?: number; tax?: number; ob?: number; vacation?: number; totalHours?: number;
    documentId?: string | null;
  },
  batchId: string
) {
  const { userId, contextId } = await currentOwner();
  const { data, error } = await db.from("payslips").insert({
    user_id: userId,
    owner_context_id: contextId,
    work_profile_id: payslip.workProfileId ?? null,
    period_start: payslip.periodStart,
    period_end: payslip.periodEnd,
    gross_salary: payslip.gross ?? null,
    net_salary: payslip.net ?? null,
    tax_amount: payslip.tax ?? null,
    ob_amount: payslip.ob ?? null,
    vacation_pay: payslip.vacation ?? null,
    total_hours: payslip.totalHours ?? null,
    document_id: payslip.documentId ?? null,
  }).select().single();
  if (error) throw error;
  await emit({
    kind: "document",
    title: "Lönespec importerad",
    subtitle: `${payslip.periodStart} – ${payslip.periodEnd}`,
    occursAt: new Date().toISOString(),
    sourceTable: "payslips",
    sourceId: data.id,
  });
  return data;
}

/** contract/warranty/insurance/id_document/other → arkivera i documents. */
export async function routeArchive(documentId: string, type: DocumentType) {
  await emit({
    kind: "document",
    title: `${type} arkiverat`,
    occursAt: new Date().toISOString(),
    sourceTable: "documents",
    sourceId: documentId,
  });
}
