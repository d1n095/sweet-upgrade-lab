import { motion } from 'framer-motion';
import { CreditCard, Shield } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const PaymentMethods = () => {
  const { language } = useLanguage();

  // SVG icons for payment methods
  const paymentIcons = [
    { name: 'Visa', color: '#1A1F71' },
    { name: 'Mastercard', color: '#EB001B' },
    { name: 'Klarna', color: '#FFB3C7' },
    { name: 'Swish', color: '#00A0DE' },
  ];

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
      <div className="flex items-center gap-3">
        {paymentIcons.map((payment) => (
          <div
            key={payment.name}
            className="w-12 h-8 rounded bg-white/10 border border-white/20 flex items-center justify-center text-xs font-bold"
            style={{ color: payment.color }}
            title={payment.name}
          >
            {payment.name.substring(0, 2)}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PaymentMethods;
