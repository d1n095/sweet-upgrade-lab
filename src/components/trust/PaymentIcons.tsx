import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { usePaymentMethodsStore } from '@/stores/paymentMethodsStore';
import { PAYMENT_ICON_MAP, GenericIcon } from './PaymentMethodIcons';

const PaymentIcons = () => {
  const { language } = useLanguage();
  const { methods, isLoaded, load } = usePaymentMethodsStore();

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  const visibleMethods = methods.filter(m => m.enabled);

  if (visibleMethods.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="w-4 h-4 text-primary" />
        <span>{language === 'sv' ? 'Säkra betalningar via' : 'Secure payments via'}</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {visibleMethods.map((payment) => {
          const Icon = PAYMENT_ICON_MAP[payment.id];
          return (
            <motion.div
              key={payment.id}
              whileHover={{ scale: 1.05 }}
              className="cursor-default"
              title={payment.name}
            >
              {Icon ? <Icon size="md" /> : <GenericIcon name={payment.name} size="md" />}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default PaymentIcons;
