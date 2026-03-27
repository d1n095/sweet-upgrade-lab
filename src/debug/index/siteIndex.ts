/**
 * Site Index — searchable index of pages, components, and API endpoints (TASK 2).
 */
export type IndexEntryType = 'page' | 'component' | 'api' | 'store' | 'util';

export interface IndexEntry {
  id: string;
  type: IndexEntryType;
  label: string;
  path: string;
  description: string;
  tags: string[];
}

export interface SiteIndex {
  pages: IndexEntry[];
  components: IndexEntry[];
  api: IndexEntry[];
  stores: IndexEntry[];
  utils: IndexEntry[];
  generated_at: string;
}

const PAGES: IndexEntry[] = [
  { id: 'p-home', type: 'page', label: 'Home', path: '/', description: 'Main landing page', tags: ['landing', 'hero', 'products'] },
  { id: 'p-produkter', type: 'page', label: 'Produkter', path: '/produkter', description: 'Product listing page', tags: ['shop', 'products', 'catalog'] },
  { id: 'p-product-detail', type: 'page', label: 'Product Detail', path: '/product/:handle', description: 'Single product view', tags: ['product', 'detail', 'shop'] },
  { id: 'p-about', type: 'page', label: 'About Us', path: '/about', description: 'About the company', tags: ['about', 'info'] },
  { id: 'p-contact', type: 'page', label: 'Contact', path: '/contact', description: 'Contact form', tags: ['contact', 'form'] },
  { id: 'p-checkout', type: 'page', label: 'Checkout', path: '/checkout', description: 'Shopping cart checkout', tags: ['checkout', 'cart', 'payment'] },
  { id: 'p-track', type: 'page', label: 'Track Order', path: '/track-order', description: 'Order tracking', tags: ['order', 'tracking'] },
  { id: 'p-cbd', type: 'page', label: 'CBD', path: '/cbd', description: 'CBD information page', tags: ['cbd', 'info'] },
  { id: 'p-returns', type: 'page', label: 'Returns Policy', path: '/policies/returns', description: 'Returns & refunds policy', tags: ['policy', 'returns'] },
  { id: 'p-shipping-pol', type: 'page', label: 'Shipping Policy', path: '/policies/shipping', description: 'Shipping information', tags: ['policy', 'shipping'] },
  { id: 'p-privacy', type: 'page', label: 'Privacy Policy', path: '/policies/privacy', description: 'GDPR / privacy policy', tags: ['policy', 'privacy', 'gdpr'] },
  { id: 'p-terms', type: 'page', label: 'Terms & Conditions', path: '/policies/terms', description: 'Terms of service', tags: ['policy', 'terms'] },
  { id: 'p-profile', type: 'page', label: 'Member Profile', path: '/profile', description: 'User profile & account settings', tags: ['profile', 'account', 'auth'] },
  { id: 'p-affiliate', type: 'page', label: 'Affiliate Landing', path: '/affiliate', description: 'Affiliate program landing', tags: ['affiliate', 'marketing'] },
  { id: 'p-business', type: 'page', label: 'Business', path: '/business', description: 'B2B / business page', tags: ['business', 'b2b'] },
  { id: 'p-suggest', type: 'page', label: 'Suggest Product', path: '/suggest-product', description: 'Product suggestion form', tags: ['suggestion', 'form'] },
  { id: 'p-whats-new', type: 'page', label: "What's New", path: '/whats-new', description: 'Latest updates and news', tags: ['news', 'updates'] },
  { id: 'p-balance', type: 'page', label: 'Balance', path: '/balance', description: 'Member balance page', tags: ['balance', 'wallet'] },
  { id: 'p-admin', type: 'page', label: 'Admin Dashboard', path: '/admin', description: 'Admin overview', tags: ['admin', 'dashboard'] },
  { id: 'p-admin-orders', type: 'page', label: 'Admin Orders', path: '/admin/orders', description: 'Order management', tags: ['admin', 'orders'] },
  { id: 'p-admin-products', type: 'page', label: 'Admin Products', path: '/admin/products', description: 'Product management', tags: ['admin', 'products'] },
  { id: 'p-admin-members', type: 'page', label: 'Admin Members', path: '/admin/members', description: 'User / member management', tags: ['admin', 'members'] },
  { id: 'p-admin-logs', type: 'page', label: 'Admin Logs', path: '/admin/logs', description: 'Activity & security logs', tags: ['admin', 'logs', 'audit'] },
  { id: 'p-admin-debug', type: 'page', label: 'Debug Dashboard', path: '/admin/debug', description: 'Debug, scan, and test environment', tags: ['admin', 'debug', 'scan', 'test'] },
];

const COMPONENTS: IndexEntry[] = [
  { id: 'c-deep-debug', type: 'component', label: 'DeepDebugPanel', path: 'src/components/admin/DeepDebugPanel.tsx', description: 'Deep debug trace panel', tags: ['debug', 'trace', 'admin'] },
  { id: 'c-system-state', type: 'component', label: 'SystemStateDashboard', path: 'src/components/admin/SystemStateDashboard.tsx', description: 'System health dashboard', tags: ['system', 'health', 'admin'] },
  { id: 'c-admin-layout', type: 'component', label: 'AdminLayout', path: 'src/pages/admin/AdminLayout.tsx', description: 'Admin section layout with nav', tags: ['admin', 'layout', 'nav'] },
  { id: 'c-debug-dashboard', type: 'component', label: 'AdminDebug', path: 'src/pages/admin/AdminDebug.tsx', description: 'Full debug dashboard with scanner, index, logs, and test runner', tags: ['debug', 'scanner', 'test', 'index'] },
];

const API_ENDPOINTS: IndexEntry[] = [
  { id: 'api-products', type: 'api', label: 'GET /rest/v1/products', path: '/rest/v1/products', description: 'Supabase: list all products', tags: ['products', 'supabase', 'rest'] },
  { id: 'api-orders', type: 'api', label: 'GET /rest/v1/orders', path: '/rest/v1/orders', description: 'Supabase: list orders', tags: ['orders', 'supabase', 'rest'] },
  { id: 'api-categories', type: 'api', label: 'GET /rest/v1/categories', path: '/rest/v1/categories', description: 'Supabase: list categories', tags: ['categories', 'supabase', 'rest'] },
  { id: 'api-profiles', type: 'api', label: 'GET /rest/v1/profiles', path: '/rest/v1/profiles', description: 'Supabase: user profiles', tags: ['profiles', 'users', 'supabase', 'rest'] },
  { id: 'api-auth', type: 'api', label: 'POST /auth/v1/token', path: '/auth/v1/token', description: 'Supabase: authentication', tags: ['auth', 'login', 'supabase'] },
  { id: 'api-full-scan', type: 'api', label: 'POST /functions/v1/run-full-scan', path: '/functions/v1/run-full-scan', description: 'Edge function: run full scan', tags: ['scan', 'edge-function', 'admin'] },
];

const STORES: IndexEntry[] = [
  { id: 's-cart', type: 'store', label: 'cartStore', path: 'src/stores/cartStore.ts', description: 'Shopping cart state', tags: ['cart', 'zustand'] },
  { id: 's-scanner', type: 'store', label: 'scannerStore', path: 'src/stores/scannerStore.ts', description: 'AI scanner state', tags: ['scanner', 'ai', 'zustand'] },
  { id: 's-site-scanner', type: 'store', label: 'siteScannerStore', path: 'src/debug/scanner/siteScanner.ts', description: 'Deterministic site scanner', tags: ['scanner', 'debug', 'zustand'] },
  { id: 's-debug-logger', type: 'store', label: 'debugLoggerStore', path: 'src/debug/logger/debugLogger.ts', description: 'Global debug logger', tags: ['logger', 'debug', 'zustand'] },
  { id: 's-full-scan', type: 'store', label: 'fullScanOrchestrator', path: 'src/stores/fullScanOrchestrator.ts', description: 'Orchestrates the AI scan pipeline', tags: ['scan', 'orchestrator', 'ai', 'zustand'] },
];

const UTILS: IndexEntry[] = [
  { id: 'u-deep-debug', type: 'util', label: 'deepDebugTrace', path: 'src/utils/deepDebugTrace.ts', description: 'Work-item lifecycle tracing', tags: ['trace', 'debug'] },
  { id: 'u-observability', type: 'util', label: 'observabilityLogger', path: 'src/utils/observabilityLogger.ts', description: 'Supabase observability event logger', tags: ['observability', 'logging'] },
  { id: 'u-site-scanner', type: 'util', label: 'siteScanner', path: 'src/debug/scanner/siteScanner.ts', description: 'Deterministic site scanner', tags: ['scanner', 'debug'] },
  { id: 'u-debug-logger', type: 'util', label: 'debugLogger', path: 'src/debug/logger/debugLogger.ts', description: 'Global debug logger', tags: ['logger', 'debug'] },
  { id: 'u-site-index', type: 'util', label: 'siteIndex', path: 'src/debug/index/siteIndex.ts', description: 'Searchable site index', tags: ['index', 'search'] },
  { id: 'u-test-runner', type: 'util', label: 'testRunner', path: 'src/debug/testRunner/testRunner.ts', description: 'User flow test runner', tags: ['test', 'simulation'] },
];

export function buildSiteIndex(): SiteIndex {
  return { pages: PAGES, components: COMPONENTS, api: API_ENDPOINTS, stores: STORES, utils: UTILS, generated_at: new Date().toISOString() };
}

export function searchIndex(index: SiteIndex, query: string, types?: IndexEntryType[]): IndexEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const all: IndexEntry[] = [...index.pages, ...index.components, ...index.api, ...index.stores, ...index.utils];
  return all.filter(entry => {
    if (types && types.length && !types.includes(entry.type)) return false;
    return entry.label.toLowerCase().includes(q) || entry.path.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q) || entry.tags.some(t => t.includes(q));
  });
}

export function filterIndex(index: SiteIndex, type: IndexEntryType): IndexEntry[] {
  switch (type) {
    case 'page': return index.pages;
    case 'component': return index.components;
    case 'api': return index.api;
    case 'store': return index.stores;
    case 'util': return index.utils;
  }
}

export function exportIndexJson(index: SiteIndex): string { return JSON.stringify(index, null, 2); }
