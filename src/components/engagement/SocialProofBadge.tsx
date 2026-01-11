import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, TrendingUp, Clock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface SocialProofBadgeProps {
  productId?: string;
  showViewers?: boolean;
  showSales?: boolean;
  showLimitedTime?: boolean;
  compact?: boolean;
}

const SocialProofBadge = ({ 
  productId, 
  showViewers = true, 
  showSales = false,
  showLimitedTime = false,
  compact = false 
}: SocialProofBadgeProps) => {
  const { language } = useLanguage();
  const [currentViewers, setCurrentViewers] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Simulate random viewers (3-15) based on product id for consistency
    const baseViewers = productId 
      ? (productId.charCodeAt(productId.length - 1) % 12) + 3
      : Math.floor(Math.random() * 12) + 3;
    
    setCurrentViewers(baseViewers);
    setIsVisible(true);

    // Simulate fluctuating viewers
    const interval = setInterval(() => {
      setCurrentViewers(prev => {
        const change = Math.random() > 0.5 ? 1 : -1;
        const newValue = prev + change;
        return Math.max(2, Math.min(20, newValue));
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [productId]);

  if (!isVisible) return null;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {showViewers && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full"
          >
            <Eye className="w-3 h-3" />
            <span>{currentViewers}</span>
          </motion.div>
        )}
        {showLimitedTime && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 text-xs text-accent bg-accent/10 px-2 py-0.5 rounded-full"
          >
            <Clock className="w-3 h-3" />
            <span>{language === 'sv' ? 'Begränsat' : 'Limited'}</span>
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showViewers && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 text-sm"
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="w-4 h-4 text-primary" />
            <span>
              <span className="font-semibold text-foreground">{currentViewers}</span>
              {' '}
              {language === 'sv' ? 'tittar just nu' : 'viewing now'}
            </span>
          </div>
        </motion.div>
      )}

      {showSales && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 text-sm"
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span>
              <span className="font-semibold text-foreground">50+</span>
              {' '}
              {language === 'sv' ? 'sålda senaste veckan' : 'sold last week'}
            </span>
          </div>
        </motion.div>
      )}

      {showLimitedTime && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 text-sm"
        >
          <div className="flex items-center gap-1.5 bg-accent/10 text-accent px-3 py-1.5 rounded-full">
            <Clock className="w-4 h-4" />
            <span className="font-medium">
              {language === 'sv' ? 'Begränsat erbjudande' : 'Limited time offer'}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SocialProofBadge;
