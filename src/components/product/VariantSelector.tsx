import { ProductVariant } from '@/hooks/useProductVariants';
import { cn } from '@/lib/utils';

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariant: ProductVariant | null;
  onSelect: (variant: ProductVariant) => void;
  lang?: string;
}

const VariantSelector = ({ variants, selectedVariant, onSelect, lang = 'sv' }: VariantSelectorProps) => {
  if (variants.length <= 1) return null;

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {lang === 'sv' ? 'Välj storlek' : 'Select size'}
      </p>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const isSelected = selectedVariant?.id === variant.id;
          const isOutOfStock = variant.stock <= 0;

          return (
            <button
              key={variant.id}
              onClick={() => !isOutOfStock && onSelect(variant)}
              disabled={isOutOfStock}
              className={cn(
                'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                isSelected
                  ? 'border-foreground bg-foreground text-background ring-1 ring-foreground/20'
                  : 'border-border bg-background text-foreground hover:border-foreground/50',
                isOutOfStock && 'opacity-40 cursor-not-allowed line-through'
              )}
            >
              {variant.size}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VariantSelector;
