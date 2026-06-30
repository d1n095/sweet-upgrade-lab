import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type DirtySource = { id: string; message?: string };

interface UnsavedChangesContextValue {
  isDirty: boolean;
  /** Register/unregister a dirty source. Returns an unregister fn. */
  register: (id: string, dirty: boolean, message?: string) => void;
  /** Wrap any navigation action — runs it immediately if clean, otherwise prompts. */
  guard: (action: () => void) => void;
  /** Force-clear all dirty flags (call this after a successful save if needed). */
  clearAll: () => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

const DEFAULT_MESSAGE = 'Du har osparade ändringar. Är du säker på att du vill lämna sidan?';

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const sourcesRef = useRef<Map<string, DirtySource>>(new Map());
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState<null | (() => void)>(null);

  const recomputed = () => setVersion(v => v + 1);

  const register = useCallback((id: string, dirty: boolean, message?: string) => {
    const map = sourcesRef.current;
    const existing = map.get(id);
    if (dirty) {
      if (!existing || existing.message !== message) {
        map.set(id, { id, message });
        recomputed();
      }
    } else if (existing) {
      map.delete(id);
      recomputed();
    }
  }, []);

  const clearAll = useCallback(() => {
    if (sourcesRef.current.size > 0) {
      sourcesRef.current.clear();
      recomputed();
    }
  }, []);

  const isDirty = sourcesRef.current.size > 0;
  const currentMessage = useMemo(() => {
    const first = Array.from(sourcesRef.current.values()).find(s => s.message);
    return first?.message || DEFAULT_MESSAGE;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const guard = useCallback((action: () => void) => {
    if (sourcesRef.current.size === 0) {
      action();
      return;
    }
    setPending(() => action);
  }, []);

  // Browser-level guard for tab close / refresh / external navigation
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (sourcesRef.current.size === 0) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const value = useMemo<UnsavedChangesContextValue>(
    () => ({ isDirty, register, guard, clearAll }),
    [isDirty, register, guard, clearAll]
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Osparade ändringar</AlertDialogTitle>
            <AlertDialogDescription>{currentMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stanna kvar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const run = pending;
                sourcesRef.current.clear();
                recomputed();
                setPending(null);
                if (run) run();
              }}
            >
              Lämna ändå
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  );
}

/** Layout-side hook. Safe to call outside the provider (returns no-op guard). */
export function useUnsavedChangesGuard() {
  const ctx = useContext(UnsavedChangesContext);
  return ctx ?? {
    isDirty: false,
    register: () => {},
    guard: (action: () => void) => action(),
    clearAll: () => {},
  };
}

/**
 * Page-level hook — call from any admin page/form.
 *   const dirty = form.formState.isDirty;
 *   useUnsavedChanges(dirty);
 */
export function useUnsavedChanges(dirty: boolean, message?: string) {
  const ctx = useContext(UnsavedChangesContext);
  const idRef = useRef<string>(Math.random().toString(36).slice(2));
  useEffect(() => {
    if (!ctx) return;
    ctx.register(idRef.current, dirty, message);
    return () => ctx.register(idRef.current, false);
  }, [ctx, dirty, message]);
}
