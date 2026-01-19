import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const ResetPassword = () => {
  const { language } = useLanguage();
  const { updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Check if user arrived via reset link (they should have a session from the magic link)
  useEffect(() => {
    // Give auth time to process the recovery token
    const timer = setTimeout(() => {
      if (!session) {
        toast.error(
          language === 'sv' 
            ? 'Ogiltig eller utgången länk. Begär en ny återställningslänk.' 
            : 'Invalid or expired link. Please request a new reset link.'
        );
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [session, language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error(
        language === 'sv' 
          ? 'Lösenorden matchar inte' 
          : 'Passwords do not match'
      );
      return;
    }

    if (password.length < 6) {
      toast.error(
        language === 'sv' 
          ? 'Lösenordet måste vara minst 6 tecken' 
          : 'Password must be at least 6 characters'
      );
      return;
    }

    setLoading(true);

    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      
      setSuccess(true);
      toast.success(
        language === 'sv' 
          ? 'Lösenordet har uppdaterats!' 
          : 'Password updated successfully!'
      );
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Ett fel uppstod');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-md mx-auto">
          <div className="bg-card rounded-2xl p-8 shadow-lg border">
            {success ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="font-display text-2xl font-bold mb-2">
                  {language === 'sv' ? 'Lösenord uppdaterat!' : 'Password Updated!'}
                </h1>
                <p className="text-muted-foreground">
                  {language === 'sv' 
                    ? 'Du omdirigeras till startsidan...' 
                    : 'Redirecting to home page...'}
                </p>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-primary" />
                  </div>
                  <h1 className="font-display text-2xl font-bold mb-2">
                    {language === 'sv' ? 'Välj nytt lösenord' : 'Choose New Password'}
                  </h1>
                  <p className="text-muted-foreground">
                    {language === 'sv' 
                      ? 'Ange ditt nya lösenord nedan' 
                      : 'Enter your new password below'}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder={language === 'sv' ? 'Nytt lösenord' : 'New password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 h-12 rounded-xl"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder={language === 'sv' ? 'Bekräfta lösenord' : 'Confirm password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-11 h-12 rounded-xl"
                      required
                      minLength={6}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !session}
                    className="w-full h-12 rounded-xl font-semibold"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      language === 'sv' ? 'Uppdatera lösenord' : 'Update Password'
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ResetPassword;
