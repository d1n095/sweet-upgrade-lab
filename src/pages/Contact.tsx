import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, Clock, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { storeConfig } from '@/config/storeConfig';
import { toast } from 'sonner';

const Contact = () => {
  const { language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success(
      language === 'sv' 
        ? 'Tack för ditt meddelande! Vi återkommer inom 24 timmar.'
        : 'Thank you for your message! We\'ll get back to you within 24 hours.'
    );
    
    setFormData({ name: '', email: '', subject: '', message: '' });
    setIsSubmitting(false);
  };

  const contactInfo = [
    {
      icon: Mail,
      label: { sv: 'E-post', en: 'Email' },
      value: storeConfig.contact.email,
      href: `mailto:${storeConfig.contact.email}`,
    },
    {
      icon: Phone,
      label: { sv: 'Telefon', en: 'Phone' },
      value: storeConfig.contact.phoneFormatted,
      href: `tel:${storeConfig.contact.phone}`,
    },
    {
      icon: MapPin,
      label: { sv: 'Adress', en: 'Address' },
      value: `${storeConfig.contact.address.street}, ${storeConfig.contact.address.zip} ${storeConfig.contact.address.city}`,
      href: null,
    },
    {
      icon: Clock,
      label: { sv: 'Svarstid', en: 'Response time' },
      value: language === 'sv' ? 'Inom 24 timmar' : 'Within 24 hours',
      href: null,
    },
  ];

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
              <MessageSquare className="w-4 h-4" />
              {language === 'sv' ? 'Kontakta Oss' : 'Contact Us'}
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-semibold mb-4">
              {language === 'sv' ? 'Hur kan vi hjälpa dig?' : 'How can we help you?'}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {language === 'sv'
                ? 'Vi finns här för att svara på dina frågor. Hör av dig så återkommer vi så snart som möjligt.'
                : 'We\'re here to answer your questions. Get in touch and we\'ll get back to you as soon as possible.'}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8">
                <h2 className="font-display text-2xl font-semibold mb-6">
                  {language === 'sv' ? 'Skicka meddelande' : 'Send a message'}
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        {language === 'sv' ? 'Namn' : 'Name'}
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder={language === 'sv' ? 'Ditt namn' : 'Your name'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        {language === 'sv' ? 'E-post' : 'Email'}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        placeholder={language === 'sv' ? 'din@email.se' : 'your@email.com'}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subject">
                      {language === 'sv' ? 'Ämne' : 'Subject'}
                    </Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      required
                      placeholder={language === 'sv' ? 'Vad gäller din fråga?' : 'What is your question about?'}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="message">
                      {language === 'sv' ? 'Meddelande' : 'Message'}
                    </Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      rows={5}
                      placeholder={language === 'sv' ? 'Beskriv hur vi kan hjälpa dig...' : 'Describe how we can help you...'}
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      language === 'sv' ? 'Skickar...' : 'Sending...'
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {language === 'sv' ? 'Skicka meddelande' : 'Send message'}
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8">
                <h2 className="font-display text-2xl font-semibold mb-6">
                  {language === 'sv' ? 'Kontaktinformation' : 'Contact Information'}
                </h2>
                
                <div className="space-y-6">
                  {contactInfo.map((item) => (
                    <div key={item.label.sv} className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {item.label[language]}
                        </p>
                        {item.href ? (
                          <a 
                            href={item.href}
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {item.value}
                          </a>
                        ) : (
                          <p className="font-medium">{item.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FAQ Link */}
              <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6">
                <h3 className="font-display text-lg font-semibold mb-2">
                  {language === 'sv' ? 'Vanliga frågor' : 'FAQ'}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {language === 'sv'
                    ? 'Kanske hittar du svaret på din fråga i våra vanliga frågor.'
                    : 'You might find the answer to your question in our FAQ.'}
                </p>
                <Button variant="outline" asChild>
                  <a href="/#faq">
                    {language === 'sv' ? 'Se vanliga frågor' : 'View FAQ'}
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
