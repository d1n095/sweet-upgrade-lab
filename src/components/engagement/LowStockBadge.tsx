import { motion } from 'framer-motion';
import { AlertTriangle, Flame } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface LowStockBadgeProps {
  productId: string;
  stock?: number;
  threshold?: number;
  compact?: boolean;
}

const LowStockBadge = ({ productId, stock, threshold = 5, compact = false }: LowStockBadgeProps) => {
  const { language } = useLanguage();

  // Use real stock if provided, fallback to simulated
  const stockLevel = stock ?? ((productId.charCodeAt(productId.length - 1) % 10) + 1);
  const effectiveThreshold = threshold || 5;
  const isLowStock = stockLevel > 0 && stockLevel <= effectiveThreshold;
  const isVeryLowStock = stockLevel > 0 && stockLevel <= Math.ceil(effectiveThreshold / 2);

  if (!isLowStock) return null;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
          isVeryLowStock 
            ? 'bg-destructive/10 text-destructive' 
            : 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
        }`}
      >
        {isVeryLowStock ? <Flame className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
        <span>{language === 'sv' ? `${stockLevel} kvar` : `${stockLevel} left`}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
        isVeryLowStock 
          ? 'bg-destructive/10 text-destructive border border-destructive/20' 
          : 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800'
      }`}
    >
      {isVeryLowStock ? <Flame className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      <span className="font-medium">
        {isVeryLowStock 
          ? (language === 'sv' ? `Bara ${stockLevel} kvar! Skynda!` : `Only ${stockLevel} left! Hurry!`)
          : (language === 'sv' ? `Få kvar i lager (${stockLevel} st)` : `Low stock (${stockLevel} left)`)
        }
      </span>
    </motion.div>
  );
};

export default LowStockBadge;
