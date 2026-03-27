/**
 * Site Scanner — deterministic, no AI dependencies (TASK 1).
 * Crawls all known routes, detects broken links, missing assets,
 * API failures and console errors. Results stored in Zustand.
 */
import { create } from 'zustand';

export const KNOWN_ROUTES: Array<{ path: string; label: string; type: 'page' | 'admin' | 'policy' }> = [
  { path: '/', label: 'Home', type: 'page' },
  { path: '/produkter', label: 'Products', type: 'page' },
  { path: '/about', label: 'About Us', type: 'page' },
  { path: '/contact', label: 'Contact', type: 'page' },
  { path: '/track-order', label: 'Track Order', type: 'page' },
  { path: '/checkout', label: 'Checkout', type: 'page' },
  { path: '/order-confirmation', label: 'Order Confirmation', type: 'page' },
  { path: '/cbd', label: 'CBD', type: 'page' },
  { path: '/policies/returns', label: 'Returns Policy', type: 'policy' },
  { path: '/policies/shipping', label: 'Shipping Policy', type: 'policy' },
  { path: '/policies/privacy', label: 'Privacy Policy', type: 'policy' },
  { path: '/policies/terms', label: 'Terms & Conditions', type: 'policy' },
  { path: '/profile', label: 'Member Profile', type: 'page' },
  { path: '/affiliate', label: 'Affiliate Landing', type: 'page' },
  { path: '/business', label: 'Business', type: 'page' },
  { path: '/suggest-product', label: 'Suggest Product', type: 'page' },
  { path: '/reset-password', label: 'Reset Password', type: 'page' },
  { path: '/whats-new', label: "What's New", type: 'page' },
  { path: '/balance', label: 'Balance', type: 'page' },
  { path: '/affiliate-panel', label: 'Affiliate Panel', type: 'page' },
  { path: '/admin', label: 'Admin Dashboard', type: 'admin' },
  { path: '/admin/orders', label: 'Admin Orders', type: 'admin' },
  { path: '/admin/products', label: 'Admin Products', type: 'admin' },
  { path: '/admin/members', label: 'Admin Members', type: 'admin' },
  { path: '/admin/logs', label: 'Admin Logs', type: 'admin' },
  { path: '/admin/settings', label: 'Admin Settings', type: 'admin' },
  { path: '/admin/stats', label: 'Admin Stats', type: 'admin' },
  { path: '/admin/debug', label: 'Debug Dashboard', type: 'admin' },
];

export type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';
export type IssueSeverity = 'critical' | 'error' | 'warning' | 'info';

export interface RouteResult {
  path: string;
  label: string;
  type: string;
  status: number | null;
  ok: boolean;
  latency_ms: number;
  error?: string;
  retries: number;
}

export interface AssetIssue {
  url: string;
  type: string;
  initiatorType: string;
  duration_ms: number;
  transferSize: number;
  severity: IssueSeverity;
  reason: string;
}

export interface ApiResult {
  endpoint: string;
  label: string;
  ok: boolean;
  status: number | null;
  latency_ms: number;
  error?: string;
}

export interface ConsoleError {
  level: 'error' | 'warn';
  message: string;
  timestamp: number;
  stack?: string;
}

export interface ScanSummary {
  total_routes: number;
  broken_routes: number;
  total_assets: number;
  broken_assets: number;
  total_api: number;
  broken_api: number;
  console_errors: number;
  console_warnings: number;
  scan_duration_ms: number;
  scanned_at: string;
  health_score: number;
}

export interface RawScanData {
  routes: RouteResult[];
  assets: AssetIssue[];
  api: ApiResult[];
  console_errors: ConsoleError[];
  summary: ScanSummary;
}

export interface ScannerOptions {
  depth: number;
  includePrefix: string;
  excludePrefix: string;
  retries: number;
  timeoutMs: number;
}

const DEFAULT_OPTIONS: ScannerOptions = {
  depth: 1,
  includePrefix: '',
  excludePrefix: '',
  retries: 1,
  timeoutMs: 6000,
};

// Console error capture
const capturedConsoleErrors: ConsoleError[] = [];
let consolePatched = false;

export function patchConsole() {
  if (consolePatched || typeof window === 'undefined') return;
  consolePatched = true;
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: any[]) => {
    capturedConsoleErrors.push({ level: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), timestamp: Date.now(), stack: args[0]?.stack });
    origError(...args);
  };
  console.warn = (...args: any[]) => {
    capturedConsoleErrors.push({ level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), timestamp: Date.now() });
    origWarn(...args);
  };
}

export function getConsoleErrors(): ConsoleError[] { return [...capturedConsoleErrors]; }
export function clearConsoleErrors() { capturedConsoleErrors.length = 0; }

async function probeRoute(path: string, label: string, type: string, opts: ScannerOptions): Promise<RouteResult> {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${base}${path}`;
  let lastError: string | undefined;
  let lastStatus: number | null = null;
  let lastOk = false;
  let latency = 0;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
      const resp = await fetch(url, { method: 'GET', signal: controller.signal, credentials: 'same-origin' });
      clearTimeout(timeout);
      latency = Date.now() - start;
      lastStatus = resp.status;
      lastOk = resp.status < 400;
      lastError = undefined;
      break;
    } catch (err: any) {
      latency = Date.now() - start;
      lastError = err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Network error');
      lastStatus = null;
      lastOk = false;
    }
  }
  return { path, label, type, status: lastStatus, ok: lastOk, latency_ms: latency, error: lastError, retries: opts.retries };
}

function collectAssetIssues(): AssetIssue[] {
  if (typeof window === 'undefined' || !window.performance) return [];
  const entries = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const issues: AssetIssue[] = [];
  for (const entry of entries) {
    const failed = entry.transferSize === 0 && entry.duration > 10;
    const slow = entry.duration > 3000;
    if (failed) {
      issues.push({ url: entry.name, type: entry.initiatorType, initiatorType: entry.initiatorType, duration_ms: Math.round(entry.duration), transferSize: entry.transferSize, severity: 'error', reason: 'Asset may have failed to load (transferSize=0)' });
    } else if (slow) {
      issues.push({ url: entry.name, type: entry.initiatorType, initiatorType: entry.initiatorType, duration_ms: Math.round(entry.duration), transferSize: entry.transferSize, severity: 'warning', reason: `Slow asset (${Math.round(entry.duration)}ms)` });
    }
  }
  return issues;
}

const API_PROBES: Array<{ endpoint: string; label: string }> = [
  { endpoint: '/rest/v1/', label: 'Supabase REST root' },
  { endpoint: '/rest/v1/products?select=id&limit=1', label: 'Products endpoint' },
  { endpoint: '/rest/v1/categories?select=id&limit=1', label: 'Categories endpoint' },
];

async function probeApi(endpoint: string, label: string, opts: ScannerOptions): Promise<ApiResult> {
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  if (!supabaseUrl) return { endpoint, label, ok: false, status: null, latency_ms: 0, error: 'VITE_SUPABASE_URL not set' };
  const url = `${supabaseUrl}${endpoint}`;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
    const resp = await fetch(url, { method: 'GET', signal: controller.signal, headers: { apikey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '' } });
    clearTimeout(timeout);
    const ok = resp.status === 200 || resp.status === 401;
    return { endpoint, label, ok, status: resp.status, latency_ms: Date.now() - start };
  } catch (err: any) {
    return { endpoint, label, ok: false, status: null, latency_ms: Date.now() - start, error: err.name === 'AbortError' ? 'Request timed out' : err.message };
  }
}

function calcHealthScore(routes: RouteResult[], assets: AssetIssue[], api: ApiResult[], consoleErrors: ConsoleError[]): number {
  let score = 100;
  score -= routes.filter(r => !r.ok).length * 5;
  score -= assets.filter(a => a.severity === 'error').length * 2;
  score -= api.filter(a => !a.ok).length * 3;
  score -= Math.min(consoleErrors.filter(e => e.level === 'error').length, 20);
  return Math.max(0, Math.min(100, Math.round(score)));
}

interface SiteScannerState {
  status: ScanStatus;
  options: ScannerOptions;
  result: RawScanData | null;
  progress: number;
  currentStep: string;
  error: string | null;
  setOptions: (opts: Partial<ScannerOptions>) => void;
  runScan: () => Promise<void>;
  exportJson: () => string;
  reset: () => void;
}

export const useSiteScannerStore = create<SiteScannerState>((set, get) => ({
  status: 'idle',
  options: { ...DEFAULT_OPTIONS },
  result: null,
  progress: 0,
  currentStep: '',
  error: null,
  setOptions: (opts) => set(s => ({ options: { ...s.options, ...opts } })),
  reset: () => set({ status: 'idle', result: null, progress: 0, currentStep: '', error: null }),
  exportJson: () => { const r = get().result; return r ? JSON.stringify(r, null, 2) : '{}'; },
  runScan: async () => {
    if (get().status === 'scanning') return;
    const opts = get().options;
    const routes = KNOWN_ROUTES.filter(r => {
      if (opts.includePrefix && !r.path.startsWith(opts.includePrefix)) return false;
      if (opts.excludePrefix && r.path.startsWith(opts.excludePrefix)) return false;
      return true;
    });
    const totalSteps = routes.length + API_PROBES.length + 2;
    let completed = 0;
    const advance = (step: string) => { completed++; set({ progress: Math.round((completed / totalSteps) * 100), currentStep: step }); };
    set({ status: 'scanning', progress: 0, currentStep: 'Starting scan...', error: null, result: null });
    const scanStart = Date.now();
    try {
      const routeResults: RouteResult[] = [];
      for (const route of routes) {
        advance(`Scanning route: ${route.path}`);
        routeResults.push(await probeRoute(route.path, route.label, route.type, opts));
      }
      advance('Scanning assets...');
      const assetIssues = collectAssetIssues();
      const apiResults: ApiResult[] = [];
      for (const probe of API_PROBES) {
        advance(`Testing API: ${probe.label}`);
        apiResults.push(await probeApi(probe.endpoint, probe.label, opts));
      }
      advance('Collecting console errors...');
      const consoleErrors = getConsoleErrors();
      const scanDuration = Date.now() - scanStart;
      const rawData: RawScanData = {
        routes: routeResults, assets: assetIssues, api: apiResults, console_errors: consoleErrors,
        summary: {
          total_routes: routeResults.length, broken_routes: routeResults.filter(r => !r.ok).length,
          total_assets: assetIssues.length, broken_assets: assetIssues.filter(a => a.severity === 'error').length,
          total_api: apiResults.length, broken_api: apiResults.filter(a => !a.ok).length,
          console_errors: consoleErrors.filter(e => e.level === 'error').length,
          console_warnings: consoleErrors.filter(e => e.level === 'warn').length,
          scan_duration_ms: scanDuration, scanned_at: new Date().toISOString(),
          health_score: calcHealthScore(routeResults, assetIssues, apiResults, consoleErrors),
        },
      };
      set({ status: 'done', result: rawData, progress: 100, currentStep: 'Scan complete' });
    } catch (err: any) {
      set({ status: 'error', error: err.message || 'Scan failed', progress: 0 });
    }
  },
}));
