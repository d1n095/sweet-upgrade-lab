/**
 * ROUTE REGISTRY — Single source of truth for app routes.
 * Every entry maps a path to a real page file. The Truth Engine cross-checks
 * this registry against (a) the actual <Route> declarations in App.tsx and
 * (b) the existence of the referenced file on disk.
 *
 * This file is data only — no side effects, no JSX, no imports of pages.
 */

export interface RouteEntry {
  path: string;
  /** PascalCase component name as it appears in App.tsx */
  element: string;
  /** Relative path to the page file (must exist on disk) */
  file: string;
  /** Whether the route is wrapped in PageGuard / Suspense / similar */
  wrapper?: "PageGuard" | "Suspense" | "Navigate" | null;
  /** Public, admin, or auth-gated */
  area: "public" | "admin" | "auth" | "redirect";
  /** If wrapper === "Navigate", the redirect destination */
  redirectTo?: string;
}

export const ROUTE_REGISTRY: RouteEntry[] = [
  // Public
  { path: "/",                       element: "Index",            file: "src/pages/Index.tsx",            wrapper: null,        area: "public" },
  { path: "/produkter",              element: "Produkter",        file: "src/pages/Produkter.tsx",        wrapper: null,        area: "public" },
  { path: "/product/:handle",        element: "ProductDetail",    file: "src/pages/ProductDetail.tsx",    wrapper: null,        area: "public" },
  { path: "/about",                  element: "AboutUs",          file: "src/pages/AboutUs.tsx",          wrapper: null,        area: "public" },
  { path: "/contact",                element: "Contact",          file: "src/pages/Contact.tsx",          wrapper: null,        area: "public" },
  { path: "/track-order",            element: "TrackOrder",       file: "src/pages/TrackOrder.tsx",       wrapper: null,        area: "public" },
  { path: "/checkout",               element: "Checkout",         file: "src/pages/Checkout.tsx",         wrapper: null,        area: "public" },
  { path: "/order-confirmation",     element: "OrderConfirmation",file: "src/pages/OrderConfirmation.tsx",wrapper: null,        area: "public" },
  { path: "/order/:id",              element: "OrderDetail",      file: "src/pages/OrderDetail.tsx",      wrapper: null,        area: "public" },
  { path: "/cbd",                    element: "CBD",              file: "src/pages/CBD.tsx",              wrapper: null,        area: "public" },
  { path: "/policies/returns",       element: "ReturnsPolicy",    file: "src/pages/policies/ReturnsPolicy.tsx",  wrapper: null, area: "public" },
  { path: "/policies/shipping",      element: "ShippingPolicy",   file: "src/pages/policies/ShippingPolicy.tsx", wrapper: null, area: "public" },
  { path: "/policies/privacy",       element: "PrivacyPolicy",    file: "src/pages/policies/PrivacyPolicy.tsx",  wrapper: null, area: "public" },
  { path: "/policies/terms",         element: "TermsConditions",  file: "src/pages/policies/TermsConditions.tsx",wrapper: null, area: "public" },
  { path: "/profile",                element: "MemberProfile",    file: "src/pages/MemberProfile.tsx",    wrapper: null,        area: "auth" },
  { path: "/affiliate",              element: "AffiliateLanding", file: "src/pages/AffiliateLanding.tsx", wrapper: "PageGuard", area: "public" },
  { path: "/business",               element: "Business",         file: "src/pages/Business.tsx",         wrapper: "PageGuard", area: "public" },
  { path: "/suggest-product",        element: "SuggestProduct",   file: "src/pages/SuggestProduct.tsx",   wrapper: "PageGuard", area: "public" },
  { path: "/reset-password",         element: "ResetPassword",    file: "src/pages/ResetPassword.tsx",    wrapper: null,        area: "auth" },
  { path: "/whats-new",              element: "WhatsNew",         file: "src/pages/WhatsNew.tsx",         wrapper: "PageGuard", area: "public" },
  { path: "/balance",                element: "BalancePage",      file: "src/pages/BalancePage.tsx",      wrapper: null,        area: "auth" },
  { path: "/affiliate-panel",        element: "AffiliatePanel",   file: "src/pages/AffiliatePanel.tsx",   wrapper: null,        area: "auth" },
  { path: "/r/:code",                element: "ReferralLanding",  file: "src/pages/ReferralLanding.tsx",  wrapper: null,        area: "public" },

  // Redirects (no file backing required)
  { path: "/shop",            element: "Navigate", file: "(redirect)", wrapper: "Navigate", area: "redirect", redirectTo: "/produkter" },
  { path: "/products",        element: "Navigate", file: "(redirect)", wrapper: "Navigate", area: "redirect", redirectTo: "/produkter" },
  { path: "/donations",       element: "Navigate", file: "(redirect)", wrapper: "Navigate", area: "redirect", redirectTo: "/" },
  { path: "/donations-panel", element: "Navigate", file: "(redirect)", wrapper: "Navigate", area: "redirect", redirectTo: "/" },

  // Admin (nested under /admin)
  { path: "/admin/ops",              element: "AdminOps",          file: "src/pages/admin/AdminOps.tsx",         wrapper: null, area: "admin" },
  { path: "/admin/growth",           element: "AdminGrowth",       file: "src/pages/admin/AdminGrowth.tsx",      wrapper: null, area: "admin" },
  { path: "/admin/orders",           element: "AdminOrders",       file: "src/pages/admin/AdminOrders.tsx",      wrapper: null, area: "admin" },
  { path: "/admin/pos",              element: "AdminPOS",          file: "src/pages/admin/AdminPOS.tsx",         wrapper: null, area: "admin" },
  { path: "/admin/products",         element: "AdminProducts",     file: "src/pages/admin/AdminProducts.tsx",    wrapper: null, area: "admin" },
  { path: "/admin/categories",       element: "AdminCategories",   file: "src/pages/admin/AdminCategories.tsx",  wrapper: null, area: "admin" },
  { path: "/admin/members",          element: "AdminMembers",      file: "src/pages/admin/AdminMembers.tsx",     wrapper: null, area: "admin" },
  { path: "/admin/partners",         element: "AdminPartners",     file: "src/pages/admin/AdminPartners.tsx",    wrapper: null, area: "admin" },
  { path: "/admin/content",          element: "AdminContent",      file: "src/pages/admin/AdminContent.tsx",     wrapper: null, area: "admin" },
  { path: "/admin/campaigns",        element: "AdminCampaigns",    file: "src/pages/admin/AdminCampaigns.tsx",   wrapper: null, area: "admin" },
  { path: "/admin/shipping",         element: "AdminShipping",     file: "src/pages/admin/AdminShipping.tsx",    wrapper: null, area: "admin" },
  { path: "/admin/seo",              element: "AdminSEO",          file: "src/pages/admin/AdminSEO.tsx",         wrapper: null, area: "admin" },
  { path: "/admin/legal",            element: "AdminLegal",        file: "src/pages/admin/AdminLegal.tsx",       wrapper: null, area: "admin" },
  { path: "/admin/settings",         element: "AdminSettingsPage", file: "src/pages/admin/AdminSettingsPage.tsx",wrapper: null, area: "admin" },
  { path: "/admin/stats",            element: "AdminStats",        file: "src/pages/admin/AdminStats.tsx",       wrapper: null, area: "admin" },
  { path: "/admin/reviews",          element: "AdminReviews",      file: "src/pages/admin/AdminReviews.tsx",     wrapper: null, area: "admin" },
  { path: "/admin/logs",             element: "AdminLogs",         file: "src/pages/admin/AdminLogs.tsx",        wrapper: null, area: "admin" },
  { path: "/admin/incidents",        element: "AdminIncidents",    file: "src/pages/admin/AdminIncidents.tsx",   wrapper: null, area: "admin" },
  { path: "/admin/finance",          element: "AdminPayments",     file: "src/pages/admin/AdminPayments.tsx",    wrapper: null, area: "admin" },
  { path: "/admin/payments",         element: "AdminPayments",     file: "src/pages/admin/AdminPayments.tsx",    wrapper: null, area: "admin" },
  { path: "/admin/donations",        element: "AdminDonations",    file: "src/pages/admin/AdminDonations.tsx",   wrapper: null, area: "admin" },
  { path: "/admin/staff",            element: "AdminStaff",        file: "src/pages/admin/AdminStaff.tsx",       wrapper: null, area: "admin" },
  { path: "/admin/insights",         element: "AdminInsights",     file: "src/pages/admin/AdminInsights.tsx",    wrapper: null, area: "admin" },
  { path: "/admin/data",             element: "AdminData",         file: "src/pages/admin/AdminData.tsx",        wrapper: null, area: "admin" },
  { path: "/admin/history",          element: "AdminHistory",      file: "src/pages/admin/AdminHistory.tsx",     wrapper: null, area: "admin" },
  { path: "/admin/changes",          element: "AdminChangeHistory",file: "src/pages/admin/AdminChangeHistory.tsx",wrapper: null,area: "admin" },
  { path: "/admin/database",         element: "AdminDatabase",     file: "src/pages/admin/AdminDatabase.tsx",    wrapper: null, area: "admin" },
  { path: "/admin/warehouse",        element: "ScanPackingMode",   file: "src/components/admin/warehouse/ScanPackingMode.tsx", wrapper: null, area: "admin" },
  { path: "/admin/overview",         element: "SystemOverview",    file: "src/pages/admin/SystemOverview.tsx",   wrapper: null, area: "admin" },
  { path: "/admin/system-explorer",  element: "SystemExplorer",    file: "src/pages/admin/SystemExplorer.tsx",   wrapper: "Suspense", area: "admin" },
  { path: "/admin/debug",            element: "AdminDebug",        file: "src/pages/admin/AdminDebug.tsx",       wrapper: null, area: "admin" },
  { path: "/admin/security",         element: "AdminSecurity",     file: "src/pages/admin/AdminSecurity.tsx",    wrapper: null, area: "admin" },
  { path: "/admin/issues",           element: "AdminIssues",       file: "src/pages/admin/AdminIssues.tsx",      wrapper: null, area: "admin" },
  { path: "/admin/scans",            element: "AdminScans",        file: "src/pages/admin/AdminScans.tsx",       wrapper: null, area: "admin" },

  // Admin redirects
  { path: "/admin/communication", element: "Navigate", file: "(redirect)", wrapper: "Navigate", area: "redirect", redirectTo: "/admin/content" },
  { path: "/admin/updates",       element: "Navigate", file: "(redirect)", wrapper: "Navigate", area: "redirect", redirectTo: "/admin/content" },
  { path: "/admin/visibility",    element: "Navigate", file: "(redirect)", wrapper: "Navigate", area: "redirect", redirectTo: "/admin/settings" },
  { path: "/admin/ai",            element: "Navigate", file: "(redirect)", wrapper: "Navigate", area: "redirect", redirectTo: "/admin/system-explorer" },

  // Catch-all
  { path: "*", element: "NotFound", file: "src/pages/NotFound.tsx", wrapper: null, area: "public" },
];

export const ROUTE_COUNT = ROUTE_REGISTRY.length;
