/**
 * Test Runner — simulates user flows and validates app behaviour (TASK 4).
 * Tests are deterministic, side-effect-free environment/DOM checks.
 */
import { create } from 'zustand';

export type TestStatus = 'pending' | 'running' | 'pass' | 'fail' | 'skip';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'storage' | 'api' | 'ui' | 'environment' | 'edge_case';
  run: () => Promise<TestResult>;
}

export interface TestResult {
  id: string;
  name: string;
  category: string;
  status: TestStatus;
  message: string;
  details?: Record<string, any>;
  duration_ms: number;
}

export interface TestRunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  ran_at: string;
}

export const TEST_CASES: TestCase[] = [
  {
    id: 't-env-supabase-url',
    name: 'Supabase URL configured',
    description: 'Checks that VITE_SUPABASE_URL environment variable is set',
    category: 'environment',
    run: async () => {
      const start = Date.now();
      const url = (import.meta as any).env?.VITE_SUPABASE_URL;
      const ok = !!url && url.startsWith('https://');
      return { id: 't-env-supabase-url', name: 'Supabase URL configured', category: 'environment', status: ok ? 'pass' : 'fail', message: ok ? 'VITE_SUPABASE_URL is set and valid' : 'VITE_SUPABASE_URL is missing or invalid', duration_ms: Date.now() - start };
    },
  },
  {
    id: 't-env-anon-key',
    name: 'Supabase anon key configured',
    description: 'Checks that VITE_SUPABASE_ANON_KEY is set',
    category: 'environment',
    run: async () => {
      const start = Date.now();
      const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
      const ok = !!key && key.length >= 20;
      return { id: 't-env-anon-key', name: 'Supabase anon key configured', category: 'environment', status: ok ? 'pass' : 'fail', message: ok ? 'VITE_SUPABASE_ANON_KEY is set' : 'VITE_SUPABASE_ANON_KEY is missing or too short', duration_ms: Date.now() - start };
    },
  },
  {
    id: 't-env-browser',
    name: 'Browser APIs available',
    description: 'Checks that essential browser APIs are present',
    category: 'environment',
    run: async () => {
      const start = Date.now();
      const missing: string[] = [];
      if (typeof window === 'undefined') missing.push('window');
      if (typeof document === 'undefined') missing.push('document');
      if (typeof localStorage === 'undefined') missing.push('localStorage');
      if (typeof fetch === 'undefined') missing.push('fetch');
      const ok = missing.length === 0;
      return { id: 't-env-browser', name: 'Browser APIs available', category: 'environment', status: ok ? 'pass' : 'fail', message: ok ? 'All required browser APIs are present' : `Missing: ${missing.join(', ')}`, duration_ms: Date.now() - start };
    },
  },
  {
    id: 't-storage-read-write',
    name: 'localStorage read/write',
    description: 'Verifies localStorage is readable and writable',
    category: 'storage',
    run: async () => {
      const start = Date.now();
      const key = '__debug_test__';
      let ok = false; let message = '';
      try {
        localStorage.setItem(key, '1');
        const val = localStorage.getItem(key);
        localStorage.removeItem(key);
        ok = val === '1';
        message = ok ? 'localStorage is functional' : 'localStorage write/read mismatch';
      } catch (err: any) { message = err.message || 'localStorage unavailable'; }
      return { id: 't-storage-read-write', name: 'localStorage read/write', category: 'storage', status: ok ? 'pass' : 'fail', message, duration_ms: Date.now() - start };
    },
  },
  {
    id: 't-api-supabase-reachable',
    name: 'Supabase API reachable',
    description: 'Checks that the Supabase REST API responds',
    category: 'api',
    run: async () => {
      const start = Date.now();
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
      if (!supabaseUrl) return { id: 't-api-supabase-reachable', name: 'Supabase API reachable', category: 'api', status: 'skip' as TestStatus, message: 'Skipped: VITE_SUPABASE_URL not set', duration_ms: 0 };
      try {
        const resp = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '' }, signal: AbortSignal.timeout(6000) });
        const ok = resp.status < 500;
        return { id: 't-api-supabase-reachable', name: 'Supabase API reachable', category: 'api', status: ok ? 'pass' : 'fail', message: ok ? `Supabase responded ${resp.status}` : `Supabase error ${resp.status}`, duration_ms: Date.now() - start };
      } catch (err: any) { return { id: 't-api-supabase-reachable', name: 'Supabase API reachable', category: 'api', status: 'fail', message: err.message || 'Network error', duration_ms: Date.now() - start }; }
    },
  },
  {
    id: 't-ui-root',
    name: 'React root is mounted',
    description: 'Checks that #root element contains rendered content',
    category: 'ui',
    run: async () => {
      const start = Date.now();
      const root = document.getElementById('root');
      const ok = root !== null && root.childElementCount > 0;
      return { id: 't-ui-root', name: 'React root is mounted', category: 'ui', status: ok ? 'pass' : 'fail', message: ok ? `React root has ${root?.childElementCount} child element(s)` : 'React root is empty or missing', duration_ms: Date.now() - start };
    },
  },
  {
    id: 't-ui-console-errors',
    name: 'No console errors on load',
    description: 'Checks that no console errors were captured during page load',
    category: 'ui',
    run: async () => {
      const start = Date.now();
      const { getConsoleErrors } = await import('../scanner/siteScanner');
      const errors = getConsoleErrors().filter(e => e.level === 'error');
      const ok = errors.length === 0;
      return { id: 't-ui-console-errors', name: 'No console errors on load', category: 'ui', status: ok ? 'pass' : 'fail', message: ok ? 'No console errors captured' : `${errors.length} console error(s) captured`, details: ok ? undefined : { errors: errors.slice(0, 5).map(e => e.message) }, duration_ms: Date.now() - start };
    },
  },
  {
    id: 't-nav-history',
    name: 'Browser history API available',
    description: 'Checks that the History API works (needed for React Router)',
    category: 'navigation',
    run: async () => {
      const start = Date.now();
      const ok = typeof window !== 'undefined' && typeof window.history === 'object' && typeof window.history.pushState === 'function';
      return { id: 't-nav-history', name: 'Browser history API available', category: 'navigation', status: ok ? 'pass' : 'fail', message: ok ? 'History API is available' : 'History API is missing', duration_ms: Date.now() - start };
    },
  },
  {
    id: 't-edge-json-parse',
    name: 'JSON serialization works',
    description: 'Validates JSON.stringify / JSON.parse round-trip',
    category: 'edge_case',
    run: async () => {
      const start = Date.now();
      try {
        const obj = { a: 1, b: [2, 3], c: { d: true, e: null } };
        const ok = JSON.stringify(JSON.parse(JSON.stringify(obj))) === JSON.stringify(obj);
        return { id: 't-edge-json-parse', name: 'JSON serialization works', category: 'edge_case', status: ok ? 'pass' : 'fail', message: ok ? 'JSON serialization is correct' : 'JSON round-trip mismatch', duration_ms: Date.now() - start };
      } catch (err: any) { return { id: 't-edge-json-parse', name: 'JSON serialization works', category: 'edge_case', status: 'fail', message: err.message, duration_ms: Date.now() - start }; }
    },
  },
];

interface TestRunnerState {
  running: boolean;
  results: TestResult[];
  summary: TestRunSummary | null;
  selectedTests: Set<string>;
  toggleTest: (id: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  runTests: () => Promise<void>;
  reset: () => void;
  exportReport: () => string;
}

export const useTestRunnerStore = create<TestRunnerState>((set, get) => ({
  running: false,
  results: [],
  summary: null,
  selectedTests: new Set(TEST_CASES.map(t => t.id)),
  toggleTest: (id) => set(s => { const next = new Set(s.selectedTests); if (next.has(id)) next.delete(id); else next.add(id); return { selectedTests: next }; }),
  selectAll: () => set({ selectedTests: new Set(TEST_CASES.map(t => t.id)) }),
  selectNone: () => set({ selectedTests: new Set() }),
  reset: () => set({ results: [], summary: null }),
  runTests: async () => {
    if (get().running) return;
    const { selectedTests } = get();
    const toRun = TEST_CASES.filter(t => selectedTests.has(t.id));
    if (!toRun.length) return;
    set({ running: true, results: [], summary: null });
    const allResults: TestResult[] = [];
    const start = Date.now();
    for (const test of toRun) {
      try {
        const result = await test.run();
        allResults.push(result);
        set({ results: [...allResults] });
      } catch (err: any) {
        allResults.push({ id: test.id, name: test.name, category: test.category, status: 'fail', message: `Unexpected error: ${err?.message || String(err)}`, duration_ms: 0 });
        set({ results: [...allResults] });
      }
    }
    set({ running: false, results: allResults, summary: { total: allResults.length, passed: allResults.filter(r => r.status === 'pass').length, failed: allResults.filter(r => r.status === 'fail').length, skipped: allResults.filter(r => r.status === 'skip').length, duration_ms: Date.now() - start, ran_at: new Date().toISOString() } });
  },
  exportReport: () => JSON.stringify({ summary: get().summary, results: get().results }, null, 2),
}));
