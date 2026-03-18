import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Search, Shield, UserCheck, Briefcase, 
  Loader2, ChevronDown, ChevronUp, Package, Star,
  Eye, X, Mail, ExternalLink, ChevronLeft, ChevronRight, Phone,
  Award, TrendingUp, Hash, Link2, Calendar, Heart, ShoppingBag, Pencil, Check
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useFounderRole } from '@/hooks/useFounderRole';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Member {
  user_id: string;
  is_member: boolean;
  member_since: string | null;
  created_at: string;
  email?: string;
  username?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  xp?: number;
  level?: number;
  trust_score?: number;
  referral_code?: string | null;
}

import type { RoleFilter } from '@/pages/admin/AdminMembers';

interface RoleStats {
  total: number;
  members: number;
  businesses: number;
  founders: number;
  admins: number;
  moderators: number;
  support: number;
  warehouse: number;
}

interface AdminMemberManagerProps {
  roleFilter?: RoleFilter;
  onStatsUpdate?: (stats: RoleStats) => void;
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

const AdminMemberManager = ({ roleFilter = 'all', onStatsUpdate }: AdminMemberManagerProps) => {
  const { language } = useLanguage();
  const { isFounder } = useFounderRole();
  const { user } = useAuth();
  const currentUserId = user?.id;
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
  const [lastRoleChangeTime, setLastRoleChangeTime] = useState(0);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

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

  // Reset page when filter changes
  useEffect(() => {
    setPage(0);
  }, [roleFilter]);

  const loadMembers = useCallback(async () => {
    try {
      // Load profiles and emails+roles in parallel
      const [profilesRes, rolesRes, emailsRes, businessRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, is_member, member_since, created_at, username, avatar_url, xp, level, trust_score, referral_code')
          .order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
        // Fetch all users with emails via RPC (empty query = all)
        supabase.rpc('admin_search_users', { p_query: '' }),
        supabase.from('business_accounts').select('*', { count: 'exact', head: true }),
      ]);

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];
      const emails = (emailsRes.data || []) as any[];

      // Build email/phone map
      const emailMap: Record<string, { email: string; phone: string | null; user_created_at: string | null }> = {};
      for (const e of emails) {
        emailMap[e.user_id] = { email: e.email, phone: e.phone, user_created_at: e.user_created_at };
      }

      // Merge emails into profiles
      const membersList: Member[] = profiles.map(p => ({
        ...p,
        email: emailMap[p.user_id]?.email || null,
        phone: emailMap[p.user_id]?.phone || null,
      }));
      setMembers(membersList);

      // Build roles map
      const rolesMap: Record<string, string> = {};
      roles.forEach((r) => { rolesMap[r.user_id] = r.role; });
      setUserRoles(rolesMap);

      // Compute stats from the SAME data
      const roleCounts: Record<string, number> = {};
      roles.forEach(r => { roleCounts[r.role] = (roleCounts[r.role] || 0) + 1; });

      onStatsUpdate?.({
        total: membersList.length,
        members: membersList.filter(m => m.is_member).length,
        businesses: businessRes.count || 0,
        founders: roleCounts['founder'] || 0,
        admins: (roleCounts['admin'] || 0) + (roleCounts['it'] || 0) + (roleCounts['founder'] || 0),
        moderators: roleCounts['moderator'] || 0,
        support: roleCounts['support'] || 0,
        warehouse: roleCounts['warehouse'] || 0,
      });
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onStatsUpdate]);

  const loadMemberDetails = async (member: Member) => {
    setLoadingDetails(true);
    setSelectedMember(member);
    setIsDialogOpen(true);

    try {
      const [ordersRes, reviewsRes, emailRes] = await Promise.all([
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
        // Fetch email if not already loaded
        !member.email
          ? supabase.rpc('admin_search_users', { p_query: member.username || member.user_id.slice(0, 8) })
          : Promise.resolve({ data: null }),
      ]);

      // Update member with email if found
      if (emailRes.data) {
        const match = (emailRes.data as any[]).find((u: any) => u.user_id === member.user_id);
        if (match) {
          const updated = { ...member, email: match.email, username: match.username || member.username, phone: match.phone || null };
          setSelectedMember(updated);
          setMembers(prev => prev.map(m => m.user_id === member.user_id ? updated : m));
        }
      }

      setMemberOrders(ordersRes.data || []);
      setMemberReviews(reviewsRes.data || []);
    } catch (error) {
      console.error('Failed to load member details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Pending role change confirmation state
  const [pendingRoleChange, setPendingRoleChange] = useState<{ userId: string; role: string; username: string | null } | null>(null);

  const requestRoleChange = (userId: string, role: string) => {
    // Security: prevent self-role changes
    if (userId === currentUserId) {
      toast.error('Du kan inte ändra din egen roll');
      return;
    }
    // Security: prevent changing a founder's role (unless you're a founder)
    const currentRole = userRoles[userId];
    if (currentRole === 'founder' && !isFounder) {
      toast.error('Bara grundare kan ändra en grundar-roll');
      return;
    }
    // Security: prevent assigning founder role (unless you're a founder)
    if (role === 'founder' && !isFounder) {
      toast.error('Bara grundare kan tilldela grundar-rollen');
      return;
    }
    const member = members.find(m => m.user_id === userId);
    setPendingRoleChange({ userId, role, username: member?.username || member?.email || userId.slice(0, 8) });
  };

  const confirmRoleChange = async () => {
    if (!pendingRoleChange) return;
    const { userId, role } = pendingRoleChange;
    setPendingRoleChange(null);
    setAssigningRole(true);
    try {
      if (role === 'none') {
        await supabase.from('user_roles').delete().eq('user_id', userId);
        toast.success(t.roleRemoved);
        setUserRoles((prev) => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
      } else {
        const validRole = role as AppRole;
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

  const handleSaveUsername = async () => {
    if (!selectedMember || !newUsername.trim()) return;
    const trimmed = newUsername.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      toast.error('Användarnamn måste vara 2–30 tecken');
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: trimmed })
        .eq('user_id', selectedMember.user_id);
      if (error) throw error;
      toast.success('Användarnamn uppdaterat');
      const updated = { ...selectedMember, username: trimmed };
      setSelectedMember(updated);
      setMembers(prev => prev.map(m => m.user_id === selectedMember.user_id ? { ...m, username: trimmed } : m));
      setEditingUsername(false);
    } catch (error) {
      console.error('Failed to update username:', error);
      toast.error('Kunde inte uppdatera användarnamnet');
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
    // Role filter
    if (roleFilter === 'members' && !member.is_member) return false;
    if (roleFilter === 'founder' && userRoles[member.user_id] !== 'founder') return false;
    if (roleFilter === 'admin_level' && !['admin', 'it', 'founder'].includes(userRoles[member.user_id] || '')) return false;
    if (roleFilter === 'moderator' && userRoles[member.user_id] !== 'moderator') return false;
    if (roleFilter === 'support' && userRoles[member.user_id] !== 'support') return false;
    if (roleFilter === 'warehouse' && userRoles[member.user_id] !== 'warehouse') return false;

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
                        updated[idx] = { ...updated[idx], email: result.email, username: result.username || updated[idx].username, phone: result.phone || null };
                      } else {
                        updated.push({
                          user_id: result.user_id,
                          is_member: false,
                          member_since: null,
                          created_at: result.user_created_at || new Date().toISOString(),
                          email: result.email,
                          username: result.username,
                          avatar_url: result.avatar_url,
                          phone: result.phone || null,
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
                  <p className="font-medium text-sm truncate flex items-center gap-1.5">
                    {member.username || member.user_id.slice(0, 12) + '...'}
                    {member.user_id === currentUserId && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">du</span>
                    )}
                  </p>
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
                  onValueChange={(value) => requestRoleChange(member.user_id, value)}
                  disabled={
                    assigningRole ||
                    member.user_id === currentUserId ||
                    (userRoles[member.user_id] === 'founder' && !isFounder)
                  }
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue placeholder={t.assignRole} />
                  </SelectTrigger>
                   <SelectContent>
                    <SelectItem value="none">{t.noRole}</SelectItem>
                    {isFounder && <SelectItem value="founder">👑 Grundare</SelectItem>}
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
              <div className="p-4 bg-secondary/50 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {selectedMember.avatar_url ? (
                      <img src={selectedMember.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <Users className="w-7 h-7 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {editingUsername ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          className="h-8 text-sm w-40"
                          maxLength={30}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveUsername();
                            if (e.key === 'Escape') setEditingUsername(false);
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveUsername}>
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingUsername(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="font-semibold text-base flex items-center gap-2">
                        {selectedMember.username || 'Inget användarnamn'}
                        {isFounder && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => { setNewUsername(selectedMember.username || ''); setEditingUsername(true); }}
                            title="Ändra användarnamn"
                          >
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {selectedMember.is_member && (
                        <Badge variant="outline" className="text-xs">
                          <UserCheck className="w-3 h-3 mr-1" /> Medlem
                        </Badge>
                      )}
                      {userRoles[selectedMember.user_id] && (
                        <Badge className={getRoleBadgeColor(userRoles[selectedMember.user_id])}>
                          <Shield className="w-3 h-3 mr-1" />
                          {userRoles[selectedMember.user_id]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid gap-1.5 pt-2 border-t border-border">
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kontaktuppgifter</h5>
                  {selectedMember.email && (
                    <p className="text-sm flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> {selectedMember.email}
                    </p>
                  )}
                  {selectedMember.phone && (
                    <p className="text-sm flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> {selectedMember.phone}
                    </p>
                  )}
                  {!selectedMember.email && !selectedMember.phone && (
                    <p className="text-xs text-muted-foreground italic">Ingen kontaktinfo tillgänglig</p>
                  )}
                </div>

                {/* Account Details */}
                <div className="grid gap-1.5 pt-2 border-t border-border">
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kontoinformation</h5>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">Registrerad:</span>
                      <span className="font-medium">{formatDate(selectedMember.created_at)}</span>
                    </div>
                    {selectedMember.member_since && (
                      <div className="flex items-center gap-2 text-sm">
                        <UserCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Medlem sedan:</span>
                        <span className="font-medium">{formatDate(selectedMember.member_since)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground break-all mt-1">
                    <Hash className="w-3 h-3 inline mr-1" />ID: {selectedMember.user_id}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                  <div className="text-center p-2 bg-background rounded-lg">
                    <p className="text-lg font-bold">{selectedMember.level ?? 1}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                      <Award className="w-3 h-3" /> Nivå
                    </p>
                  </div>
                  <div className="text-center p-2 bg-background rounded-lg">
                    <p className="text-lg font-bold">{selectedMember.xp ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3" /> XP
                    </p>
                  </div>
                  <div className="text-center p-2 bg-background rounded-lg">
                    <p className="text-lg font-bold">{selectedMember.trust_score ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3" /> Trust
                    </p>
                  </div>
                </div>

                {selectedMember.referral_code && (
                  <div className="flex items-center gap-2 text-sm pt-1">
                    <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Referral-kod:</span>
                    <code className="text-xs bg-background px-2 py-0.5 rounded font-mono">{selectedMember.referral_code}</code>
                  </div>
                )}
              </div>

              {/* Orders */}
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {t.orderHistory} ({memberOrders.length})
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

      {/* Role change confirmation dialog */}
      <AlertDialog open={!!pendingRoleChange} onOpenChange={(open) => !open && setPendingRoleChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bekräfta rolländring</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRoleChange?.role === 'none'
                ? `Är du säker på att du vill ta bort rollen för "${pendingRoleChange?.username}"?`
                : `Är du säker på att du vill tilldela rollen "${pendingRoleChange?.role}" till "${pendingRoleChange?.username}"?`}
              {' '}Denna åtgärd ändrar användarens behörigheter omedelbart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              Ja, ändra roll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminMemberManager;
