// Shared payment icon components used by both PaymentIcons (footer) and PaymentMethods (product page)
import React from 'react';
import swishLogo from '@/assets/payment/swish-logo-official.png';

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
  <div className={`${sizeClasses[size]} rounded-md bg-black flex items-center justify-center`}>
    <svg viewBox="0 0 165.521 46.836" className={size === 'sm' ? 'h-4 w-auto' : 'h-5 w-auto'} aria-label="Apple Pay">
      <path
        d="M20.382 7.428c-1.584 1.872-4.104 3.312-6.624 3.096-.312-2.52 
        .912-5.184 2.352-6.84C17.694 1.812 20.43.228 22.614 0c.264 2.616-.744 
        5.208-2.232 7.428zM22.566 11.1c-3.672-.216-6.792 2.088-8.544 
        2.088-1.776 0-4.44-1.968-7.344-1.92A10.87 10.87 0 0 0 
        .222 14.964c-3.792 6.552-9.72 18.552-.048 25.896 1.392 
        3.648 5.064 4.248 7.92 4.248 1.656 0 4.08-.936 6.408-.936 
        2.328 0 4.464.936 6.408.888 3.408-.048 5.016-3.648 
        6.408-7.296 2.064-4.752 2.856-9.312 2.904-9.552-.072-.048-5.664-2.184-5.712-8.592-.048-5.376 
        4.392-7.944 4.584-8.088-2.496-3.696-6.408-4.104-7.776-4.2z"
        fill="white"
        transform="scale(0.45) translate(2, 10)"
      />
      <text x="55" y="34" fill="white" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="600" fontSize={size === 'sm' ? '26' : '28'}>Pay</text>
    </svg>
  </div>
);

const GooglePayIcon = ({ size = 'sm' }: IconProps) => (
  <div className={`${sizeClasses[size]} rounded-md bg-white border border-border flex items-center justify-center gap-1`}>
    <svg viewBox="0 0 24 24" className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
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

const RevolutIcon = ({ size = 'sm' }: IconProps) => (
  <div className={`${sizeClasses[size]} rounded-md bg-[#0075EB] flex items-center justify-center`}>
    <span className="font-bold text-white" style={{ fontSize: size === 'sm' ? 9 : 11 }}>Revolut</span>
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
  revolut: RevolutIcon,
};

export { GenericIcon };
export type { IconProps };
