import { useState } from 'react';
import { Mail, Lock, Loader2, Crown, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const { language } = useLanguage();
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setResetSent(true);
        toast.success(
          language === 'sv' 
            ? 'Återställningslänk skickad till din e-post!' 
            : 'Reset link sent to your email!'
        );
      } else if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success(language === 'sv' ? 'Välkommen tillbaka!' : 'Welcome back!');
        onClose();
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        toast.success(
          language === 'sv' 
            ? 'Konto skapat! Du är nu medlem.' 
            : 'Account created! You are now a member.'
        );
        onClose();
      }
    } catch (error: any) {
      toast.error(error.message || 'Ett fel uppstod');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: 'login' | 'register' | 'forgot') => {
    setMode(newMode);
    setResetSent(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left mb-6">
          <div className="flex items-center gap-3 mb-2">
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => handleModeChange('login')}
                className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {mode !== 'forgot' && (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <SheetTitle className="font-display text-xl">
                {mode === 'forgot'
                  ? (language === 'sv' ? 'Glömt lösenord' : 'Forgot Password')
                  : mode === 'login' 
                    ? (language === 'sv' ? 'Logga in' : 'Sign In')
                    : (language === 'sv' ? 'Bli medlem' : 'Become a Member')}
              </SheetTitle>
              <SheetDescription>
                {mode === 'forgot'
                  ? (language === 'sv' 
                      ? 'Vi skickar en återställningslänk till din e-post' 
                      : "We'll send a reset link to your email")
                  : (language === 'sv' 
                      ? 'Få tillgång till exklusiva medlemspriser'
                      : 'Get access to exclusive member prices')}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Reset sent confirmation */}
        {mode === 'forgot' && resetSent ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {language === 'sv' ? 'E-post skickad!' : 'Email Sent!'}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {language === 'sv' 
                ? 'Kolla din inkorg och klicka på länken för att återställa ditt lösenord.' 
                : 'Check your inbox and click the link to reset your password.'}
            </p>
            <Button
              variant="outline"
              onClick={() => handleModeChange('login')}
              className="rounded-xl"
            >
              {language === 'sv' ? 'Tillbaka till inloggning' : 'Back to login'}
            </Button>
          </div>
        ) : (
          <>
            {/* Benefits */}
            {mode === 'register' && (
              <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/20">
                <p className="text-sm font-medium text-accent mb-2">
                  {language === 'sv' ? 'Medlemsfördelar:' : 'Member benefits:'}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ {language === 'sv' ? 'Exklusiva medlemspriser' : 'Exclusive member prices'}</li>
                  <li>✓ {language === 'sv' ? 'Automatiska mängdrabatter' : 'Automatic volume discounts'}</li>
                  <li>✓ {language === 'sv' ? 'Tillgång till paketpriser' : 'Access to bundle pricing'}</li>
                </ul>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder={language === 'sv' ? 'E-postadress' : 'Email address'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 rounded-xl"
                  required
                />
              </div>
              
              {mode !== 'forgot' && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder={language === 'sv' ? 'Lösenord' : 'Password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 h-12 rounded-xl"
                    required
                    minLength={6}
                  />
                </div>
              )}

              {/* Forgot password link */}
              {mode === 'login' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => handleModeChange('forgot')}
                    className="text-sm text-primary hover:underline"
                  >
                    {language === 'sv' ? 'Glömt lösenord?' : 'Forgot password?'}
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl font-semibold"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : mode === 'forgot' ? (
                  language === 'sv' ? 'Skicka återställningslänk' : 'Send Reset Link'
                ) : mode === 'login' ? (
                  language === 'sv' ? 'Logga in' : 'Sign In'
                ) : (
                  language === 'sv' ? 'Skapa konto' : 'Create Account'
                )}
              </Button>
            </form>

            {/* Toggle mode */}
            {mode !== 'forgot' && (
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">
                  {mode === 'login'
                    ? (language === 'sv' ? 'Har du inget konto?' : "Don't have an account?")
                    : (language === 'sv' ? 'Har du redan ett konto?' : 'Already have an account?')}
                </span>{' '}
                <button
                  type="button"
                  onClick={() => handleModeChange(mode === 'login' ? 'register' : 'login')}
                  className="text-primary font-medium hover:underline"
                >
                  {mode === 'login'
                    ? (language === 'sv' ? 'Bli medlem' : 'Become a member')
                    : (language === 'sv' ? 'Logga in' : 'Sign in')}
                </button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default AuthModal;
