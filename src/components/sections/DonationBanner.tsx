import { motion } from 'framer-motion';
import { Heart, Leaf, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const DonationBanner = () => {
  const { language } = useLanguage();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const content = {
    sv: {
      title: 'Stötta vårt arbete',
      subtitle: 'Hjälp oss fortsätta research för giftfria alternativ',
      cta: 'Läs mer',
      dialogTitle: 'Bli en del av framtiden',
      dialogDesc: 'Ditt bidrag hjälper oss researcha och verifiera fler giftfria produkter för alla.',
      amounts: ['50 kr', '100 kr', '200 kr'],
      custom: 'Valfritt belopp',
      anonymous: 'Bidra anonymt',
      purpose: 'Syfte',
      purposes: ['Miljö & Hållbarhet', 'Hälsoresearch', 'Allmänt'],
      donate: 'Stötta nu',
      thankYou: 'Tack för att du bryr dig! ❤️',
      comingSoon: 'Betalning kommer snart. Tack för ditt intresse!',
    },
    en: {
      title: 'Support our work',
      subtitle: 'Help us continue researching toxin-free alternatives',
      cta: 'Learn more',
      dialogTitle: 'Be part of the future',
      dialogDesc: 'Your contribution helps us research and verify more toxin-free products for everyone.',
      amounts: ['50 SEK', '100 SEK', '200 SEK'],
      custom: 'Custom amount',
      anonymous: 'Contribute anonymously',
      purpose: 'Purpose',
      purposes: ['Environment & Sustainability', 'Health Research', 'General'],
      donate: 'Support now',
      thankYou: 'Thank you for caring! ❤️',
      comingSoon: 'Payment coming soon. Thank you for your interest!',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  const handleDonate = () => {
    toast.success(t.comingSoon);
  };

  return (
    <section className="py-8 bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Sparkles className="w-4 h-4" />
                {t.cta}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-primary" />
                  {t.dialogTitle}
                </DialogTitle>
                <DialogDescription>{t.dialogDesc}</DialogDescription>
              </DialogHeader>

              <div className="space-y-6 pt-4">
                {/* Amount selection */}
                <div className="grid grid-cols-3 gap-2">
                  {t.amounts.map((amount, index) => (
                    <Button
                      key={amount}
                      variant={selectedAmount === index ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedAmount(index)}
                    >
                      {amount}
                    </Button>
                  ))}
                </div>

                {/* Purpose dropdown */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t.purpose}</label>
                  <select className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm">
                    {t.purposes.map((purpose) => (
                      <option key={purpose}>{purpose}</option>
                    ))}
                  </select>
                </div>

                {/* Anonymous checkbox */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm">{t.anonymous}</span>
                </label>

                {/* Donate button */}
                <Button className="w-full gap-2" onClick={handleDonate}>
                  <Heart className="w-4 h-4" />
                  {t.donate}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>
    </section>
  );
};

export default DonationBanner;
