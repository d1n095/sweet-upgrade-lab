import { motion } from 'framer-motion';
import { Phone, Mail, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { PageSection } from '@/hooks/usePageSections';

interface Props {
  sections?: PageSection[];
  getSection?: (key: string) => PageSection | undefined;
  isSectionVisible?: (key: string) => boolean;
}

const HomepageContact = ({ getSection }: Props) => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const navigate = useNavigate();

  const section = getSection?.('contact');
  const getLang = (sv: string | null | undefined, en: string | null | undefined) =>
    (lang === 'sv' ? sv : en) || sv || '';

  const title = section ? getLang(section.title_sv, section.title_en) : (lang === 'sv' ? 'Kontakta oss' : 'Contact us');
  const content = section ? getLang(section.content_sv, section.content_en) : (lang === 'sv' ? 'Har du frågor? Vi finns här.' : 'Have questions? We are here.');

  return (
    <section className="py-28 md:py-36 border-t border-border/30">
      <div className="container mx-auto px-5">
        <div className="max-w-lg mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6"
          >
            <Mail className="w-6 h-6 text-foreground" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-semibold mb-4 text-foreground"
          >
            {title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-sm text-muted-foreground/80 leading-relaxed mb-8"
          >
            {content}
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.16 }}
          >
            <Button
              variant="outline"
              size="lg"
              className="rounded-full"
              onClick={() => navigate('/kontakt')}
            >
              {lang === 'sv' ? 'Gå till kontakt' : 'Go to contact'}
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HomepageContact;
