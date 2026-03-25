import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, MapPin, Phone, Loader2, Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const COUNTRIES = [
  { code: 'SE', sv: 'Sverige', en: 'Sweden' },
  { code: 'NO', sv: 'Norge', en: 'Norway' },
  { code: 'DK', sv: 'Danmark', en: 'Denmark' },
  { code: 'FI', sv: 'Finland', en: 'Finland' },
  { code: 'DE', sv: 'Tyskland', en: 'Germany' },
  { code: 'NL', sv: 'Nederländerna', en: 'Netherlands' },
  { code: 'GB', sv: 'Storbritannien', en: 'United Kingdom' },
  { code: 'FR', sv: 'Frankrike', en: 'France' },
  { code: 'ES', sv: 'Spanien', en: 'Spain' },
  { code: 'IT', sv: 'Italien', en: 'Italy' },
];

interface ProfileFormData {
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  zip: string;
  city: string;
  country: string;
}

const ProfileInfoForm = () => {
  const { language } = useLanguage();
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    zip: '',
    city: '',
    country: 'SE',
  });

  const content = {
    sv: {
      title: 'Personuppgifter',
      subtitle: 'Används för snabbare checkout och leverans',
      firstName: 'Förnamn',
      lastName: 'Efternamn',
      phone: 'Telefon',
      address: 'Adress',
      zip: 'Postnummer',
      city: 'Stad',
      country: 'Land',
      save: 'Spara ändringar',
      saving: 'Sparar...',
      saved: 'Uppgifter sparade!',
      error: 'Kunde inte spara. Försök igen.',
    },
    en: {
      title: 'Personal Information',
      subtitle: 'Used for faster checkout and delivery',
      firstName: 'First name',
      lastName: 'Last name',
      phone: 'Phone',
      address: 'Address',
      zip: 'Postal code',
      city: 'City',
      country: 'Country',
      save: 'Save changes',
      saving: 'Saving...',
      saved: 'Information saved!',
      error: 'Could not save. Please try again.',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, full_name, phone, address, zip, city, country')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        // Fallback: if first_name is empty but full_name exists, split it
        let firstName = (data as any).first_name || '';
        let lastName = (data as any).last_name || '';
        if (!firstName && data.full_name) {
          const parts = data.full_name.split(' ');
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ') || '';
        }

        setForm({
          first_name: firstName,
          last_name: lastName,
          phone: data.phone || '',
          address: data.address || '',
          zip: data.zip || '',
          city: data.city || '',
          country: data.country || 'SE',
        });
      }
      setIsLoading(false);
    };

    loadProfile();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const fullName = [form.first_name, form.last_name].filter(Boolean).join(' ');
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: form.first_name.trim() || null,
          last_name: form.last_name.trim() || null,
          full_name: fullName || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          zip: form.zip.trim() || null,
          city: form.city.trim() || null,
          country: form.country || 'SE',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success(t.saved);
    } catch (error) {
      console.error('Profile save error:', error);
      toast.error(t.error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof ProfileFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">{t.title}</h3>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4" autoComplete="off">
        {/* Name row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">{t.firstName}</Label>
            <Input
              id="firstName"
              value={form.first_name}
              onChange={(e) => updateField('first_name', e.target.value)}
              className="mt-1.5"
              autoCapitalize="words"
              autoComplete="given-name"
            />
          </div>
          <div>
            <Label htmlFor="lastName">{t.lastName}</Label>
            <Input
              id="lastName"
              value={form.last_name}
              onChange={(e) => updateField('last_name', e.target.value)}
              className="mt-1.5"
              autoCapitalize="words"
              autoComplete="family-name"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <Label htmlFor="profilePhone">{t.phone}</Label>
          <Input
            id="profilePhone"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            className="mt-1.5"
            inputMode="tel"
            autoComplete="tel"
            type="tel"
          />
        </div>

        {/* Address */}
        <div>
          <Label htmlFor="profileAddress">{t.address}</Label>
          <Input
            id="profileAddress"
            value={form.address}
            onChange={(e) => updateField('address', e.target.value)}
            className="mt-1.5"
            autoComplete="street-address"
            autoCapitalize="words"
          />
        </div>

        {/* Zip + City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="profileZip">{t.zip}</Label>
            <Input
              id="profileZip"
              value={form.zip}
              onChange={(e) => updateField('zip', e.target.value)}
              className="mt-1.5"
              inputMode="numeric"
              autoComplete="postal-code"
            />
          </div>
          <div>
            <Label htmlFor="profileCity">{t.city}</Label>
            <Input
              id="profileCity"
              value={form.city}
              onChange={(e) => updateField('city', e.target.value)}
              className="mt-1.5"
              autoCapitalize="words"
              autoComplete="address-level2"
            />
          </div>
        </div>

        {/* Country */}
        <div>
          <Label>{t.country}</Label>
          <Select value={form.country} onValueChange={(v) => updateField('country', v)}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map(c => (
                <SelectItem key={c.code} value={c.code}>
                  {language === 'sv' ? c.sv : c.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t.saving}
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {t.save}
            </>
          )}
        </Button>
      </form>
    </motion.div>
  );
};

export default ProfileInfoForm;
