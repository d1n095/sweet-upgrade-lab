import RequirePermission from '@/components/guards/RequirePermission';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "./context/LanguageContext";
import ScrollToTop from "./components/ScrollToTop";
import Index from "./pages/Index";
import ProductDetail from "./pages/ProductDetail";
import OrderDetail from "./pages/OrderDetail";
import Shop from "./pages/Shop";
import Produkter from "./pages/Produkter";
import AboutUs from "./pages/AboutUs";
import Contact from "./pages/Contact";
import TrackOrder from "./pages/TrackOrder";
import OrderConfirmation from "./pages/OrderConfirmation";
import Checkout from "./pages/Checkout";
import CBD from "./pages/CBD";
import ReturnsPolicy from "./pages/policies/ReturnsPolicy";
import ShippingPolicy from "./pages/policies/ShippingPolicy";
import PrivacyPolicy from "./pages/policies/PrivacyPolicy";
import TermsConditions from "./pages/policies/TermsConditions";
import MemberProfile from "./pages/MemberProfile";
import AffiliateLanding from "./pages/AffiliateLanding";
import Business from "./pages/Business";
import SuggestProduct from "./pages/SuggestProduct";
import ResetPassword from "./pages/ResetPassword";
import WhatsNew from "./pages/WhatsNew";
import Donations from "./pages/Donations";
import NotFound from "./pages/NotFound";
import BalancePage from "./pages/BalancePage";
import AffiliatePanel from "./pages/AffiliatePanel";
import DonationsPanel from "./pages/DonationsPanel";
import ReferralLanding from "./pages/ReferralLanding";
import CookieBanner from "./components/cookie/CookieBanner";
import MaintenanceGuard from "./components/guards/MaintenanceGuard";
import MiniWorkbench from "./components/admin/MiniWorkbench";
import { usePageVisibility, ToggleablePage } from "./stores/pageVisibilityStore";
import { useAdminRole } from "./hooks/useAdminRole";

// Admin
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminDonations from "./pages/admin/AdminDonations";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminPartners from "./pages/admin/AdminPartners";
import AdminContent from "./pages/admin/AdminContent";
import AdminVisibility from "./pages/admin/AdminVisibility";
import AdminLegal from "./pages/admin/AdminLegal";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminStats from "./pages/admin/AdminStats";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminLogs from "./pages/admin/AdminLogs";
import AdminCampaigns from "./pages/admin/AdminCampaigns";
import AdminShipping from "./pages/admin/AdminShipping";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminSEO from "./pages/admin/AdminSEO";
import AdminStaff from "./pages/admin/AdminStaff";
import AdminRoles from "./pages/admin/AdminRoles";
import AdminIncidents from "./pages/admin/AdminIncidents";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminInsights from "./pages/admin/AdminInsights";
import AdminDatabase from "./pages/admin/AdminDatabase";
import AdminData from "./pages/admin/AdminData";
import AdminOps from "./pages/admin/AdminOps";
import AdminGrowth from "./pages/admin/AdminGrowth";
import AdminHistory from "./pages/admin/AdminHistory";
import AdminChangeHistory from "./pages/admin/AdminChangeHistory";
import AdminPOS from "./pages/admin/AdminPOS";
import ScanPackingMode from "./components/admin/warehouse/ScanPackingMode";
import SystemExplorer from "./pages/admin/SystemExplorer";

const queryClient = new QueryClient();

// Guard component for toggleable pages — admins can always preview
const PageGuard = ({ pageId, children }: { pageId: ToggleablePage; children: React.ReactNode }) => {
  const { isVisible } = usePageVisibility();
  const { isAdmin } = useAdminRole();
  if (!isVisible(pageId) && !isAdmin) return <NotFound />;
  return <>{children}</>;
};

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <MaintenanceGuard>
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

              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="ops" element={<RequirePermission module="system"><AdminOps /></RequirePermission>} />
                <Route path="growth" element={<RequirePermission module="system"><AdminGrowth /></RequirePermission>} />
                <Route path="orders" element={<RequirePermission module="orders"><AdminOrders /></RequirePermission>} />
                <Route path="pos" element={<RequirePermission module="orders"><AdminPOS /></RequirePermission>} />
                <Route path="products" element={<RequirePermission module="inventory"><AdminProducts /></RequirePermission>} />
                <Route path="categories" element={<RequirePermission module="inventory"><AdminCategories /></RequirePermission>} />
                <Route path="members" element={<RequirePermission module="users"><AdminMembers /></RequirePermission>} />
                <Route path="partners" element={<RequirePermission module="users"><AdminPartners /></RequirePermission>} />
                <Route path="communication" element={<Navigate to="/admin/content" replace />} />
                <Route path="updates" element={<Navigate to="/admin/content" replace />} />
                <Route path="visibility" element={<Navigate to="/admin/settings" replace />} />
                <Route path="content" element={<RequirePermission module="content"><AdminContent /></RequirePermission>} />
                <Route path="campaigns" element={<RequirePermission module="content"><AdminCampaigns /></RequirePermission>} />
                <Route path="shipping" element={<RequirePermission module="system"><AdminShipping /></RequirePermission>} />
                <Route path="seo" element={<RequirePermission module="content"><AdminSEO /></RequirePermission>} />
                <Route path="legal" element={<RequirePermission module="content"><AdminLegal /></RequirePermission>} />
                <Route path="settings" element={<RequirePermission module="system"><AdminSettingsPage /></RequirePermission>} />
                <Route path="stats" element={<RequirePermission module="statistics"><AdminStats /></RequirePermission>} />
                <Route path="reviews" element={<RequirePermission module="reviews"><AdminReviews /></RequirePermission>} />
                <Route path="logs" element={<RequirePermission module="system"><AdminLogs /></RequirePermission>} />
                <Route path="incidents" element={<RequirePermission module="system"><AdminIncidents /></RequirePermission>} />
                <Route path="finance" element={<RequirePermission module="finance"><AdminPayments /></RequirePermission>} />
                <Route path="payments" element={<RequirePermission module="finance"><AdminPayments /></RequirePermission>} />
                <Route path="donations" element={<RequirePermission module="donations"><AdminDonations /></RequirePermission>} />
                <Route path="staff" element={<AdminStaff />} />
                <Route path="roles" element={<AdminRoles />} />
                <Route path="insights" element={<RequirePermission module="statistics"><AdminInsights /></RequirePermission>} />
                <Route path="data" element={<RequirePermission module="system"><AdminData /></RequirePermission>} />
                <Route path="history" element={<RequirePermission module="system"><AdminHistory /></RequirePermission>} />
                <Route path="changes" element={<RequirePermission module="system"><AdminChangeHistory /></RequirePermission>} />
                <Route path="database" element={<RequirePermission module="system"><AdminDatabase /></RequirePermission>} />
                <Route path="warehouse" element={<RequirePermission module="orders"><ScanPackingMode /></RequirePermission>} />
                <Route path="system-explorer" element={<RequirePermission module="system"><SystemExplorer /></RequirePermission>} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MaintenanceGuard>
          <CookieBanner />
          <MiniWorkbench />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
