import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Package, Star, Gift, Settings, LogOut, 
  ChevronRight, Loader2, Clock, Check, BadgeCheck,
  Shield, TrendingUp, Zap, Award, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger, ScrollableTabs } from '@/components/ui/tabs';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ReviewStars from '@/components/reviews/ReviewStars';
import ReferralDashboard from '@/components/referral/ReferralDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useEmployeeRole } from '@/hooks/useEmployeeRole';
import { useLanguage } from '@/context/LanguageContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import OrderTracker from '@/components/orders/OrderTracker';
import InfluencerDashboard from '@/components/dashboard/InfluencerDashboard';
import AffiliateDashboard from '@/components/dashboard/AffiliateDashboard';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import DonationImpact from '@/components/donations/DonationImpact';
import AccountSettings from '@/components/profile/AccountSettings';
import ProfileInfoForm from '@/components/profile/ProfileInfoForm';
import CompleteProfileBanner from '@/components/profile/CompleteProfileBanner';
import BusinessAccountForm from '@/components/profile/BusinessAccountForm';
import TrustBadges from '@/components/trust/TrustBadges';

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


const MemberProfile = () => {
  const { language } = useLanguage();
  const { user, profile, loading: authLoading, signOut, isMember, username, maskEmail, xp, level, xpProgress, trustScore } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminRole();
  const { isEmployee, isLoading: employeeLoading } = useEmployeeRole();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  

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
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id, product_title, rating, comment, is_approved, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setReviews(reviewsData || []);

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
                {/* Avatar with initials */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-xl font-bold shrink-0">
                  {(username || user.email || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{t.welcome}</p>
                  <h1 className="font-display text-2xl font-semibold truncate">
                    {username || (language === 'sv' ? 'Användare' : 'User')}
                  </h1>
                  <div className="flex items-center flex-wrap gap-2 mt-1.5">
                    {/* Role badge */}
                    {isAdmin ? (
                      <Badge className="bg-destructive/10 text-destructive text-[10px]">
                        <Shield className="w-3 h-3 mr-1" />
                        Admin
                      </Badge>
                    ) : isEmployee ? (
                      <Badge className="bg-warning/10 text-warning text-[10px]">
                        <Shield className="w-3 h-3 mr-1" />
                        {language === 'sv' ? 'Anställd' : 'Staff'}
                      </Badge>
                    ) : (
                      <Badge className="bg-secondary text-muted-foreground text-[10px]">
                        {language === 'sv' ? 'Kund' : 'Customer'}
                      </Badge>
                    )}
                    {isMember && (
                      <Badge className="bg-primary/10 text-primary text-[10px]">
                        <BadgeCheck className="w-3 h-3 mr-1" />
                        {t.member}
                      </Badge>
                    )}
                    {/* Level badge - only for admin/staff */}
                    {(isAdmin || isEmployee) && (
                      <Badge className="bg-accent/10 text-accent text-[10px]">
                        <Award className="w-3 h-3 mr-1" />
                        Level {level}
                      </Badge>
                    )}
                  </div>
                  {/* XP Progress bar - only for admin/staff */}
                  {(isAdmin || isEmployee) && (
                    <div className="mt-2 flex items-center gap-2 max-w-[280px]">
                      <Zap className="w-3.5 h-3.5 text-accent shrink-0" />
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-accent to-primary rounded-full transition-all duration-500"
                          style={{ width: `${xpProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{xp} XP</span>
                    </div>
                  )}
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
            <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm pb-3 pt-2 -mx-4 px-4 border-b border-border/50 mb-6">
              <div className="relative">
                <ScrollableTabs className="pb-1 cursor-grab active:cursor-grabbing">
                  <div className="inline-flex items-center gap-1.5 min-w-max">
                    {[
                      { value: 'orders', icon: Package, label: language === 'sv' ? 'Ordrar' : 'Orders' },
                      { value: 'reviews', icon: Star, label: language === 'sv' ? 'Recensioner' : 'Reviews', badge: reviews.length || undefined },
                      { value: 'rewards', icon: Gift, label: language === 'sv' ? 'Koder' : 'Codes', badge: unusedRewards.length || undefined },
                      { value: 'referral', icon: Users, label: language === 'sv' ? 'Bjud in' : 'Refer' },
                      { value: 'settings', icon: Settings, label: language === 'sv' ? 'Inställningar' : 'Settings' },
                    ].map(({ value, icon: Icon, label, badge }) => (
                      <button
                        key={value}
                        onClick={() => handleTabChange(value)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
                          currentTab === value
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                        {badge && badge > 0 && (
                          <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                            currentTab === value ? 'bg-primary-foreground/20' : 'bg-muted'
                          }`}>{badge}</span>
                        )}
                      </button>
                    ))}
                    {isAdmin && (
                      <button
                        onClick={() => navigate('/admin')}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full px-3.5 py-2 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-all"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Admin
                      </button>
                    )}
                  </div>
                </ScrollableTabs>
                {/* Fade hint on right edge */}
                <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background/95 to-transparent pointer-events-none md:hidden" />
              </div>
            </div>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <OrderTracker />
              
              {isEmployee && !isAdmin && (
                <div className="mt-6">
                  <EmployeeDashboard />
                </div>
              )}
              
              <div className="mt-6">
                <InfluencerDashboard />
              </div>
              
              <div className="mt-6">
                <AffiliateDashboard />
              </div>
            </TabsContent>

            {/* Referral Tab */}
            <TabsContent value="referral">
              <ReferralDashboard />
            </TabsContent>

            {/* Donations Tab */}
            <TabsContent value="donations">
              <DonationImpact />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <div className="space-y-6">
                <CompleteProfileBanner />
                <ProfileInfoForm />
                <AccountSettings />
                <BusinessAccountForm />
                <TrustBadges level={level} trustScore={trustScore} xp={xp} />
              </div>
            </TabsContent>

            {/* Overview Tab */}
            <TabsContent value="overview">
              {/* Stats cards */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <motion.button onClick={() => handleTabChange('reviews')} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-4 text-center cursor-pointer hover:bg-secondary/50 hover:border-primary/20 transition-colors">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Star className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-2xl font-bold">{reviews.length}</p>
                  <p className="text-xs text-muted-foreground">{t.overview.reviewsDesc}</p>
                </motion.button>
                <motion.button onClick={() => handleTabChange('rewards')} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-xl p-4 text-center cursor-pointer hover:bg-secondary/50 hover:border-primary/20 transition-colors">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-accent" />
                  </div>
                  <p className="text-2xl font-bold">{unusedRewards.length}</p>
                  <p className="text-xs text-muted-foreground">{t.overview.rewardsDesc}</p>
                </motion.button>
                <motion.button onClick={() => handleTabChange('settings')} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-4 text-center cursor-pointer hover:bg-secondary/50 hover:border-primary/20 transition-colors">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-secondary flex items-center justify-center">
                    <BadgeCheck className="w-5 h-5 text-foreground" />
                  </div>
                  <p className="text-2xl font-bold">{isMember ? '✓' : '—'}</p>
                  <p className="text-xs text-muted-foreground">{t.overview.memberDesc}</p>
                </motion.button>
              </div>

              {/* Quick navigation */}
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                {language === 'sv' ? 'Snabbnavigering' : 'Quick Navigation'}
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {[
                  { tab: 'orders', icon: Package, label: language === 'sv' ? 'Mina ordrar' : 'My Orders', desc: language === 'sv' ? 'Se och spåra dina beställningar' : 'View and track your orders' },
                  { tab: 'reviews', icon: Star, label: t.tabs.reviews, desc: language === 'sv' ? 'Läs och skriv produktrecensioner' : 'Read and write product reviews' },
                  { tab: 'rewards', icon: Gift, label: t.tabs.rewards, desc: language === 'sv' ? 'Se dina rabattkoder' : 'View your discount codes' },
                  { tab: 'donations', icon: TrendingUp, label: language === 'sv' ? 'Donationer' : 'Donations', desc: language === 'sv' ? 'Din påverkan och bidrag' : 'Your impact and contributions' },
                  { tab: 'settings', icon: Settings, label: language === 'sv' ? 'Inställningar' : 'Settings', desc: language === 'sv' ? 'Hantera ditt konto' : 'Manage your account' },
                ].map((item) => (
                  <button
                    key={item.tab}
                    onClick={() => handleTabChange(item.tab)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary/50 hover:border-primary/20 transition-colors text-left group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
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
                  <Link to="/produkter">
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
                  <Link to="/produkter">
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
