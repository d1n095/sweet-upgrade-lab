// =====================================================================
// core/db.ts — Övergångsbrygga tills Supabase-typerna regenererats.
//
// VARFÖR: Migrationerna UPGRADE_01..06 inför nya tabeller/kolumner
// (owner_contexts, context_members, transactions, pay_snapshot, m.fl.).
// Supabases genererade `Database`-typ känner inte till dem förrän man kör
// `supabase gen types` EFTER migrationerna. Tills dess kan inte den
// starkt typade klienten referera de nya fälten.
//
// LÖSNING: `db` är samma klient men otypad, isolerad HÄR. Nya services
// använder `db` för nya tabeller. När typerna regenererats byter vi
// tillbaka till den typade `supabase` och raderar denna fil.
//
// TODO(post-migration): kör `supabase gen types typescript` → ersätt
// `db` med `supabase` i session.ts, shift-service.ts, finance-service.ts.
// =====================================================================

import { supabase } from "@/integrations/supabase/client";

// Avsiktligt otypad vy av klienten för schema som ännu inte finns i types.ts.
// Detta är en medveten, dokumenterad och temporär avvikelse.
export const db = supabase as unknown as {
  from: (table: string) => any;
  auth: typeof supabase.auth;
  storage: typeof supabase.storage;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};
