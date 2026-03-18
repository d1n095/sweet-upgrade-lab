import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Search, Shield, UserCheck, Briefcase, 
  Loader2, ChevronDown, ChevronUp, Package, Star,
  Eye, X, Mail, ExternalLink, ChevronLeft, ChevronRight
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
  username?: string | null;
  avatar_url?: string | null;
}

type AppRole = 'admin' | 'founder' | 'it' | 'moderator' | 'support' | 'affiliate' | 'donor' | 'manager' | 'marketing' | 'finance' | 'warehouse';

interface UserRole {
  user_id: string;
  role: AppRole;
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

const ITEMS_PER_PAGE = 50;

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
  const [page, setPage] = useState(0);
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
    fi: {
      title: 'Jäsenhallinta',
      subtitle: 'Hae ja hallitse jäseniä',
      searchPlaceholder: 'Hae sähköpostilla tai ID:llä...',
      noMembers: 'Jäseniä ei löytynyt',
      memberSince: 'Jäsen alkaen',
      orders: 'Tilaukset',
      reviews: 'Arvostelut',
      role: 'Rooli',
      assignRole: 'Määritä rooli',
      admin: 'Admin',
      moderator: 'Moderaattori',
      user: 'Käyttäjä',
      affiliate: 'Kumppani',
      employee: 'Työntekijä',
      viewDetails: 'Näytä tiedot',
      memberDetails: 'Jäsentiedot',
      orderHistory: 'Tilaushistoria',
      noOrders: 'Ei tilauksia',
      noReviews: 'Ei arvosteluja',
      approved: 'Hyväksytty',
      pending: 'Odottaa',
      roleAssigned: 'Rooli määritetty!',
      roleRemoved: 'Rooli poistettu!',
      error: 'Jotain meni pieleen',
      close: 'Sulje',
      noRole: 'Ei roolia',
    },
    nl: {
      title: 'Ledenbeheer',
      subtitle: 'Zoek en beheer leden',
      searchPlaceholder: 'Zoek op e-mail of ID...',
      noMembers: 'Geen leden gevonden',
      memberSince: 'Lid sinds',
      orders: 'Bestellingen',
      reviews: 'Beoordelingen',
      role: 'Rol',
      assignRole: 'Rol toewijzen',
      admin: 'Admin',
      moderator: 'Moderator',
      user: 'Gebruiker',
      affiliate: 'Affiliate',
      employee: 'Medewerker',
      viewDetails: 'Details bekijken',
      memberDetails: 'Lidgegevens',
      orderHistory: 'Bestelgeschiedenis',
      noOrders: 'Geen bestellingen',
      noReviews: 'Geen beoordelingen',
      approved: 'Goedgekeurd',
      pending: 'In afwachting',
      roleAssigned: 'Rol toegewezen!',
      roleRemoved: 'Rol verwijderd!',
      error: 'Er is iets misgegaan',
      close: 'Sluiten',
      noRole: 'Geen rol',
    },
    fr: {
      title: 'Gestion des membres',
      subtitle: 'Rechercher et gérer les membres',
      searchPlaceholder: 'Rechercher par e-mail ou ID...',
      noMembers: 'Aucun membre trouvé',
      memberSince: 'Membre depuis',
      orders: 'Commandes',
      reviews: 'Avis',
      role: 'Rôle',
      assignRole: 'Attribuer un rôle',
      admin: 'Admin',
      moderator: 'Modérateur',
      user: 'Utilisateur',
      affiliate: 'Affilié',
      employee: 'Employé',
      viewDetails: 'Voir les détails',
      memberDetails: 'Détails du membre',
      orderHistory: 'Historique des commandes',
      noOrders: 'Aucune commande',
      noReviews: 'Aucun avis',
      approved: 'Approuvé',
      pending: 'En attente',
      roleAssigned: 'Rôle attribué!',
      roleRemoved: 'Rôle supprimé!',
      error: 'Une erreur s\'est produite',
      close: 'Fermer',
      noRole: 'Aucun rôle',
    },
    es: {
      title: 'Gestión de miembros',
      subtitle: 'Buscar y gestionar miembros',
      searchPlaceholder: 'Buscar por email o ID...',
      noMembers: 'No se encontraron miembros',
      memberSince: 'Miembro desde',
      orders: 'Pedidos',
      reviews: 'Reseñas',
      role: 'Rol',
      assignRole: 'Asignar rol',
      admin: 'Admin',
      moderator: 'Moderador',
      user: 'Usuario',
      affiliate: 'Afiliado',
      employee: 'Empleado',
      viewDetails: 'Ver detalles',
      memberDetails: 'Detalles del miembro',
      orderHistory: 'Historial de pedidos',
      noOrders: 'Sin pedidos',
      noReviews: 'Sin reseñas',
      approved: 'Aprobado',
      pending: 'Pendiente',
      roleAssigned: '¡Rol asignado!',
      roleRemoved: '¡Rol eliminado!',
      error: 'Algo salió mal',
      close: 'Cerrar',
      noRole: 'Sin rol',
    },
    pl: {
      title: 'Zarządzanie członkami',
      subtitle: 'Wyszukuj i zarządzaj członkami',
      searchPlaceholder: 'Szukaj po e-mail lub ID...',
      noMembers: 'Nie znaleziono członków',
      memberSince: 'Członek od',
      orders: 'Zamówienia',
      reviews: 'Opinie',
      role: 'Rola',
      assignRole: 'Przypisz rolę',
      admin: 'Admin',
      moderator: 'Moderator',
      user: 'Użytkownik',
      affiliate: 'Partner',
      employee: 'Pracownik',
      viewDetails: 'Zobacz szczegóły',
      memberDetails: 'Szczegóły członka',
      orderHistory: 'Historia zamówień',
      noOrders: 'Brak zamówień',
      noReviews: 'Brak opinii',
      approved: 'Zatwierdzony',
      pending: 'Oczekujący',
      roleAssigned: 'Rola przypisana!',
      roleRemoved: 'Rola usunięta!',
      error: 'Coś poszło nie tak',
      close: 'Zamknij',
      noRole: 'Brak roli',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      // Load profiles with username
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, is_member, member_since, created_at, username, avatar_url')
        .order('created_at', { ascending: false });

      if (profiles) {
        // Also fetch emails for all members via RPC (founders/admins can see this)
        const membersList = profiles as Member[];
        
        // Batch-fetch emails: search with empty string returns nothing, so we fetch by chunks
        // Instead, just load emails for all visible members via individual lookups
        // We'll use the RPC when searching
        setMembers(membersList);
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
  }, []);

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
        const validRole = role as AppRole;
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

  const filteredMembers = members.filter((member) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      member.user_id.toLowerCase().includes(q) ||
      (member.username && member.username.toLowerCase().includes(q)) ||
      (member.email && member.email.toLowerCase().includes(q))
    );
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'founder':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'admin':
      case 'it':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'manager':
      case 'finance':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'marketing':
        return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400';
      case 'moderator':
      case 'support':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'warehouse':
        return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
      case 'affiliate':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'donor':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
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
          onChange={(e) => {
            setSearchQuery(e.target.value);
            // If searching, also search via RPC for emails
            const q = e.target.value.trim();
            if (q.length >= 3) {
              supabase.rpc('admin_search_users', { p_query: q }).then(({ data }) => {
                if (data) {
                  // Merge email/username info into members
                  setMembers(prev => {
                    const updated = [...prev];
                    for (const result of data as any[]) {
                      const idx = updated.findIndex(m => m.user_id === result.user_id);
                      if (idx >= 0) {
                        updated[idx] = { ...updated[idx], email: result.email, username: result.username || updated[idx].username };
                      } else {
                        // User exists in auth but might not be in our list yet
                        updated.push({
                          user_id: result.user_id,
                          is_member: false,
                          member_since: null,
                          created_at: new Date().toISOString(),
                          email: result.email,
                          username: result.username,
                          avatar_url: result.avatar_url,
                        });
                      }
                    }
                    return updated;
                  });
                }
              });
            }
          }}
          placeholder={t.searchPlaceholder}
          className="pl-9"
        />
      </div>

      {/* Members List */}
      <p className="text-xs text-muted-foreground">{filteredMembers.length} användare totalt • Sida {page + 1} av {Math.max(1, Math.ceil(filteredMembers.length / ITEMS_PER_PAGE))}</p>
      <div className="max-h-[500px] overflow-y-auto space-y-2">
        {filteredMembers.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">{t.noMembers}</p>
        ) : (
          filteredMembers.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE).map((member) => (
            <motion.div
              key={member.user_id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
              onClick={() => loadMemberDetails(member)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{member.username || member.user_id.slice(0, 12) + '...'}</p>
                  {member.email && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="w-3 h-3 shrink-0" /> {member.email}
                    </p>
                  )}
                  {!member.email && (
                    <p className="text-xs text-muted-foreground truncate">{member.user_id.slice(0, 8)}...</p>
                  )}
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

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                    <SelectItem value="founder">👑 Grundare</SelectItem>
                    <SelectItem value="admin">🛡️ {t.admin}</SelectItem>
                    <SelectItem value="it">💻 IT</SelectItem>
                    <SelectItem value="manager">📋 Manager</SelectItem>
                    <SelectItem value="marketing">📢 Marketing</SelectItem>
                    <SelectItem value="finance">💰 Finans</SelectItem>
                    <SelectItem value="moderator">👔 {t.employee}</SelectItem>
                    <SelectItem value="support">🎧 Support</SelectItem>
                    <SelectItem value="warehouse">📦 Lager</SelectItem>
                    <SelectItem value="affiliate">🤝 Affiliate</SelectItem>
                    <SelectItem value="donor">💚 Donator</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => { e.stopPropagation(); loadMemberDetails(member); }}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {filteredMembers.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="h-8 gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Föregående
          </Button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {Math.ceil(filteredMembers.length / ITEMS_PER_PAGE)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * ITEMS_PER_PAGE >= filteredMembers.length}
            onClick={() => setPage(p => p + 1)}
            className="h-8 gap-1"
          >
            Nästa <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

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
              <div className="p-4 bg-secondary/50 rounded-lg space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {selectedMember.avatar_url ? (
                      <img src={selectedMember.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-base">{selectedMember.username || 'Inget användarnamn'}</p>
                    {selectedMember.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> {selectedMember.email}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs font-mono text-muted-foreground break-all">{selectedMember.user_id}</p>
                <p className="text-xs text-muted-foreground">Registrerad: {formatDate(selectedMember.created_at)}</p>
                <div className="flex items-center gap-2 flex-wrap">
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
