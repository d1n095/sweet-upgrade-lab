export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: 'ev-chargers' | 'wall-boxes' | 'portable' | 'accessories';
  power: string;
  features: string[];
  inStock: boolean;
  badge?: 'new' | 'bestseller' | 'sale';
}

export interface CartItem extends Product {
  quantity: number;
}

export type Category = {
  id: string;
  name: string;
  icon: string;
};
