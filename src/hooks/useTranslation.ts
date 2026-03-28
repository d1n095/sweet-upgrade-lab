import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/i18n/translations';

export const useTranslation = () => {
  const { language } = useLanguage();

  return {
    t: (key: string) => t(language, key),
  };
};
