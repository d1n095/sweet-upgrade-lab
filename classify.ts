// =====================================================================
// modules/scan/classify.ts — Dokumentklassificerare (ADR-006).
// Regelbaserad FÖRST (fungerar utan AI), AI som förstärkning. Avgör vad ett
// dokument ÄR innan någon extraktion sker. Oberoende av OCR-leverantör.
// =====================================================================

export type DocumentType =
  | "schema"
  | "payslip"
  | "receipt"
  | "invoice"
  | "contract"
  | "warranty"
  | "insurance"
  | "id_document"
  | "other";

export type Classification = {
  type: DocumentType;
  confidence: number;      // 0..1
  signals: string[];       // vilka signaler som gav utslag (transparens)
  ambiguous: boolean;      // true → fråga användaren, gissa inte
};

// Signalord per typ (svenska). Regelbaserad grund.
const SIGNALS: Record<Exclude<DocumentType, "other">, RegExp[]> = {
  schema: [/\bschema\b/i, /\bturlista\b/i, /\barbetspass\b/i, /\bpass\b/i, /\bvecka\s*\d+/i],
  payslip: [/lönespec/i, /lönespecifikation/i, /bruttolön/i, /nettolön/i, /skatteavdrag/i,
            /semesterersättning/i, /\bOB-tillägg\b/i, /utbetald/i, /personnummer/i],
  receipt: [/\bkvitto\b/i, /\btotalt\b/i, /\bmoms\b/i, /kortköp/i, /swish/i, /\bkassa\b/i],
  invoice: [/\bfaktura\b/i, /förfaller/i, /ocr-?nummer/i, /bankgiro/i, /plusgiro/i, /att betala/i],
  contract: [/\bavtal\b/i, /anställningsavtal/i, /kollektivavtal/i, /\bkontrakt\b/i, /underskrift/i],
  warranty: [/\bgaranti\b/i, /garantibevis/i, /garantitid/i, /serienummer/i],
  insurance: [/försäkring/i, /försäkringsbrev/i, /\bpremie\b/i, /självrisk/i],
  id_document: [/körkort/i, /\bpass\b.*\bnr\b/i, /identitetskort/i, /\bID-?kort\b/i],
};

/**
 * Klassificera från OCR-råtext. Regelbaserad — ingen AI krävs.
 * Poäng per typ = antal matchande signaler, normaliserat.
 */
export function classifyFromText(rawText: string): Classification {
  const text = rawText || "";
  const scores: Array<{ type: DocumentType; hits: string[] }> = [];

  for (const [type, patterns] of Object.entries(SIGNALS) as [DocumentType, RegExp[]][]) {
    const hits = patterns.filter((p) => p.test(text)).map((p) => p.source);
    if (hits.length > 0) scores.push({ type, hits });
  }

  if (scores.length === 0) {
    return { type: "other", confidence: 0.3, signals: [], ambiguous: true };
  }

  scores.sort((a, b) => b.hits.length - a.hits.length);
  const top = scores[0];
  const runnerUp = scores[1];

  // Confidence: fler unika signaler = säkrare. Normaliserat, tak 0.95 (rule-based).
  const confidence = Math.min(0.95, 0.5 + top.hits.length * 0.12);

  // Tvetydigt om tvåa ligger nära (inom 1 signal) → fråga användaren.
  const ambiguous = !!runnerUp && top.hits.length - runnerUp.hits.length <= 1 && confidence < 0.8;

  return { type: top.type, confidence, signals: top.hits, ambiguous };
}

/**
 * Spökpass-hint: ser texten ut som appens EGEN vy? (SCAN-GHOST-001)
 * Egna UI-texter/rubriker som inte hör hemma i ett äkta arbetsschema.
 */
const APP_UI_MARKERS = [
  /intjänat denna period/i, /nästa löneutbetalning/i, /Snabbmotor/i,
  /Mission Control/i, /Life Feed/i, /My Money Master/i, /oklch\(/i,
  /pay_snapshot/i, /owner_context/i,
];
export function looksLikeOwnAppScreenshot(rawText: string): boolean {
  const text = rawText || "";
  return APP_UI_MARKERS.filter((m) => m.test(text)).length >= 2;
}

/** Mänsklig etikett för en dokumenttyp (svenska). */
export function typeLabel(t: DocumentType): string {
  return {
    schema: "Arbetsschema", payslip: "Lönespecifikation", receipt: "Kvitto",
    invoice: "Faktura", contract: "Avtal", warranty: "Garanti",
    insurance: "Försäkring", id_document: "ID-handling", other: "Övrigt dokument",
  }[t];
}
