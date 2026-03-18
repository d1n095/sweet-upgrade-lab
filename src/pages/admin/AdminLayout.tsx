import { useEffect } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import {
  Loader2, Package, ClipboardList, BarChart3, Settings, Grid, Users,
  Handshake, MessageCircle, Heart, Sparkles, Eye, LogOut, Home, Shield,
  Activity, AlertTriangle, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AdminGlobalSearch from '@/components/admin/AdminGlobalSearch';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/admin/orders', label: 'Ordrar', icon: ClipboardList },
  { to: '/admin/products', label: 'Produkter', icon: Package },
  { to: '/admin/categories', label: 'Kategorier', icon: Grid },
  { to: '/admin/members', label: 'Användare', icon: Users },
  { to: '/admin/partners', label: 'Partners', icon: Handshake },
  { to: '/admin/communication', label: 'Kommunikation', icon: MessageCircle },
  { to: '/admin/updates', label: 'Nytt hos oss', icon: Sparkles },
  { to: '/admin/visibility', label: 'Sidsynlighet', icon: Eye },
  { to: '/admin/legal', label: 'Juridik & Donationer', icon: Heart },
  { to: '/admin/logs', label: 'Logg', icon: Activity },
  { to: '/admin/settings', label: 'Inställningar', icon: Settings },
];

const AdminLayout = () => {
  const { isAdmin, isLoading } = useAdminRole();
  const { user, signOut } = useAuth();
  const { siteActive, checkoutEnabled, isLoaded, fetchSettings } = useStoreSettings();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoaded) fetchSettings();
  }, [isLoaded, fetchSettings]);

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const handleSignOut = async () => {
    await signOut();
    toast.success('Utloggad');
    navigate('/');
  };

  const currentPage = navItems.find(item =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to + '/')
  ) || (location.pathname === '/admin' ? navItems[0] : undefined);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar - fixed */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card fixed inset-y-0 left-0 z-30">
        <div className="h-14 flex items-center gap-3 px-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display font-semibold text-lg">Admin</span>
        </div>

        <ScrollArea className="flex-1 py-3">
          <nav className="space-y-0.5 px-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
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
          </nav>
        </ScrollArea>

        <div className="p-3 border-t border-border space-y-0.5">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={() => navigate('/')}>
            <Home className="w-4 h-4" />
            Tillbaka till butiken
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
            Logga ut
          </Button>
        </div>
      </aside>

      {/* Main area with offset for sidebar */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Desktop Topbar */}
        <header className="hidden md:flex h-14 items-center justify-between px-8 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <AdminGlobalSearch />
            <h2 className="text-sm font-semibold">{currentPage?.label || 'Admin'}</h2>
          </div>
          <div className="flex items-center gap-3">
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
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border flex items-center px-4 gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-display font-semibold">Admin</span>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
              <Home className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
          <div className="flex overflow-x-auto px-2 py-1.5 gap-1">
            {navItems.slice(0, 6).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] font-medium min-w-[56px] transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="md:p-8 p-4 pt-18 pb-24 md:pt-6 md:pb-8 max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
