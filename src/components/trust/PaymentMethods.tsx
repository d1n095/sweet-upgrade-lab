import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const PaymentMethods = () => {
  const { language } = useLanguage();

  const paymentIcons = [
    { name: 'Visa', color: '#1A1F71' },
    { name: 'MC', color: '#EB001B' },
    { name: 'Klarna', color: '#FFB3C7' },
    { name: 'Swish', color: '#00A0DE' },
    { name: ' Pay', color: '#000000' },
    { name: 'G Pay', color: '#4285F4' },
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
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {paymentIcons.map((payment) => (
          <div
            key={payment.name}
            className="w-12 h-8 rounded bg-card border border-border flex items-center justify-center text-[9px] font-bold"
            style={{ color: payment.color }}
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
