import { ProductVariant } from '@/hooks/useProductVariants';
import { cn } from '@/lib/utils';

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariant: ProductVariant | null;
  onSelect: (variant: ProductVariant) => void;
  lang?: string;
}

const formatPrice = (amount: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

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
                'relative px-4 py-2.5 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-0.5',
                isSelected
                  ? 'border-foreground bg-foreground text-background ring-1 ring-foreground/20'
                  : 'border-border bg-background text-foreground hover:border-foreground/50',
                isOutOfStock && 'opacity-40 cursor-not-allowed'
              )}
            >
              <span className={cn(isOutOfStock && 'line-through')}>{variant.size}</span>
              <span className={cn(
                'text-[11px]',
                isSelected ? 'text-background/70' : 'text-muted-foreground'
              )}>
                {formatPrice(variant.price)}
              </span>
              {isOutOfStock && (
                <span className={cn(
                  'text-[10px] font-semibold',
                  isSelected ? 'text-background/60' : 'text-destructive'
                )}>
                  {lang === 'sv' ? 'Slutsåld' : 'Sold out'}
                </span>
              )}
              {!isOutOfStock && variant.stock <= 5 && (
                <span className={cn(
                  'text-[10px]',
                  isSelected ? 'text-background/60' : 'text-warning'
                )}>
                  {lang === 'sv' ? `${variant.stock} kvar` : `${variant.stock} left`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VariantSelector;
