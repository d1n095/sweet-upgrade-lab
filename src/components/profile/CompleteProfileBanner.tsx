import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStoreSettings } from '@/stores/storeSettingsStore';

const CompleteProfileBanner = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { requirePhone, requireAddress } = useStoreSettings();
  const [isIncomplete, setIsIncomplete] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setIsIncomplete(false);
      return;
    }

    const check = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, address, zip, city')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!data) return;

      const missing: string[] = [];
      const d = data as any;
      if (!d.first_name) missing.push(language === 'sv' ? 'förnamn' : 'first name');
      if (!d.last_name) missing.push(language === 'sv' ? 'efternamn' : 'last name');
      if (requirePhone && !d.phone) missing.push(language === 'sv' ? 'telefon' : 'phone');
      if (requireAddress && (!d.address || !d.zip || !d.city)) missing.push(language === 'sv' ? 'adress' : 'address');

      setMissingFields(missing);
      setIsIncomplete(missing.length > 0);
    };

    check();
  }, [user, requirePhone, requireAddress, language]);

  if (!isIncomplete || dismissed || !user) return null;

  const content = {
    sv: {
      title: 'Komplettera din profil',
      subtitle: 'för snabbare checkout',
      cta: 'Fyll i nu',
    },
    en: {
      title: 'Complete your profile',
      subtitle: 'for faster checkout',
      cta: 'Fill in now',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <AlertCircle className="w-5 h-5 text-accent shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {t.title} <span className="text-muted-foreground font-normal">– {t.subtitle}</span>
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {missingFields.join(', ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => navigate('/profil?tab=settings')}
          >
            {t.cta}
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CompleteProfileBanner;
