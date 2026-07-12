// =====================================================================
// core/session.ts — Löser inloggad användare + AKTIV ägarskapskontext.
// Solo-first (ADR-002 + DESIGN-PRINCIPLE-solo-first):
//   - En användare med bara sin personliga kontext ser ALDRIG något om
//     kontexter. resolveActiveContext() returnerar bara deras personliga id.
//   - Kontext-väljare visas först när användaren har > 1 kontext.
// Denna modul är den enda källan för "vilken owner_context_id ska data
// skrivas mot" — alla services använder den.
// =====================================================================

import { supabase } from "@/integrations/supabase/client";
import { db } from "./db";

export type OwnerContext = {
  id: string;
  type: "personal" | "household" | "organization";
  name: string;
};

export type SessionInfo = {
  userId: string;
  contexts: OwnerContext[];
  activeContextId: string;
  isSolo: boolean; // true = bara personlig kontext → dölj all kontext-UI
};

const ACTIVE_KEY = "mmm.active_context";

/** Hämta inloggad användare eller kasta (anropas i mutations/loaders). */
export async function requireUser(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Ej inloggad");
  return user.id;
}

/** Alla kontexter användaren är medlem i (aktiv status). */
export async function loadContexts(): Promise<OwnerContext[]> {
  const { data, error } = await db
    .from("context_members")
    .select("context_id, owner_contexts(id, type, name)")
    .eq("status", "active");
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => r.owner_contexts)
    .filter(Boolean)
    .map((c: any) => ({ id: c.id, type: c.type, name: c.name }));
}

/**
 * Lös hela sessionen inkl. aktiv kontext.
 * Solo-first: om bara en kontext finns är den alltid aktiv och isSolo=true.
 * Vald kontext (för multi) sparas i localStorage men fallbackar säkert.
 */
export async function resolveSession(): Promise<SessionInfo> {
  const userId = await requireUser();
  const contexts = await loadContexts();

  // Failsafe: om ingen kontext (t.ex. race vid ny användare), försök personlig.
  if (contexts.length === 0) {
    const personalId = await ensurePersonalContext(userId);
    return {
      userId,
      contexts: [{ id: personalId, type: "personal", name: "Min data" }],
      activeContextId: personalId,
      isSolo: true,
    };
  }

  const isSolo = contexts.length === 1;
  let activeContextId = contexts[0].id;

  if (!isSolo && typeof window !== "undefined") {
    const stored = window.localStorage.getItem(ACTIVE_KEY);
    if (stored && contexts.some((c) => c.id === stored)) activeContextId = stored;
    else {
      // Default till personlig kontext om flera finns.
      const personal = contexts.find((c) => c.type === "personal");
      if (personal) activeContextId = personal.id;
    }
  }

  return { userId, contexts, activeContextId, isSolo };
}

/** Byt aktiv kontext (bara relevant för multi-kontext-användare). */
export function setActiveContext(contextId: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_KEY, contextId);
}

/**
 * Garantera att användaren har en personlig kontext (självläkande).
 * DB-triggern skapar den normalt vid registrering; detta är ett skyddsnät.
 */
export async function ensurePersonalContext(userId: string): Promise<string> {
  const { data: existing } = await db
    .from("context_members")
    .select("context_id, owner_contexts(type)")
    .eq("user_id", userId)
    .eq("status", "active");
  const personal = (existing ?? []).find((r: any) => r.owner_contexts?.type === "personal");
  if (personal) return personal.context_id;

  const { data: ctx, error } = await db
    .from("owner_contexts")
    .insert({ type: "personal", name: "Min data" })
    .select("id")
    .single();
  if (error) throw error;
  await db.from("context_members").insert({
    context_id: ctx.id, user_id: userId, role: "owner", status: "active",
  });
  return ctx.id;
}

/**
 * Bekvämlighet för mutations: ge {userId, contextId} i ETT anrop.
 * Använd överallt där data skapas så owner_context_id alltid sätts rätt.
 */
export async function currentOwner(): Promise<{ userId: string; contextId: string }> {
  const s = await resolveSession();
  return { userId: s.userId, contextId: s.activeContextId };
}
