import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageVisibility, ToggleablePage } from '@/stores/pageVisibilityStore';
import { useLanguage } from '@/context/LanguageContext';
import { Link } from 'react-router-dom';

const pages: { id: ToggleablePage; sv: string; en: string; href: string }[] = [
  { id: 'whats-new', sv: 'Nytt hos oss', en: "What's New", href: '/whats-new' },
  { id: 'donations', sv: 'Donationer', en: 'Donations', href: '/donations' },
  { id: 'affiliate', sv: 'Samarbete / Partnership', en: 'Partnership', href: '/affiliate' },
  { id: 'business', sv: 'Handla som företag', en: 'Business Orders', href: '/business' },
  { id: 'suggest-product', sv: 'Önska produkt', en: 'Suggest Product', href: '/suggest-product' },
];

const AdminPageVisibility = () => {
  const { language } = useLanguage();
  const { visibility, setVisibility } = usePageVisibility();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {language === 'sv'
          ? 'Styr vilka sidor som syns i navigeringen. Som admin kan du alltid förhandsgranska dolda sidor.'
          : 'Control which pages are visible in navigation. As admin you can always preview hidden pages.'}
      </p>
      <div className="space-y-3">
        {pages.map((page) => {
          const isVisible = visibility[page.id] ?? false;
          return (
            <div key={page.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`page-${page.id}`} className="font-medium cursor-pointer">
                      {language === 'sv' ? page.sv : page.en}
                    </Label>
                    {!isVisible && (
                      <Badge variant="secondary" className="text-[10px]">Dold</Badge>
                    )}
                  </div>
                  {!isVisible && (
                    <Link
                      to={page.href}
                      className="text-[11px] text-accent hover:underline flex items-center gap-1 mt-1"
                    >
                      <Eye className="w-3 h-3" />
                      Förhandsgranska
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  )}
                </div>
              </div>
              <Switch
                id={`page-${page.id}`}
                checked={isVisible}
                onCheckedChange={(checked) => setVisibility(page.id, checked)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminPageVisibility;
