import { useState, useEffect } from 'react';
import { Mail, Lock, Loader2, Crown, ArrowLeft, CheckCircle, Eye, EyeOff, UserCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { logAuthEvent } from '@/utils/activityLogger';
import { useLoginRateLimit } from '@/hooks/useLoginRateLimit';
import { useStoreSettings } from '@/stores/storeSettingsStore';
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
  const lang = getContentLang(language);
  const { signIn, signUp, resetPassword } = useAuth();
  const { checkRateLimit, resetAttempts } = useLoginRateLimit();
  const { registrationEnabled } = useStoreSettings();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rate limit check for login
    if (mode === 'login') {
      const { allowed, remainingSeconds } = checkRateLimit();
      if (!allowed) {
        toast.error(
          lang === 'sv'
            ? `För många försök. Vänta ${remainingSeconds} sekunder.`
            : `Too many attempts. Wait ${remainingSeconds} seconds.`
        );
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setResetSent(true);
        toast.success(
          lang === 'sv' 
            ? 'Återställningslänk skickad till din e-post!' 
            : 'Reset link sent to your email!'
        );
      } else if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          logAuthEvent('login_failed', email, { error: error.message });
          throw error;
        }
        resetAttempts();
        logAuthEvent('login', email);
        toast.success(lang === 'sv' ? 'Välkommen tillbaka!' : 'Welcome back!');
        onClose();
      } else {
        const { error } = await signUp(email, password, username || undefined);
        if (error) throw error;
        
        // Send welcome email in background
        supabase.functions.invoke('send-welcome-email', {
          body: { email, language }
        }).catch(err => console.error('Welcome email failed:', err));
        
        logAuthEvent('login', email, { type: 'signup' });
        toast.success(
          lang === 'sv' 
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
                  ? (lang === 'sv' ? 'Glömt lösenord' : 'Forgot Password')
                  : mode === 'login' 
                    ? (lang === 'sv' ? 'Logga in' : 'Sign In')
                    : (lang === 'sv' ? 'Bli medlem' : 'Become a Member')}
              </SheetTitle>
              <SheetDescription>
                {mode === 'forgot'
                  ? (lang === 'sv' 
                      ? 'Vi skickar en återställningslänk till din e-post' 
                      : "We'll send a reset link to your email")
                  : (lang === 'sv' 
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
              {lang === 'sv' ? 'E-post skickad!' : 'Email Sent!'}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {lang === 'sv' 
                ? 'Kolla din inkorg och klicka på länken för att återställa ditt lösenord.' 
                : 'Check your inbox and click the link to reset your password.'}
            </p>
            <Button
              variant="outline"
              onClick={() => handleModeChange('login')}
              className="rounded-xl"
            >
              {lang === 'sv' ? 'Tillbaka till inloggning' : 'Back to login'}
            </Button>
          </div>
        ) : (
          <>
            {/* Benefits */}
            {mode === 'register' && (
              <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/20">
                <p className="text-sm font-medium text-accent mb-2">
                  {lang === 'sv' ? 'Medlemsfördelar:' : 'Member benefits:'}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ {lang === 'sv' ? 'Exklusiva medlemspriser' : 'Exclusive member prices'}</li>
                  <li>✓ {lang === 'sv' ? 'Automatiska mängdrabatter' : 'Automatic volume discounts'}</li>
                  <li>✓ {lang === 'sv' ? 'Tillgång till paketpriser' : 'Access to bundle pricing'}</li>
                </ul>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username field for registration */}
              {mode === 'register' && (
                <div>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={lang === 'sv' ? 'Användarnamn (valfritt)' : 'Username (optional)'}
                      value={username}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
                        setUsername(val);
                        setUsernameError('');
                      }}
                      className="pl-11 h-12 rounded-xl"
                      maxLength={24}
                    />
                  </div>
                  {usernameError && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {usernameError}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {lang === 'sv' ? 'Lämna tomt för automatiskt genererat namn' : 'Leave empty for auto-generated name'}
                  </p>
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder={lang === 'sv' ? 'E-postadress' : 'Email address'}
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
                    type={showPassword ? 'text' : 'password'}
                    placeholder={lang === 'sv' ? 'Lösenord' : 'Password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 pr-11 h-12 rounded-xl"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
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
                    {lang === 'sv' ? 'Glömt lösenord?' : 'Forgot password?'}
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
                  lang === 'sv' ? 'Skicka återställningslänk' : 'Send Reset Link'
                ) : mode === 'login' ? (
                  lang === 'sv' ? 'Logga in' : 'Sign In'
                ) : (
                  lang === 'sv' ? 'Skapa konto' : 'Create Account'
                )}
              </Button>
            </form>

            {/* Toggle mode */}
            {mode !== 'forgot' && (
              <div className="mt-6 text-center text-sm">
                {mode === 'login' && registrationEnabled && (
                  <>
                    <span className="text-muted-foreground">
                      {lang === 'sv' ? 'Har du inget konto?' : "Don't have an account?"}
                    </span>{' '}
                    <button
                      type="button"
                      onClick={() => handleModeChange('register')}
                      className="text-primary font-medium hover:underline"
                    >
                      {lang === 'sv' ? 'Bli medlem' : 'Become a member'}
                    </button>
                  </>
                )}
                {mode === 'register' && (
                  <>
                    <span className="text-muted-foreground">
                      {lang === 'sv' ? 'Har du redan ett konto?' : 'Already have an account?'}
                    </span>{' '}
                    <button
                      type="button"
                      onClick={() => handleModeChange('login')}
                      className="text-primary font-medium hover:underline"
                    >
                      {lang === 'sv' ? 'Logga in' : 'Sign in'}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default AuthModal;
