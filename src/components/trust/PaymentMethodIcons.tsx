// Shared payment icon components used by both PaymentIcons (footer) and PaymentMethods (product page)
import React from 'react';
import swishLogo from '@/assets/payment/swish-logo.svg';

interface IconProps {
  size?: 'sm' | 'md';
}

const sizeClasses = {
  sm: 'h-7 min-w-[44px] px-2 text-[10px]',
  md: 'h-8 min-w-[50px] px-2.5 text-[11px]',
};

const VisaIcon = ({ size = 'sm' }: IconProps) => (
  <div className={`${sizeClasses[size]} rounded-md bg-[#1A1F71] flex items-center justify-center`}>
    <span className="font-bold italic text-white tracking-wider" style={{ fontSize: size === 'sm' ? 13 : 15 }}>VISA</span>
  </div>
);

const MastercardIcon = ({ size = 'sm' }: IconProps) => (
  <div className={`${sizeClasses[size]} rounded-md bg-[#252525] flex items-center justify-center gap-0.5`}>
    <div className="w-4 h-4 rounded-full bg-[#EB001B] -mr-1.5" />
    <div className="w-4 h-4 rounded-full bg-[#F79E1B] opacity-90" />
  </div>
);

const KlarnaIcon = ({ size = 'sm' }: IconProps) => (
  <div className={`${sizeClasses[size]} rounded-md bg-[#FFB3C7] flex items-center justify-center`}>
    <span className="font-extrabold text-[#0A0B09] tracking-tight" style={{ fontSize: size === 'sm' ? 11 : 13 }}>Klarna</span>
  </div>
);

const SwishIcon = ({ size = 'sm' }: IconProps) => (
  <div className={`${sizeClasses[size]} rounded-md bg-white border border-border flex items-center justify-center`}>
    <img
      src={swishLogo}
      alt="Swish"
      className={size === 'sm' ? 'h-4 w-auto object-contain' : 'h-5 w-auto object-contain'}
      loading="lazy"
      decoding="async"
    />
  </div>
);

const ApplePayIcon = ({ size = 'sm' }: IconProps) => (
  <div className={`${sizeClasses[size]} rounded-md bg-black flex items-center justify-center gap-0.5`}>
    <span className="text-white" style={{ fontSize: size === 'sm' ? 13 : 15 }}>&#63743;</span>
    <span className="font-semibold text-white" style={{ fontSize: size === 'sm' ? 10 : 12 }}>Pay</span>
  </div>
);

const GooglePayIcon = ({ size = 'sm' }: IconProps) => (
  <div className={`${sizeClasses[size]} rounded-md bg-white border border-border flex items-center justify-center gap-1`}>
    <span className="font-semibold tracking-tight" style={{ fontSize: size === 'sm' ? 10 : 12 }}>
      <span className="text-[#4285F4]">G</span>
      <span className="text-[#EA4335]">o</span>
      <span className="text-[#FBBC05]">o</span>
      <span className="text-[#4285F4]">g</span>
      <span className="text-[#34A853]">l</span>
      <span className="text-[#EA4335]">e</span>
    </span>
    <span className="font-medium text-[#5F6368]" style={{ fontSize: size === 'sm' ? 10 : 12 }}>Pay</span>
  </div>
);

const PayPalIcon = ({ size = 'sm' }: IconProps) => (
  <div className={`${sizeClasses[size]} rounded-md bg-white border border-border flex items-center justify-center`}>
    <span className="font-bold italic" style={{ fontSize: size === 'sm' ? 10 : 12 }}>
      <span className="text-[#253B80]">Pay</span>
      <span className="text-[#179BD7]">Pal</span>
    </span>
  </div>
);

const GenericIcon = ({ name, size = 'sm' }: { name: string } & IconProps) => (
  <div className={`${sizeClasses[size]} rounded-md bg-muted border border-border flex items-center justify-center`}>
    <span className="font-semibold text-muted-foreground" style={{ fontSize: size === 'sm' ? 8 : 9 }}>{name}</span>
  </div>
);

export const PAYMENT_ICON_MAP: Record<string, React.FC<IconProps>> = {
  visa: VisaIcon,
  mastercard: MastercardIcon,
  klarna: KlarnaIcon,
  swish: SwishIcon,
  applepay: ApplePayIcon,
  googlepay: GooglePayIcon,
  paypal: PayPalIcon,
};

export { GenericIcon };
export type { IconProps };
