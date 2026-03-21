import { useState } from 'react';
import { Bug, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import { toast } from 'sonner';

const BugReportButton = () => {
  const { user } = useAuth();
  const { hasAccess } = useStaffAccess();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!user || !hasAccess) return null;

  const handleSubmit = async () => {
    if (!description.trim()) { toast.error('Ange en beskrivning'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('bug_reports').insert({
        user_id: user.id,
        page_url: window.location.pathname,
        description: description.trim(),
      });
      if (error) throw error;
      toast.success('Bugg rapporterad ✓');
      setDescription('');
      setOpen(false);
    } catch { toast.error('Kunde inte skicka'); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Rapportera problem">
          <Bug className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bug className="w-4 h-4" /> Rapportera problem</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Sida: {window.location.pathname}</div>
          <Textarea
            placeholder="Beskriv problemet..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
          />
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Skicka rapport
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BugReportButton;
