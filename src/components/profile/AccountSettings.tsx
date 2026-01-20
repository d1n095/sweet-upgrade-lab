import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AccountSettings = () => {
  const { language } = useLanguage();
  const { user, updatePassword } = useAuth();
  
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const content = {
    sv: {
      title: 'Kontoinställningar',
      emailSection: 'Ändra e-postadress',
      emailLabel: 'Ny e-postadress',
      emailPlaceholder: 'din.nya@email.se',
      emailButton: 'Uppdatera e-post',
      emailSuccess: 'Bekräftelsemail skickat! Kontrollera din inkorg.',
      emailError: 'Kunde inte uppdatera e-post. Försök igen.',
      passwordSection: 'Ändra lösenord',
      currentPasswordLabel: 'Nuvarande lösenord',
      newPasswordLabel: 'Nytt lösenord',
      confirmPasswordLabel: 'Bekräfta nytt lösenord',
      passwordButton: 'Uppdatera lösenord',
      passwordSuccess: 'Lösenord uppdaterat!',
      passwordError: 'Kunde inte uppdatera lösenord. Försök igen.',
      passwordMismatch: 'Lösenorden matchar inte',
      passwordTooShort: 'Lösenordet måste vara minst 6 tecken',
      updating: 'Uppdaterar...',
      currentEmail: 'Nuvarande e-post',
    },
    en: {
      title: 'Account Settings',
      emailSection: 'Change Email Address',
      emailLabel: 'New email address',
      emailPlaceholder: 'your.new@email.com',
      emailButton: 'Update Email',
      emailSuccess: 'Confirmation email sent! Check your inbox.',
      emailError: 'Could not update email. Please try again.',
      passwordSection: 'Change Password',
      currentPasswordLabel: 'Current password',
      newPasswordLabel: 'New password',
      confirmPasswordLabel: 'Confirm new password',
      passwordButton: 'Update Password',
      passwordSuccess: 'Password updated!',
      passwordError: 'Could not update password. Please try again.',
      passwordMismatch: 'Passwords do not match',
      passwordTooShort: 'Password must be at least 6 characters',
      updating: 'Updating...',
      currentEmail: 'Current email',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail.trim()) return;

    setIsUpdatingEmail(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });

      if (error) throw error;

      toast.success(t.emailSuccess);
      setNewEmail('');
    } catch (error) {
      console.error('Email update error:', error);
      toast.error(t.emailError);
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error(t.passwordTooShort);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t.passwordMismatch);
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const { error } = await updatePassword(newPassword);

      if (error) throw error;

      toast.success(t.passwordSuccess);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Password update error:', error);
      toast.error(t.passwordError);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{t.emailSection}</h3>
            <p className="text-sm text-muted-foreground">
              {t.currentEmail}: <span className="font-medium">{user?.email}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleEmailUpdate} className="space-y-4">
          <div>
            <Label htmlFor="newEmail">{t.emailLabel}</Label>
            <Input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              className="mt-1.5"
            />
          </div>
          <Button type="submit" disabled={isUpdatingEmail || !newEmail.trim()}>
            {isUpdatingEmail ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t.updating}
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t.emailButton}
              </>
            )}
          </Button>
        </form>
      </motion.div>

      {/* Password Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-accent" />
          </div>
          <h3 className="font-semibold">{t.passwordSection}</h3>
        </div>

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div>
            <Label htmlFor="newPassword">{t.newPasswordLabel}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">{t.confirmPasswordLabel}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button type="submit" disabled={isUpdatingPassword || !newPassword || !confirmPassword}>
            {isUpdatingPassword ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t.updating}
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t.passwordButton}
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default AccountSettings;
