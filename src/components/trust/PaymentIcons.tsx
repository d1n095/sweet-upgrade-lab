import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// SVG Payment Icons
const VisaIcon = () => (
  <svg viewBox="0 0 50 35" className="w-10 h-7">
    <rect width="50" height="35" rx="4" fill="#1A1F71"/>
    <text x="25" y="22" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial">VISA</text>
  </svg>
);

const MastercardIcon = () => (
  <svg viewBox="0 0 50 35" className="w-10 h-7">
    <rect width="50" height="35" rx="4" fill="#F7F7F7"/>
    <circle cx="20" cy="17.5" r="10" fill="#EB001B"/>
    <circle cx="30" cy="17.5" r="10" fill="#F79E1B"/>
    <path d="M25 9.5a10 10 0 000 16" fill="#FF5F00"/>
  </svg>
);

const KlarnaIcon = () => (
  <svg viewBox="0 0 50 35" className="w-10 h-7">
    <rect width="50" height="35" rx="4" fill="#FFB3C7"/>
    <text x="25" y="22" textAnchor="middle" fill="#0A0B09" fontSize="10" fontWeight="bold" fontFamily="Arial">Klarna</text>
  </svg>
);

const SwishIcon = () => (
  <svg viewBox="0 0 50 35" className="w-10 h-7">
    <rect width="50" height="35" rx="4" fill="#FFFFFF"/>
    <rect x="1" y="1" width="48" height="33" rx="3" stroke="#E5E5E5" strokeWidth="1" fill="none"/>
    <path d="M15 12c8-4 12 10 20 6" stroke="#00A0DE" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M15 18c8-4 12 10 20 6" stroke="#F7CE46" strokeWidth="3" fill="none" strokeLinecap="round"/>
  </svg>
);

const PayPalIcon = () => (
  <svg viewBox="0 0 50 35" className="w-10 h-7">
    <rect width="50" height="35" rx="4" fill="#FFFFFF"/>
    <rect x="1" y="1" width="48" height="33" rx="3" stroke="#E5E5E5" strokeWidth="1" fill="none"/>
    <text x="25" y="20" textAnchor="middle" fill="#003087" fontSize="9" fontWeight="bold" fontFamily="Arial">Pay</text>
    <text x="25" y="28" textAnchor="middle" fill="#009CDE" fontSize="9" fontWeight="bold" fontFamily="Arial">Pal</text>
  </svg>
);

const ApplePayIcon = () => (
  <svg viewBox="0 0 50 35" className="w-10 h-7">
    <rect width="50" height="35" rx="4" fill="#000000"/>
    <text x="25" y="22" textAnchor="middle" fill="white" fontSize="9" fontWeight="500" fontFamily="system-ui">Pay</text>
  </svg>
);

const GooglePayIcon = () => (
  <svg viewBox="0 0 50 35" className="w-10 h-7">
    <rect width="50" height="35" rx="4" fill="#FFFFFF"/>
    <rect x="1" y="1" width="48" height="33" rx="3" stroke="#E5E5E5" strokeWidth="1" fill="none"/>
    <circle cx="16" cy="17.5" r="5" fill="#4285F4"/>
    <circle cx="24" cy="17.5" r="5" fill="#EA4335"/>
    <circle cx="32" cy="17.5" r="5" fill="#FBBC05"/>
    <circle cx="40" cy="17.5" r="3" fill="#34A853"/>
  </svg>
);

const paymentMethods = [
  { id: 'visa', Icon: VisaIcon, name: 'Visa' },
  { id: 'mastercard', Icon: MastercardIcon, name: 'Mastercard' },
  { id: 'klarna', Icon: KlarnaIcon, name: 'Klarna' },
  { id: 'swish', Icon: SwishIcon, name: 'Swish' },
  { id: 'paypal', Icon: PayPalIcon, name: 'PayPal' },
  { id: 'applepay', Icon: ApplePayIcon, name: 'Apple Pay' },
  { id: 'googlepay', Icon: GooglePayIcon, name: 'Google Pay' },
];

const PaymentIcons = () => {
  const { language } = useLanguage();

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
        {paymentMethods.map((payment) => (
          <motion.div
            key={payment.id}
            whileHover={{ scale: 1.05 }}
            className="cursor-default"
            title={payment.name}
          >
            <payment.Icon />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default PaymentIcons;
