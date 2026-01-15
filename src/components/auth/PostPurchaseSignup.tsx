import { motion } from 'framer-motion';
import { Heart, Gift, Package, User, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

interface PostPurchaseSignupProps {
  donationAmount?: number;
  onCreateAccount: () => void;
  onSkip: () => void;
}

const PostPurchaseSignup = ({ donationAmount = 0, onCreateAccount, onSkip }: PostPurchaseSignupProps) => {
  const { language } = useLanguage();

  const content = {
    sv: {
      title: 'Grattis till ditt köp!',
      donationMessage: 'Du har bidragit till samhället med',
      createAccount: 'Skapa konto för att:',
      benefits: [
        'Följa din order live',
        'Se din samhälls-påverkan växa',
        'Få exklusiva erbjudanden',
        'Spara favoriter och historik',
      ],
      cta: 'Skapa konto',
      skip: 'Nej tack',
    },
    en: {
      title: 'Congratulations on your purchase!',
      donationMessage: 'You contributed to the community with',
      createAccount: 'Create an account to:',
      benefits: [
        'Track your order live',
        'See your community impact grow',
        'Get exclusive offers',
        'Save favorites and history',
      ],
      cta: 'Create account',
      skip: 'No thanks',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card border border-border rounded-2xl p-6 max-w-md mx-auto text-center"
    >
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
        <Heart className="w-8 h-8 text-success" />
      </div>

      <h2 className="font-display text-2xl font-bold mb-2">{t.title}</h2>

      {donationAmount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-success/10 rounded-lg p-3 mb-4"
        >
          <p className="text-sm text-muted-foreground">{t.donationMessage}</p>
          <p className="text-2xl font-bold text-success">{formatPrice(donationAmount)}</p>
        </motion.div>
      )}

      <div className="text-left mb-6">
        <p className="font-medium mb-3">{t.createAccount}</p>
        <ul className="space-y-2">
          {t.benefits.map((benefit, index) => (
            <motion.li
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="flex items-center gap-2 text-sm"
            >
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Gift className="w-3 h-3 text-primary" />
              </div>
              {benefit}
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <Button onClick={onCreateAccount} className="w-full">
          <User className="w-4 h-4 mr-2" />
          {t.cta}
        </Button>
        <Button variant="ghost" onClick={onSkip} className="w-full text-muted-foreground">
          {t.skip}
        </Button>
      </div>
    </motion.div>
  );
};

export default PostPurchaseSignup;
