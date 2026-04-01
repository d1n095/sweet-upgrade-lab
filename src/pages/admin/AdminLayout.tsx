import { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink, useLocation, Link } from 'react-router-dom';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { useAdminSession } from '@/hooks/useAdminSession';
import {
  Loader2, Package, ClipboardList, BarChart3, Settings, Grid, Users,
  Handshake, Heart, Eye, LogOut, Home, Shield, Crown,
  Activity, User, Menu, X, Star, FileText, Percent, Truck, Wallet, Globe,
  AlertTriangle, ScanLine, Sparkles, History, ShoppingCart, Radar, Cpu,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useEmployeeRole } from '@/hooks/useEmployeeRole';
import { useFounderRole } from '@/hooks/useFounderRole';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logAuthEvent } from '@/utils/activityLogger';
import AdminGlobalSearch from '@/components/admin/AdminGlobalSearch';
import AdminNotificationBell from '@/components/admin/AdminNotificationBell';
import BugReportButton from '@/components/admin/BugReportButton';
import AiControlBar from '@/components/admin/AiControlBar';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRealtime } from '@/hooks/useAdminRealtime';


// role: 'all' = everyone with admin/employee access, 'admin' = admin only, 'founder' = founder only
interface NavItem {
  to: string;
  label: string;
  icon: any;
  end?: boolean;
  role: 'all' | 'admin' | 'founder';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: '',
    items: [
      { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true, role: 'all' },
    ],
  },
  {
    label: 'DRIFT',
    items: [
      { to: '/admin/ops', label: 'Operations', icon: ClipboardList, role: 'all' },
      { to: '/admin/orders', label: 'Ordrar', icon: ClipboardList, role: 'all' },
      { to: '/admin/pos', label: 'Kassa (POS)', icon: ShoppingCart, role: 'all' },
      { to: '/admin/incidents', label: 'Ärenden', icon: AlertTriangle, role: 'all' },
      { to: '/admin/warehouse', label: 'Warehouse', icon: ScanLine, role: 'all' },
      { to: '/admin/shipping', label: 'Frakt', icon: Truck, role: 'admin' },
      { to: '/admin/staff', label: 'Workbench', icon: Crown, role: 'founder' },
    ],
  },
  {
    label: 'LAGER',
    items: [
      { to: '/admin/products', label: 'Produkter', icon: Package, role: 'all' },
      { to: '/admin/categories', label: 'Kategorier', icon: Grid, role: 'admin' },
      { to: '/admin/reviews', label: 'Recensioner', icon: Star, role: 'all' },
    ],
  },
  {
    label: 'TILLVÄXT',
    items: [
      { to: '/admin/growth', label: 'Tillväxt', icon: Activity, role: 'admin' },
      { to: '/admin/stats', label: 'Statistik', icon: BarChart3, role: 'admin' },
      { to: '/admin/insights', label: 'Insights', icon: Activity, role: 'admin' },
      { to: '/admin/campaigns', label: 'Kampanjer', icon: Percent, role: 'admin' },
      { to: '/admin/seo', label: 'SEO', icon: Globe, role: 'admin' },
    ],
  },
  {
    label: 'EKONOMI',
    items: [
      { to: '/admin/finance', label: 'Ekonomi', icon: Wallet, role: 'admin' },
      { to: '/admin/donations', label: 'Donationer', icon: Heart, role: 'admin' },
      { to: '/admin/partners', label: 'Partners', icon: Handshake, role: 'admin' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { to: '/admin/ai', label: 'Scan Center', icon: Radar, role: 'admin' },
      { to: '/admin/advanced', label: 'Advanced System', icon: Cpu, role: 'admin' },
      { to: '/admin/history', label: 'Historik', icon: History, role: 'admin' },
      { to: '/admin/members', label: 'Användare', icon: Users, role: 'admin' },
      { to: '/admin/content', label: 'Innehåll', icon: FileText, role: 'admin' },
      { to: '/admin/legal', label: 'Juridik', icon: Heart, role: 'admin' },
      { to: '/admin/logs', label: 'Logg', icon: Activity, role: 'admin' },
      { to: '/admin/data', label: 'Data Center', icon: Eye, role: 'admin' },
      { to: '/admin/database', label: 'Databas', icon: Grid, role: 'admin' },
      { to: '/admin/settings', label: 'Inställningar', icon: Settings, role: 'admin' },
    ],
  },
];

// Flatten for lookups
const allNavItems = navGroups.flatMap(g => g.items);

const AdminLayout = () => {
  const { isAdmin, isLoading } = useAdminRole();
  const { isEmployee, isLoading: employeeLoading } = useEmployeeRole();
  const { isFounder, isLoading: founderLoading } = useFounderRole();
  const { user, signOut } = useAuth();
  const { siteActive, checkoutEnabled, isLoaded, fetchSettings } = useStoreSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [recentErrorCount, setRecentErrorCount] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Centralized realtime sync for all admin queries
  useAdminRealtime();
  const [errorBannerDismissed, setErrorBannerDismissed] = useState(false);
  const hasAccess = isAdmin || isEmployee;
  const combinedLoading = isLoading || employeeLoading || founderLoading;

  // Admin session timeout (30 min inactivity)
  useAdminSession();

  useEffect(() => {
    if (!isLoaded) fetchSettings();
  }, [isLoaded, fetchSettings]);

  useEffect(() => {
    if (!combinedLoading && !hasAccess) {
      navigate('/');
    }
  }, [hasAccess, combinedLoading, navigate]);

  // Filter nav groups based on role
  const filterItem = (item: NavItem) => {
    if (item.role === 'founder') return isFounder;
    if (isAdmin) return true;
    return item.role === 'all';
  };
  const visibleGroups = navGroups.map(g => ({
    ...g,
    items: g.items.filter(filterItem),
  })).filter(g => g.items.length > 0);
  const visibleNavItems = allNavItems.filter(filterItem);

  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  // Fetch recent error count (last hour)
  useEffect(() => {
    const fetchErrors = async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('log_type', 'error')
        .gte('created_at', oneHourAgo);
      setRecentErrorCount(count || 0);
    };
    fetchErrors();

    // Listen for new errors
    const channel = supabase
      .channel('admin-error-banner')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: 'log_type=eq.error' }, () => {
        setRecentErrorCount(prev => prev + 1);
        setErrorBannerDismissed(false);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (combinedLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasAccess) return null;

  const handleSignOut = async () => {
    logAuthEvent('logout', user?.email || undefined);
    await signOut();
    toast.success('Utloggad');
    navigate('/');
  };

  const currentPage = visibleNavItems.find(item =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to + '/')
  ) || (location.pathname === '/admin' ? visibleNavItems[0] : undefined);

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* Main area */}
      <div className="flex flex-col h-full">
        {/* Desktop Topbar */}
        <header className="hidden md:flex h-14 items-center justify-between px-8 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg shrink-0" onClick={() => setMobileNavOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <AdminGlobalSearch />
          </div>
          <div className="flex items-center gap-2">
            <AiControlBar />
            <BugReportButton />
            <AdminNotificationBell />
            {!siteActive && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/20">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                <span className="text-xs font-medium text-destructive">Underhållsläge</span>
              </div>
            )}
            {!checkoutEnabled && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 border border-warning/20">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                <span className="text-xs font-medium text-warning">Kassa av</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50">
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground truncate max-w-[180px]">{user?.email || '—'}</span>
            </div>
          </div>
        </header>

        {/* Mobile header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4">
          <div className="h-14 flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg shrink-0" onClick={() => setMobileNavOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="font-display font-semibold text-sm truncate">{currentPage?.label || 'Admin'}</span>
            </div>
            <div className="ml-auto flex items-center gap-1 shrink-0">
              {!siteActive && (
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" title="Underhållsläge" />
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
                <Home className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="pb-2">
            <AdminGlobalSearch />
          </div>
        </div>

        {/* Nav drawer */}
        <AnimatePresence>
          {mobileNavOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] bg-black/40"
                onClick={() => setMobileNavOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-y-0 left-0 z-[70] w-72 bg-card border-r border-border flex flex-col"
              >
                <div className="h-14 flex items-center justify-between px-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-display font-semibold">Admin</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileNavOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* User info */}
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{user?.email || '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{isAdmin ? 'Administratör' : 'Anställd'}</p>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1 py-2">
                  <nav className="space-y-4 px-3">
                    {visibleGroups.map((group, gi) => {
                      const isCollapsed = group.label ? collapsedGroups.has(group.label) : false;
                      return (
                        <div key={gi}>
                          {group.label && (
                            <button
                              onClick={() => toggleGroup(group.label)}
                              className="w-full flex items-center justify-between px-3 mb-1 group"
                            >
                              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider group-hover:text-muted-foreground/80 transition-colors">{group.label}</p>
                              {isCollapsed
                                ? <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                                : <ChevronDown className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
                              }
                            </button>
                          )}
                          {!isCollapsed && (
                            <div className="space-y-0.5">
                              {group.items.map((item) => (
                                <NavLink
                                  key={item.to}
                                  to={item.to}
                                  end={item.end}
                                  className={({ isActive }) =>
                                    cn(
                                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                                      isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                    )
                                  }
                                >
                                  <item.icon className="w-4 h-4 shrink-0" />
                                  {item.label}
                                </NavLink>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </nav>
                </ScrollArea>

                <div className="p-3 border-t border-border space-y-0.5">
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground min-h-[44px]" onClick={() => navigate('/')}>
                    <Home className="w-4 h-4" />
                    Tillbaka till butiken
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground min-h-[44px]" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4" />
                    Logga ut
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Error banner */}
        {recentErrorCount > 0 && !errorBannerDismissed && (
          <div className="bg-destructive/10 border-b border-destructive/20 px-4 md:px-8 py-2 flex items-center justify-between">
            <Link to="/admin/logs" className="flex items-center gap-2 text-sm text-destructive hover:underline">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">{recentErrorCount} {recentErrorCount === 1 ? 'fel' : 'fel'} senaste timmen</span>
              <span className="text-destructive/70">→ Visa loggar</span>
            </Link>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => setErrorBannerDismissed(true)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
          <div className="md:px-6 md:py-6 p-4 pt-24 pb-8 md:pt-6 md:pb-8 h-full">
            <Outlet />
          </div>
        </main>
        
      </div>
    </div>
  );
};

export default AdminLayout;
