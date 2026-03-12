import { ShieldCheck, Award, Recycle, Heart, Globe, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface ProductCertificationsProps {
  certifications: string[] | null;
}

const iconMap: Record<string, React.ElementType> = {
  'cruelty-free': Heart,
  'vegan': Sparkles,
  'organic': Recycle,
  'eco-friendly': Globe,
  'dermatologist-tested': ShieldCheck,
};

const ProductCertifications = ({ certifications }: ProductCertificationsProps) => {
  const { contentLang } = useLanguage();

  if (!certifications || certifications.length === 0) return null;

  const content = {
    sv: { title: 'Certifieringar & Transparens', subtitle: 'Vi är öppna med vad våra produkter innehåller och hur de tillverkas.' },
    en: { title: 'Certifications & Transparency', subtitle: 'We\'re transparent about what our products contain and how they\'re made.' },
  };
  const t = content[contentLang as keyof typeof content] || content.en;

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-2">
        <Award className="w-5 h-5 text-accent" />
        <h3 className="font-display text-lg font-semibold">{t.title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-5">{t.subtitle}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {certifications.map((cert, i) => {
          const Icon = iconMap[cert.toLowerCase()] || ShieldCheck;
          return (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border/50"
            >
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5 text-accent" />
              </div>
              <span className="text-sm font-medium">{cert}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductCertifications;
