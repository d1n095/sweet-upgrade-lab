import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { usePaymentMethodsStore } from '@/stores/paymentMethodsStore';

const PaymentMethods = () => {
  const { language } = useLanguage();
  const { methods, isLoaded, load } = usePaymentMethodsStore();

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  const visibleMethods = methods.filter(m => m.enabled);

  const colorMap: Record<string, string> = {
    visa: '#1A1F71',
    mastercard: '#EB001B',
    klarna: '#FFB3C7',
    swish: '#00A0DE',
    applepay: '#000000',
    googlepay: '#4285F4',
    paypal: '#003087',
  };

  if (visibleMethods.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="w-4 h-4 text-primary" />
        <span>{language === 'sv' ? 'Säkra betalningar med' : 'Secure payments with'}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {visibleMethods.map((payment) => (
          <div
            key={payment.id}
            className="w-12 h-8 rounded bg-card border border-border flex items-center justify-center text-[9px] font-bold"
            style={{ color: colorMap[payment.id] || '#374151' }}
            title={payment.name}
          >
            {payment.name}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PaymentMethods;
