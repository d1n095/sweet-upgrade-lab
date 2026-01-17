import { Link } from 'react-router-dom';
import { 
  User, 
  Package, 
  Heart, 
  Settings, 
  LogOut, 
  Crown, 
  ShoppingBag,
  MapPin,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
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

  const handleSignOut = async () => {
    await signOut();
    onClose();
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
      icon: Heart,
      label: language === 'sv' ? 'Mina donationer' : 'My Donations',
      href: '/profile?tab=donations',
      description: language === 'sv' ? 'Din påverkan' : 'Your impact',
    },
    {
      icon: MapPin,
      label: language === 'sv' ? 'Spåra order' : 'Track Order',
      href: '/track-order',
      description: language === 'sv' ? 'Följ din leverans' : 'Follow your delivery',
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
        </SheetHeader>

        {/* Menu items */}
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-secondary/50 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="my-6 border-t border-border" />

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-secondary/30">
            <ShoppingBag className="w-5 h-5 text-primary mb-2" />
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">
              {language === 'sv' ? 'Beställningar' : 'Orders'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-secondary/30">
            <Heart className="w-5 h-5 text-accent mb-2" />
            <p className="text-2xl font-bold">0 kr</p>
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
