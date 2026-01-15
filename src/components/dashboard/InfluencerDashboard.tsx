import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gift, Package, Check, Copy, Sparkles, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface InfluencerData {
  id: string;
  name: string;
  code: string;
  max_products: number;
  products_used: number;
  is_active: boolean;
  valid_until: string | null;
}

interface ReceivedProduct {
  id: string;
  product_title: string;
  received_at: string;
}

const InfluencerDashboard = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [influencerData, setInfluencerData] = useState<InfluencerData | null>(null);
  const [receivedProducts, setReceivedProducts] = useState<ReceivedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const content = {
    sv: {
      title: 'VIP Influencer Dashboard',
      yourCode: 'Din personliga kod',
      copyCode: 'Kopiera kod',
      copied: 'Kopierad!',
      productsRemaining: 'produkter kvar',
      of: 'av',
      received: 'Mottagna produkter',
      noProducts: 'Du har inte fått några produkter ännu',
      validUntil: 'Giltig till',
      noExpiry: 'Ingen utgång',
      shopNow: 'Handla nu',
      howToUse: 'Så använder du din kod',
      step1: 'Lägg till produkter i varukorgen',
      step2: 'Ange din kod i rabattfältet',
      step3: 'Välj gratis produkt',
      inactive: 'Din kod är pausad',
      expired: 'Din kod har gått ut',
    },
    en: {
      title: 'VIP Influencer Dashboard',
      yourCode: 'Your personal code',
      copyCode: 'Copy code',
      copied: 'Copied!',
      productsRemaining: 'products remaining',
      of: 'of',
      received: 'Received products',
      noProducts: "You haven't received any products yet",
      validUntil: 'Valid until',
      noExpiry: 'No expiry',
      shopNow: 'Shop now',
      howToUse: 'How to use your code',
      step1: 'Add products to your cart',
      step2: 'Enter your code in the discount field',
      step3: 'Select free product',
      inactive: 'Your code is paused',
      expired: 'Your code has expired',
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    if (user?.email) {
      loadInfluencerData();
    }
  }, [user]);

  const loadInfluencerData = async () => {
    if (!user?.email) return;
    
    try {
      // Check if user is an influencer
      const { data: influencer, error } = await supabase
        .from('influencers')
        .select('*')
        .eq('email', user.email.toLowerCase())
        .single();

      if (error || !influencer) {
        setInfluencerData(null);
        return;
      }

      setInfluencerData(influencer as unknown as InfluencerData);

      // Load received products
      const { data: products } = await supabase
        .from('influencer_products')
        .select('id, product_title, received_at')
        .eq('influencer_id', influencer.id)
        .order('received_at', { ascending: false });

      setReceivedProducts((products || []) as ReceivedProduct[]);
    } catch (error) {
      console.error('Failed to load influencer data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => {
    if (influencerData?.code) {
      navigator.clipboard.writeText(influencerData.code);
      toast.success(t.copied);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'sv' ? 'sv-SE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = influencerData?.valid_until && new Date(influencerData.valid_until) < new Date();
  const isInactive = !influencerData?.is_active;
  const productsRemaining = influencerData ? influencerData.max_products - influencerData.products_used : 0;
  const progressPercent = influencerData ? (influencerData.products_used / influencerData.max_products) * 100 : 0;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-secondary/50 rounded-xl" />
        <div className="h-24 bg-secondary/50 rounded-xl" />
      </div>
    );
  }

  if (!influencerData) {
    return null; // User is not an influencer
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">{t.title}</h2>
          <p className="text-sm text-muted-foreground">
            {language === 'sv' ? `Hej ${influencerData.name}!` : `Hello ${influencerData.name}!`}
          </p>
        </div>
      </div>

      {/* Status warnings */}
      {isExpired && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          ⚠️ {t.expired}
        </div>
      )}
      {isInactive && !isExpired && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 text-sm">
          ⏸️ {t.inactive}
        </div>
      )}

      {/* Code card */}
      <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
        <p className="text-sm text-muted-foreground mb-2">{t.yourCode}</p>
        <div className="flex items-center justify-between">
          <p className="font-mono text-2xl font-bold text-purple-600">{influencerData.code}</p>
          <Button onClick={copyCode} size="sm" variant="secondary" className="gap-2">
            <Copy className="w-4 h-4" />
            {t.copyCode}
          </Button>
        </div>
        
        {/* Progress */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>{productsRemaining} {t.productsRemaining}</span>
            <span className="text-muted-foreground">
              {influencerData.products_used} {t.of} {influencerData.max_products}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Validity */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {t.validUntil}: {influencerData.valid_until ? formatDate(influencerData.valid_until) : t.noExpiry}
        </div>
      </div>

      {/* How to use */}
      <div className="p-4 bg-card border border-border rounded-xl">
        <h3 className="font-semibold mb-3">{t.howToUse}</h3>
        <div className="space-y-2">
          {[t.step1, t.step2, t.step3].map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {index + 1}
              </div>
              <p className="text-sm">{step}</p>
            </div>
          ))}
        </div>
        <Link to="/shop">
          <Button className="w-full mt-4" disabled={isExpired || isInactive || productsRemaining <= 0}>
            <ExternalLink className="w-4 h-4 mr-2" />
            {t.shopNow}
          </Button>
        </Link>
      </div>

      {/* Received products */}
      <div className="p-4 bg-card border border-border rounded-xl">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          {t.received}
        </h3>
        {receivedProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noProducts}</p>
        ) : (
          <div className="space-y-2">
            {receivedProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium">{product.product_title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(product.received_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default InfluencerDashboard;
