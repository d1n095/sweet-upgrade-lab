import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Package, 
  Heart, 
  LogOut, 
  Crown, 
  ShoppingBag,
  MapPin,
  Shield,
  BarChart3,
  Star,
  Gift,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useAccountStats } from '@/hooks/useAccountStats';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface AccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccountDrawer = ({ isOpen, onClose }: AccountDrawerProps) => {
  const { language } = useLanguage();
  const { user, isMember, signOut } = useAuth();
  const { isAdmin } = useAdminRole();
  const { stats } = useAccountStats();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success(language === 'sv' ? 'Du har loggat ut' : 'You have been signed out');
    onClose();
    navigate('/');
  };

  const handleNavigation = (href: string) => {
    onClose();
    navigate(href);
  };

  const menuItems = [
    {
      icon: User,
      label: language === 'sv' ? 'Min profil' : 'My Profile',
      href: '/profile',
      description: language === 'sv' ? 'Hantera dina uppgifter' : 'Manage your details',
    },
    {
      icon: Package,
      label: language === 'sv' ? 'Mina beställningar' : 'My Orders',
      href: '/profile?tab=orders',
      description: language === 'sv' ? 'Se orderhistorik' : 'View order history',
    },
    {
      icon: Star,
      label: language === 'sv' ? 'Mina recensioner' : 'My Reviews',
      href: '/profile?tab=reviews',
      description: language === 'sv' ? 'Dina produktrecensioner' : 'Your product reviews',
    },
    {
      icon: Gift,
      label: language === 'sv' ? 'Rabattkoder' : 'Discount Codes',
      href: '/profile?tab=rewards',
      description: language === 'sv' ? 'Dina belöningar' : 'Your rewards',
    },
    {
      icon: Heart,
      label: language === 'sv' ? 'Donationer' : 'Donations',
      href: '/profile?tab=donations',
      description: language === 'sv' ? 'Din påverkan' : 'Your impact',
    },
    {
      icon: MapPin,
      label: language === 'sv' ? 'Spåra order' : 'Track Order',
      href: '/track-order',
      description: language === 'sv' ? 'Följ din leverans' : 'Follow your delivery',
    },
    {
      icon: Settings,
      label: language === 'sv' ? 'Inställningar' : 'Settings',
      href: '/profile?tab=settings',
      description: language === 'sv' ? 'Ändra e-post & lösenord' : 'Change email & password',
    },
  ];

  const adminItems = [
    {
      icon: BarChart3,
      label: language === 'sv' ? 'Admin Statistik' : 'Admin Stats',
      href: '/admin/stats',
      description: language === 'sv' ? 'Fullständig översikt' : 'Full overview',
    },
    {
      icon: Shield,
      label: language === 'sv' ? 'Admin-panel' : 'Admin Panel',
      href: '/profile?tab=overview',
      description: language === 'sv' ? 'Hantera butiken' : 'Manage the store',
    },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <SheetTitle className="font-display text-xl">
                {language === 'sv' ? 'Mitt konto' : 'My Account'}
              </SheetTitle>
              <SheetDescription className="text-sm">
                {user?.email}
              </SheetDescription>
            </div>
          </div>
          
          {/* Member badge */}
          {isMember && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/10 border border-accent/20">
              <Crown className="w-5 h-5 text-accent" />
              <div>
                <p className="text-sm font-medium text-accent">
                  {language === 'sv' ? 'Premium Medlem' : 'Premium Member'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === 'sv' ? 'Du har tillgång till exklusiva priser' : 'You have access to exclusive prices'}
                </p>
              </div>
            </div>
          )}

          {/* Admin badge */}
          {isAdmin && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Shield className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-primary">
                  {language === 'sv' ? 'Administratör' : 'Administrator'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === 'sv' ? 'Du har admin-rättigheter' : 'You have admin privileges'}
                </p>
              </div>
            </div>
          )}
        </SheetHeader>

        {/* Admin items */}
        {isAdmin && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide px-4 mb-2">
              {language === 'sv' ? 'Administration' : 'Administration'}
            </p>
            <nav className="space-y-1">
              {adminItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleNavigation(item.href)}
                  className="flex items-center gap-4 p-4 rounded-xl hover:bg-primary/5 transition-colors group w-full text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Menu items */}
        <div className="mb-4">
          {isAdmin && (
            <p className="text-xs text-muted-foreground uppercase tracking-wide px-4 mb-2">
              {language === 'sv' ? 'Mitt konto' : 'My Account'}
            </p>
          )}
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-secondary/50 transition-colors group w-full text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Divider */}
        <div className="my-6 border-t border-border" />

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-secondary/30">
            <ShoppingBag className="w-5 h-5 text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.ordersCount}</p>
            <p className="text-xs text-muted-foreground">
              {language === 'sv' ? 'Beställningar' : 'Orders'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-secondary/30">
            <Heart className="w-5 h-5 text-accent mb-2" />
            <p className="text-2xl font-bold">{stats.totalDonated} kr</p>
            <p className="text-xs text-muted-foreground">
              {language === 'sv' ? 'Donerat' : 'Donated'}
            </p>
          </div>
        </div>

        {/* Sign out button */}
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="w-full h-12 rounded-xl gap-2"
        >
          <LogOut className="w-5 h-5" />
          {language === 'sv' ? 'Logga ut' : 'Sign out'}
        </Button>
      </SheetContent>
    </Sheet>
  );
};

export default AccountDrawer;
