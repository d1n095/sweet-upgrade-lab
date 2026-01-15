import { motion } from 'framer-motion';
import { User, Gift, Package, TrendingUp, Heart, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

interface LoginIncentivesProps {
  onLogin: () => void;
  onContinue: () => void;
}

const LoginIncentives = ({ onLogin, onContinue }: LoginIncentivesProps) => {
  const { language } = useLanguage();

  const content = {
    sv: {
      title: 'Logga in för en bättre upplevelse',
      subtitle: 'Du kan också fortsätta som gäst',
      login: 'Logga in',
      continue: 'Fortsätt som gäst',
      benefits: [
        { icon: Package, text: 'Spåra din order i realtid' },
        { icon: Heart, text: 'Se din samhälls-påverkan' },
        { icon: Gift, text: 'Få personliga erbjudanden' },
        { icon: TrendingUp, text: 'Snabbare checkout nästa gång' },
      ],
    },
    en: {
      title: 'Log in for a better experience',
      subtitle: 'You can also continue as guest',
      login: 'Log in',
      continue: 'Continue as guest',
      benefits: [
        { icon: Package, text: 'Track your order in real-time' },
        { icon: Heart, text: 'See your community impact' },
        { icon: Gift, text: 'Get personalized offers' },
        { icon: TrendingUp, text: 'Faster checkout next time' },
      ],
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl p-5 border border-primary/10"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h4 className="font-medium">{t.title}</h4>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {t.benefits.map((benefit, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-2 text-sm"
          >
            <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
              <benefit.icon className="w-3 h-3 text-success" />
            </div>
            <span>{benefit.text}</span>
          </motion.div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={onLogin} className="flex-1">
          {t.login}
        </Button>
        <Button variant="outline" onClick={onContinue} className="flex-1">
          {t.continue}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
};

export default LoginIncentives;
