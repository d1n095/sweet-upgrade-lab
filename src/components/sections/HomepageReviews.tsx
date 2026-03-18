import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

interface Review {
  id: string;
  rating: number;
  comment: string;
  product_title: string;
  created_at: string;
}

const HomepageReviews = () => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const t = {
    sv: { title: 'Vad våra kunder säger', empty: 'Inga recensioner ännu' },
    en: { title: 'What our customers say', empty: 'No reviews yet' },
  }[lang];

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('reviews')
          .select('id, rating, comment, product_title, created_at')
          .eq('is_approved', true)
          .order('created_at', { ascending: false })
          .limit(3);

        setReviews(data || []);
      } catch (err) {
        console.error('Failed to load reviews:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading || reviews.length === 0) return null;

  return (
    <section className="py-24 md:py-32 border-t border-border/30">
      <div className="container mx-auto px-5">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-semibold text-center mb-14 text-foreground"
        >
          {t.title}
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {reviews.map((review, i) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border border-border/50 rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
            >
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${s < review.rating ? 'fill-foreground text-foreground' : 'text-border'}`}
                  />
                ))}
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed line-clamp-3 mb-3">
                "{review.comment}"
              </p>
              <p className="text-[11px] text-muted-foreground/70 font-medium">
                {review.product_title}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HomepageReviews;
