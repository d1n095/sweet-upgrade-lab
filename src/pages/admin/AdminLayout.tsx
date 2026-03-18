import { useEffect } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useAuth } from '@/hooks/useAuth';
import { useStoreSettings } from '@/stores/storeSettingsStore';
import { Loader2, Package, ClipboardList, BarChart3, Settings, Grid, Users, Handshake, MessageCircle, Heart, Sparkles, Eye, LogOut, Home, Shield, Activity, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const navItems = [
  { to: '/admin', label: 'Översikt', icon: BarChart3, end: true },
  { to: '/admin/orders', label: 'Ordrar', icon: ClipboardList },
  { to: '/admin/products', label: 'Produkter', icon: Package },
  { to: '/admin/categories', label: 'Kategorier', icon: Grid },
  { to: '/admin/members', label: 'Medlemmar', icon: Users },
  { to: '/admin/partners', label: 'Partners', icon: Handshake },
  { to: '/admin/communication', label: 'Kommunikation', icon: MessageCircle },
  { to: '/admin/updates', label: 'Nytt hos oss', icon: Sparkles },
  { to: '/admin/visibility', label: 'Sidsynlighet', icon: Eye },
  { to: '/admin/legal', label: 'Juridik & Donationer', icon: Heart },
  { to: '/admin/logs', label: 'Aktivitetslogg', icon: Activity },
  { to: '/admin/settings', label: 'Inställningar', icon: Settings },
];

const AdminLayout = () => {
  const { isAdmin, isLoading } = useAdminRole();
  const { signOut } = useAuth();
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

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display font-semibold text-lg">Admin</span>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-1 px-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
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

        {/* Bottom actions */}
        <div className="p-3 border-t border-border space-y-1">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground" onClick={() => navigate('/')}>
            <Home className="w-4 h-4" />
            Tillbaka till butiken
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
            Logga ut
          </Button>
        </div>
      </aside>

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

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="md:p-8 p-4 pt-18 pb-24 md:pt-8 md:pb-8 max-w-6xl mx-auto">
          {(!siteActive || !checkoutEnabled) && (
            <div className="mb-6 space-y-2">
              {!siteActive && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  <p className="text-sm font-medium text-destructive">Sajten är inaktiv — besökare ser underhållssidan</p>
                </div>
              )}
              {!checkoutEnabled && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Kassan är avstängd — kunder kan inte beställa</p>
                </div>
              )}
            </div>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
