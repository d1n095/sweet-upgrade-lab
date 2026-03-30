import { useState, useEffect, useRef } from 'react';
import { Mail, Lock, Loader2, Crown, ArrowLeft, CheckCircle, Eye, EyeOff, UserCircle, AlertCircle, ShieldAlert, CheckCircle2, Phone } from 'lucide-react';
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

// Banned words for usernames
const BANNED_WORDS = [
  'admin', 'root', 'moderator', 'support', 'staff', 'system', 'official',
  'fuck', 'shit', 'ass', 'dick', 'porn', 'sex', 'nazi', 'hitler',
  'fitta', 'kuk', 'hora', 'jävla', 'fan', 'skit',
  '4thepeople', 'grundare', 'founder',
];

const validateUsername = (username: string, lang: string): string | null => {
  if (!username || !username.trim()) {
    return lang === 'sv' ? 'Användarnamn krävs' : 'Username is required';
  }
  if (username.length < 3) {
    return lang === 'sv' ? 'Minst 3 tecken' : 'At least 3 characters';
  }
  if (username.length > 20) {
    return lang === 'sv' ? 'Max 20 tecken' : 'Max 20 characters';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return lang === 'sv' ? 'Bara bokstäver, siffror, _ och -' : 'Only letters, numbers, _ and -';
  }
  const lower = username.toLowerCase();
  const hasBanned = BANNED_WORDS.some(w => lower.includes(w));
  if (hasBanned) {
    return lang === 'sv' ? 'Användarnamnet innehåller otillåtna ord' : 'Username contains prohibited words';
  }
  if (/^[_-]|[_-]$/.test(username)) {
    return lang === 'sv' ? 'Kan inte börja eller sluta med _ eller -' : "Can't start or end with _ or -";
  }
  return null;
};

const SUPPORTED_EMAIL_LANGUAGES = ['sv', 'en', 'no', 'da', 'de'] as const;
type EmailLanguage = typeof SUPPORTED_EMAIL_LANGUAGES[number];

/**
 * Resolves the best language for the welcome email.
 * Priority: app language → browser language → 'en'.
 * Normalizes locale codes (e.g. "sv-SE" → "sv").
 */
function resolveEmailLanguage(appLang: string): EmailLanguage {
  const normalize = (code: string | undefined) =>
    code?.slice(0, 2).toLowerCase() ?? '';
  const supported = (s: string): s is EmailLanguage =>
    (SUPPORTED_EMAIL_LANGUAGES as readonly string[]).includes(s);

  const fromApp = normalize(appLang);
  if (supported(fromApp)) return fromApp;

  const browserLang = typeof navigator !== 'undefined' ? navigator.language : undefined;
  const fromBrowser = normalize(browserLang);
  if (supported(fromBrowser)) return fromBrowser;

  return 'en';
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
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const usernameCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validatePhone = (value: string): string | null => {
    if (!value || !value.trim()) {
      return lang === 'sv' ? 'Telefonnummer krävs' : 'Phone number is required';
    }
    const digits = value.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return lang === 'sv' ? 'Ogiltigt telefonnummer' : 'Invalid phone number';
    }
    return null;
  };

  // Debounced username uniqueness check
  const checkUsernameAvailability = (value: string) => {
    if (usernameCheckTimeout.current) clearTimeout(usernameCheckTimeout.current);
    setUsernameAvailable(null);
    
    const validationError = validateUsername(value, lang);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }
    
    setUsernameError('');
    setCheckingUsername(true);
    
    usernameCheckTimeout.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', value)
          .maybeSingle();
        
        if (error) throw error;
        setUsernameAvailable(!data);
        if (data) {
          setUsernameError(lang === 'sv' ? 'Användarnamnet är redan taget' : 'Username is already taken');
        }
      } catch {
        // Silently fail - server will catch duplicates
      } finally {
        setCheckingUsername(false);
      }
    }, 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validate username + phone for registration (REQUIRED)
    if (mode === 'register') {
      const error = validateUsername(username, lang);
      if (error) {
        setUsernameError(error);
        return;
      }
      if (usernameAvailable === false) {
        setUsernameError(lang === 'sv' ? 'Användarnamnet är redan taget' : 'Username is already taken');
        return;
      }
      const pError = validatePhone(phone);
      if (pError) {
        setPhoneError(pError);
        return;
      }
    }

    // Rate limit check for login
    if (mode === 'login') {
      const { allowed, remainingSeconds } = checkRateLimit();
      if (!allowed) {
        setFormError(
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
      } else if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          logAuthEvent('login_failed', email, { error: error.message });
          if (error.message.includes('Invalid login credentials')) {
            setFormError(lang === 'sv' ? 'Fel e-post eller lösenord' : 'Wrong email or password');
          } else if (error.message.includes('Email not confirmed')) {
            setFormError(lang === 'sv' ? 'Du måste verifiera din e-post först. Kolla din inkorg.' : 'You must verify your email first. Check your inbox.');
          } else {
            setFormError(error.message);
          }
          return;
        }
        resetAttempts();
        logAuthEvent('login', email);
        toast.success(lang === 'sv' ? 'Välkommen tillbaka!' : 'Welcome back!');
        onClose();
      } else {
        const { error } = await signUp(email, password, username, phone);
        if (error) {
          if (error.message.includes('already registered')) {
            setFormError(lang === 'sv' ? 'E-postadressen är redan registrerad. Logga in istället.' : 'Email is already registered. Sign in instead.');
          } else {
            setFormError(error.message);
          }
          return;
        }
        
        // Send welcome email in background using resolved language
        const finalLang = resolveEmailLanguage(language);
        supabase.functions.invoke('send-welcome-email', {
          body: { email, language: finalLang }
        }).catch(err => console.error('Welcome email failed:', err));
        
        logAuthEvent('login', email, { type: 'signup' });
        
        // Show verification message instead of closing
        setSignupEmail(email);
        setSignupComplete(true);
      }
    } catch (error: any) {
      setFormError(error.message || (lang === 'sv' ? 'Ett fel uppstod. Försök igen.' : 'An error occurred. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: 'login' | 'register' | 'forgot') => {
    if (newMode === 'register' && !registrationEnabled) return;
    setMode(newMode);
    setResetSent(false);
    setSignupComplete(false);
    setFormError('');
    setUsernameError('');
    setPhoneError('');
    setUsernameAvailable(null);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSignupComplete(false);
      setResetSent(false);
      setFormError('');
      setUsernameError('');
      setPhoneError('');
      setUsernameAvailable(null);
      setUsername('');
      setPhone('');
    }
  }, [isOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => {
      // Prevent closing during loading or after signup (force user to see verify message)
      if (loading) return;
      if (signupComplete) return; // Don't let user accidentally close before seeing verify info
      if (!open) onClose();
    }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left mb-6">
          <div className="flex items-center gap-3 mb-2">
            {mode === 'forgot' && !resetSent && (
              <button
                type="button"
                onClick={() => handleModeChange('login')}
                className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {mode !== 'forgot' && !signupComplete && (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
            )}
            {!signupComplete && (
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
            )}
          </div>
        </SheetHeader>

        {/* Signup complete - verification message */}
        {signupComplete ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              {lang === 'sv' ? 'Verifieringsmail skickat!' : 'Verification Email Sent!'}
            </h3>
            <p className="text-muted-foreground text-sm mb-2">
              {lang === 'sv' 
                ? 'Vi har skickat en verifieringslänk till:' 
                : 'We sent a verification link to:'}
            </p>
            <p className="font-medium text-sm mb-4">{signupEmail}</p>
            
            <div className="mb-6 p-4 rounded-xl bg-secondary border border-border text-left space-y-2">
              <p className="text-sm font-medium">
                {lang === 'sv' ? 'Nästa steg:' : 'Next steps:'}
              </p>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>{lang === 'sv' ? 'Öppna din e-post' : 'Open your email'}</li>
                <li>{lang === 'sv' ? 'Klicka på verifieringslänken' : 'Click the verification link'}</li>
                <li>{lang === 'sv' ? 'Logga in med ditt konto' : 'Sign in with your account'}</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                {lang === 'sv' ? '💡 Kolla även skräpposten om du inte hittar mailet.' : '💡 Check your spam folder if you can\'t find the email.'}
              </p>
            </div>

            {username && (
              <div className="mb-6 p-3 rounded-xl bg-accent/10 border border-accent/20">
                <p className="text-sm">
                  {lang === 'sv' ? 'Ditt användarnamn:' : 'Your username:'}{' '}
                  <span className="font-semibold">{username}</span>
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSignupComplete(false);
                  handleModeChange('login');
                }}
                className="rounded-xl w-full"
              >
                {lang === 'sv' ? 'Gå till inloggning' : 'Go to login'}
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                className="rounded-xl w-full text-muted-foreground"
              >
                {lang === 'sv' ? 'Stäng' : 'Close'}
              </Button>
            </div>
          </div>
        ) : mode === 'forgot' && resetSent ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-primary" />
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

            {/* Form error banner */}
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{formError}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete={mode === 'login' ? 'on' : 'off'}>
              {/* Username field for registration - REQUIRED */}
              {mode === 'register' && (
                <div>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      name="reg_uname_field"
                      autoComplete="off"
                      placeholder={lang === 'sv' ? 'Användarnamn *' : 'Username *'}
                      value={username}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
                        setUsername(val);
                        setFormError('');
                        if (val) {
                          checkUsernameAvailability(val);
                        } else {
                          setUsernameError(lang === 'sv' ? 'Användarnamn krävs' : 'Username is required');
                          setUsernameAvailable(null);
                        }
                      }}
                      className="pl-11 pr-10 h-12 rounded-xl"
                      maxLength={20}
                      required
                    />
                    {/* Status indicator */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingUsername && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                      {!checkingUsername && usernameAvailable === true && !usernameError && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                      {!checkingUsername && (usernameAvailable === false || usernameError) && username && (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                  </div>
                  {usernameError && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {usernameError}
                    </p>
                  )}
                  {!usernameError && usernameAvailable === true && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {lang === 'sv' ? 'Användarnamnet är tillgängligt' : 'Username is available'}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {lang === 'sv' ? '3–20 tecken: bokstäver, siffror, _ och -' : '3–20 characters: letters, numbers, _ and -'}
                  </p>
                </div>
              )}

              {/* Phone field for registration - REQUIRED */}
              {mode === 'register' && (
                <div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="tel"
                      inputMode="tel"
                      name="reg_phone_field"
                      autoComplete="tel"
                      placeholder={lang === 'sv' ? 'Telefonnummer *' : 'Phone number *'}
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setPhoneError('');
                        setFormError('');
                      }}
                      className="pl-11 h-12 rounded-xl"
                      required
                    />
                  </div>
                  {phoneError && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {phoneError}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {lang === 'sv' ? 'T.ex. 070-123 45 67' : 'E.g. 070-123 45 67'}
                  </p>
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  name={mode === 'login' ? 'login_email' : 'reg_email_field'}
                  autoComplete={mode === 'login' ? 'email' : 'email'}
                  placeholder={lang === 'sv' ? 'E-postadress' : 'Email address'}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFormError(''); }}
                  className="pl-11 h-12 rounded-xl"
                  required
                />
              </div>
              
              {mode !== 'forgot' && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    name={mode === 'login' ? 'login_pass' : 'reg_pass_field'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder={lang === 'sv' ? 'Lösenord' : 'Password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFormError(''); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const form = e.currentTarget.closest('form');
                        if (form) form.requestSubmit();
                      }
                    }}
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

              {/* Remember me + Forgot password */}
              {mode === 'login' && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-border w-4 h-4 accent-primary"
                    />
                    <span className="text-sm text-muted-foreground">
                      {lang === 'sv' ? 'Kom ihåg mig' : 'Remember me'}
                    </span>
                  </label>
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
                disabled={loading || (mode === 'register' && (!!usernameError || !username || checkingUsername || !!phoneError || !phone))}
                className="w-full h-12 rounded-xl font-semibold"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {mode === 'login'
                      ? (lang === 'sv' ? 'Loggar in...' : 'Signing in...')
                      : mode === 'register'
                        ? (lang === 'sv' ? 'Skapar konto...' : 'Creating account...')
                        : (lang === 'sv' ? 'Skickar...' : 'Sending...')}
                  </span>
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
