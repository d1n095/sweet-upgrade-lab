import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Search, Shield, UserCheck, Briefcase, 
  Loader2, ChevronDown, ChevronUp, Package, Star,
  Eye, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface Member {
  user_id: string;
  is_member: boolean;
  member_since: string | null;
  created_at: string;
  email?: string;
}

interface UserRole {
  user_id: string;
  role: 'admin' | 'moderator' | 'user';
}

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  shopify_order_number: string | null;
}

interface Review {
  id: string;
  product_title: string;
  rating: number;
  comment: string;
  is_approved: boolean;
  created_at: string;
}

const AdminMemberManager = () => {
  const { language } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberOrders, setMemberOrders] = useState<Order[]>([]);
  const [memberReviews, setMemberReviews] = useState<Review[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [assigningRole, setAssigningRole] = useState(false);

  const content: Record<string, {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    noMembers: string;
    memberSince: string;
    orders: string;
    reviews: string;
    role: string;
    assignRole: string;
    admin: string;
    moderator: string;
    user: string;
    affiliate: string;
    employee: string;
    viewDetails: string;
    memberDetails: string;
    orderHistory: string;
    noOrders: string;
    noReviews: string;
    approved: string;
    pending: string;
    roleAssigned: string;
    roleRemoved: string;
    error: string;
    close: string;
    noRole: string;
  }> = {
    sv: {
      title: 'Medlemshantering',
      subtitle: 'Sök och hantera medlemmar',
      searchPlaceholder: 'Sök på e-post eller ID...',
      noMembers: 'Inga medlemmar hittades',
      memberSince: 'Medlem sedan',
      orders: 'Ordrar',
      reviews: 'Recensioner',
      role: 'Roll',
      assignRole: 'Tilldela roll',
      admin: 'Admin',
      moderator: 'Moderator',
      user: 'Användare',
      affiliate: 'Affiliate',
      employee: 'Anställd',
      viewDetails: 'Visa detaljer',
      memberDetails: 'Medlemsdetaljer',
      orderHistory: 'Orderhistorik',
      noOrders: 'Inga ordrar',
      noReviews: 'Inga recensioner',
      approved: 'Godkänd',
      pending: 'Väntande',
      roleAssigned: 'Roll tilldelad!',
      roleRemoved: 'Roll borttagen!',
      error: 'Något gick fel',
      close: 'Stäng',
      noRole: 'Ingen roll',
    },
    en: {
      title: 'Member Management',
      subtitle: 'Search and manage members',
      searchPlaceholder: 'Search by email or ID...',
      noMembers: 'No members found',
      memberSince: 'Member since',
      orders: 'Orders',
      reviews: 'Reviews',
      role: 'Role',
      assignRole: 'Assign role',
      admin: 'Admin',
      moderator: 'Moderator',
      user: 'User',
      affiliate: 'Affiliate',
      employee: 'Employee',
      viewDetails: 'View details',
      memberDetails: 'Member Details',
      orderHistory: 'Order History',
      noOrders: 'No orders',
      noReviews: 'No reviews',
      approved: 'Approved',
      pending: 'Pending',
      roleAssigned: 'Role assigned!',
      roleRemoved: 'Role removed!',
      error: 'Something went wrong',
      close: 'Close',
      noRole: 'No role',
    },
    no: {
      title: 'Medlemshåndtering',
      subtitle: 'Søk og administrer medlemmer',
      searchPlaceholder: 'Søk på e-post eller ID...',
      noMembers: 'Ingen medlemmer funnet',
      memberSince: 'Medlem siden',
      orders: 'Ordrer',
      reviews: 'Anmeldelser',
      role: 'Rolle',
      assignRole: 'Tildel rolle',
      admin: 'Admin',
      moderator: 'Moderator',
      user: 'Bruker',
      affiliate: 'Affiliate',
      employee: 'Ansatt',
      viewDetails: 'Vis detaljer',
      memberDetails: 'Medlemsdetaljer',
      orderHistory: 'Ordrehistorikk',
      noOrders: 'Ingen ordrer',
      noReviews: 'Ingen anmeldelser',
      approved: 'Godkjent',
      pending: 'Venter',
      roleAssigned: 'Rolle tildelt!',
      roleRemoved: 'Rolle fjernet!',
      error: 'Noe gikk galt',
      close: 'Lukk',
      noRole: 'Ingen rolle',
    },
    da: {
      title: 'Medlemshåndtering',
      subtitle: 'Søg og administrer medlemmer',
      searchPlaceholder: 'Søg på e-mail eller ID...',
      noMembers: 'Ingen medlemmer fundet',
      memberSince: 'Medlem siden',
      orders: 'Ordrer',
      reviews: 'Anmeldelser',
      role: 'Rolle',
      assignRole: 'Tildel rolle',
      admin: 'Admin',
      moderator: 'Moderator',
      user: 'Bruger',
      affiliate: 'Affiliate',
      employee: 'Ansat',
      viewDetails: 'Vis detaljer',
      memberDetails: 'Medlemsdetaljer',
      orderHistory: 'Ordrehistorik',
      noOrders: 'Ingen ordrer',
      noReviews: 'Ingen anmeldelser',
      approved: 'Godkendt',
      pending: 'Afventer',
      roleAssigned: 'Rolle tildelt!',
      roleRemoved: 'Rolle fjernet!',
      error: 'Noget gik galt',
      close: 'Luk',
      noRole: 'Ingen rolle',
    },
    de: {
      title: 'Mitgliederverwaltung',
      subtitle: 'Mitglieder suchen und verwalten',
      searchPlaceholder: 'Nach E-Mail oder ID suchen...',
      noMembers: 'Keine Mitglieder gefunden',
      memberSince: 'Mitglied seit',
      orders: 'Bestellungen',
      reviews: 'Bewertungen',
      role: 'Rolle',
      assignRole: 'Rolle zuweisen',
      admin: 'Admin',
      moderator: 'Moderator',
      user: 'Benutzer',
      affiliate: 'Affiliate',
      employee: 'Mitarbeiter',
      viewDetails: 'Details anzeigen',
      memberDetails: 'Mitgliedsdetails',
      orderHistory: 'Bestellverlauf',
      noOrders: 'Keine Bestellungen',
      noReviews: 'Keine Bewertungen',
      approved: 'Genehmigt',
      pending: 'Ausstehend',
      roleAssigned: 'Rolle zugewiesen!',
      roleRemoved: 'Rolle entfernt!',
      error: 'Etwas ist schief gelaufen',
      close: 'Schließen',
      noRole: 'Keine Rolle',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      // Load profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profiles) {
        setMembers(profiles);
      }

      // Load user roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (roles) {
        const rolesMap: Record<string, string> = {};
        roles.forEach((r) => {
          rolesMap[r.user_id] = r.role;
        });
        setUserRoles(rolesMap);
      }
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMemberDetails = async (member: Member) => {
    setLoadingDetails(true);
    setSelectedMember(member);
    setIsDialogOpen(true);

    try {
      const [ordersRes, reviewsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, created_at, total_amount, status, shopify_order_number')
          .eq('user_id', member.user_id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('reviews')
          .select('id, product_title, rating, comment, is_approved, created_at')
          .eq('user_id', member.user_id)
          .order('created_at', { ascending: false }),
      ]);

      setMemberOrders(ordersRes.data || []);
      setMemberReviews(reviewsRes.data || []);
    } catch (error) {
      console.error('Failed to load member details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAssignRole = async (userId: string, role: string) => {
    setAssigningRole(true);
    try {
      if (role === 'none') {
        // Remove role
        await supabase.from('user_roles').delete().eq('user_id', userId);
        toast.success(t.roleRemoved);
        setUserRoles((prev) => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
      } else {
        // Validate role is correct type
        const validRole = role as 'admin' | 'moderator' | 'user';
        // Check if user already has a role
        const existingRole = userRoles[userId];
        if (existingRole) {
          await supabase
            .from('user_roles')
            .update({ role: validRole })
            .eq('user_id', userId);
        } else {
          await supabase.from('user_roles').insert([{ user_id: userId, role: validRole }]);
        }
        toast.success(t.roleAssigned);
        setUserRoles((prev) => ({ ...prev, [userId]: role }));
      }
    } catch (error) {
      console.error('Failed to assign role:', error);
      toast.error(t.error);
    } finally {
      setAssigningRole(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const filteredMembers = members.filter((member) =>
    member.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'moderator':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">{t.title}</h3>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="pl-9"
        />
      </div>

      {/* Members List */}
      <div className="max-h-80 overflow-y-auto space-y-2">
        {filteredMembers.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{t.noMembers}</p>
        ) : (
          filteredMembers.slice(0, 20).map((member) => (
            <motion.div
              key={member.user_id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{member.user_id.slice(0, 20)}...</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {member.is_member && (
                      <Badge variant="outline" className="text-xs">
                        <UserCheck className="w-3 h-3 mr-1" />
                        {t.memberSince} {member.member_since ? formatDate(member.member_since) : '-'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {userRoles[member.user_id] && (
                  <Badge className={getRoleBadgeColor(userRoles[member.user_id])}>
                    <Shield className="w-3 h-3 mr-1" />
                    {userRoles[member.user_id]}
                  </Badge>
                )}
                <Select
                  value={userRoles[member.user_id] || 'none'}
                  onValueChange={(value) => handleAssignRole(member.user_id, value)}
                  disabled={assigningRole}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue placeholder={t.assignRole} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.noRole}</SelectItem>
                    <SelectItem value="admin">{t.admin}</SelectItem>
                    <SelectItem value="moderator">{t.employee}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => loadMemberDetails(member)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Member Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {t.memberDetails}
            </DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : selectedMember && (
            <div className="space-y-4">
              {/* Member Info */}
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-sm font-mono break-all">{selectedMember.user_id}</p>
                <div className="flex items-center gap-2 mt-2">
                  {selectedMember.is_member && (
                    <Badge variant="outline">
                      {t.memberSince} {selectedMember.member_since ? formatDate(selectedMember.member_since) : '-'}
                    </Badge>
                  )}
                  {userRoles[selectedMember.user_id] && (
                    <Badge className={getRoleBadgeColor(userRoles[selectedMember.user_id])}>
                      {userRoles[selectedMember.user_id]}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Orders */}
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {t.orderHistory}
                </h4>
                {memberOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noOrders}</p>
                ) : (
                  <div className="space-y-2">
                    {memberOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {order.shopify_order_number || order.id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatPrice(order.total_amount)}</p>
                          <Badge variant="outline" className="text-xs">
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reviews */}
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  {t.reviews}
                </h4>
                {memberReviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noReviews}</p>
                ) : (
                  <div className="space-y-2">
                    {memberReviews.map((review) => (
                      <div
                        key={review.id}
                        className="p-3 bg-secondary/30 rounded-lg text-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium">{review.product_title}</p>
                          <Badge variant={review.is_approved ? 'default' : 'secondary'}>
                            {review.is_approved ? t.approved : t.pending}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${
                                i < review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-muted-foreground text-xs">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button variant="outline" className="w-full" onClick={() => setIsDialogOpen(false)}>
                {t.close}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMemberManager;
