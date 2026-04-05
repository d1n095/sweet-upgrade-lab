import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, CheckCircle, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ReviewStars from './ReviewStars';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface FeedbackSurveyProps {
  orderId: string;
  onSubmitted?: () => void;
}

const FeedbackSurvey = ({ orderId, onSubmitted }: FeedbackSurveyProps) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [overall, setOverall] = useState(0);
  const [delivery, setDelivery] = useState(0);
  const [packaging, setPackaging] = useState(0);
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const t = language === 'sv' ? {
    title: 'Hur var din upplevelse?',
    subtitle: 'Din feedback hjälper oss bli bättre',
    overall: 'Helhetsbetyg',
    delivery: 'Leverans',
    packaging: 'Förpackning',
    recommend: 'Skulle du rekommendera oss?',
    yes: 'Ja',
    no: 'Nej',
    comments: 'Övriga kommentarer',
    placeholder: 'Berätta gärna mer om din upplevelse...',
    submit: 'Skicka feedback',
    submitting: 'Skickar...',
    submitted: 'Tack för din feedback!',
    error: 'Välj ett helhetsbetyg',
  } : {
    title: 'How was your experience?',
    subtitle: 'Your feedback helps us improve',
    overall: 'Overall rating',
    delivery: 'Delivery',
    packaging: 'Packaging',
    recommend: 'Would you recommend us?',
    yes: 'Yes',
    no: 'No',
    comments: 'Additional comments',
    placeholder: 'Tell us more about your experience...',
    submit: 'Submit feedback',
    submitting: 'Submitting...',
    submitted: 'Thank you for your feedback!',
    error: 'Please select an overall rating',
  };

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (overall === 0) {
      toast.error(t.error);
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('feedback_surveys').insert({
        user_id: user.id,
        order_id: orderId,
        overall_satisfaction: overall,
        delivery_rating: delivery || null,
        packaging_rating: packaging || null,
        would_recommend: recommend,
        comments: comments.trim() || null,
      });
      if (error) throw error;
      setIsSubmitted(true);
      onSubmitted?.();
    } catch (err) {

      toast.error(language === 'sv' ? 'Något gick fel' : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-primary/10 rounded-2xl p-6 text-center">
        <CheckCircle className="w-10 h-10 text-primary mx-auto mb-3" />
        <p className="font-semibold">{t.submitted}</p>
      </motion.div>
    );
  }

  return (
    <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">{t.title}</h3>
      </div>
      <p className="text-muted-foreground text-sm mb-6">{t.subtitle}</p>

      <div className="space-y-5">
        {/* Overall */}
        <div>
          <label className="block text-sm font-medium mb-2">{t.overall} *</label>
          <ReviewStars rating={overall} size="lg" interactive onRatingChange={setOverall} />
        </div>

        {/* Delivery */}
        <div>
          <label className="block text-sm font-medium mb-2">{t.delivery}</label>
          <ReviewStars rating={delivery} size="md" interactive onRatingChange={setDelivery} />
        </div>

        {/* Packaging */}
        <div>
          <label className="block text-sm font-medium mb-2">{t.packaging}</label>
          <ReviewStars rating={packaging} size="md" interactive onRatingChange={setPackaging} />
        </div>

        {/* Recommend */}
        <div>
          <label className="block text-sm font-medium mb-2">{t.recommend}</label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={recommend === true ? 'default' : 'outline'} onClick={() => setRecommend(true)}>{t.yes}</Button>
            <Button type="button" size="sm" variant={recommend === false ? 'default' : 'outline'} onClick={() => setRecommend(false)}>{t.no}</Button>
          </div>
        </div>

        {/* Comments */}
        <div>
          <label className="block text-sm font-medium mb-2">{t.comments}</label>
          <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder={t.placeholder} rows={3} className="resize-none" />
        </div>

        <Button type="submit" disabled={isSubmitting || overall === 0} className="w-full">
          {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.submitting}</> : <><Send className="w-4 h-4 mr-2" />{t.submit}</>}
        </Button>
      </div>
    </motion.form>
  );
};

export default FeedbackSurvey;
