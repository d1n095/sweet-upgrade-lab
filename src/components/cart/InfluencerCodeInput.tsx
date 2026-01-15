import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Loader2, Check, X, Gift, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/context/LanguageContext';
import { useInfluencerCode } from '@/hooks/useInfluencerCode';
import { useAuth } from '@/hooks/useAuth';

interface InfluencerCodeInputProps {
  onValidCode?: (influencerId: string, productsRemaining: number) => void;
  onSelectFreeProduct?: (productId: string) => void;
  cartProductIds?: string[];
}

const InfluencerCodeInput = ({ 
  onValidCode, 
  onSelectFreeProduct,
  cartProductIds = [] 
}: InfluencerCodeInputProps) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    isValidating,
    validatedInfluencer,
    receivedProducts,
    validateCode,
    clearValidation,
  } = useInfluencerCode();

  const content = {
    sv: {
      title: 'Har du en influencer-kod?',
      placeholder: 'Ange din kod',
      apply: 'Använd',
      remove: 'Ta bort',
      freeProducts: 'gratis produkter',
      remaining: 'kvar',
      alreadyReceived: 'Redan mottagen',
      selectFree: 'Välj gratis',
      loginRequired: 'Logga in för att använda koden',
      welcomeVip: 'Välkommen VIP!',
    },
    en: {
      title: 'Have an influencer code?',
      placeholder: 'Enter your code',
      apply: 'Apply',
      remove: 'Remove',
      freeProducts: 'free products',
      remaining: 'remaining',
      alreadyReceived: 'Already received',
      selectFree: 'Select free',
      loginRequired: 'Log in to use the code',
      welcomeVip: 'Welcome VIP!',
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  const handleApply = async () => {
    if (!user?.email) {
      return;
    }
    
    const result = await validateCode(code, user.email);
    if (result && onValidCode) {
      onValidCode(result.influencer_id, result.products_remaining);
    }
  };

  const handleRemove = () => {
    setCode('');
    clearValidation();
    setIsExpanded(false);
  };

  const receivedProductIds = receivedProducts.map(p => p.shopify_product_id);

  return (
    <div className="border-t border-border/50 pt-3">
      {!validatedInfluencer ? (
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Tag className="w-4 h-4" />
            <span>{t.title}</span>
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 mt-3">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder={t.placeholder}
                    className="font-mono text-sm"
                    disabled={isValidating}
                  />
                  <Button
                    onClick={handleApply}
                    disabled={!code || isValidating || !user}
                    size="sm"
                    className="px-4"
                  >
                    {isValidating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t.apply
                    )}
                  </Button>
                </div>
                {!user && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t.loginRequired}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Valid code banner */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">{t.welcomeVip}</p>
                <p className="text-xs text-muted-foreground">
                  {validatedInfluencer.products_remaining} {t.freeProducts} {t.remaining}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Available products for free */}
          {validatedInfluencer.products_remaining > 0 && cartProductIds.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Gift className="w-3 h-3" />
                {language === 'sv' ? 'Välj gratis produkt:' : 'Select free product:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {cartProductIds.map((productId) => {
                  const isReceived = receivedProductIds.includes(productId);
                  return (
                    <Badge
                      key={productId}
                      variant={isReceived ? 'secondary' : 'outline'}
                      className={`cursor-pointer transition-all ${
                        isReceived 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:bg-accent hover:border-accent'
                      }`}
                      onClick={() => {
                        if (!isReceived && onSelectFreeProduct) {
                          onSelectFreeProduct(productId);
                        }
                      }}
                    >
                      {isReceived ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          {t.alreadyReceived}
                        </>
                      ) : (
                        <>
                          <Gift className="w-3 h-3 mr-1" />
                          {t.selectFree}
                        </>
                      )}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default InfluencerCodeInput;
