import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { usePaymentMethodsStore } from '@/stores/paymentMethodsStore';
import { PAYMENT_ICON_MAP, GenericIcon } from './PaymentMethodIcons';

const PaymentMethods = () => {
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
      className="flex flex-col items-center gap-3 mt-2"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="w-3.5 h-3.5 text-primary" />
        <span>{language === 'sv' ? 'Säkra betalningar med' : 'Secure payments with'}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {visibleMethods.map((payment) => {
          const Icon = PAYMENT_ICON_MAP[payment.id];
          return (
            <div key={payment.id} title={payment.name} className="cursor-default">
              {Icon ? <Icon size="sm" /> : <GenericIcon name={payment.name} size="sm" />}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default PaymentMethods;
