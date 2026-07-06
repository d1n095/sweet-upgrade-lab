import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "./context/LanguageContext";
import ScrollToTop from "./components/ScrollToTop";

// Public pages that are part of the typical first-paint experience stay eager.
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CookieBanner from "./components/cookie/CookieBanner";
import MaintenanceGuard from "./components/guards/MaintenanceGuard";
import { usePageVisibility, ToggleablePage } from "./stores/pageVisibilityStore";
import { useAdminRole } from "./hooks/useAdminRole";
import { usePreviewCleanMode } from "./hooks/usePreviewCleanMode";

// Public pages — lazy (not needed for landing page LCP)
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Produkter = lazy(() => import("./pages/Produkter"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Contact = lazy(() => import("./pages/Contact"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CBD = lazy(() => import("./pages/CBD"));
const ReturnsPolicy = lazy(() => import("./pages/policies/ReturnsPolicy"));
const ShippingPolicy = lazy(() => import("./pages/policies/ShippingPolicy"));
const PrivacyPolicy = lazy(() => import("./pages/policies/PrivacyPolicy"));
const TermsConditions = lazy(() => import("./pages/policies/TermsConditions"));
const MemberProfile = lazy(() => import("./pages/MemberProfile"));
const AffiliateLanding = lazy(() => import("./pages/AffiliateLanding"));
const Business = lazy(() => import("./pages/Business"));
const SuggestProduct = lazy(() => import("./pages/SuggestProduct"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const WhatsNew = lazy(() => import("./pages/WhatsNew"));
const BalancePage = lazy(() => import("./pages/BalancePage"));
const AffiliatePanel = lazy(() => import("./pages/AffiliatePanel"));
const ReferralLanding = lazy(() => import("./pages/ReferralLanding"));

// Admin — all lazy. Anonymous shoppers no longer download the admin bundle.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const SystemOverview = lazy(() => import("./pages/admin/SystemOverview"));
const ScannerOverview = lazy(() => import("./pages/admin/ScannerOverview"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminDonations = lazy(() => import("./pages/admin/AdminDonations"));
const AdminMembers = lazy(() => import("./pages/admin/AdminMembers"));
const AdminPartners = lazy(() => import("./pages/admin/AdminPartners"));
const AdminContent = lazy(() => import("./pages/admin/AdminContent"));
const AdminLegal = lazy(() => import("./pages/admin/AdminLegal"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminStats = lazy(() => import("./pages/admin/AdminStats"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminCampaigns = lazy(() => import("./pages/admin/AdminCampaigns"));
const AdminEventsCampaigns = lazy(() => import("./pages/admin/AdminEventsCampaigns"));
const AdminShipping = lazy(() => import("./pages/admin/AdminShipping"));
const AdminSEO = lazy(() => import("./pages/admin/AdminSEO"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff"));
const AdminIncidents = lazy(() => import("./pages/admin/AdminIncidents"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminInsights = lazy(() => import("./pages/admin/AdminInsights"));
const AdminDatabase = lazy(() => import("./pages/admin/AdminDatabase"));
const AdminData = lazy(() => import("./pages/admin/AdminData"));
const AdminOps = lazy(() => import("./pages/admin/AdminOps"));
const AdminGrowth = lazy(() => import("./pages/admin/AdminGrowth"));
const AdminHistory = lazy(() => import("./pages/admin/AdminHistory"));
const AdminChangeHistory = lazy(() => import("./pages/admin/AdminChangeHistory"));
const AdminPOS = lazy(() => import("./pages/admin/AdminPOS"));
const ScanPackingMode = lazy(() => import("./components/admin/warehouse/ScanPackingMode"));
const AdminDebug = lazy(() => import("./pages/admin/AdminDebug"));
const AdminSecurity = lazy(() => import("./pages/admin/AdminSecurity"));
const AdminIssues = lazy(() => import("./pages/admin/AdminIssues"));
const AdminScans = lazy(() => import("./pages/admin/AdminScans"));
const AdminControl = lazy(() => import("./pages/admin/AdminControl"));
const AdminControlCenter = lazy(() => import("./pages/admin/AdminControlCenter"));
const AdminERP = lazy(() => import("./pages/admin/AdminERP"));

// Admin-only dev tools — lazy + only mounted from admin paths via PathGate below.
const MiniWorkbench = lazy(() => import("./components/admin/MiniWorkbench"));
const GodModeOverlay = lazy(() => import("./components/admin/GodModeOverlay"));
const SystemExplorer = lazy(() => import("./pages/admin/SystemExplorer"));
const DevOS = lazy(() => import("./pages/admin/DevOS"));

// Defaults tuned to reduce backend traffic (and therefore Cloud credits):
// - staleTime 60s: avoid re-fetching the same data on every component mount
// - refetchOnWindowFocus off: don't re-hit Supabase every time the tab regains focus
// - refetchOnReconnect off: avoid bursts after brief network blips
// - retry 1: don't hammer the backend on persistent errors
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

// Guard component for toggleable pages — admins can always preview
const PageGuard = ({ pageId, children }: { pageId: ToggleablePage; children: React.ReactNode }) => {
  const { isVisible } = usePageVisibility();
  const { isAdmin } = useAdminRole();
  if (!isVisible(pageId) && !isAdmin) return <NotFound />;
  return <>{children}</>;
};

// Gate dev/admin-only overlays behind admin paths. Anonymous shoppers never
// download MiniWorkbench/GodModeOverlay bundles nor fire their auth queries.
const AdminToolsGate = () => {
  const location = useLocation();
  const onAdmin = location.pathname.startsWith("/admin") || location.pathname.startsWith("/devos");
  if (!onAdmin) return null;
  return (
    <Suspense fallback={null}>
      <MiniWorkbench />
      <GodModeOverlay />
    </Suspense>
  );
};

const App = () => {
  const isPreviewCleanMode = usePreviewCleanMode();

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <MaintenanceGuard>
                <Suspense fallback={null}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/shop" element={<Navigate to="/produkter" replace />} />
                    <Route path="/products" element={<Navigate to="/produkter" replace />} />
                    <Route path="/produkter" element={<Produkter />} />
                    <Route path="/product/:handle" element={<ProductDetail />} />
                    <Route path="/about" element={<AboutUs />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/track-order" element={<TrackOrder />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/order-confirmation" element={<OrderConfirmation />} />
                    <Route path="/order/:id" element={<OrderDetail />} />

                    <Route path="/cbd" element={<CBD />} />
                    <Route path="/policies/returns" element={<ReturnsPolicy />} />
                    <Route path="/policies/shipping" element={<ShippingPolicy />} />
                    <Route path="/policies/privacy" element={<PrivacyPolicy />} />
                    <Route path="/policies/terms" element={<TermsConditions />} />
                    <Route path="/profile" element={<MemberProfile />} />
                    <Route path="/affiliate" element={<PageGuard pageId="affiliate"><AffiliateLanding /></PageGuard>} />
                    <Route path="/business" element={<PageGuard pageId="business"><Business /></PageGuard>} />
                    <Route path="/suggest-product" element={<PageGuard pageId="suggest-product"><SuggestProduct /></PageGuard>} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/whats-new" element={<PageGuard pageId="whats-new"><WhatsNew /></PageGuard>} />
                    <Route path="/donations" element={<Navigate to="/" replace />} />
                    <Route path="/balance" element={<BalancePage />} />
                    <Route path="/affiliate-panel" element={<AffiliatePanel />} />
                    <Route path="/donations-panel" element={<Navigate to="/" replace />} />
                    <Route path="/r/:code" element={<ReferralLanding />} />

                    <Route path="/devos" element={<DevOS />} />

                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminOverview />} />
                      <Route path="ops" element={<AdminOps />} />
                      <Route path="growth" element={<AdminGrowth />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="pos" element={<AdminPOS />} />
                      <Route path="products" element={<AdminProducts />} />
                      <Route path="categories" element={<AdminCategories />} />
                      <Route path="members" element={<AdminMembers />} />
                      <Route path="partners" element={<AdminPartners />} />
                      <Route path="communication" element={<Navigate to="/admin/content" replace />} />
                      <Route path="updates" element={<Navigate to="/admin/content" replace />} />
                      <Route path="visibility" element={<Navigate to="/admin/settings" replace />} />
                      <Route path="content" element={<AdminContent />} />
                      <Route path="campaigns" element={<AdminCampaigns />} />
                      <Route path="events-dashboard" element={<AdminEventsCampaigns />} />
                      <Route path="shipping" element={<AdminShipping />} />
                      <Route path="seo" element={<AdminSEO />} />
                      <Route path="legal" element={<AdminLegal />} />
                      <Route path="settings" element={<AdminSettingsPage />} />
                      <Route path="stats" element={<AdminStats />} />
                      <Route path="reviews" element={<AdminReviews />} />
                      <Route path="logs" element={<AdminLogs />} />
                      <Route path="incidents" element={<AdminIncidents />} />
                      <Route path="finance" element={<Navigate to="/admin/payments" replace />} />
                      <Route path="payments" element={<AdminPayments />} />
                      <Route path="donations" element={<AdminDonations />} />
                      <Route path="staff" element={<AdminStaff />} />
                      <Route path="insights" element={<AdminInsights />} />
                      <Route path="data" element={<AdminData />} />
                      <Route path="history" element={<AdminHistory />} />
                      <Route path="changes" element={<AdminChangeHistory />} />
                      <Route path="database" element={<AdminDatabase />} />
                      <Route path="warehouse" element={<ScanPackingMode />} />
                      <Route path="overview" element={<SystemOverview />} />
                      <Route path="scanner-overview" element={<ScannerOverview />} />
                      <Route path="system-explorer" element={<SystemExplorer />} />
                      <Route path="debug" element={<AdminDebug />} />
                      <Route path="ai" element={<Navigate to="/admin/system-explorer" replace />} />
                      <Route path="security" element={<AdminSecurity />} />
                      <Route path="issues" element={<AdminIssues />} />
                      <Route path="scans" element={<AdminScans />} />
                      <Route path="control" element={<AdminControl />} />
                      <Route path="control-center" element={<AdminControlCenter />} />
                      <Route path="erp" element={<AdminERP />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </MaintenanceGuard>
              {!isPreviewCleanMode && <CookieBanner />}
              {!isPreviewCleanMode && <AdminToolsGate />}
            </BrowserRouter>
          </TooltipProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
