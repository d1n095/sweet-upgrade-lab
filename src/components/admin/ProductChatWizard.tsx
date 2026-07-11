import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Sparkles, Check, ArrowLeft, Zap, Image as ImageIcon } from 'lucide-react';
import { ProductFormData, ImageUploadSection } from '@/components/admin/AdminProductForm';
import {
  getTemplates,
  detectTemplate,
  findTemplate,
  ProductTemplate,
  TemplateAsk,
} from '@/lib/productTemplates';

/**
 * Chat-style product wizard. One question at a time.
 * Zero AI — everything is rule-based templates driven by category.
 */

interface Msg {
  from: 'bot' | 'user';
  text: string;
}

interface Props {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

type StepKey =
  | 'name'
  | 'template'
  | 'price'
  | 'extras'   // dynamic per template
  | 'prebuy'
  | 'stock'
  | 'image'
  | 'review';

const STEP_ORDER: StepKey[] = ['name', 'template', 'price', 'extras', 'prebuy', 'stock', 'image', 'review'];

const ProductChatWizard: React.FC<Props> = ({
  formData, setFormData, isSubmitting, onCancel, onSubmit,
}) => {
  const [step, setStep] = React.useState<StepKey>('name');
  const [msgs, setMsgs] = React.useState<Msg[]>([
    { from: 'bot', text: '👋 Hej! Låt oss skapa en produkt. Vad heter den?' },
  ]);
  const [input, setInput] = React.useState('');
  const [template, setTemplate] = React.useState<ProductTemplate | null>(null);
  const [extras, setExtras] = React.useState<Record<string, string>>({});
  const [extraIndex, setExtraIndex] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  const say = (text: string, from: Msg['from'] = 'bot') =>
    setMsgs(m => [...m, { from, text }]);

  const applyTemplate = React.useCallback((tpl: ProductTemplate, title: string, price: string, ex: Record<string, string>) => {
    const out = tpl.build(title, price, ex);
    setFormData(p => ({
      ...p,
      title,
      price,
      productType: out.productType || p.productType,
      description: out.description,
      hook: out.hook,
      extendedDescription: out.extendedDescription,
      effects: out.effects,
      usage: out.usage,
      ingredients: out.ingredients || p.ingredients,
      storage: out.storage || p.storage,
      safety: out.safety || p.safety,
      metaTitle: out.metaTitle,
      metaDescription: out.metaDescription,
      metaKeywords: out.metaKeywords,
      tags: out.tags.join(', '),
      prebuyNote: out.prebuyNote,
      weightGrams: out.weightGrams ? String(out.weightGrams) : p.weightGrams,
      seoMode: 'auto',
    }));
  }, [setFormData]);

  const advance = (next: StepKey) => setStep(next);

  const submitName = (val: string) => {
    const v = val.trim();
    if (!v) return;
    setFormData(p => ({ ...p, title: v }));
    say(v, 'user');
    const detected = detectTemplate(v);
    setTemplate(detected);
    setTimeout(() => {
      say(`Bra. Vilken kategori passar bäst?${detected.key !== 'generic' ? ` (Jag gissar ${detected.emoji} ${detected.label})` : ''}`);
      advance('template');
    }, 200);
  };

  const chooseTemplate = (tpl: ProductTemplate) => {
    setTemplate(tpl);
    say(`${tpl.emoji} ${tpl.label}`, 'user');
    setFormData(p => ({ ...p, productType: tpl.productType }));
    setTimeout(() => {
      say('Vad ska den kosta? (SEK)');
      advance('price');
    }, 200);
  };

  const submitPrice = (val: string) => {
    const n = parseFloat(val.replace(',', '.'));
    if (!n || n <= 0) return;
    setFormData(p => ({ ...p, price: String(n) }));
    say(`${n} kr`, 'user');
    setTimeout(() => {
      if (template && template.asks.length > 0) {
        setExtraIndex(0);
        askExtra(template, 0);
        advance('extras');
      } else {
        finalizeExtras(template!, {});
      }
    }, 200);
  };

  const askExtra = (tpl: ProductTemplate, idx: number) => {
    const ask = tpl.asks[idx];
    say(`${ask.question}${ask.optional ? ' (valfritt — hoppa över med Nästa)' : ''}`);
  };

  const submitExtra = (val: string) => {
    if (!template) return;
    const ask = template.asks[extraIndex];
    const clean = val.trim();
    if (!clean && !ask.optional) return;
    const newExtras = { ...extras, [ask.key]: clean };
    setExtras(newExtras);
    if (clean) say(clean, 'user'); else say('— hoppa —', 'user');

    setTimeout(() => {
      const nextIdx = extraIndex + 1;
      if (nextIdx < template.asks.length) {
        setExtraIndex(nextIdx);
        askExtra(template, nextIdx);
      } else {
        finalizeExtras(template, newExtras);
      }
    }, 200);
  };

  const finalizeExtras = (tpl: ProductTemplate, ex: Record<string, string>) => {
    applyTemplate(tpl, formData.title, formData.price, ex);
    say('✨ Jag har fyllt i beskrivning, säljtext, effekter, användning, SEO och taggar automatiskt.');
    setTimeout(() => {
      say('Är detta en förköpsprodukt (prebuy)? Kunder reserverar plats utan att betala.');
      advance('prebuy');
    }, 400);
  };

  const submitPrebuy = (yes: boolean) => {
    setFormData(p => ({ ...p, isPrebuy: yes }));
    say(yes ? 'Ja, förköp' : 'Nej, vanlig produkt', 'user');
    setTimeout(() => {
      say(yes ? 'Hur många vill du kunna reservera? (0 = ingen gräns)' : 'Hur många har du i lager?');
      advance('stock');
    }, 200);
  };

  const submitStock = (val: string) => {
    const n = parseInt(val || '0');
    setFormData(p => ({ ...p, inventory: isNaN(n) ? 0 : n }));
    say(String(isNaN(n) ? 0 : n), 'user');
    setTimeout(() => {
      say('Ladda upp en bild (valfritt — du kan lägga till senare också).');
      advance('image');
    }, 200);
  };

  const goReview = () => {
    say('Klar med bilden.', 'user');
    setTimeout(() => {
      say('Allt är förberett. Kolla sammanfattningen nedan och tryck **Skapa produkt**.');
      advance('review');
    }, 200);
  };

  const back = () => {
    const i = STEP_ORDER.indexOf(step);
    if (i > 0) {
      setStep(STEP_ORDER[i - 1]);
      setMsgs(m => m.slice(0, -2));
    }
  };

  const canSubmit = formData.title.trim().length > 0 && parseFloat(formData.price || '0') > 0;

  return (
    <div className="flex flex-col h-[70vh] max-h-[600px]">
      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2">
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.from === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted rounded-bl-sm'
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input area — depends on step */}
      <div className="border-t border-border pt-3 space-y-2">
        {step === 'name' && (
          <TextInput
            placeholder="t.ex. Lavendel bastudoft 250ml"
            value={input}
            setValue={setInput}
            onSubmit={() => { submitName(input); setInput(''); }}
            autoFocus
          />
        )}

        {step === 'template' && (
          <div className="flex flex-wrap gap-1.5">
            {getTemplates().map(tpl => (
              <Button
                key={tpl.key}
                type="button"
                size="sm"
                variant={template?.key === tpl.key ? 'default' : 'outline'}
                className="gap-1.5 text-xs"
                onClick={() => chooseTemplate(tpl)}
              >
                <span>{tpl.emoji}</span> {tpl.label}
              </Button>
            ))}
          </div>
        )}

        {step === 'price' && (
          <TextInput
            placeholder="299"
            type="number"
            value={input}
            setValue={setInput}
            onSubmit={() => { submitPrice(input); setInput(''); }}
            autoFocus
          />
        )}

        {step === 'extras' && template && (
          <ExtraInput
            ask={template.asks[extraIndex]}
            value={input}
            setValue={setInput}
            onSubmit={() => { submitExtra(input); setInput(''); }}
          />
        )}

        {step === 'prebuy' && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => submitPrebuy(false)}>
              <Check className="w-3.5 h-3.5" /> Vanlig
            </Button>
            <Button size="sm" className="flex-1 gap-1.5 bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => submitPrebuy(true)}>
              <Zap className="w-3.5 h-3.5" /> Förköp
            </Button>
          </div>
        )}

        {step === 'stock' && (
          <TextInput
            placeholder="0"
            type="number"
            value={input}
            setValue={setInput}
            onSubmit={() => { submitStock(input); setInput(''); }}
            autoFocus
          />
        )}

        {step === 'image' && (
          <div className="space-y-2">
            <ImageUploadSection imageUrls={formData.imageUrls} setFormData={setFormData} />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" className="flex-1" onClick={goReview}>
                Hoppa över
              </Button>
              <Button type="button" size="sm" className="flex-1 gap-1.5" onClick={goReview}>
                <ImageIcon className="w-3.5 h-3.5" /> Klar
              </Button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <ReviewPanel
            formData={formData}
            template={template}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            canSubmit={canSubmit}
          />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <Button type="button" size="sm" variant="ghost" onClick={back} disabled={step === 'name' || isSubmitting} className="gap-1 text-xs">
            <ArrowLeft className="w-3 h-3" /> Bakåt
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={isSubmitting} className="text-xs">
            Avbryt
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────

const TextInput: React.FC<{
  placeholder: string;
  type?: string;
  value: string;
  setValue: (v: string) => void;
  onSubmit: () => void;
  autoFocus?: boolean;
}> = ({ placeholder, type = 'text', value, setValue, onSubmit, autoFocus }) => (
  <form
    onSubmit={e => { e.preventDefault(); onSubmit(); }}
    className="flex gap-2"
  >
    <Input
      autoFocus={autoFocus}
      type={type}
      value={value}
      onChange={e => setValue(e.target.value)}
      placeholder={placeholder}
      className="flex-1"
    />
    <Button type="submit" size="sm" className="gap-1.5">
      <Send className="w-3.5 h-3.5" /> Skicka
    </Button>
  </form>
);

const ExtraInput: React.FC<{
  ask: TemplateAsk;
  value: string;
  setValue: (v: string) => void;
  onSubmit: () => void;
}> = ({ ask, value, setValue, onSubmit }) => (
  <div className="space-y-2">
    {ask.chips && ask.chips.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {ask.chips.map(chip => (
          <button
            key={chip}
            type="button"
            onClick={() => { setValue(chip); setTimeout(onSubmit, 50); }}
            className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-primary hover:bg-primary/5 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>
    )}
    <form onSubmit={e => { e.preventDefault(); onSubmit(); }} className="flex gap-2">
      <Input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={ask.placeholder || 'Skriv svar...'}
        className="flex-1"
      />
      <Button type="submit" size="sm" variant={ask.optional && !value ? 'outline' : 'default'} className="gap-1.5">
        {ask.optional && !value ? 'Nästa' : (<><Send className="w-3.5 h-3.5" /> Skicka</>)}
      </Button>
    </form>
  </div>
);

const ReviewPanel: React.FC<{
  formData: ProductFormData;
  template: ProductTemplate | null;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  canSubmit: boolean;
}> = ({ formData, template, onSubmit, isSubmitting, canSubmit }) => (
  <form onSubmit={onSubmit} className="space-y-2.5">
    <div className="rounded-lg border border-border p-3 space-y-2 text-xs bg-muted/30">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{formData.title || '—'}</div>
          <div className="text-muted-foreground">
            {template?.emoji} {template?.label} · {formData.price || '0'} kr · Lager {formData.inventory}
          </div>
        </div>
        {formData.isPrebuy && (
          <Badge className="bg-gold/20 text-gold border-gold/30 gap-1 text-[10px]">
            <Zap className="w-2.5 h-2.5" /> PREBUY
          </Badge>
        )}
      </div>
      <div className="line-clamp-2 text-muted-foreground italic">"{formData.description}"</div>
      {formData.tags && (
        <div className="flex flex-wrap gap-1">
          {formData.tags.split(',').slice(0, 6).map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border">{t.trim()}</span>
          ))}
        </div>
      )}
    </div>

    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border">
      <span className="text-xs font-medium">Synlig i butiken direkt</span>
      <Switch
        checked={formData.isVisible}
        onCheckedChange={v => {/* mutate via parent */}}
      />
    </div>

    <Button type="submit" size="sm" disabled={!canSubmit || isSubmitting} className="w-full gap-1.5">
      {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      Skapa produkt
    </Button>
    <p className="text-[10px] text-center text-muted-foreground">
      Du kan redigera allt efteråt under "Avancerat".
    </p>
  </form>
);

export default ProductChatWizard;
