import { Leaf } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface ProductIngredientsProps {
  ingredientsSv: string | null;
  ingredientsEn: string | null;
}

const ProductIngredients = ({ ingredientsSv, ingredientsEn }: ProductIngredientsProps) => {
  const { contentLang } = useLanguage();
  const text = (contentLang === 'sv' ? ingredientsSv : ingredientsEn) || ingredientsSv;

  if (!text) return null;

  const items = text.split(',').map(i => i.trim()).filter(Boolean);

  const content = {
    sv: { title: 'Ingredienser', subtitle: 'Vad som finns i produkten' },
    en: { title: 'Ingredients', subtitle: 'What\'s inside' },
  };
  const t = content[contentLang as keyof typeof content] || content.en;

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Leaf className="w-5 h-5 text-accent" />
        <h3 className="font-display text-lg font-semibold">{t.title}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">{t.subtitle}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-secondary/60 text-foreground/80 border border-border/50"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ProductIngredients;
