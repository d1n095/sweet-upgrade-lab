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
import CookieBanner from "./components/cookie/CookieBanner";
import MaintenanceGuard from "./components/guards/MaintenanceGuard";
import { usePageVisibility, ToggleablePage } from "./stores/pageVisibilityStore";

// Admin
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminPartners from "./pages/admin/AdminPartners";
import AdminCommunication from "./pages/admin/AdminCommunication";
import AdminUpdates from "./pages/admin/AdminUpdates";
import AdminVisibility from "./pages/admin/AdminVisibility";
import AdminLegal from "./pages/admin/AdminLegal";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminStats from "./pages/admin/AdminStats";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminLogs from "./pages/admin/AdminLogs";

const queryClient = new QueryClient();

// Guard component for toggleable pages
const PageGuard = ({ pageId, children }: { pageId: ToggleablePage; children: React.ReactNode }) => {
  const { isVisible } = usePageVisibility();
  if (!isVisible(pageId)) return <NotFound />;
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
              <Route path="/produkter" element={<Produkter />} />
              <Route path="/product/:handle" element={<ProductDetail />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/track-order" element={<TrackOrder />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-confirmation" element={<OrderConfirmation />} />
              
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
              <Route path="/donations" element={<PageGuard pageId="donations"><Donations /></PageGuard>} />

              {/* Admin routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="members" element={<AdminMembers />} />
                <Route path="partners" element={<AdminPartners />} />
                <Route path="communication" element={<AdminCommunication />} />
                <Route path="updates" element={<AdminUpdates />} />
                <Route path="visibility" element={<AdminVisibility />} />
                <Route path="legal" element={<AdminLegal />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="stats" element={<AdminStats />} />
                <Route path="reviews" element={<AdminReviews />} />
                <Route path="logs" element={<AdminLogs />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MaintenanceGuard>
          <CookieBanner />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
