import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuantitySelectorProps {
  quantity: number;
  onChange: (quantity: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
}

const QuantitySelector = ({ 
  quantity, 
  onChange, 
  min = 1, 
  max = 99,
  size = 'md'
}: QuantitySelectorProps) => {
  const handleDecrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (quantity > min) {
      onChange(quantity - 1);
    }
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (quantity < max) {
      onChange(quantity + 1);
    }
  };

  const buttonSize = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-sm w-8' : 'text-base w-10';

  return (
    <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDecrease}
        disabled={quantity <= min}
        className={`${buttonSize} rounded-md hover:bg-secondary`}
      >
        <Minus className={iconSize} />
      </Button>
      <span className={`${textSize} text-center font-medium`}>
        {quantity}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleIncrease}
        disabled={quantity >= max}
        className={`${buttonSize} rounded-md hover:bg-secondary`}
      >
        <Plus className={iconSize} />
      </Button>
    </div>
  );
};

export default QuantitySelector;
