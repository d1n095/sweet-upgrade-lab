import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Package, Star, Gift, Settings, LogOut, 
  ChevronRight, Loader2, Clock, Check, BadgeCheck,
  Shield, BarChart3, Users, TrendingUp, MessageCircle,
  ChevronDown, Boxes, UserCog, Handshake, FileText, Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ReviewStars from '@/components/reviews/ReviewStars';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useEmployeeRole } from '@/hooks/useEmployeeRole';
import { useLanguage } from '@/context/LanguageContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import OrderTracker from '@/components/orders/OrderTracker';
import AdminProductManager from '@/components/admin/AdminProductManager';
import AdminInfluencerManager from '@/components/admin/AdminInfluencerManager';
import AdminAffiliateManager from '@/components/admin/AdminAffiliateManager';
import AdminPayoutManager from '@/components/admin/AdminPayoutManager';
import AdminApplicationsManager from '@/components/admin/AdminApplicationsManager';
import AdminLegalDocuments from '@/components/admin/AdminLegalDocuments';
import AdminEmailTemplates from '@/components/admin/AdminEmailTemplates';
import AdminDonationManager from '@/components/admin/AdminDonationManager';
import AdminMemberManager from '@/components/admin/AdminMemberManager';
import AdminInventoryManager from '@/components/admin/AdminInventoryManager';
import AdminCategoryManager from '@/components/admin/AdminCategoryManager';
import InfluencerDashboard from '@/components/dashboard/InfluencerDashboard';
import AffiliateDashboard from '@/components/dashboard/AffiliateDashboard';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import DonationImpact from '@/components/donations/DonationImpact';
import AccountSettings from '@/components/profile/AccountSettings';
import BalanceOverview from '@/components/profile/BalanceOverview';

interface Review {
  id: string;
  product_title: string;
  rating: number;
  comment: string;
  is_approved: boolean;
  created_at: string;
}

interface Reward {
  id: string;
  discount_code: string;
  discount_percent: number;
  is_used: boolean;
  expires_at: string;
  created_at: string;
}

interface AdminStats {
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  averageRating: number;
  totalMembers: number;
}

// Collapsible Admin Section Component
const AdminSection = ({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border border-border rounded-xl overflow-hidden">
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold">{title}</span>
          </div>
          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 space-y-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const MemberProfile = () => {
  const { language } = useLanguage();
  const { user, profile, loading: authLoading, signOut, isMember } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminRole();
  const { isEmployee, isLoading: employeeLoading } = useEmployeeRole();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);

  // Get tab from URL query params, default to 'orders'
  const currentTab = searchParams.get('tab') || 'orders';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  const content = {
    sv: {
      title: 'Min Profil',
      welcome: 'Välkommen tillbaka',
      member: 'Medlem',
      memberSince: 'Medlem sedan',
      tabs: {
        overview: 'Översikt',
        reviews: 'Mina recensioner',
        rewards: 'Mina rabattkoder'
      },
      overview: {
        reviewsTitle: 'Dina recensioner',
        reviewsDesc: 'recensioner skrivna',
        rewardsTitle: 'Dina rabattkoder',
        rewardsDesc: 'oanvända koder',
        memberTitle: 'Medlemsstatus',
        memberDesc: 'aktiv medlem'
      },
      reviews: {
        empty: 'Du har inte skrivit några recensioner ännu',
        writeFirst: 'Skriv din första recension och få 10% rabatt!',
        approved: 'Publicerad',
        pending: 'Väntar på granskning',
        shopNow: 'Shoppa nu'
      },
      rewards: {
        empty: 'Du har inga rabattkoder ännu',
        getFirst: 'Skriv en recension för att få din första rabattkod!',
        code: 'Rabattkod',
        discount: 'rabatt',
        expires: 'Giltigt till',
        used: 'Använd',
        copy: 'Kopiera',
        copied: 'Kopierad!'
      },
      actions: {
        signOut: 'Logga ut',
        shopNow: 'Shoppa nu'
      },
      loginRequired: 'Du måste vara inloggad för att se din profil',
      backToHome: 'Tillbaka till startsidan',
      admin: {
        panel: 'Admin-panel',
        panelDesc: 'Snabböversikt och hantering',
        productsInventory: 'Produkter & Lager',
        membersRoles: 'Medlemmar & Roller',
        partners: 'Partners',
        reviewsCommunication: 'Recensioner & Kommunikation',
        legalDonations: 'Juridik & Donationer',
        reviews: 'Recensioner',
        pending: 'Väntande',
        approved: 'Godkända',
        avgRating: 'Snittbetyg',
        members: 'Medlemmar',
        manageReviews: 'Hantera recensioner'
      }
    },
    en: {
      title: 'My Profile',
      welcome: 'Welcome back',
      member: 'Member',
      memberSince: 'Member since',
      tabs: {
        overview: 'Overview',
        reviews: 'My Reviews',
        rewards: 'My Discount Codes'
      },
      overview: {
        reviewsTitle: 'Your reviews',
        reviewsDesc: 'reviews written',
        rewardsTitle: 'Your discount codes',
        rewardsDesc: 'unused codes',
        memberTitle: 'Member status',
        memberDesc: 'active member'
      },
      reviews: {
        empty: "You haven't written any reviews yet",
        writeFirst: 'Write your first review and get 10% off!',
        approved: 'Published',
        pending: 'Pending review',
        shopNow: 'Shop now'
      },
      rewards: {
        empty: "You don't have any discount codes yet",
        getFirst: 'Write a review to get your first discount code!',
        code: 'Discount code',
        discount: 'off',
        expires: 'Valid until',
        used: 'Used',
        copy: 'Copy',
        copied: 'Copied!'
      },
      actions: {
        signOut: 'Sign out',
        shopNow: 'Shop now'
      },
      loginRequired: 'You must be logged in to view your profile',
      backToHome: 'Back to home',
      admin: {
        panel: 'Admin Panel',
        panelDesc: 'Quick overview and management',
        productsInventory: 'Products & Inventory',
        membersRoles: 'Members & Roles',
        partners: 'Partners',
        reviewsCommunication: 'Reviews & Communication',
        legalDonations: 'Legal & Donations',
        reviews: 'Reviews',
        pending: 'Pending',
        approved: 'Approved',
        avgRating: 'Avg Rating',
        members: 'Members',
        manageReviews: 'Manage Reviews'
      }
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    if (user) {
      loadUserData();
    }
    if (isAdmin) {
      loadAdminStats();
    }
  }, [user, isAdmin]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      // Load reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id, product_title, rating, comment, is_approved, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setReviews(reviewsData || []);

      // Load rewards
      const { data: rewardsData } = await supabase
        .from('review_rewards')
        .select('id, discount_code, discount_percent, is_used, expires_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setRewards(rewardsData || []);
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdminStats = async () => {
    try {
      // Load review stats
      const { data: allReviews } = await supabase
        .from('reviews')
        .select('rating, is_approved');

      // Load member count
      const { count: memberCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_member', true);

      if (allReviews) {
        const total = allReviews.length;
        const pending = allReviews.filter(r => !r.is_approved).length;
        const approved = allReviews.filter(r => r.is_approved).length;
        const avgRating = total > 0 
          ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10
          : 0;

        setAdminStats({
          totalReviews: total,
          pendingReviews: pending,
          approvedReviews: approved,
          averageRating: avgRating,
          totalMembers: memberCount || 0,
        });
      }
    } catch (error) {
      console.error('Failed to load admin stats:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success(language === 'sv' ? 'Du har loggat ut' : 'You have been signed out');
    navigate('/');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t.rewards.copied);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const unusedRewards = rewards.filter(r => !r.is_used && new Date(r.expires_at) > new Date());

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-20">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto text-center"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-4">{t.loginRequired}</h1>
              <Link to="/">
                <Button>{t.backToHome}</Button>
              </Link>
            </motion.div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-6 md:p-8 mb-8"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.welcome}</p>
                  <h1 className="font-display text-2xl font-semibold">{user.email}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    {isMember && (
                      <Badge className="bg-primary/10 text-primary">
                        <BadgeCheck className="w-3 h-3 mr-1" />
                        {t.member}
                      </Badge>
                    )}
                    {profile?.member_since && (
                      <span className="text-sm text-muted-foreground">
                        {t.memberSince} {formatDate(profile.member_since)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                {t.actions.signOut}
              </Button>
            </div>
          </motion.div>

          {/* Tabs */}
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="mb-6 flex-wrap">
              <TabsTrigger value="orders" className="gap-2">
                <Package className="w-4 h-4" />
                {language === 'sv' ? 'Mina ordrar' : 'My Orders'}
              </TabsTrigger>
              <TabsTrigger value="overview" className="gap-2">
                <User className="w-4 h-4" />
                {t.tabs.overview}
              </TabsTrigger>
              <TabsTrigger value="reviews" className="gap-2">
                <Star className="w-4 h-4" />
                {t.tabs.reviews}
                {reviews.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{reviews.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="rewards" className="gap-2">
                <Gift className="w-4 h-4" />
                {t.tabs.rewards}
                {unusedRewards.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{unusedRewards.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="donations" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                {language === 'sv' ? 'Donationer' : 'Donations'}
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="w-4 h-4" />
                {language === 'sv' ? 'Inställningar' : 'Settings'}
              </TabsTrigger>
            </TabsList>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <OrderTracker />
              
              {/* Employee Dashboard - visible to employees (moderators) */}
              {isEmployee && !isAdmin && (
                <div className="mt-6">
                  <EmployeeDashboard />
                </div>
              )}
              
              {/* Influencer Dashboard - visible to influencers */}
              <div className="mt-6">
                <InfluencerDashboard />
              </div>
              
              {/* Affiliate Dashboard - visible to affiliates */}
              <div className="mt-6">
                <AffiliateDashboard />
              </div>
            </TabsContent>

            {/* Donations Tab */}
            <TabsContent value="donations">
              <DonationImpact />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <AccountSettings />
            </TabsContent>

            {/* Overview Tab */}
            <TabsContent value="overview">
              {/* Balance Overview for admin/affiliate */}
              <BalanceOverview />
              <div className="grid md:grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Star className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{t.overview.reviewsTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {reviews.length} {t.overview.reviewsDesc}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-card border border-border rounded-xl p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{t.overview.rewardsTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {unusedRewards.length} {t.overview.rewardsDesc}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-card border border-border rounded-xl p-5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <BadgeCheck className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{t.overview.memberTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {isMember ? '✓' : '○'} {t.overview.memberDesc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Admin Panel - Only visible to admins */}
              {isAdmin && adminStats && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{t.admin.panel}</h3>
                      <p className="text-sm text-muted-foreground">{t.admin.panelDesc}</p>
                    </div>
                  </div>

                  {/* Admin Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <div className="bg-card border border-border rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span className="text-xs">{t.admin.reviews}</span>
                      </div>
                      <p className="text-xl font-bold">{adminStats.totalReviews}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs">{t.admin.pending}</span>
                      </div>
                      <p className="text-xl font-bold text-yellow-600">{adminStats.pendingReviews}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Check className="w-3.5 h-3.5" />
                        <span className="text-xs">{t.admin.approved}</span>
                      </div>
                      <p className="text-xl font-bold text-green-600">{adminStats.approvedReviews}</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="text-xs">{t.admin.avgRating}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <p className="text-xl font-bold">{adminStats.averageRating}</p>
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      </div>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Users className="w-3.5 h-3.5" />
                        <span className="text-xs">{t.admin.members}</span>
                      </div>
                      <p className="text-xl font-bold">{adminStats.totalMembers}</p>
                    </div>
                  </div>

                  {/* Admin Quick Navigation */}
                  <div className="flex flex-wrap gap-2 mb-6 p-3 bg-secondary/30 rounded-xl">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => document.getElementById('admin-products')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <Boxes className="w-4 h-4" />
                      {language === 'sv' ? 'Produkter' : 'Products'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => document.getElementById('admin-members')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <UserCog className="w-4 h-4" />
                      {language === 'sv' ? 'Medlemmar' : 'Members'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => document.getElementById('admin-partners')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <Handshake className="w-4 h-4" />
                      {language === 'sv' ? 'Partners' : 'Partners'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => document.getElementById('admin-communication')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <MessageCircle className="w-4 h-4" />
                      {language === 'sv' ? 'Kommunikation' : 'Communication'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => document.getElementById('admin-legal')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <Heart className="w-4 h-4" />
                      {language === 'sv' ? 'Juridik & Donationer' : 'Legal & Donations'}
                    </Button>
                    <Link to="/admin/reviews">
                      <Button size="sm" variant="default" className="gap-2">
                        <MessageCircle className="w-4 h-4" />
                        {t.admin.manageReviews}
                        {adminStats.pendingReviews > 0 && (
                          <Badge variant="secondary" className="ml-1">
                            {adminStats.pendingReviews}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  </div>

                  {/* Collapsible Admin Sections */}
                  <div className="space-y-4">
                    {/* Products & Inventory - Combined */}
                    <div id="admin-products">
                      <AdminSection title={t.admin.productsInventory} icon={Boxes} defaultOpen>
                        <AdminProductManager />
                        <div className="pt-4 border-t border-border">
                          <AdminInventoryManager />
                        </div>
                        <div className="pt-4 border-t border-border">
                          <AdminCategoryManager />
                        </div>
                      </AdminSection>
                    </div>

                    {/* Members & Roles */}
                    <div id="admin-members">
                      <AdminSection title={t.admin.membersRoles} icon={UserCog}>
                        <AdminMemberManager />
                      </AdminSection>
                    </div>

                    {/* Partners */}
                    <div id="admin-partners">
                      <AdminSection title={t.admin.partners} icon={Handshake}>
                        <AdminInfluencerManager />
                        <div className="pt-4 border-t border-border">
                          <AdminAffiliateManager />
                        </div>
                        <div className="pt-4 border-t border-border">
                          <AdminApplicationsManager />
                        </div>
                        <div className="pt-4 border-t border-border">
                          <AdminPayoutManager />
                        </div>
                      </AdminSection>
                    </div>

                    {/* Reviews & Communication */}
                    <div id="admin-communication">
                      <AdminSection title={t.admin.reviewsCommunication} icon={MessageCircle}>
                        <AdminEmailTemplates />
                      </AdminSection>
                    </div>

                    {/* Legal & Donations */}
                    <div id="admin-legal">
                      <AdminSection title={t.admin.legalDonations} icon={Heart}>
                        <AdminDonationManager />
                        <div className="pt-4 border-t border-border">
                          <AdminLegalDocuments />
                        </div>
                      </AdminSection>
                    </div>
                  </div>
                </motion.div>
              )}
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-12 bg-secondary/30 rounded-2xl">
                  <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium mb-2">{t.reviews.empty}</p>
                  <p className="text-muted-foreground mb-6">{t.reviews.writeFirst}</p>
                  <Link to="/shop">
                    <Button>{t.reviews.shopNow}</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <motion.div
                      key={review.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-border rounded-xl p-5"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium">{review.product_title}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(review.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <ReviewStars rating={review.rating} size="sm" />
                          {review.is_approved ? (
                            <Badge className="bg-green-100 text-green-700">
                              <Check className="w-3 h-3 mr-1" />
                              {t.reviews.approved}
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              <Clock className="w-3 h-3 mr-1" />
                              {t.reviews.pending}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-foreground/90">{review.comment}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Rewards Tab */}
            <TabsContent value="rewards">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : rewards.length === 0 ? (
                <div className="text-center py-12 bg-secondary/30 rounded-2xl">
                  <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium mb-2">{t.rewards.empty}</p>
                  <p className="text-muted-foreground mb-6">{t.rewards.getFirst}</p>
                  <Link to="/shop">
                    <Button>{t.actions.shopNow}</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {rewards.map((reward) => {
                    const isExpired = new Date(reward.expires_at) < new Date();
                    const isValid = !reward.is_used && !isExpired;
                    
                    return (
                      <motion.div
                        key={reward.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`bg-card border rounded-xl p-5 ${
                          isValid ? 'border-primary/30 bg-primary/5' : 'border-border opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">{t.rewards.code}</p>
                            <p className="font-mono text-xl font-bold tracking-wider">
                              {reward.discount_code}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-sm">
                              <Badge variant={isValid ? 'default' : 'secondary'}>
                                {reward.discount_percent}% {t.rewards.discount}
                              </Badge>
                              {reward.is_used ? (
                                <span className="text-muted-foreground">{t.rewards.used}</span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {t.rewards.expires} {formatDate(reward.expires_at)}
                                </span>
                              )}
                            </div>
                          </div>
                          {isValid && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyCode(reward.discount_code)}
                            >
                              {t.rewards.copy}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MemberProfile;
