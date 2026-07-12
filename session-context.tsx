// =====================================================================
// core/session-context.tsx — React-provider för sessionen/aktiv kontext.
// Solo-first: exponerar isSolo så UI kan dölja ALL kontext-relaterad yta
// för en ensamanvändare. Använd useSession() i komponenter.
// =====================================================================

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { resolveSession, setActiveContext, type SessionInfo } from "./session";

type SessionState = SessionInfo & {
  loading: boolean;
  switchContext: (id: string) => void;
  refresh: () => Promise<void>;
};

const SessionCtx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setState(await resolveSession());
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const value: SessionState = {
    userId: state?.userId ?? "",
    contexts: state?.contexts ?? [],
    activeContextId: state?.activeContextId ?? "",
    isSolo: state?.isSolo ?? true, // default solo → dölj kontext-UI tills vi vet annat
    loading,
    switchContext: (id: string) => {
      setActiveContext(id);
      setState((s) => (s ? { ...s, activeContextId: id } : s));
    },
    refresh: load,
  };

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession måste användas inom SessionProvider");
  return ctx;
}

/** Solo-first-hjälp: rendera bara barn om användaren har fler än en kontext. */
export function IfMultiContext({ children }: { children: ReactNode }) {
  const { isSolo, loading } = useSession();
  if (loading || isSolo) return null;
  return <>{children}</>;
}
