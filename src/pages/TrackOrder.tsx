import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Package, Truck, CheckCircle2, Clock, MapPin, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type OrderStatus = 'processing' | 'shipped' | 'in_transit' | 'delivered' | 'delayed' | null;

interface OrderInfo {
  orderNumber: string;
  status: OrderStatus;
  statusText: { sv: string; en: string };
  date: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  carrier?: string;
}

const TrackOrder = () => {
  const { language } = useLanguage();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [notFound, setNotFound] = useState(false);

  const statusSteps = [
    { 
      id: 'processing', 
      icon: Package, 
      label: { sv: 'Order mottagen', en: 'Order received' },
      description: { sv: 'Vi har tagit emot din beställning', en: 'We have received your order' }
    },
    { 
      id: 'shipped', 
      icon: Package, 
      label: { sv: 'Behandlas', en: 'Processing' },
      description: { sv: 'Din order förbereds för leverans', en: 'Your order is being prepared' }
    },
    { 
      id: 'in_transit', 
      icon: Truck, 
      label: { sv: 'Skickad', en: 'Shipped' },
      description: { sv: 'Din order är på väg till dig', en: 'Your order is on its way' }
    },
    { 
      id: 'delivered', 
      icon: CheckCircle2, 
      label: { sv: 'Levererad', en: 'Delivered' },
      description: { sv: 'Din order har levererats', en: 'Your order has been delivered' }
    },
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setNotFound(false);
    setOrderInfo(null);

    // Simulate API call - in production this would query Shopify API
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Demo: Show not found for now (will integrate with Shopify later)
    setNotFound(true);
    setIsSearching(false);
  };

  const getStatusIndex = (status: OrderStatus): number => {
    const statusOrder = ['processing', 'shipped', 'in_transit', 'delivered'];
    return status ? statusOrder.indexOf(status) : -1;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Truck className="w-4 h-4" />
              {language === 'sv' ? 'Orderspårning' : 'Order Tracking'}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {language === 'sv' ? 'Spåra din order' : 'Track your order'}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {language === 'sv'
                ? 'Ange ditt ordernummer och e-postadress för att se status på din leverans.'
                : 'Enter your order number and email to check your delivery status.'}
            </p>
          </motion.div>

          {/* Search Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-xl mx-auto mb-12"
          >
            <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8">
              <form onSubmit={handleSearch} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="orderNumber">
                    {language === 'sv' ? 'Ordernummer' : 'Order number'}
                  </Label>
                  <Input
                    id="orderNumber"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    required
                    placeholder={language === 'sv' ? 'T.ex. #1001' : 'E.g. #1001'}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {language === 'sv' ? 'E-postadress' : 'Email address'}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={language === 'sv' ? 'din@email.se' : 'your@email.com'}
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isSearching}>
                  {isSearching ? (
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 animate-spin" />
                      {language === 'sv' ? 'Söker...' : 'Searching...'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      {language === 'sv' ? 'Sök order' : 'Search order'}
                    </span>
                  )}
                </Button>
              </form>
            </div>
          </motion.div>

          {/* Not Found Message */}
          {notFound && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl mx-auto text-center"
            >
              <div className="bg-card border border-border/50 rounded-2xl p-8">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-display text-xl font-semibold mb-2">
                  {language === 'sv' ? 'Ingen order hittades' : 'No order found'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {language === 'sv'
                    ? 'Vi kunde inte hitta någon order med dessa uppgifter. Kontrollera att ordernumret och e-postadressen stämmer.'
                    : 'We couldn\'t find any order with these details. Please check that the order number and email are correct.'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === 'sv'
                    ? 'Behöver du hjälp? Kontakta vår kundtjänst.'
                    : 'Need help? Contact our customer service.'}
                </p>
                <Button variant="outline" className="mt-4" asChild>
                  <a href="/kontakt">
                    {language === 'sv' ? 'Kontakta oss' : 'Contact us'}
                  </a>
                </Button>
              </div>
            </motion.div>
          )}

          {/* Order Status Display (shown when order is found) */}
          {orderInfo && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {language === 'sv' ? 'Order' : 'Order'} #{orderInfo.orderNumber}
                    </p>
                    <h3 className="font-display text-xl font-semibold">
                      {orderInfo.statusText[language]}
                    </h3>
                  </div>
                  {orderInfo.status === 'delayed' && (
                    <div className="px-3 py-1 rounded-full bg-accent/10 text-accent text-sm">
                      {language === 'sv' ? 'Försenad' : 'Delayed'}
                    </div>
                  )}
                </div>

                {/* Status Timeline */}
                <div className="relative">
                  {statusSteps.map((step, index) => {
                    const currentIndex = getStatusIndex(orderInfo.status);
                    const isCompleted = index <= currentIndex;
                    const isCurrent = index === currentIndex;

                    return (
                      <div key={step.id} className="flex items-start gap-4 mb-6 last:mb-0">
                        <div className="relative flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isCompleted ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                          }`}>
                            <step.icon className="w-5 h-5" />
                          </div>
                          {index < statusSteps.length - 1 && (
                            <div className={`w-0.5 h-12 mt-2 ${
                              index < currentIndex ? 'bg-primary' : 'bg-border'
                            }`} />
                          )}
                        </div>
                        <div className="flex-1 pt-2">
                          <p className={`font-medium ${isCurrent ? 'text-primary' : ''}`}>
                            {step.label[language]}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {step.description[language]}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tracking Info */}
                {orderInfo.trackingNumber && (
                  <div className="mt-8 pt-6 border-t border-border">
                    <div className="flex items-center gap-4">
                      <MapPin className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {language === 'sv' ? 'Spårningsnummer' : 'Tracking number'}
                        </p>
                        <p className="font-mono font-medium">{orderInfo.trackingNumber}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Helpful Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto mt-12"
          >
            <div className="bg-primary/5 rounded-2xl p-6 text-center">
              <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-display text-lg font-semibold mb-2">
                {language === 'sv' ? 'Leveranstider' : 'Delivery times'}
              </h3>
              <p className="text-muted-foreground text-sm">
                {language === 'sv'
                  ? 'Våra produkter skickas från EU-lager och levereras normalt inom 2–5 arbetsdagar. Vid högsäsong kan det ta något längre.'
                  : 'Our products ship from EU warehouses and are normally delivered within 2–5 business days. During peak seasons, it may take slightly longer.'}
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TrackOrder;
