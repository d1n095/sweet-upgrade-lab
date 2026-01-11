import { motion } from 'framer-motion';
import { AlertTriangle, Flame } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface LowStockBadgeProps {
  productId: string;
  compact?: boolean;
}

const LowStockBadge = ({ productId, compact = false }: LowStockBadgeProps) => {
  const { language } = useLanguage();

  // Simulate stock level based on product id
  const stockLevel = (productId.charCodeAt(productId.length - 1) % 10) + 1;
  const isLowStock = stockLevel <= 5;
  const isVeryLowStock = stockLevel <= 3;

  if (!isLowStock) return null;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
          isVeryLowStock 
            ? 'bg-destructive/10 text-destructive' 
            : 'bg-accent/10 text-accent'
        }`}
      >
        {isVeryLowStock ? (
          <Flame className="w-3 h-3" />
        ) : (
          <AlertTriangle className="w-3 h-3" />
        )}
        <span>
          {language === 'sv' ? `${stockLevel} kvar` : `${stockLevel} left`}
        </span>
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
          : 'bg-accent/10 text-accent border border-accent/20'
      }`}
    >
      {isVeryLowStock ? (
        <Flame className="w-4 h-4" />
      ) : (
        <AlertTriangle className="w-4 h-4" />
      )}
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
