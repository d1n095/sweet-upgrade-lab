import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Share2, DollarSign, TrendingUp, Copy, Users, CreditCard, Clock, Wallet, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface AffiliateData {
  id: string;
  name: string;
  code: string;
  commission_percent: number;
  total_earnings: number;
  pending_earnings: number;
  paid_earnings: number;
  total_orders: number;
  total_sales: number;
  is_active: boolean;
  payout_method: string;
  min_payout_amount: number;
  auto_payout: boolean;
}

interface PayoutRequest {
  id: string;
  amount: number;
  payout_type: string;
  status: string;
  created_at: string;
  processed_at: string | null;
}

const AffiliateDashboard = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payoutType, setPayoutType] = useState<'cash' | 'store_credit'>('cash');

  const content: Record<string, {
    title: string;
    yourCode: string;
    copyCode: string;
    copied: string;
    totalEarnings: string;
    pendingEarnings: string;
    paidEarnings: string;
    totalSales: string;
    totalOrders: string;
    commission: string;
    customerDiscount: string;
    shareCode: string;
    inactive: string;
    howItWorks: string;
    step1: string;
    step2: string;
    step3: string;
    withdraw: string;
    withdrawTitle: string;
    withdrawDesc: string;
    amount: string;
    payoutMethod: string;
    cash: string;
    storeCredit: string;
    storeCreditBonus: string;
    submit: string;
    success: string;
    payoutHistory: string;
    pending: string;
    approved: string;
    paid: string;
    rejected: string;
    noHistory: string;
    insufficientBalance: string;
    enterAmount: string;
  }> = {
    sv: {
      title: 'Affiliate Dashboard',
      yourCode: 'Din affiliate-kod',
      copyCode: 'Kopiera kod',
      copied: 'Kopierad!',
      totalEarnings: 'Totalt intjänat',
      pendingEarnings: 'Tillgängligt saldo',
      paidEarnings: 'Utbetalt',
      totalSales: 'Total försäljning',
      totalOrders: 'Antal ordrar',
      commission: 'Din provision',
      customerDiscount: 'Dina kunder får 10% rabatt',
      shareCode: 'Dela din kod och tjäna pengar!',
      inactive: 'Ditt konto är pausat',
      howItWorks: 'Så fungerar det',
      step1: 'Dela din unika kod med dina följare',
      step2: 'De får 10% rabatt på sitt köp',
      step3: 'Du får provision på varje order',
      withdraw: 'Ta ut pengar',
      withdrawTitle: 'Begär utbetalning',
      withdrawDesc: 'Välj belopp och utbetalningsmetod',
      amount: 'Belopp',
      payoutMethod: 'Utbetalningsmetod',
      cash: 'Kontant (Swish/Bank)',
      storeCredit: 'Butikskredit',
      storeCreditBonus: '+10% bonus som butikskredit',
      submit: 'Skicka begäran',
      success: 'Utbetalningsbegäran skickad!',
      payoutHistory: 'Utbetalningshistorik',
      pending: 'Väntar',
      approved: 'Godkänd',
      paid: 'Utbetald',
      rejected: 'Nekad',
      noHistory: 'Ingen utbetalningshistorik ännu',
      insufficientBalance: 'Otillräckligt saldo',
      enterAmount: 'Ange belopp',
    },
    en: {
      title: 'Affiliate Dashboard',
      yourCode: 'Your affiliate code',
      copyCode: 'Copy code',
      copied: 'Copied!',
      totalEarnings: 'Total earnings',
      pendingEarnings: 'Available balance',
      paidEarnings: 'Paid out',
      totalSales: 'Total sales',
      totalOrders: 'Total orders',
      commission: 'Your commission',
      customerDiscount: 'Your customers get 10% off',
      shareCode: 'Share your code and earn money!',
      inactive: 'Your account is paused',
      howItWorks: 'How it works',
      step1: 'Share your unique code with followers',
      step2: 'They get 10% off their purchase',
      step3: 'You earn commission on every order',
      withdraw: 'Withdraw',
      withdrawTitle: 'Request payout',
      withdrawDesc: 'Choose amount and payout method',
      amount: 'Amount',
      payoutMethod: 'Payout method',
      cash: 'Cash (Bank transfer)',
      storeCredit: 'Store credit',
      storeCreditBonus: '+10% bonus as store credit',
      submit: 'Submit request',
      success: 'Payout request submitted!',
      payoutHistory: 'Payout history',
      pending: 'Pending',
      approved: 'Approved',
      paid: 'Paid',
      rejected: 'Rejected',
      noHistory: 'No payout history yet',
      insufficientBalance: 'Insufficient balance',
      enterAmount: 'Enter amount',
    },
    no: {
      title: 'Affiliate Dashboard',
      yourCode: 'Din affiliate-kode',
      copyCode: 'Kopier kode',
      copied: 'Kopiert!',
      totalEarnings: 'Totalt tjent',
      pendingEarnings: 'Tilgjengelig saldo',
      paidEarnings: 'Utbetalt',
      totalSales: 'Total salg',
      totalOrders: 'Antall ordrer',
      commission: 'Din provisjon',
      customerDiscount: 'Kundene dine får 10% rabatt',
      shareCode: 'Del koden din og tjen penger!',
      inactive: 'Kontoen din er pauset',
      howItWorks: 'Slik fungerer det',
      step1: 'Del din unike kode med følgerne dine',
      step2: 'De får 10% rabatt på sitt kjøp',
      step3: 'Du får provisjon på hver ordre',
      withdraw: 'Ta ut',
      withdrawTitle: 'Be om utbetaling',
      withdrawDesc: 'Velg beløp og utbetalingsmetode',
      amount: 'Beløp',
      payoutMethod: 'Utbetalingsmetode',
      cash: 'Kontant (Bank)',
      storeCredit: 'Butikkreditt',
      storeCreditBonus: '+10% bonus som butikkreditt',
      submit: 'Send forespørsel',
      success: 'Utbetalingsforespørsel sendt!',
      payoutHistory: 'Utbetalingshistorikk',
      pending: 'Venter',
      approved: 'Godkjent',
      paid: 'Utbetalt',
      rejected: 'Avvist',
      noHistory: 'Ingen utbetalingshistorikk ennå',
      insufficientBalance: 'Utilstrekkelig saldo',
      enterAmount: 'Skriv inn beløp',
    },
    da: {
      title: 'Affiliate Dashboard',
      yourCode: 'Din affiliate-kode',
      copyCode: 'Kopier kode',
      copied: 'Kopieret!',
      totalEarnings: 'Total indtjent',
      pendingEarnings: 'Tilgængelig saldo',
      paidEarnings: 'Udbetalt',
      totalSales: 'Total salg',
      totalOrders: 'Antal ordrer',
      commission: 'Din provision',
      customerDiscount: 'Dine kunder får 10% rabat',
      shareCode: 'Del din kode og tjen penge!',
      inactive: 'Din konto er sat på pause',
      howItWorks: 'Sådan fungerer det',
      step1: 'Del din unikke kode med dine følgere',
      step2: 'De får 10% rabat på deres køb',
      step3: 'Du får provision på hver ordre',
      withdraw: 'Hæv',
      withdrawTitle: 'Anmod om udbetaling',
      withdrawDesc: 'Vælg beløb og udbetalingsmetode',
      amount: 'Beløb',
      payoutMethod: 'Udbetalingsmetode',
      cash: 'Kontant (Bank)',
      storeCredit: 'Butikskredit',
      storeCreditBonus: '+10% bonus som butikskredit',
      submit: 'Send anmodning',
      success: 'Udbetalingsanmodning sendt!',
      payoutHistory: 'Udbetalingshistorik',
      pending: 'Afventer',
      approved: 'Godkendt',
      paid: 'Udbetalt',
      rejected: 'Afvist',
      noHistory: 'Ingen udbetalingshistorik endnu',
      insufficientBalance: 'Utilstrækkelig saldo',
      enterAmount: 'Indtast beløb',
    },
    de: {
      title: 'Affiliate Dashboard',
      yourCode: 'Ihr Affiliate-Code',
      copyCode: 'Code kopieren',
      copied: 'Kopiert!',
      totalEarnings: 'Gesamteinnahmen',
      pendingEarnings: 'Verfügbares Guthaben',
      paidEarnings: 'Ausgezahlt',
      totalSales: 'Gesamtumsatz',
      totalOrders: 'Gesamtbestellungen',
      commission: 'Ihre Provision',
      customerDiscount: 'Ihre Kunden erhalten 10% Rabatt',
      shareCode: 'Teilen Sie Ihren Code und verdienen Sie!',
      inactive: 'Ihr Konto ist pausiert',
      howItWorks: 'So funktioniert es',
      step1: 'Teilen Sie Ihren einzigartigen Code',
      step2: 'Sie erhalten 10% Rabatt auf ihren Einkauf',
      step3: 'Sie verdienen Provision bei jeder Bestellung',
      withdraw: 'Abheben',
      withdrawTitle: 'Auszahlung anfordern',
      withdrawDesc: 'Betrag und Auszahlungsmethode wählen',
      amount: 'Betrag',
      payoutMethod: 'Auszahlungsmethode',
      cash: 'Bar (Banküberweisung)',
      storeCredit: 'Gutschrift',
      storeCreditBonus: '+10% Bonus als Gutschrift',
      submit: 'Anfrage senden',
      success: 'Auszahlungsanfrage gesendet!',
      payoutHistory: 'Auszahlungsverlauf',
      pending: 'Ausstehend',
      approved: 'Genehmigt',
      paid: 'Ausgezahlt',
      rejected: 'Abgelehnt',
      noHistory: 'Noch kein Auszahlungsverlauf',
      insufficientBalance: 'Unzureichendes Guthaben',
      enterAmount: 'Betrag eingeben',
    },
    fi: {
      title: 'Kumppanipaneeli',
      yourCode: 'Kumppanikoodi',
      copyCode: 'Kopioi koodi',
      copied: 'Kopioitu!',
      totalEarnings: 'Yhteensä ansaittu',
      pendingEarnings: 'Saatavilla oleva saldo',
      paidEarnings: 'Maksettu',
      totalSales: 'Kokonaismyynti',
      totalOrders: 'Tilaukset yhteensä',
      commission: 'Provisio',
      customerDiscount: 'Asiakkaasi saavat 10% alennuksen',
      shareCode: 'Jaa koodisi ja ansaitse rahaa!',
      inactive: 'Tilisi on keskeytetty',
      howItWorks: 'Näin se toimii',
      step1: 'Jaa yksilöllinen koodisi',
      step2: 'He saavat 10% alennuksen ostoksestaan',
      step3: 'Ansaitset provision jokaisesta tilauksesta',
      withdraw: 'Nosta',
      withdrawTitle: 'Pyydä maksua',
      withdrawDesc: 'Valitse summa ja maksutapa',
      amount: 'Summa',
      payoutMethod: 'Maksutapa',
      cash: 'Käteinen (pankkisiirto)',
      storeCredit: 'Myymäläkrediitti',
      storeCreditBonus: '+10% bonus myymäläkrediittinä',
      submit: 'Lähetä pyyntö',
      success: 'Maksupyyntö lähetetty!',
      payoutHistory: 'Maksuhistoria',
      pending: 'Odottaa',
      approved: 'Hyväksytty',
      paid: 'Maksettu',
      rejected: 'Hylätty',
      noHistory: 'Ei vielä maksuhistoriaa',
      insufficientBalance: 'Riittämätön saldo',
      enterAmount: 'Syötä summa',
    },
    nl: {
      title: 'Affiliate Dashboard',
      yourCode: 'Jouw affiliatecode',
      copyCode: 'Code kopiëren',
      copied: 'Gekopieerd!',
      totalEarnings: 'Totaal verdiend',
      pendingEarnings: 'Beschikbaar saldo',
      paidEarnings: 'Uitbetaald',
      totalSales: 'Totale omzet',
      totalOrders: 'Totaal bestellingen',
      commission: 'Jouw commissie',
      customerDiscount: 'Jouw klanten krijgen 10% korting',
      shareCode: 'Deel jouw code en verdien geld!',
      inactive: 'Jouw account is gepauzeerd',
      howItWorks: 'Hoe het werkt',
      step1: 'Deel jouw unieke code',
      step2: 'Ze krijgen 10% korting op hun aankoop',
      step3: 'Jij verdient commissie bij elke bestelling',
      withdraw: 'Opnemen',
      withdrawTitle: 'Uitbetaling aanvragen',
      withdrawDesc: 'Kies bedrag en uitbetalingsmethode',
      amount: 'Bedrag',
      payoutMethod: 'Uitbetalingsmethode',
      cash: 'Contant (bankoverschrijving)',
      storeCredit: 'Winkelkrediet',
      storeCreditBonus: '+10% bonus als winkelkrediet',
      submit: 'Verzoek indienen',
      success: 'Uitbetalingsverzoek ingediend!',
      payoutHistory: 'Uitbetalingsgeschiedenis',
      pending: 'In behandeling',
      approved: 'Goedgekeurd',
      paid: 'Uitbetaald',
      rejected: 'Afgewezen',
      noHistory: 'Nog geen uitbetalingsgeschiedenis',
      insufficientBalance: 'Onvoldoende saldo',
      enterAmount: 'Bedrag invoeren',
    },
    fr: {
      title: 'Tableau de bord affilié',
      yourCode: 'Votre code affilié',
      copyCode: 'Copier le code',
      copied: 'Copié !',
      totalEarnings: 'Total des gains',
      pendingEarnings: 'Solde disponible',
      paidEarnings: 'Payé',
      totalSales: 'Ventes totales',
      totalOrders: 'Commandes totales',
      commission: 'Votre commission',
      customerDiscount: 'Vos clients reçoivent 10% de réduction',
      shareCode: 'Partagez votre code et gagnez de l\'argent !',
      inactive: 'Votre compte est suspendu',
      howItWorks: 'Comment ça marche',
      step1: 'Partagez votre code unique',
      step2: 'Ils reçoivent 10% de réduction sur leur achat',
      step3: 'Vous gagnez une commission à chaque commande',
      withdraw: 'Retirer',
      withdrawTitle: 'Demander un paiement',
      withdrawDesc: 'Choisissez le montant et la méthode de paiement',
      amount: 'Montant',
      payoutMethod: 'Méthode de paiement',
      cash: 'Espèces (virement bancaire)',
      storeCredit: 'Crédit boutique',
      storeCreditBonus: '+10% bonus en crédit boutique',
      submit: 'Envoyer la demande',
      success: 'Demande de paiement envoyée !',
      payoutHistory: 'Historique des paiements',
      pending: 'En attente',
      approved: 'Approuvé',
      paid: 'Payé',
      rejected: 'Rejeté',
      noHistory: 'Pas encore d\'historique de paiement',
      insufficientBalance: 'Solde insuffisant',
      enterAmount: 'Entrez le montant',
    },
    es: {
      title: 'Panel de afiliado',
      yourCode: 'Tu código de afiliado',
      copyCode: 'Copiar código',
      copied: '¡Copiado!',
      totalEarnings: 'Total ganado',
      pendingEarnings: 'Saldo disponible',
      paidEarnings: 'Pagado',
      totalSales: 'Ventas totales',
      totalOrders: 'Pedidos totales',
      commission: 'Tu comisión',
      customerDiscount: 'Tus clientes obtienen un 10% de descuento',
      shareCode: '¡Comparte tu código y gana dinero!',
      inactive: 'Tu cuenta está pausada',
      howItWorks: 'Cómo funciona',
      step1: 'Comparte tu código único',
      step2: 'Ellos obtienen un 10% de descuento en su compra',
      step3: 'Ganas comisión en cada pedido',
      withdraw: 'Retirar',
      withdrawTitle: 'Solicitar pago',
      withdrawDesc: 'Elige el monto y el método de pago',
      amount: 'Monto',
      payoutMethod: 'Método de pago',
      cash: 'Efectivo (transferencia bancaria)',
      storeCredit: 'Crédito de tienda',
      storeCreditBonus: '+10% de bono como crédito de tienda',
      submit: 'Enviar solicitud',
      success: '¡Solicitud de pago enviada!',
      payoutHistory: 'Historial de pagos',
      pending: 'Pendiente',
      approved: 'Aprobado',
      paid: 'Pagado',
      rejected: 'Rechazado',
      noHistory: 'Sin historial de pagos aún',
      insufficientBalance: 'Saldo insuficiente',
      enterAmount: 'Introducir monto',
    },
    pl: {
      title: 'Panel partnera',
      yourCode: 'Twój kod partnerski',
      copyCode: 'Kopiuj kod',
      copied: 'Skopiowano!',
      totalEarnings: 'Łącznie zarobiono',
      pendingEarnings: 'Dostępne saldo',
      paidEarnings: 'Wypłacono',
      totalSales: 'Łączna sprzedaż',
      totalOrders: 'Łączna liczba zamówień',
      commission: 'Twoja prowizja',
      customerDiscount: 'Twoi klienci otrzymują 10% zniżki',
      shareCode: 'Podziel się kodem i zarabiaj!',
      inactive: 'Twoje konto jest zawieszone',
      howItWorks: 'Jak to działa',
      step1: 'Udostępnij swój unikalny kod',
      step2: 'Oni otrzymują 10% zniżki na zakup',
      step3: 'Zarabiasz prowizję przy każdym zamówieniu',
      withdraw: 'Wypłać',
      withdrawTitle: 'Poproś o wypłatę',
      withdrawDesc: 'Wybierz kwotę i metodę wypłaty',
      amount: 'Kwota',
      payoutMethod: 'Metoda wypłaty',
      cash: 'Gotówka (przelew bankowy)',
      storeCredit: 'Kredyt sklepowy',
      storeCreditBonus: '+10% bonus jako kredyt sklepowy',
      submit: 'Wyślij prośbę',
      success: 'Prośba o wypłatę wysłana!',
      payoutHistory: 'Historia wypłat',
      pending: 'Oczekuje',
      approved: 'Zatwierdzone',
      paid: 'Wypłacone',
      rejected: 'Odrzucone',
      noHistory: 'Brak historii wypłat',
      insufficientBalance: 'Niewystarczające saldo',
      enterAmount: 'Wprowadź kwotę',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    if (user?.email) {
      loadAffiliateData();
    }
  }, [user]);

  const loadAffiliateData = async () => {
    if (!user?.email) return;
    
    try {
      const { data: affiliate, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('email', user.email.toLowerCase())
        .single();

      if (error || !affiliate) {
        setAffiliateData(null);
        return;
      }

      setAffiliateData(affiliate as unknown as AffiliateData);

      // Load payout requests
      const { data: requests } = await supabase
        .from('affiliate_payout_requests')
        .select('*')
        .eq('affiliate_id', affiliate.id)
        .order('created_at', { ascending: false });

      setPayoutRequests((requests || []) as unknown as PayoutRequest[]);
    } catch (error) {
      console.error('Failed to load affiliate data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => {
    if (affiliateData?.code) {
      navigator.clipboard.writeText(affiliateData.code);
      toast.success(t.copied);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleWithdraw = async () => {
    if (!affiliateData) return;
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t.enterAmount);
      return;
    }
    
    if (amount > affiliateData.pending_earnings) {
      toast.error(t.insufficientBalance);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('affiliate_payout_requests')
        .insert({
          affiliate_id: affiliateData.id,
          amount: amount,
          payout_type: payoutType,
        });

      if (error) throw error;

      // Update local pending earnings
      setAffiliateData(prev => prev ? {
        ...prev,
        pending_earnings: prev.pending_earnings - amount
      } : null);

      toast.success(t.success);
      setWithdrawDialogOpen(false);
      setWithdrawAmount('');
      loadAffiliateData();
    } catch (error) {
      console.error('Failed to submit payout request:', error);
      toast.error('Error submitting request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: t.pending, color: 'bg-amber-500/10 text-amber-600' },
      approved: { label: t.approved, color: 'bg-blue-500/10 text-blue-600' },
      paid: { label: t.paid, color: 'bg-green-500/10 text-green-600' },
      rejected: { label: t.rejected, color: 'bg-red-500/10 text-red-600' },
    };
    return statusMap[status] || statusMap.pending;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-secondary/50 rounded-xl" />
        <div className="h-24 bg-secondary/50 rounded-xl" />
      </div>
    );
  }

  if (!affiliateData) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
          <Share2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">{t.title}</h2>
          <p className="text-sm text-muted-foreground">
            {language === 'sv' ? `Hej ${affiliateData.name}!` : `Hello ${affiliateData.name}!`}
          </p>
        </div>
      </div>

      {/* Status warning */}
      {!affiliateData.is_active && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 text-sm">
          ⏸️ {t.inactive}
        </div>
      )}

      {/* Code card */}
      <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20">
        <p className="text-sm text-muted-foreground mb-2">{t.yourCode}</p>
        <div className="flex items-center justify-between">
          <p className="font-mono text-2xl font-bold text-amber-600">{affiliateData.code}</p>
          <Button onClick={copyCode} size="sm" variant="secondary" className="gap-2">
            <Copy className="w-4 h-4" />
            {t.copyCode}
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {affiliateData.commission_percent}% {t.commission.toLowerCase()}
          </span>
          <span>•</span>
          <span>{t.customerDiscount}</span>
        </div>
      </div>

      {/* Balance card with withdraw button */}
      <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t.pendingEarnings}</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(affiliateData.pending_earnings)}</p>
          </div>
          <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-green-600 hover:bg-green-700">
                <Wallet className="w-4 h-4" />
                {t.withdraw}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.withdrawTitle}</DialogTitle>
                <DialogDescription>{t.withdrawDesc}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{t.amount}</label>
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="0"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      min="1"
                      max={affiliateData.pending_earnings}
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      SEK
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'sv' ? 'Max:' : 'Max:'} {formatCurrency(affiliateData.pending_earnings)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t.payoutMethod}</label>
                  <Select value={payoutType} onValueChange={(v) => setPayoutType(v as 'cash' | 'store_credit')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          {t.cash}
                        </div>
                      </SelectItem>
                      <SelectItem value="store_credit">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4" />
                          {t.storeCredit}
                          <span className="text-xs text-green-600 font-medium">{t.storeCreditBonus}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleWithdraw} 
                  className="w-full gap-2" 
                  disabled={isSubmitting || !withdrawAmount}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      {t.submit}
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">{t.totalEarnings}</span>
          </div>
          <p className="text-2xl font-bold text-primary">{formatCurrency(affiliateData.total_earnings)}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs">{t.totalOrders}</span>
          </div>
          <p className="text-2xl font-bold">{affiliateData.total_orders}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">{t.totalSales}</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(affiliateData.total_sales)}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs">{t.paidEarnings}</span>
          </div>
          <p className="text-xl font-bold text-primary">{formatCurrency(affiliateData.paid_earnings)}</p>
        </div>
      </div>

      {/* Payout History */}
      {payoutRequests.length > 0 && (
        <div className="p-4 bg-card border border-border rounded-xl">
          <h3 className="font-semibold mb-3">{t.payoutHistory}</h3>
          <div className="space-y-2">
            {payoutRequests.map((request) => {
              const statusInfo = getStatusBadge(request.status);
              return (
                <div key={request.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium">{formatCurrency(request.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(request.created_at)} • {request.payout_type === 'store_credit' ? t.storeCredit : t.cash}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="p-4 bg-card border border-border rounded-xl">
        <h3 className="font-semibold mb-3">{t.howItWorks}</h3>
        <div className="space-y-2">
          {[t.step1, t.step2, t.step3].map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center text-xs font-medium text-amber-600">
                {index + 1}
              </div>
              <p className="text-sm">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default AffiliateDashboard;