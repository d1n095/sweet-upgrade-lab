import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePageVisibility, ToggleablePage } from '@/stores/pageVisibilityStore';
import { useLanguage } from '@/context/LanguageContext';

const pages: { id: ToggleablePage; sv: string; en: string }[] = [
  { id: 'whats-new', sv: 'Nytt hos oss', en: "What's New" },
  { id: 'donations', sv: 'Donationer', en: 'Donations' },
  { id: 'affiliate', sv: 'Samarbete / Partnership', en: 'Partnership' },
  { id: 'business', sv: 'Handla som företag', en: 'Business Orders' },
  { id: 'suggest-product', sv: 'Önska produkt', en: 'Suggest Product' },
];

const AdminPageVisibility = () => {
  const { language } = useLanguage();
  const { visibility, setVisibility } = usePageVisibility();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {language === 'sv'
          ? 'Styr vilka sidor som syns i navigeringen och är tillgängliga för besökare.'
          : 'Control which pages are visible in navigation and accessible to visitors.'}
      </p>
      <div className="space-y-3">
        {pages.map((page) => (
          <div key={page.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
            <Label htmlFor={`page-${page.id}`} className="font-medium cursor-pointer">
              {language === 'sv' ? page.sv : page.en}
            </Label>
            <Switch
              id={`page-${page.id}`}
              checked={visibility[page.id] ?? false}
              onCheckedChange={(checked) => setVisibility(page.id, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPageVisibility;
