import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Check, X, Clock, Loader2, 
  Mail, Instagram, Youtube, MessageSquare, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface Application {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  social_media: string;
  followers_count: string;
  platform: string;
  why_join: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
}

const AdminApplicationsManager = () => {
  const { language } = useLanguage();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [commissionPercent, setCommissionPercent] = useState('10');
  const [adminNotes, setAdminNotes] = useState('');

  const content = {
    sv: {
      title: 'Affiliate-ansökningar',
      subtitle: 'Granska och godkänn nya affiliates',
      noApplications: 'Inga väntande ansökningar',
      pending: 'Väntar',
      approved: 'Godkänd',
      rejected: 'Nekad',
      approve: 'Godkänn',
      reject: 'Neka',
      refresh: 'Uppdatera',
      processTitle: 'Hantera ansökan',
      commission: 'Provision %',
      notes: 'Anteckningar',
      followers: 'Följare',
      platform: 'Plattform',
      reason: 'Motivering',
      success: 'Uppdaterad!',
      affiliateCreated: 'Affiliate skapad!',
    },
    en: {
      title: 'Affiliate Applications',
      subtitle: 'Review and approve new affiliates',
      noApplications: 'No pending applications',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      approve: 'Approve',
      reject: 'Reject',
      refresh: 'Refresh',
      processTitle: 'Process application',
      commission: 'Commission %',
      notes: 'Notes',
      followers: 'Followers',
      platform: 'Platform',
      reason: 'Reason',
      success: 'Updated!',
      affiliateCreated: 'Affiliate created!',
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliate_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications((data || []) as Application[]);
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateCode = (name: string) => {
    const cleanName = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `AMB${cleanName}${random}`;
  };

  const approveApplication = async () => {
    if (!selectedApp) return;
    
    setProcessingId(selectedApp.id);
    try {
      // Create affiliate
      const code = generateCode(selectedApp.name);
      
      const { error: affiliateError } = await supabase
        .from('affiliates')
        .insert({
          name: selectedApp.name,
          email: selectedApp.email.toLowerCase(),
          code,
          commission_percent: parseFloat(commissionPercent),
          notes: adminNotes || null,
        });

      if (affiliateError) throw affiliateError;

      // Update application status
      const { error: appError } = await supabase
        .from('affiliate_applications')
        .update({
          status: 'approved',
          admin_notes: adminNotes || null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', selectedApp.id);

      if (appError) throw appError;

      // Send welcome email
      try {
        await supabase.functions.invoke('notify-affiliate', {
          body: {
            email: selectedApp.email,
            name: selectedApp.name,
            code,
            commissionPercent: parseFloat(commissionPercent),
          }
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }

      toast.success(t.affiliateCreated);
      setSelectedApp(null);
      setAdminNotes('');
      setCommissionPercent('10');
      loadApplications();
    } catch (error) {
      console.error('Failed to approve application:', error);
      toast.error('Error approving application');
    } finally {
      setProcessingId(null);
    }
  };

  const rejectApplication = async () => {
    if (!selectedApp) return;
    
    setProcessingId(selectedApp.id);
    try {
      const { error } = await supabase
        .from('affiliate_applications')
        .update({
          status: 'rejected',
          admin_notes: adminNotes || null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', selectedApp.id);

      if (error) throw error;

      toast.success(t.success);
      setSelectedApp(null);
      setAdminNotes('');
      loadApplications();
    } catch (error) {
      console.error('Failed to reject application:', error);
      toast.error('Error rejecting application');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: t.pending, color: 'bg-amber-500/10 text-amber-600' },
      approved: { label: t.approved, color: 'bg-green-500/10 text-green-600' },
      rejected: { label: t.rejected, color: 'bg-red-500/10 text-red-600' },
    };
    return statusMap[status] || statusMap.pending;
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, React.ElementType> = {
      instagram: Instagram,
      youtube: Youtube,
      tiktok: MessageSquare,
      facebook: Users,
    };
    return icons[platform] || MessageSquare;
  };

  const pendingCount = applications.filter(a => a.status === 'pending').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="bg-amber-500/10 text-amber-600">
              {pendingCount} {t.pending.toLowerCase()}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={loadApplications} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {t.refresh}
          </Button>
        </div>
      </div>

      {/* Applications list */}
      {applications.length === 0 ? (
        <div className="text-center py-12 bg-secondary/30 rounded-xl">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">{t.noApplications}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const statusInfo = getStatusBadge(app.status);
            const PlatformIcon = getPlatformIcon(app.platform);

            return (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
                      {app.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{app.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {app.email}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <PlatformIcon className="w-3 h-3" />
                          {app.platform}
                        </span>
                        <span>{app.followers_count} {t.followers.toLowerCase()}</span>
                        <span>{formatDate(app.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {app.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setSelectedApp(app)}
                        className="gap-1 bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4" />
                        {t.approve}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedApp(app);
                          setAdminNotes('reject');
                        }}
                        className="gap-1 text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                        {t.reject}
                      </Button>
                    </div>
                  )}
                </div>

                {app.why_join && (
                  <div className="mt-3 p-3 bg-secondary/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">{t.reason}:</p>
                    <p className="text-sm">{app.why_join}</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Approve/Reject Dialog */}
      <Dialog open={!!selectedApp} onOpenChange={() => {
        setSelectedApp(null);
        setAdminNotes('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.processTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-4 bg-secondary/50 rounded-lg">
              <p className="font-semibold text-lg">{selectedApp?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedApp?.email}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>{selectedApp?.platform}</span>
                <span>•</span>
                <span>{selectedApp?.followers_count} {t.followers.toLowerCase()}</span>
              </div>
            </div>

            {adminNotes !== 'reject' && (
              <div className="space-y-2">
                <Label>{t.commission}</Label>
                <Input
                  type="number"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(e.target.value)}
                  min="5"
                  max="15"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t.notes}</Label>
              <Textarea
                value={adminNotes === 'reject' ? '' : adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder={language === 'sv' ? 'Valfritt...' : 'Optional...'}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              {adminNotes !== 'reject' ? (
                <Button
                  onClick={approveApplication}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={processingId === selectedApp?.id}
                >
                  {processingId === selectedApp?.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {t.approve}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={rejectApplication}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={processingId === selectedApp?.id}
                >
                  {processingId === selectedApp?.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      {t.reject}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminApplicationsManager;