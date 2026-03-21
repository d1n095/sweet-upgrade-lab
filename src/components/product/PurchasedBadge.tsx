import { Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const PurchasedBadge = () => {
  const { language } = useLanguage();

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">
      <Check className="w-3 h-3" />
      {language === 'sv' ? 'Köpt tidigare' : 'Previously purchased'}
    </span>
  );
};

export default PurchasedBadge;
