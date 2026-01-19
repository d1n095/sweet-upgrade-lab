import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Save, Mail, Eye } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface EmailTemplate {
  id: string;
  template_type: string;
  subject_sv: string;
  subject_en: string;
  greeting_sv: string;
  greeting_en: string;
  intro_sv: string;
  intro_en: string;
  benefits_sv: string[];
  benefits_en: string[];
  cta_text_sv: string;
  cta_text_en: string;
  footer_sv: string;
  footer_en: string;
  is_active: boolean;
}

const AdminEmailTemplates = () => {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [editLang, setEditLang] = useState<'sv' | 'en'>('sv');
  const [formData, setFormData] = useState<Partial<EmailTemplate>>({});
  const [showPreview, setShowPreview] = useState(false);

  const { data: template, isLoading } = useQuery({
    queryKey: ['email-template', 'welcome'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_type', 'welcome')
        .single();
      
      if (error) throw error;
      setFormData(data);
      return data as EmailTemplate;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<EmailTemplate>) => {
      const { error } = await supabase
        .from('email_templates')
        .update(updates)
        .eq('template_type', 'welcome');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-template'] });
      toast.success(language === 'sv' ? 'Mall sparad!' : 'Template saved!');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSave = () => {
    if (!formData.id) return;
    updateMutation.mutate(formData);
  };

  const handleBenefitsChange = (value: string, lang: 'sv' | 'en') => {
    const benefits = value.split('\n').filter(b => b.trim());
    setFormData(prev => ({
      ...prev,
      [lang === 'sv' ? 'benefits_sv' : 'benefits_en']: benefits,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const currentSubject = editLang === 'sv' ? formData.subject_sv : formData.subject_en;
  const currentGreeting = editLang === 'sv' ? formData.greeting_sv : formData.greeting_en;
  const currentIntro = editLang === 'sv' ? formData.intro_sv : formData.intro_en;
  const currentBenefits = editLang === 'sv' ? formData.benefits_sv : formData.benefits_en;
  const currentCta = editLang === 'sv' ? formData.cta_text_sv : formData.cta_text_en;
  const currentFooter = editLang === 'sv' ? formData.footer_sv : formData.footer_en;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">
              {language === 'sv' ? 'Välkomstmail' : 'Welcome Email'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {language === 'sv' ? 'Anpassa mailet som skickas till nya medlemmar' : 'Customize the email sent to new members'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="rounded-xl"
          >
            <Eye className="w-4 h-4 mr-2" />
            {showPreview 
              ? (language === 'sv' ? 'Dölj förhandsgranskning' : 'Hide preview')
              : (language === 'sv' ? 'Förhandsgranska' : 'Preview')}
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            className="rounded-xl"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {language === 'sv' ? 'Spara' : 'Save'}
          </Button>
        </div>
      </div>

      <Tabs value={editLang} onValueChange={(v) => setEditLang(v as 'sv' | 'en')}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="sv" className="rounded-lg">🇸🇪 Svenska</TabsTrigger>
          <TabsTrigger value="en" className="rounded-lg">🇬🇧 English</TabsTrigger>
        </TabsList>

        <TabsContent value={editLang} className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Editor */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">
                  {language === 'sv' ? 'Redigera innehåll' : 'Edit content'}
                </CardTitle>
                <CardDescription>
                  {editLang === 'sv' ? 'Svensk version' : 'English version'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{language === 'sv' ? 'Ämnesrad' : 'Subject line'}</Label>
                  <Input
                    value={currentSubject || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      [editLang === 'sv' ? 'subject_sv' : 'subject_en']: e.target.value,
                    }))}
                    className="rounded-xl"
                    placeholder={editLang === 'sv' ? 'Välkommen till...' : 'Welcome to...'}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === 'sv' ? 'Hälsning' : 'Greeting'}</Label>
                  <Input
                    value={currentGreeting || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      [editLang === 'sv' ? 'greeting_sv' : 'greeting_en']: e.target.value,
                    }))}
                    className="rounded-xl"
                    placeholder={editLang === 'sv' ? 'Välkommen till familjen!' : 'Welcome to the family!'}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === 'sv' ? 'Introduktion' : 'Introduction'}</Label>
                  <Textarea
                    value={currentIntro || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      [editLang === 'sv' ? 'intro_sv' : 'intro_en']: e.target.value,
                    }))}
                    className="rounded-xl min-h-[80px]"
                    placeholder={editLang === 'sv' ? 'Tack för att du registrerade dig...' : 'Thank you for signing up...'}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === 'sv' ? 'Fördelar (en per rad)' : 'Benefits (one per line)'}</Label>
                  <Textarea
                    value={currentBenefits?.join('\n') || ''}
                    onChange={(e) => handleBenefitsChange(e.target.value, editLang)}
                    className="rounded-xl min-h-[120px]"
                    placeholder={editLang === 'sv' 
                      ? '💰 Exklusiva medlemspriser\n📦 Automatiska rabatter' 
                      : '💰 Exclusive member prices\n📦 Automatic discounts'}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === 'sv' ? 'Knapptext (CTA)' : 'Button text (CTA)'}</Label>
                  <Input
                    value={currentCta || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      [editLang === 'sv' ? 'cta_text_sv' : 'cta_text_en']: e.target.value,
                    }))}
                    className="rounded-xl"
                    placeholder={editLang === 'sv' ? 'Börja handla' : 'Start shopping'}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === 'sv' ? 'Avslutning' : 'Footer'}</Label>
                  <Input
                    value={currentFooter || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      [editLang === 'sv' ? 'footer_sv' : 'footer_en']: e.target.value,
                    }))}
                    className="rounded-xl"
                    placeholder={editLang === 'sv' ? 'Vi är glada att ha dig med oss!' : 'We\'re happy to have you!'}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            {showPreview && (
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === 'sv' ? 'Förhandsgranskning' : 'Preview'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'sv' ? 'Så här ser mailet ut' : 'This is how the email looks'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/30 rounded-xl p-4 space-y-4">
                    {/* Subject */}
                    <div className="text-sm">
                      <span className="text-muted-foreground">{language === 'sv' ? 'Ämne: ' : 'Subject: '}</span>
                      <span className="font-medium">{currentSubject}</span>
                    </div>
                    
                    <div className="border-t pt-4">
                      {/* Header */}
                      <div className="text-center mb-4">
                        <h3 className="text-xl font-bold text-primary">4thepeople</h3>
                        <p className="text-xs text-muted-foreground">Giftfria produkter som fungerar</p>
                      </div>

                      {/* Greeting banner */}
                      <div className="bg-primary text-primary-foreground rounded-lg p-4 text-center mb-4">
                        <p className="font-semibold">{currentGreeting}</p>
                      </div>

                      {/* Intro */}
                      <p className="text-sm text-muted-foreground mb-4">{currentIntro}</p>

                      {/* Benefits */}
                      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                          {editLang === 'sv' ? 'Dina medlemsfördelar:' : 'Your member benefits:'}
                        </p>
                        {currentBenefits?.map((benefit, i) => (
                          <p key={i} className="text-sm text-green-700 dark:text-green-300">{benefit}</p>
                        ))}
                      </div>

                      {/* CTA */}
                      <div className="text-center mb-4">
                        <span className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium">
                          {currentCta} →
                        </span>
                      </div>

                      {/* Footer */}
                      <div className="border-t pt-3 text-center">
                        <p className="text-sm font-medium text-primary">{currentFooter}</p>
                        <p className="text-xs text-muted-foreground mt-1">4thepeople-teamet</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminEmailTemplates;
