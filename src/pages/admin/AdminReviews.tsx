import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, Star, Check, X, MessageCircle, 
  BarChart3, Users, Clock, TrendingUp, 
  Send, Loader2, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ReviewStars from '@/components/reviews/ReviewStars';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface Review {
  id: string;
  user_id: string;
  shopify_product_id: string;
  shopify_product_handle: string;
  product_title: string;
  rating: number;
  comment: string;
  is_verified_purchase: boolean;
  is_approved: boolean;
  is_rejected?: boolean;
  admin_response: string | null;
  created_at: string;
}

interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  averageRating: number;
}

const AdminReviews = () => {
  const { language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminRole();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({ total: 0, pending: 0, approved: 0, rejected: 0, averageRating: 0 });
  const [rejectedReviews, setRejectedReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const content = {
    sv: {
      title: 'Recensionshantering',
      subtitle: 'Granska, godkänn och svara på kundrecensioner',
      tabs: {
        pending: 'Väntande',
        approved: 'Godkända',
        rejected: 'Nekade',
        all: 'Alla'
      },
      stats: {
        total: 'Totalt',
        pending: 'Väntande',
        approved: 'Godkända',
        avgRating: 'Snittbetyg'
      },
      actions: {
        approve: 'Godkänn',
        reject: 'Neka',
        respond: 'Svara',
        sendResponse: 'Skicka svar',
        cancel: 'Avbryt'
      },
      noReviews: 'Inga recensioner att visa',
      verified: 'Verifierad köpare',
      responseLabel: 'Ditt svar till kunden',
      responsePlaceholder: 'Skriv ett svar på recensionen...',
      accessDenied: 'Åtkomst nekad',
      accessDeniedDesc: 'Du har inte behörighet att visa denna sida.',
      loginRequired: 'Du måste vara inloggad som admin för att se denna sida.',
      backToHome: 'Tillbaka till startsidan'
    },
    en: {
      title: 'Review Management',
      subtitle: 'Review, approve and respond to customer reviews',
      tabs: {
        pending: 'Pending',
        approved: 'Approved',
        rejected: 'Rejected',
        all: 'All'
      },
      stats: {
        total: 'Total',
        pending: 'Pending',
        approved: 'Approved',
        avgRating: 'Avg rating'
      },
      actions: {
        approve: 'Approve',
        reject: 'Reject',
        respond: 'Respond',
        sendResponse: 'Send response',
        cancel: 'Cancel'
      },
      noReviews: 'No reviews to display',
      verified: 'Verified buyer',
      responseLabel: 'Your response to the customer',
      responsePlaceholder: 'Write a response to the review...',
      accessDenied: 'Access Denied',
      accessDeniedDesc: 'You do not have permission to view this page.',
      loginRequired: 'You must be logged in as admin to view this page.',
      backToHome: 'Back to home'
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    if (isAdmin) {
      loadReviews();
      loadStats();
    }
  }, [isAdmin, activeTab]);

  const loadReviews = async () => {
    try {
      let query = supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeTab === 'pending') {
        query = query.eq('is_approved', false);
      } else if (activeTab === 'approved') {
        query = query.eq('is_approved', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Failed to load reviews:', error);
      toast.error('Kunde inte ladda recensioner');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: allReviews, error } = await supabase
        .from('reviews')
        .select('rating, is_approved');

      if (error) throw error;

      if (allReviews) {
        const total = allReviews.length;
        const pending = allReviews.filter(r => !r.is_approved).length;
        const approved = allReviews.filter(r => r.is_approved).length;
        const rejected = 0; // We don't have a rejected flag, deleted = rejected
        const avgRating = total > 0 
          ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10
          : 0;

        setStats({ total, pending, approved, rejected, averageRating: avgRating });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleApprove = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ is_approved: true })
        .eq('id', reviewId);

      if (error) throw error;
      
      toast.success('Recension godkänd!');
      loadReviews();
      loadStats();
    } catch (error) {
      console.error('Failed to approve review:', error);
      toast.error('Kunde inte godkänna recensionen');
    }
  };

  const handleReject = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) throw error;
      
      toast.success('Recension borttagen');
      loadReviews();
      loadStats();
    } catch (error) {
      console.error('Failed to delete review:', error);
      toast.error('Kunde inte ta bort recensionen');
    }
  };

  const handleRespond = async (reviewId: string) => {
    if (!response.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ 
          admin_response: response.trim(),
          admin_response_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) throw error;
      
      toast.success('Svar skickat!');
      setRespondingTo(null);
      setResponse('');
      loadReviews();
    } catch (error) {
      console.error('Failed to respond:', error);
      toast.error('Kunde inte skicka svar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Loading state
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  // Access denied
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-20">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto text-center"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold mb-4">{t.accessDenied}</h1>
              <p className="text-muted-foreground mb-8">
                {!user ? t.loginRequired : t.accessDeniedDesc}
              </p>
              <Link to="/">
                <Button>{t.backToHome}</Button>
              </Link>
            </motion.div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-semibold">{t.title}</h1>
                <p className="text-muted-foreground">{t.subtitle}</p>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">{t.stats.total}</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{t.stats.pending}</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Check className="w-4 h-4" />
                <span className="text-sm">{t.stats.approved}</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">{t.stats.avgRating}</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{stats.averageRating}</p>
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="w-4 h-4" />
                {t.tabs.pending}
                {stats.pending > 0 && (
                  <Badge variant="secondary" className="ml-1">{stats.pending}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="gap-2">
                <Check className="w-4 h-4" />
                {t.tabs.approved}
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-2">
                <Users className="w-4 h-4" />
                {t.tabs.all}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{t.noReviews}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <motion.div
                      key={review.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-border rounded-xl p-5"
                    >
                      {/* Review header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{review.product_title}</span>
                            {review.is_verified_purchase && (
                              <Badge variant="outline" className="text-xs">
                                {t.verified}
                              </Badge>
                            )}
                            {review.is_approved ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                {language === 'sv' ? 'Godkänd' : 'Approved'}
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {language === 'sv' ? 'Väntande' : 'Pending'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(review.created_at)}
                          </p>
                        </div>
                        <ReviewStars rating={review.rating} size="sm" />
                      </div>

                      {/* Review content */}
                      <p className="text-foreground/90 mb-4">{review.comment}</p>

                      {/* Admin response */}
                      {review.admin_response && (
                        <div className="bg-primary/5 rounded-lg p-3 mb-4">
                          <p className="text-sm font-medium text-primary mb-1">
                            {language === 'sv' ? 'Ditt svar:' : 'Your response:'}
                          </p>
                          <p className="text-sm text-muted-foreground">{review.admin_response}</p>
                        </div>
                      )}

                      {/* Response form */}
                      {respondingTo === review.id && (
                        <div className="bg-secondary/50 rounded-lg p-4 mb-4">
                          <label className="block text-sm font-medium mb-2">
                            {t.responseLabel}
                          </label>
                          <Textarea
                            value={response}
                            onChange={(e) => setResponse(e.target.value)}
                            placeholder={t.responsePlaceholder}
                            rows={3}
                            className="mb-3"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleRespond(review.id)}
                              disabled={isSubmitting || !response.trim()}
                            >
                              {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Send className="w-4 h-4 mr-1" />
                                  {t.actions.sendResponse}
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRespondingTo(null);
                                setResponse('');
                              }}
                            >
                              {t.actions.cancel}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {!review.is_approved && (
                          <Button
                            size="sm"
                            onClick={() => handleApprove(review.id)}
                            className="gap-1"
                          >
                            <Check className="w-4 h-4" />
                            {t.actions.approve}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRespondingTo(review.id);
                            setResponse(review.admin_response || '');
                          }}
                          className="gap-1"
                        >
                          <MessageCircle className="w-4 h-4" />
                          {t.actions.respond}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReject(review.id)}
                          className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="w-4 h-4" />
                          {t.actions.reject}
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminReviews;
