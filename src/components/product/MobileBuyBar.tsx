import { Minus, Plus, ShoppingCart, Check, Shield, Truck, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import PaymentMethods from '@/components/trust/PaymentMethods';

interface MobileBuyBarProps {
  quantity: number;
  setQuantity: (q: number) => void;
  isAdded: boolean;
  isOutOfStock: boolean;
  price: number;
  onAddToCart: () => void;
}

const MobileBuyBar = ({ quantity, setQuantity, isAdded, isOutOfStock, price, onAddToCart }: MobileBuyBarProps) => {
  const { t } = useLanguage();

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border safe-bottom">
      {/* Trust strip */}
      <div className="flex items-center justify-center gap-4 px-4 py-1.5 border-b border-border/50 bg-secondary/30">
        {[
          { icon: Shield, label: t('product.securepayment') },
          { icon: Truck, label: t('product.fastdelivery') },
          { icon: RotateCcw, label: t('product.returns') },
        ].map(({ icon: Icon, label }, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Icon className="w-3 h-3 text-accent" />
            {label}
          </span>
        ))}
      </div>

      {/* CTA row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center border border-border rounded-lg shrink-0">
          <button
            className="h-11 w-11 flex items-center justify-center active:bg-secondary/60 rounded-l-lg transition-colors"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-10 text-center font-medium text-base select-none">{quantity}</span>
          <button
            className="h-11 w-11 flex items-center justify-center active:bg-secondary/60 rounded-r-lg transition-colors"
            onClick={() => setQuantity(quantity + 1)}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <Button
          size="lg"
          className={`flex-1 h-12 text-sm font-semibold transition-all ${isAdded ? 'bg-accent hover:bg-accent text-accent-foreground' : ''}`}
          onClick={onAddToCart}
          disabled={isOutOfStock}
        >
          {isOutOfStock ? (
            t('product.outofstock')
          ) : isAdded ? (
            <><Check className="w-4 h-4 mr-2" />{t('product.added')}</>
          ) : (
            <><ShoppingCart className="w-4 h-4 mr-2" />{formatPrice(price)} · {t('product.addtocart')}</>
          )}
        </Button>
      </div>

      {/* Payment icons */}
      <div className="px-4 pb-2 -mt-1">
        <PaymentMethods />
      </div>
    </div>
  );
};

export default MobileBuyBar;
